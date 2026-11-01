+++
number = "17.4"
title = "Layered guardrails: a healthcare assistant"
lede = "Stack guardrails in one agent: see the order they really run in, build a healthcare assistant with an input filter, PII redaction, approval for bookings and a disclaimer, read what its saved runs reveal, and end with the whole assistant in one script."
summary = "Stacking middleware, the order before, after and wrap hooks run in, a five-layer agent and what its layers get wrong, the healthcare assistant with both fixes, four saved runs and a blocked one, the stack in run order, the guardrails at a glance, the assistant in one script with Gemini, interview questions and two practice tasks."
type = "build"
status = "published"
source = "17 Guardrails: langchain_guardrails_crash_course.ipynb (cells 28-36; emojis removed, printouts trimmed, the filter and the validator fixed as in 17.3); the run order, the blocked request, the stack figure, the one-script assistant with Gemini, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Each guardrail of lessons [17.2](lesson:17.2) and [17.3](lesson:17.3) catches one kind of problem and misses others, so a production agent stacks several: a cheap filter at the door, redaction before every model call, a person before every risky action, a check on every answer. This lesson stacks them, first in a five-layer agent, then in a healthcare assistant whose saved runs show what each layer does and doesn't do, and ends with the assistant as one script.

## Stack them

Every middleware in `middleware=[...]` adds its hooks to the agent's graph. They don't all run top to bottom:

| Hooks | Order | The first middleware in the list |
|---|---|---|
| `before_agent`, `before_model` | List order | Runs first |
| `after_model`, `after_agent` | Reverse list order | Runs last |
| `wrap_model_call`, `wrap_tool_call` | Nested | Is the outermost wrapper |

Think of the list as layers around the model, the first one outermost: a request passes the layers inward in list order and the answer passes them outward in reverse, like nested decorators or a chain of servlet filters. Section 20 of [lesson 5.2](lesson:5.2) runs the same order in plain Python. Here is the five-layer agent, with the two classes of [lesson 17.3](lesson:17.3) (the filter in its fixed form):

```python title="Notebook cell" norun
from langchain.agents import create_agent
from langchain.agents.middleware import PIIMiddleware, HumanInTheLoopMiddleware
from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.tools import tool


@tool
def search_tool(query: str) -> str:
    """Search for information."""
    return f"Search results: {query}"


@tool
def send_email_tool(to: str, body: str) -> str:
    """Send an email."""
    return f"Email sent to {to}"


# Full layered guardrail stack
production_agent = create_agent(
    model="gpt-4o",
    tools=[search_tool, send_email_tool],
    middleware=[
        # Layer 1: Deterministic input filter (before agent)
        ContentFilterMiddleware(banned_keywords=["hack", "exploit", "malware"]),

        # Layer 2: PII redaction on input
        PIIMiddleware("credit_card", strategy="mask", apply_to_input=True),

        # Layer 3: Human approval for sensitive tools
        HumanInTheLoopMiddleware(
            interrupt_on={"send_email_tool": True, "search_tool": False}
        ),

        # Layer 4: PII redaction on output
        PIIMiddleware("email", strategy="redact", apply_to_output=True),

        # Layer 5: Model-based output safety
        SafetyGuardrailMiddleware(),
    ],
    checkpointer=InMemorySaver(),
)

print("Production-grade agent with 5-layer guardrails created!")
```

```output saved note="emoji removed from the printout"
Production-grade agent with 5-layer guardrails created!
```

OpenAI retires `gpt-4o` on 14 January 2027 and names `gpt-6-luna` as its replacement. Its graph, from `get_graph()`, runs the layers in this order: `ContentFilterMiddleware.before_agent`, `PIIMiddleware[credit_card].before_model`, `PIIMiddleware[email].before_model`, `model`, then `PIIMiddleware[email].after_model`, `HumanInTheLoopMiddleware.after_model`, `PIIMiddleware[credit_card].after_model`, then either `tools` and back to the first `before_model` node, or `SafetyGuardrailMiddleware.after_agent` and the end. The comments number the layers 1 to 5, but layers 3 and 4 run the other way round. Three more things to know about this stack, all checked:

