+++
number = "9.8"
title = "An agent in one script"
lede = "The whole module in one Python file: an email assistant on Gemini that reads the inbox with tools, asks you before it sends anything, remembers the conversation and summarises it when it grows. Read the script to revise; press Explain on it for every step explained."
summary = "A complete agent in one script: model, tools, system prompt, summarisation and approval middleware, checkpointer, and a chat loop that resumes after each decision; how to run it, which line changes for each alternative, and practice tasks."
type = "build"
status = "published"
source = "Summary of this module: 9 LangChain Updated: 1-langchainintro.ipynb, 3-tools.ipynb and 6-middleware.ipynb (the email tools and both middleware) with Gemini; the inbox, the chat loop and the terminal review added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["GOOGLE_API_KEY"]
+++

Lessons 9.1 to 9.7 covered the parts of a LangChain 1 agent: a model, messages, tools, the agent loop with its memory, structured output and middleware. This lesson puts them together in one script, with Gemini as the model: an email assistant that can read the inbox freely but must ask you before sending. It is the page to come back to for the syntax.

## Before you run it

- `GOOGLE_API_KEY` in your `.env` file, created in Google AI Studio ([lesson 6.1](lesson:6.1)).
- The packages of [lesson 6.1](lesson:6.1)'s `requirements.txt`; the script uses `langchain`, `langchain-google-genai` and `langgraph`, which `langchain` installs.

## The script

```python title="email_agent.py" explain
"""An email assistant: reads the inbox, asks before sending, summarises long conversations."""
import uuid

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware, SummarizationMiddleware
from langchain.chat_models import init_chat_model
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

load_dotenv()  # GOOGLE_API_KEY from .env

# 1. Model: one function for every provider (lesson 9.1)
model = init_chat_model("google_genai:gemini-3.5-flash-lite")

# 2. Tools: functions the model may ask for (lesson 9.3)
INBOX = {
    "1": {"sender": "alice@example.com", "subject": "Meeting moved", "body": "Can we move tomorrow's meeting to 3 pm?"},
    "2": {"sender": "bob@example.com", "subject": "Invoice 1042", "body": "Please confirm you received invoice 1042."},
}


@tool
def read_email_tool(email_id: str) -> str:
    """Read an email from the inbox by its ID."""
    email = INBOX.get(email_id)
    if email is None:
        return f"No email with ID {email_id}. Valid IDs: {', '.join(INBOX)}"
    return f"From: {email['sender']}\nSubject: {email['subject']}\n\n{email['body']}"


@tool
def send_email_tool(recipient: str, subject: str, body: str) -> str:
    """Send an email."""
    return f"Email sent to {recipient} with subject '{subject}'"


# 3. Agent: the loop, its memory and its middleware (lessons 9.4, 9.6, 9.7)
agent = create_agent(
    model=model,
    tools=[read_email_tool, send_email_tool],
    system_prompt=(
        "You are an email assistant. The inbox has emails with IDs "
        f"{', '.join(INBOX)}. Read an email before you reply to it. Keep replies short."
    ),
    middleware=[
        SummarizationMiddleware(model=model, trigger=("tokens", 4000), keep=("messages", 10)),
        HumanInTheLoopMiddleware(
            interrupt_on={"send_email_tool": {"allowed_decisions": ["approve", "edit", "reject"]}}
        ),
    ],
    checkpointer=InMemorySaver(),
)


# 4. Review: one decision per paused tool call (lesson 9.7)
def ask_decision(action: dict) -> dict:
    print(f"\nApprove {action['name']}? {action['args']}")
    choice = input("Approve (y), edit the body (e) or reject (n)? ").strip().lower()
    if choice == "y":
        return {"type": "approve"}
    if choice == "e":
        args = {**action["args"], "body": input("New body: ")}
        return {"type": "edit", "edited_action": {"name": action["name"], "args": args}}
    return {"type": "reject", "message": input("Why not? ")}


def main() -> None:
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}
    print("Email assistant. Type /quit to stop.")
    while True:
        text = input("\nYou: ").strip()
        if text == "/quit":
            break
        if not text:
            continue
        result = agent.invoke({"messages": [{"role": "user", "content": text}]}, config)
        while "__interrupt__" in result:
            requests = result["__interrupt__"][0].value["action_requests"]
            decisions = [ask_decision(action) for action in requests]
            result = agent.invoke(Command(resume={"decisions": decisions}), config)
        print(f"Assistant: {result['messages'][-1].text}")


if __name__ == "__main__":
    main()
```

::: walkthrough

The script has four parts. Steps 1 and 2 give the agent a model and two tools. Step 3 builds the agent: the loop that calls the model and runs tools, a checkpointer that remembers the conversation, and two middleware that shorten it and pause before sending. Step 4 and `main` are the terminal: they read your messages, ask you about each email before it goes out, and print the answers.