- **Layer 4 redacts input too.** `apply_to_input` defaults to `True`, so "Send an email to team@company.com about the Q4 results" reaches the model as "Send an email to [REDACTED_EMAIL] about the Q4 results", and the model has no address to put in its `send_email_tool` call. An agent that must write to addresses its users give needs `apply_to_input=False` on that layer, with the address kept out of logs and traces some other way.
- **Refusals meet layer 5.** Layer 1's jump to `"end"` lands on the `after_agent` hooks, so the safety model judges the filter's own refusal: every blocked request costs a model call after all.
- **Layer 5 needs its fix.** This agent has a checkpointer, so `SafetyGuardrailMiddleware` should return its replacement instead of editing the message ([lesson 17.3](lesson:17.3)).

## A healthcare assistant

A healthcare assistant has to block harmful or off-topic requests, keep patients' email addresses and card numbers away from the model, let a person approve every booking, and add a disclaimer to every answer. Two classes do the custom parts, with the two fixes of [lesson 17.3](lesson:17.3): the filter reads the newest message, and the validator returns its change.

```python title="Notebook cell"
from typing import Any
from langchain.agents.middleware import AgentMiddleware, AgentState, hook_config
from langchain.agents.middleware import PIIMiddleware, HumanInTheLoopMiddleware
from langgraph.runtime import Runtime
from langchain.agents import create_agent
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage


# --- Healthcare-specific content filter ---
class HealthcareSafetyFilter(AgentMiddleware):
    """Block non-medical or harmful requests in a healthcare context."""

    BLOCKED_TOPICS = ["drug synthesis", "self-harm", "suicide method", "weapon", "hack"]

    @hook_config(can_jump_to=["end"])
    def before_agent(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        if not state["messages"]:
            return None

        last_msg = state["messages"][-1]  # the newest request (lesson 17.3)
        if last_msg.type != "human":
            return None

        content = last_msg.content.lower()
        for topic in self.BLOCKED_TOPICS:
            if topic in content:
                return {
                    "messages": [{
                        "role": "assistant",
                        "content": (
                            "I'm a healthcare assistant and can only help with "
                            "medical questions, appointments, and health information. "
                            "If you're in crisis, please call 112 or your local emergency number."
                        )
                    }],
                    "jump_to": "end"
                }
        return None


# --- Medical output validator ---
class MedicalOutputValidator(AgentMiddleware):
    """Ensure all responses include appropriate medical disclaimers."""

    DISCLAIMER = "\n\n*This is general health information, not medical advice. Please consult a qualified healthcare professional.*"

    @hook_config(can_jump_to=["end"])
    def after_agent(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        if not state["messages"]:
            return None

        last_message = state["messages"][-1]
        if not isinstance(last_message, AIMessage):
            return None

        # Add disclaimer if not already present, returned as an update (lesson 17.3)
        if "medical advice" not in last_message.content.lower():
            new_content = last_message.content + self.DISCLAIMER
            return {"messages": [last_message.model_copy(update={"content": new_content})]}

        return None


# --- Healthcare tools ---
@tool
def search_symptoms(symptoms: str) -> str:
    """Search for information about medical symptoms."""
    return f"Symptom information for: {symptoms}. Please consult a doctor for diagnosis."


@tool
def book_appointment(patient_name: str, date: str, doctor: str) -> str:
    """Book a medical appointment."""
    return f"Appointment booked for {patient_name} with Dr. {doctor} on {date}"


@tool
def get_medication_info(medication: str) -> str:
    """Get information about a medication."""
    return f"General info about {medication}. Always follow your doctor's prescription."


# --- Build the healthcare chatbot ---
healthcare_bot = create_agent(
    model="gpt-4o",
    tools=[search_symptoms, book_appointment, get_medication_info],
    middleware=[
        # Guardrail 1: Block harmful/off-topic requests
        HealthcareSafetyFilter(),

        # Guardrail 2: Redact patient PII from inputs
        PIIMiddleware("email", strategy="redact", apply_to_input=True),
        PIIMiddleware("credit_card", strategy="mask", apply_to_input=True),

        # Guardrail 3: Require approval before booking appointments
        HumanInTheLoopMiddleware(
            interrupt_on={
                "book_appointment": True,
                "search_symptoms": False,
                "get_medication_info": False,
            }
        ),

        # Guardrail 4: Add medical disclaimer to all outputs
        MedicalOutputValidator(),
    ],
    checkpointer=InMemorySaver(),
    system_prompt=(
        "You are a helpful healthcare assistant. "
        "You can search for symptoms, medication information, and help book appointments. "
        "Always be empathetic and remind users to consult a doctor for diagnosis."
    )
)

print("Healthcare chatbot with full guardrail stack created!")
```

```output real
Healthcare chatbot with full guardrail stack created!
```

The saved runs below come from the same assistant before the two fixes, which explains some of what they show.

### A medical question

```python title="Notebook cell" norun
# Test 1: Safe medical query
config_t1 = {"configurable": {"thread_id": "healthcare_session_t1"}}

result = healthcare_bot.invoke(
    {"messages": [{"role": "user", "content": "What are symptoms of Type 2 Diabetes?"}]},
    config=config_t1
)

result
```

```output saved note="metadata trimmed; the cell ran twice on this thread, so the state holds two turns, and the second is cut"
{'messages': [HumanMessage(content='What are symptoms of Type 2 Diabetes?', ...),
  AIMessage(content='', ..., tool_calls=[{'name': 'search_symptoms', 'args': {'symptoms': 'Type 2 Diabetes'}, 'id': 'call_LElUXrARIRsGoVAEowpMGfmv', 'type': 'tool_call'}], ...),
  ToolMessage(content='Symptom information for: Type 2 Diabetes. Please consult a doctor for diagnosis.', name='search_symptoms', ...),
  AIMessage(content="Here is some information about the symptoms of Type 2 Diabetes. However, it's important to consult with a doctor for any diagnosis:\n\nCommon symptoms of Type 2 Diabetes include:\n\n1. Increased thirst\n2. Frequent urination, especially at night\n3. Increased hunger\n4. Unplanned weight loss\n5. Fatigue or tiredness\n6. Blurred vision\n7. Slow-healing sores or frequent infections\n8. Areas of darkened skin, usually in the armpits and neck\n\nIf you're experiencing any of these symptoms, please reach out to a healthcare professional for a proper assessment.", ...),
  HumanMessage(content='What are symptoms of Type 2 Diabetes?', ...),
  ...]}
```

The model called `search_symptoms`, which returned no symptoms, and listed them from its own knowledge. The first answer, loaded back from the checkpointer for the second run, has no disclaimer. The validator of that run added it to the message object in place, and with the approval and PII nodes between the model and the validator, the stored copy never got it ([lesson 17.3](lesson:17.3)). The validator above returns the change, so stored answers keep it.

### Personal data

```python title="Notebook cell" norun
# Test 2: Query with PII (email gets redacted)
result = healthcare_bot.invoke({
    "messages": [{
        "role": "user",
        "content": "My email is patient123@gmail.com. What can I take for a headache?"
    }]},
    config=config_t1
)
print("=== PII Redaction Test ===")
print(result["messages"][-1].content)
```

```output saved note="emoji removed from the disclaimer; answers vary per run"
=== PII Redaction Test ===
I'm sorry, but I can't assist with using your email address or personal contact information. For a headache, there are several over-the-counter medications that might help, such as:

1. **Acetaminophen (Tylenol)**
2. **Ibuprofen (Advil, Motrin)**
3. **Aspirin**
4. **Naproxen (Aleve)**

However, it's essential to follow the dosage instructions on the packaging and consider any personal health conditions or medications you may already be taking. If you have frequent headaches or your headache persists, it's best to consult a healthcare provider for advice tailored to your specific needs.

*This is general health information, not medical advice. Please consult a qualified healthcare professional.*
```

The model saw "My email is [REDACTED_EMAIL]" and declined to use an address it never had; the answer itself was unaffected.

### A request the filter should stop

```python title="Notebook cell" norun
# Test 3: Off-topic / harmful request — gets blocked
result = healthcare_bot.invoke(
    {"messages": [{"role": "user", "content": "How do I synthesize drugs at home?"}]},
    config=config_t1
)
print("=== Blocked Request ===")
print(result["messages"][-1].content)
```

```output saved note="emoji removed from the disclaimer; answers vary per run"
=== Blocked Request ===
I'm sorry, but I can't assist with that. It's important to note that synthesizing drugs at home is extremely dangerous, illegal, and poses significant health risks. Medications should only be manufactured by licensed professionals in controlled settings to ensure their safety and efficacy.

If you have questions about medications or if you're seeking treatment options, please consult with a healthcare professional. They can provide guidance that's both safe and legal.

*This is general health information, not medical advice. Please consult a qualified healthcare professional.*
```