```python title="Setup" norun
import uuid

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware, SummarizationMiddleware
from langchain.chat_models import init_chat_model
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

load_dotenv()  # GOOGLE_API_KEY from .env
```

**Setup.** The agent pieces come from `langchain`: `create_agent`, the middleware, `init_chat_model` and the `tool` decorator. Two come from LangGraph, the library the agent runs on: the checkpointer that saves its state and `Command`, which resumes a paused run. `load_dotenv()` copies `GOOGLE_API_KEY` from the `.env` file into the environment, where the Gemini class finds it, so the key never appears in the code.

```python title="Step 1 · Model" norun
model = init_chat_model("google_genai:gemini-3.5-flash-lite")
```

**1. The model.** `init_chat_model` takes `"provider:model"` and returns that provider's chat model class, here `ChatGoogleGenerativeAI`; changing provider means changing this string and installing the provider's package. Creating it sends nothing. The prefix matters: without `google_genai:`, LangChain currently guesses Vertex AI for a `gemini` name, a different Google service with different credentials. A small, fast model suits an agent that makes several calls per question; the name is Google's at the time of writing, so check Google's model list **VERIFY**.

```python title="Step 2 · Tools" norun
INBOX = {
    "1": {"sender": "alice@example.com", "subject": "Meeting moved", "body": "Can we move tomorrow's meeting to 3 pm?"},
    "2": {"sender": "bob@example.com", "subject": "Invoice 1042", "body": "Please confirm you received invoice 1042."},
}


@tool
def read_email_tool(email_id: str) -> str:
    """Read an email from the inbox by its ID."""
    email = INBOX.get(email_id)
    if email is None:
        return f"No email with ID {email_id}. Valid IDs: {', '.join(INBOX)}"
    return f"From: {email['sender']}\nSubject: {email['subject']}\n\n{email['body']}"


@tool
def send_email_tool(recipient: str, subject: str, body: str) -> str:
    """Send an email."""
    return f"Email sent to {recipient} with subject '{subject}'"
```

**2. Tools.** `@tool` turns each function into a tool: its name, docstring and typed parameters become the schema the model reads to decide when and how to call it. The model never runs a tool; it replies with a tool call, a name and arguments, and the agent runs the function. `INBOX` stands in for a mail server, and the sending tool only reports what it would send. An unknown ID returns a message listing the valid ones rather than raising, so the model can correct itself; an exception would end the run.

```python title="Step 3 · Agent" norun
agent = create_agent(
    model=model,
    tools=[read_email_tool, send_email_tool],
    system_prompt=(
        "You are an email assistant. The inbox has emails with IDs "
        f"{', '.join(INBOX)}. Read an email before you reply to it. Keep replies short."
    ),
    middleware=[
        SummarizationMiddleware(model=model, trigger=("tokens", 4000), keep=("messages", 10)),
        HumanInTheLoopMiddleware(
            interrupt_on={"send_email_tool": {"allowed_decisions": ["approve", "edit", "reject"]}}
        ),
    ],
    checkpointer=InMemorySaver(),
)
```

**3. The agent.** `create_agent` builds the loop: call the model with the system prompt and the messages; if the reply asks for tools, run them, add their results and call the model again; stop when the reply is a plain answer. The system prompt is sent first on every call but not stored with the messages. The checkpointer saves the conversation after every step under a thread ID, so each question continues the same conversation. `SummarizationMiddleware` checks the history before every model call: past about 4,000 tokens, the model summarises the older part and only the newest 10 messages are kept beside the summary. `HumanInTheLoopMiddleware` checks every model reply: if it asks for `send_email_tool`, the run stops before the tool runs and returns the request, and the checkpointer holds the paused state until a decision arrives. Reading needs no approval, since tools left out of `interrupt_on` never pause.

```python title="Step 4 · Review" norun
def ask_decision(action: dict) -> dict:
    print(f"\nApprove {action['name']}? {action['args']}")
    choice = input("Approve (y), edit the body (e) or reject (n)? ").strip().lower()
    if choice == "y":
        return {"type": "approve"}
    if choice == "e":
        args = {**action["args"], "body": input("New body: ")}
        return {"type": "edit", "edited_action": {"name": action["name"], "args": args}}
    return {"type": "reject", "message": input("Why not? ")}
```

**4. The review.** Each paused call comes as an action request with the tool's name and arguments. `ask_decision` shows it and returns one decision: approve runs the call as the model wrote it; edit runs it with a new body and the other arguments unchanged; reject skips it and tells the model why, so it can explain to you or try something else.