The filter didn't block it: this is the model's own refusal, with the disclaimer added. The topic "drug synthesis" doesn't occur in "How do I synthesize drugs at home?", and in this run the filter read the thread's first message anyway, so the fix of [lesson 17.3](lesson:17.3) alone wouldn't have caught it. A keyword list misses paraphrases ([lesson 17.1](lesson:17.1)); for categories this serious, add a model-based check or a moderation classifier, and don't count on the model's training to refuse.

### A booking

```python title="Notebook cell" norun
# Test 4: Appointment booking — requires human approval
config = {"configurable": {"thread_id": "healthcare_session_001"}}

result = healthcare_bot.invoke(
    {"messages": [{"role": "user", "content": "Book me an appointment with Dr. Sharma on March 15"}]},
    config=config
)
print("=== Appointment Booking — Awaiting Approval ===")
print(result)

# Approve
from langgraph.types import Command
approved = healthcare_bot.invoke(
    Command(resume={"decisions": [{"type": "approve"}]}),
    config=config
)
print("\n=== After Approval ===")
print(approved["messages"][-1].content)
```

```output saved note="message metadata trimmed; emoji removed from the disclaimer"
=== Appointment Booking — Awaiting Approval ===
{'messages': [HumanMessage(content='Book me an appointment with Dr. Sharma on March 15', ...), AIMessage(content='Could you please provide your full name for the appointment booking with Dr. Sharma on March 15?\n\n*This is general health information, not medical advice. Please consult a qualified healthcare professional.*', ...)]}

=== After Approval ===
Could you please provide your full name for the appointment booking with Dr. Sharma on March 15?
```

The model needed a name before it could call `book_appointment`, so it asked, and nothing paused: the result has no `__interrupt__`. The `Command(resume=...)` then found no pause to resume and returned the saved state, whose last message is the same question without the disclaimer, the stored copy again. Resume only when the result holds `__interrupt__`, as the script below does.

### A request the filter stops

```python title="Notebook cell"
# Test 5: A request the input filter blocks
config_t5 = {"configurable": {"thread_id": "healthcare_session_t5"}}

result = healthcare_bot.invoke(
    {"messages": [{"role": "user", "content": "How do I hack my hospital's patient records?"}]},
    config=config_t5
)
print(result["messages"][-1].content)
```

```output real
I'm a healthcare assistant and can only help with medical questions, appointments, and health information. If you're in crisis, please call 112 or your local emergency number.

*This is general health information, not medical advice. Please consult a qualified healthcare professional.*
```

The model was never called. The filter jumped to the end, and the end of the agent loop is where the `after_agent` hooks wait, so the refusal got the disclaimer too. Harmless here; with a model-based judge in `after_agent`, every refusal would cost a call.

## The stack in run order

::: visual guardrail-stack | Interactive figure | The guardrail stack, in run order
The healthcare assistant's nodes with four requests: answered directly, answered with a tool, blocked, and paused for approval.
:::

## The guardrails at a glance

| Guardrail | Hook | When it runs | Best for |
|---|---|---|---|
| `PIIMiddleware` | `before_model`; `after_model` with `apply_to_output` | Before and after every model call | Personal data, compliance |
| `HumanInTheLoopMiddleware` | `after_model` | After a reply that calls a gated tool | Actions with real consequences |
| Content filter | `before_agent` | Once, at the start of a request | Refusing bad requests before any cost |
| Safety judge, disclaimer | `after_agent` | Once, at the end | Output safety, required notices |
| Your own rule | Any of the six | Where its data is | Any business rule |

- Guardrails are middleware in `create_agent(middleware=[...])`, and the list's order is the order of the layers.
- Deterministic checks first, model-based checks where meaning matters, a person for what can't be undone.
- Approval needs a checkpointer: `InMemorySaver` while developing, a database checkpointer in production ([lesson 11.5](lesson:11.5)).
- A hook reads the newest message and returns its changes.

## The assistant in one script

The assistant as one terminal program, with Gemini as the model: read it to revise, press **Explain** on it for every step. It needs `GOOGLE_API_KEY` in `.env` ([lesson 6.1](lesson:6.1)) and the packages of [lesson 6.1](lesson:6.1)'s `requirements.txt`; the script uses `langchain`, `langchain-google-genai` and `langgraph`, which `langchain` installs.

```python title="healthcare_assistant.py" explain
"""A healthcare assistant with layered guardrails: an input filter, PII redaction, approval for bookings, a disclaimer."""
import uuid
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    AgentState,
    HumanInTheLoopMiddleware,
    PIIMiddleware,
    hook_config,
)
from langchain.chat_models import init_chat_model
from langchain.tools import tool
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.runtime import Runtime
from langgraph.types import Command

load_dotenv()  # GOOGLE_API_KEY from .env

# 1. Model: one function for every provider (lesson 9.1)
model = init_chat_model("google_genai:gemini-3.5-flash-lite")


# 2. Tools: stand-ins for a symptom database, a booking system and a drug database
@tool
def search_symptoms(symptoms: str) -> str:
    """Search for information about medical symptoms."""
    return f"Symptom information for: {symptoms}. Please consult a doctor for diagnosis."


@tool
def book_appointment(patient_name: str, date: str, doctor: str) -> str:
    """Book a medical appointment."""
    return f"Appointment booked for {patient_name} with Dr. {doctor} on {date}"


@tool
def get_medication_info(medication: str) -> str:
    """Get information about a medication."""
    return f"General info about {medication}. Always follow your doctor's prescription."


# 3. Input guardrail: refuse blocked topics before any model call (lesson 17.3)
class HealthcareSafetyFilter(AgentMiddleware):
    BLOCKED_TOPICS = ["drug synthesis", "self-harm", "suicide method", "weapon", "hack"]
    REFUSAL = (
        "I'm a healthcare assistant and can only help with medical questions, appointments "
        "and health information. If you're in crisis, please call 112 or your local emergency number."
    )

    @hook_config(can_jump_to=["end"])
    def before_agent(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        last = state["messages"][-1]  # the request this run answers
        if last.type == "human" and any(topic in last.text.lower() for topic in self.BLOCKED_TOPICS):
            return {"messages": [{"role": "assistant", "content": self.REFUSAL}], "jump_to": "end"}
        return None


# 4. Output guardrail: every answer ends with a disclaimer, returned as an update (lesson 17.3)
class MedicalOutputValidator(AgentMiddleware):
    DISCLAIMER = (
        "\n\nThis is general health information, not medical advice. "
        "Please consult a qualified healthcare professional."
    )

    def after_agent(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and "medical advice" not in last.text.lower():
            return {"messages": [last.model_copy(update={"content": last.text + self.DISCLAIMER})]}
        return None


# 5. Agent: the guardrails, the tools and a memory per conversation (lessons 17.2, 17.4)
agent = create_agent(
    model=model,
    tools=[search_symptoms, book_appointment, get_medication_info],
    system_prompt=(
        "You are a helpful healthcare assistant. You can search for symptoms, medication "
        "information, and help book appointments. Always be empathetic and remind users "
        "to consult a doctor for diagnosis."
    ),
    middleware=[
        HealthcareSafetyFilter(),
        PIIMiddleware("email", strategy="redact"),
        PIIMiddleware("credit_card", strategy="mask"),
        HumanInTheLoopMiddleware(
            interrupt_on={"book_appointment": {"allowed_decisions": ["approve", "reject"]}}
        ),
        MedicalOutputValidator(),
    ],
    checkpointer=InMemorySaver(),
)


# 6. Review: a person approves or rejects each booking (lesson 9.7)
def review(action: dict) -> dict:
    print(f"\nBook {action['args']}?")
    if input("Approve (y) or reject (n)? ").strip().lower() == "y":
        return {"type": "approve"}
    return {"type": "reject", "message": input("Why not? ")}


def main() -> None:
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}
    print("Healthcare assistant. Type /quit to stop.")
    while True:
        text = input("\nYou: ").strip()
        if text == "/quit":
            break
        if not text:
            continue
        result = agent.invoke({"messages": [{"role": "user", "content": text}]}, config)
        while "__interrupt__" in result:
            requests = result["__interrupt__"][0].value["action_requests"]
            decisions = [review(action) for action in requests]
            result = agent.invoke(Command(resume={"decisions": decisions}), config)
        print(f"Assistant: {result['messages'][-1].text}")


if __name__ == "__main__":
    main()
```

::: walkthrough

The script has three parts. Steps 1 and 2 give the agent a model and three tools. Steps 3 to 5 are the guardrails and the agent that runs them in layers: a filter at the door, redaction before every model call, approval before every booking, a disclaimer on every answer. Step 6 and `main` are the terminal: they read your messages, ask you about each booking, and print the answers.

```python title="Setup" norun
import uuid
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    AgentState,
    HumanInTheLoopMiddleware,
    PIIMiddleware,
    hook_config,
)
from langchain.chat_models import init_chat_model
from langchain.tools import tool
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.runtime import Runtime
from langgraph.types import Command

load_dotenv()  # GOOGLE_API_KEY from .env
```