```python title="Chat loop" norun
def main() -> None:
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}
    print("Email assistant. Type /quit to stop.")
    while True:
        text = input("\nYou: ").strip()
        if text == "/quit":
            break
        if not text:
            continue
        result = agent.invoke({"messages": [{"role": "user", "content": text}]}, config)
        while "__interrupt__" in result:
            requests = result["__interrupt__"][0].value["action_requests"]
            decisions = [ask_decision(action) for action in requests]
            result = agent.invoke(Command(resume={"decisions": decisions}), config)
        print(f"Assistant: {result['messages'][-1].text}")


if __name__ == "__main__":
    main()
```

**Chat loop.** A fresh `uuid` gives each run of the script its own thread. Each message is passed as a single new user message; the checkpointer supplies the rest of the conversation. When `invoke` returns with `__interrupt__`, the run is paused: the loop collects one decision per request, in order, and resumes the same thread with `Command(resume=...)`. It loops because the model may ask to send again after the first email. When there is no interrupt, the last message is the model's answer, and `.text` gives its text whatever form the content takes.

In one sentence: the agent loops model and tools on a saved thread, middleware shortens the history before each model call and stops before each email, and the script resumes it with your decision.

:::

## Run it

```zsh title="Terminal" norun
python email_agent.py
```

```output illustrative note="the answers vary per run"
Email assistant. Type /quit to stop.

You: What's in email 1?
Assistant: Alice asks whether tomorrow's meeting can move to 3 pm.

You: Tell her that works for me.

Approve send_email_tool? {'recipient': 'alice@example.com', 'subject': 'Re: Meeting moved', 'body': '3 pm works for me.'}
Approve (y), edit the body (e) or reject (n)? e
New body: 3 pm works for me. See you then.
Assistant: Done: I replied to Alice that 3 pm works.

You: Now confirm Bob's invoice.

Approve send_email_tool? {'recipient': 'bob@example.com', 'subject': 'Re: Invoice 1042', 'body': 'I confirm receipt of invoice 1042.'}
Approve (y), edit the body (e) or reject (n)? n
Why not? Finance confirms invoices, not me.
Assistant: Understood, I didn't send it. Finance will need to confirm invoice 1042.

You: /quit
```

The first question needed only the reading tool, so it ran without a pause. "Tell her" worked because the checkpointer kept the first exchange. For Bob's invoice the model read email 2 on its own before proposing a reply, as the system prompt asks.

## Swap one piece

| Part | In the script | Alternatives |
|---|---|---|
| Model | `"google_genai:gemini-3.5-flash-lite"` | `"openai:gpt-5"`, `"groq:openai/gpt-oss-120b"` ([9.1](lesson:9.1)) |
| Memory | `InMemorySaver()` | A database checkpointer such as `SqliteSaver`, so threads survive restarts |
| Shortening the history | `SummarizationMiddleware` | Trimming in a `before_model` hook, or a `("fraction", 0.7)` trigger ([9.6](lesson:9.6)) |
| Approval | Batched decisions for one tool | `True` for all decisions, a `when` condition, `interrupt_mode="per_call"` ([9.7](lesson:9.7)) |
| Answer format | Text | A Pydantic `response_format` ([9.5](lesson:9.5)) |

The same memory with the classic API is the chatbot of [lesson 7.5](lesson:7.5).

## Practice

::: practice
**Start a new conversation.** Add a `/new` command that starts a fresh thread, so the assistant forgets the conversation without restarting the script.

```python title="email_agent.py (in the loop, before the empty-text check)" norun
        if text == "/new":
            config = {"configurable": {"thread_id": str(uuid.uuid4())}}
            print("New conversation.")
            continue
```

A new thread ID means an empty history: the checkpointer still holds the old thread, but nothing points to it any more.
:::

::: practice
**Gate another tool.** Add a `delete_email_tool(email_id)` that removes an email from `INBOX`, and make it pause for approve or reject only: editing the ID of a deletion would be a second way to delete.

```python title="email_agent.py" norun
@tool
def delete_email_tool(email_id: str) -> str:
    """Delete an email from the inbox by its ID."""
    if INBOX.pop(email_id, None) is None:
        return f"No email with ID {email_id}."
    return f"Deleted email {email_id}."


# in create_agent
    tools=[read_email_tool, send_email_tool, delete_email_tool],
# in HumanInTheLoopMiddleware
            interrupt_on={
                "send_email_tool": {"allowed_decisions": ["approve", "edit", "reject"]},
                "delete_email_tool": {"allowed_decisions": ["approve", "reject"]},
            }
```

`ask_decision` needs no change for approve and reject. If the reviewer types `e` for a deletion, resuming raises `ValueError: ... Decision type 'edit' is not allowed for tool 'delete_email_tool'`, which ends the script. The allowed decisions travel with each pause, in `result["__interrupt__"][0].value["review_configs"]`; offer only those.
:::