**Setup.** From `langchain`: the agent factory, the middleware classes (the two built-in guardrails, the base class for your own, `AgentState` and `hook_config` for their hooks), `init_chat_model` and the `tool` decorator. From LangGraph, the library the agent runs on: the checkpointer, `Runtime` for the hooks' signature, and `Command` to resume a paused run. `AIMessage` lets the output guardrail recognise an answer. `load_dotenv()` copies `GOOGLE_API_KEY` from the `.env` file into the environment, so the key never appears in the code.

```python title="Step 1 · Model" norun
model = init_chat_model("google_genai:gemini-3.5-flash-lite")
```

**1. The model.** `init_chat_model` takes `"provider:model"` and returns that provider's chat model class; the `google_genai:` prefix selects the Gemini API rather than Vertex AI. Creating it sends nothing. Gemini 3 models can return `content` as a list of blocks rather than a string, which is why the guardrails below read `.text`: `.content.lower()` would fail on a list. The name is Google's at the time of writing; check Google's model list **VERIFY**.

```python title="Step 2 · Tools" norun
@tool
def search_symptoms(symptoms: str) -> str:
    """Search for information about medical symptoms."""
    return f"Symptom information for: {symptoms}. Please consult a doctor for diagnosis."


@tool
def book_appointment(patient_name: str, date: str, doctor: str) -> str:
    """Book a medical appointment."""
    return f"Appointment booked for {patient_name} with Dr. {doctor} on {date}"


@tool
def get_medication_info(medication: str) -> str:
    """Get information about a medication."""
    return f"General info about {medication}. Always follow your doctor's prescription."
```

**2. Tools.** Each function's name, docstring and typed parameters become the schema the model reads ([lesson 9.3](lesson:9.3)). They stand in for a symptom database, a booking system and a drug database. Two only read; `book_appointment` changes something in the world, which is why step 5 puts it behind approval.

```python title="Step 3 · Input guardrail" norun
class HealthcareSafetyFilter(AgentMiddleware):
    BLOCKED_TOPICS = ["drug synthesis", "self-harm", "suicide method", "weapon", "hack"]
    REFUSAL = (
        "I'm a healthcare assistant and can only help with medical questions, appointments "
        "and health information. If you're in crisis, please call 112 or your local emergency number."
    )

    @hook_config(can_jump_to=["end"])
    def before_agent(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        last = state["messages"][-1]  # the request this run answers
        if last.type == "human" and any(topic in last.text.lower() for topic in self.BLOCKED_TOPICS):
            return {"messages": [{"role": "assistant", "content": self.REFUSAL}], "jump_to": "end"}
        return None
```

**3. The input guardrail.** `before_agent` runs once per message you type, before anything else. It reads the newest message, the one this run answers: with a checkpointer, `state["messages"]` holds the whole conversation. If a blocked topic appears, it returns the refusal as an assistant message and `jump_to: "end"`, which `@hook_config(can_jump_to=["end"])` allows; the model is never called. The keyword list is fast and free, and misses paraphrases such as "synthesize drugs". The jump ends at the `after_agent` hooks, so step 4 still stamps the refusal.

```python title="Step 4 · Output guardrail" norun
class MedicalOutputValidator(AgentMiddleware):
    DISCLAIMER = (
        "\n\nThis is general health information, not medical advice. "
        "Please consult a qualified healthcare professional."
    )

    def after_agent(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and "medical advice" not in last.text.lower():
            return {"messages": [last.model_copy(update={"content": last.text + self.DISCLAIMER})]}
        return None
```

**4. The output guardrail.** `after_agent` runs once, on the final answer. It returns a copy of the answer with the disclaimer appended; the copy has the same ID, so `add_messages` replaces the answer in the state and the checkpointer keeps the version with the disclaimer. `.text` joins Gemini's text blocks into one string. An answer that already says "medical advice" is left alone, so the disclaimer never doubles.

```python title="Step 5 · Agent" norun
agent = create_agent(
    model=model,
    tools=[search_symptoms, book_appointment, get_medication_info],
    system_prompt=(
        "You are a helpful healthcare assistant. You can search for symptoms, medication "
        "information, and help book appointments. Always be empathetic and remind users "
        "to consult a doctor for diagnosis."
    ),
    middleware=[
        HealthcareSafetyFilter(),
        PIIMiddleware("email", strategy="redact"),
        PIIMiddleware("credit_card", strategy="mask"),
        HumanInTheLoopMiddleware(
            interrupt_on={"book_appointment": {"allowed_decisions": ["approve", "reject"]}}
        ),
        MedicalOutputValidator(),
    ],
    checkpointer=InMemorySaver(),
)
```

**5. The agent.** `create_agent` builds the loop of model and tools ([lesson 9.4](lesson:9.4)) and adds one node per hook. On the way in: the filter, then the two `PIIMiddleware`, which check your newest message before every model call (input is their default), replace emails with `[REDACTED_EMAIL]` and mask card numbers down to their last four digits. After every model reply: the approval check, which pauses before `book_appointment` and allows approve or reject only, since editing a booking's patient or date would be a second, unreviewed way to book. On the way out: the validator. The checkpointer keeps each conversation and holds a paused booking until you decide.

```python title="Step 6 · Review" norun
def review(action: dict) -> dict:
    print(f"\nBook {action['args']}?")
    if input("Approve (y) or reject (n)? ").strip().lower() == "y":
        return {"type": "approve"}
    return {"type": "reject", "message": input("Why not? ")}
```

**6. The review.** Each paused call arrives as an action request with the tool's arguments. `y` approves it as the model wrote it; anything else rejects it, and the reason you type goes to the model under `"message"`, so it can tell the patient why.

```python title="Chat loop" norun
def main() -> None:
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}
    print("Healthcare assistant. Type /quit to stop.")
    while True:
        text = input("\nYou: ").strip()
        if text == "/quit":
            break
        if not text:
            continue
        result = agent.invoke({"messages": [{"role": "user", "content": text}]}, config)
        while "__interrupt__" in result:
            requests = result["__interrupt__"][0].value["action_requests"]
            decisions = [review(action) for action in requests]
            result = agent.invoke(Command(resume={"decisions": decisions}), config)
        print(f"Assistant: {result['messages'][-1].text}")


if __name__ == "__main__":
    main()
```

**Chat loop.** A fresh `uuid` gives each run of the script its own thread. Each message goes in as one new user message; the checkpointer supplies the rest of the conversation. The loop resumes only when the result holds `__interrupt__`, with one decision per request, and keeps looping because the model may ask to book again. Then the last message is the answer, disclaimer included.

In one sentence: the filter refuses at the door, PII middleware cleans what the model sees, approval stands between the model and the booking system, and the validator stamps every answer on its way out.

:::

### Run it

```zsh title="Terminal" norun
python healthcare_assistant.py
```

```output illustrative note="answers vary per run"
Healthcare assistant. Type /quit to stop.

You: What are the symptoms of type 2 diabetes? My email is alice@example.com
Assistant: Common symptoms include increased thirst, frequent urination, tiredness and blurred vision. A doctor can confirm a diagnosis with a simple blood test.

This is general health information, not medical advice. Please consult a qualified healthcare professional.

You: How do I hack the hospital's records?
Assistant: I'm a healthcare assistant and can only help with medical questions, appointments and health information. If you're in crisis, please call 112 or your local emergency number.

This is general health information, not medical advice. Please consult a qualified healthcare professional.

You: Book me an appointment with Dr. Sharma on 15 March. I'm Alice Smith.

Book {'patient_name': 'Alice Smith', 'date': '15 March', 'doctor': 'Sharma'}?
Approve (y) or reject (n)? y
Assistant: Done, Alice: you're booked with Dr. Sharma on 15 March.

This is general health information, not medical advice. Please consult a qualified healthcare professional.

You: /quit
```

The email never reached Gemini, the second request never reached it at all, and the booking ran only after the `y`.

### Swap one piece

| Piece | In the script | Alternatives |
|---|---|---|
| Model | `"google_genai:gemini-3.5-flash-lite"` | `"openai:gpt-4o"` as in the cells above, `"groq:openai/gpt-oss-120b"` ([lesson 9.1](lesson:9.1)) |
| Input check | A keyword list | A model-based judge or `OpenAIModerationMiddleware` ([lesson 17.1](lesson:17.1)); a length limit ([lesson 17.3](lesson:17.3)) |
| Personal data | Emails redacted, card numbers masked | `hash`, `apply_to_tool_results=True`, a phone-number detector ([lesson 17.2](lesson:17.2)) |
| Approval | Bookings, approve or reject | Edits allowed, per-call interrupts, a `when` condition ([lesson 9.7](lesson:9.7)) |
| Output check | A disclaimer | The safety judge of [lesson 17.3](lesson:17.3), returning its change (second practice task) |
| Memory | `InMemorySaver` | A database checkpointer, so paused bookings survive a restart ([lesson 11.5](lesson:11.5)) |

## Interview questions

::: check
Your email agent uses `PIIMiddleware("email", strategy="redact", apply_to_output=True)` to keep addresses out of replies, and now it can't email the addresses users give it. Why?

`apply_to_input` defaults to `True`, so the middleware also redacts the user's message before every model call. The model reads "[REDACTED_EMAIL]" and has no address to give the email tool. Set `apply_to_input=False` on that instance, or let the tool resolve the recipient from data the model never sees, and keep addresses out of logs and traces separately.
:::

::: check
How do you test a stack of guardrails before it meets real users?

At three levels. Call each hook with hand-built states, no model needed, as lessons 17.2 and 17.3 do. Run the whole agent with a scripted stand-in model to check the paths: a blocked request makes no model call, a gated tool pauses, the stored answers carry the disclaimer. Then run a set of harmful and harmless requests against the real model, count what is wrongly blocked and wrongly passed, and repeat it on every change of rules, prompts or models; traces show which node acted on each request ([lesson 12.1](lesson:12.1)).
:::

::: check
The healthcare filter let "How do I synthesize drugs at home?" through. What do you change?

The keyword "drug synthesis" doesn't match the paraphrase, and no list of phrases will cover every wording. Keep the list for the obvious cases, and add a check that reads meaning for the categories that matter most: a moderation classifier or a judge prompt in `before_agent` that fails closed. Log what the model refused on its own, since each of those is a request the guardrails missed.
:::

::: check
Patients complain that refusals end with a medical disclaimer. Why does it happen, and how do you stop it?

The filter's jump to `"end"` goes to the end of the agent loop, and the `after_agent` hooks run there, so the validator stamps the refusal too. Mark the refusal, for example with `"name": "guardrail"` in the message the filter returns, and have the validator return `None` for messages with that name.
:::

## Practice

::: practice
**Hook order.** Three middleware: `A` defines `before_agent` and `after_agent`, `B` defines `before_model` and `after_model`, `C` defines `after_model` and `after_agent`. With `middleware=[A, B, C]`, in what order do the hooks and the model run for a request the model answers without tools?

```text title="Order"
A.before_agent
B.before_model
model
C.after_model
B.after_model
C.after_agent
A.after_agent
```

On the way in, list order: `A` first. On the way out, reverse order: `C`, the innermost layer, before `B` for `after_model`, and before `A` for `after_agent`. Checked with stand-in middleware that print their names.
:::

::: practice
**Judge the answers, not the refusals.** Add a model-based safety judge to `healthcare_assistant.py`. It must run before the disclaimer is added, fail closed, and skip the filter's own refusals.

```python title="healthcare_assistant.py (additions)" norun
class SafetyJudge(AgentMiddleware):
    """Model-based output check; skips refusals written by the filter."""

    def __init__(self, judge_model):
        super().__init__()
        self.judge_model = judge_model

    def after_agent(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        last = state["messages"][-1]
        if not isinstance(last, AIMessage) or last.name == "guardrail":
            return None  # the filter's refusal: nothing to judge
        verdict = self.judge_model.invoke(
            "Is this answer from a healthcare assistant safe to show a patient? "
            f"Reply with only SAFE or UNSAFE.\n\n{last.text}"
        ).text.strip().upper()
        if verdict != "SAFE":  # anything but SAFE counts as unsafe
            return {"messages": [last.model_copy(update={"content": "I can't answer that. Please ask a doctor."})]}
        return None


# in HealthcareSafetyFilter.before_agent, name the refusal
            return {"messages": [{"role": "assistant", "content": self.REFUSAL, "name": "guardrail"}], "jump_to": "end"}

# in create_agent, list the judge after the validator so that it runs before it
        MedicalOutputValidator(),
        SafetyJudge(model),
```

`after_agent` hooks run in reverse list order, so the judge, listed last, sees the answer as the model wrote it, and the validator then adds the disclaimer, to a replacement as well. The validator's `model_copy` keeps the refusal's name, and the judge returns early for it, so blocked requests still cost nothing. Checked offline with stand-in middleware: the judge ran before the validator, and a refusal reached both with the name `guardrail`.
:::
