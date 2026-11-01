+++
number = "17.2"
title = "PII and approval middleware"
lede = "Two guardrails ship with LangChain. PIIMiddleware finds personal data and redacts, masks, hashes or blocks it before the model sees it; HumanInTheLoopMiddleware makes risky tools wait for a person."
summary = "Why personal data must not reach the model, PIIMiddleware's types and four strategies, what the model, the tools and the stored conversation see, testing the strategies without a model, what the detectors catch and miss, custom detectors, input, output and tool results, blocking on an agent with memory, approval as a guardrail, interview questions and a practice task."
type = "concept"
status = "published"
source = "17 Guardrails: langchain_guardrails_crash_course.ipynb (cells 10-20; printouts trimmed, emojis removed, a made-up key in the block test, the reject decision's key fixed); the strategies and detectors run without a model, the stored state, blocking on a saved thread, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["OPENAI_API_KEY"]
+++

Everything in an agent's messages leaves your system on every model call: the provider receives it, traces record it ([lesson 12.1](lesson:12.1)), and a checkpointer stores it ([lesson 9.4](lesson:9.4)). When a user types an email address, a card number or an API key, the value spreads to all of those places, and rules such as the GDPR, HIPAA and PCI DSS restrict where it may go. `PIIMiddleware` (PII: personally identifiable information) finds such values with patterns and deals with them before the model is called. The second built-in guardrail, `HumanInTheLoopMiddleware`, closes the lesson.

## Redact personal data

Load the key first ([lesson 0.3](lesson:0.3)):

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

One middleware per kind of data: emails are redacted, card numbers masked, and anything that looks like an OpenAI key blocks the request.

```python title="Notebook cell"
from langchain.agents import create_agent
from langchain.agents.middleware import PIIMiddleware
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool


# Define a simple dummy tool
@tool
def customer_lookup(query: str) -> str:
    """Look up customer information."""
    return f"Customer record found for query: {query}"


# Create agent with PII Middleware
agent = create_agent(
    model="gpt-4o",
    tools=[customer_lookup],
    middleware=[
        # Redact emails in user input before sending to model
        PIIMiddleware(
            "email",
            strategy="redact",
            apply_to_input=True,
        ),
        # Mask credit cards in user input
        PIIMiddleware(
            "credit_card",
            strategy="mask",
            apply_to_input=True,
        ),
        # Block API keys - raise error if detected
        PIIMiddleware(
            "api_key",
            detector=r"sk-[a-zA-Z0-9]{32}",
            strategy="block",
            apply_to_input=True,
        ),
    ],
)

print("Agent with PII middleware created successfully!")
```

```output real
Agent with PII middleware created successfully!
```

OpenAI retires `gpt-4o` on 14 January 2027 and names `gpt-6-luna` as its replacement. The first argument names the kind of data. Five kinds are built in; any other name, such as `"api_key"`, needs a `detector`. `strategy` says what happens to each match, and `apply_to_input=True`, the default, checks the user's newest message before every model call.

| Type | What its detector matches | Example |
|---|---|---|
| `email` | Text shaped like `name@domain.tld` | `john.doe@example.com` |
| `credit_card` | 16 digits in groups of four, separated by spaces, hyphens or nothing, that pass the Luhn checksum | `5105-1051-0510-5100` |
| `ip` | IPv4 addresses that Python's `ipaddress` accepts | `192.168.1.1` |
| `mac_address` | Six pairs of hex digits joined by `:` or `-` | `00:1A:2B:3C:4D:5E` |
| `url` | Addresses with `http://` or `https://`, and bare ones that start with `www.` or have a path | `https://secret-site.com` |

## What the model sees

```python title="Notebook cell" norun
# Test PII Redaction
result = agent.invoke({
    "messages": [{
        "role": "user",
        "content": "My email is john.doe@example.com and my card is 5105-1051-0510-5100. Can you help me?"
    }]
})

print("=== Agent Response ===")
print(result["messages"][-1].content)
```

```output saved note="answers vary per run"
=== Agent Response ===
I found the customer record associated with the card ending in 5100. How may I assist you further with this information?
```

```python title="Notebook cell" norun
result
```

```output saved note="message metadata and IDs trimmed"
{'messages': [HumanMessage(content='My email is [REDACTED_EMAIL] and my card is ****-****-****-5100. Can you help me?', ...),
  AIMessage(content='', ..., tool_calls=[{'name': 'customer_lookup', 'args': {'query': '****-****-****-5100'}, 'id': 'call_OramGIuVaxnSsOIxTyQpLIrQ', 'type': 'tool_call'}], ...),
  ToolMessage(content='Customer record found for query: ****-****-****-5100', name='customer_lookup', tool_call_id='call_OramGIuVaxnSsOIxTyQpLIrQ', ...),
  AIMessage(content='I found the customer record associated with the card ending in 5100. How may I assist you further with this information?', ...)]}
```

Three things happened:

- **The model never saw the values.** It received `[REDACTED_EMAIL]` and `****-****-****-5100`, and answered from those.
- **Neither did the tool.** The model passed the masked number on, and the stand-in tool "found" a record for it. A real lookup by card number would fail: once a value is replaced, every later step works without it, tools included.
- **The original is gone.** The first message in the result is the redacted one. The middleware returned a copy of the message with the same ID, and `add_messages` swapped it in ([lesson 10.3](lesson:10.3)), so the original text is no longer in the agent's state, nor in its checkpointer when it has one. That is what logs and stores need; it also means nothing later in the run can get the value back.

Each `PIIMiddleware` adds two nodes to the agent's graph, named after its type:

```python title="Notebook cell"
list(agent.get_graph().nodes)
```

```output real
['__start__',
 'model',
 'tools',
 'PIIMiddleware[email].before_model',
 'PIIMiddleware[email].after_model',
 'PIIMiddleware[credit_card].before_model',
 'PIIMiddleware[credit_card].after_model',
 'PIIMiddleware[api_key].before_model',
 'PIIMiddleware[api_key].after_model',
 '__end__']
```

The `before_model` node checks the input before every model call; the `after_model` node checks the reply, and does nothing unless `apply_to_output=True`. Because the type is part of the name and names must be unique, two `PIIMiddleware("email", ...)` in one agent raise `AssertionError: Please remove duplicate middleware instances.`: use one instance with both flags set.

## Block a secret

```python title="Notebook cell"
# Test API Key Blocking
try:
    result = agent.invoke({
        "messages": [{
            "role": "user",
            "content": "Here is my key: sk-abcdefghijklmnopqrstuvwxyz123456"
        }]
    })

except Exception as e:
    print(f"Blocked as expected: {e}")
```

```output real
Blocked as expected: Detected 1 instance(s) of api_key in text content
```

`block` raises `PIIDetectionError` (importable from `langchain.agents.middleware`) in the `before_model` node, so the model is never called and the run ends without a reply. Catch that class rather than every `Exception`, and answer the user yourself; the error's `pii_type` and `matches` say what was found, and `matches` holds the secret itself, so keep it out of your logs.

On an agent with a checkpointer, blocking stops the run, not the storage. The message was saved before the check ran, and because the middleware only checks the newest user message, the next turn on the same thread sends the blocked message to the model with everything else (checked: the second call received the key in full). On agents with memory, prefer `redact` for secrets, or move the user to a new thread after a block; removing a message from a saved thread, and what stays in its older checkpoints, is covered in [lesson 14.2](lesson:14.2).

Patterns only catch what they describe. `sk-[a-zA-Z0-9]{32}` wants exactly 32 letters or digits after `sk-`; OpenAI's newer project keys start `sk-proj-` and contain `-` and `_`, so this pattern lets them through **VERIFY**. Test every pattern against real examples of what it must catch.

## Four strategies, no model needed

A hook is an ordinary method. Call `before_model` with a state dict and it returns the update it would make, without an agent or a model; the second argument, the runtime, isn't used by this middleware, so `None` will do.

```python title="Notebook cell"
from langchain_core.messages import HumanMessage

text = "My email is john.doe@example.com and my card is 5105-1051-0510-5100."
state = {"messages": [HumanMessage(text)]}

for strategy in ["redact", "mask", "hash"]:
    for pii_type in ["email", "credit_card"]:
        update = PIIMiddleware(pii_type, strategy=strategy).before_model(state, None)
        print(f"{strategy:6} {pii_type:11} {update['messages'][0].content}")
```

```output real
redact email       My email is [REDACTED_EMAIL] and my card is 5105-1051-0510-5100.
redact credit_card My email is john.doe@example.com and my card is [REDACTED_CREDIT_CARD].
mask   email       My email is john.doe@****.com and my card is 5105-1051-0510-5100.
mask   credit_card My email is john.doe@example.com and my card is ****-****-****-5100.
hash   email       My email is <email_hash:836f82db> and my card is 5105-1051-0510-5100.
hash   credit_card My email is john.doe@example.com and my card is <credit_card_hash:e5cf1479>.
```

| Strategy | What remains | Use it for |
|---|---|---|
| `redact` (default) | Only the type: `[REDACTED_EMAIL]` | Prompts, logs and stores that never need the value |
| `mask` | Part of the value: a card's last four digits, an email's name before the `@` | Showing a person which card or account is meant |
| `hash` | A token that is the same every time for the same value | Counting or joining by value without keeping it |
| `block` | Nothing: the run stops with `PIIDetectionError` | Secrets that must never be sent |

Two of them keep more than they seem to. A masked email still shows the name, `john.doe@****.com`: masking is for readability, not anonymity. A hash token is the first eight hex digits of an unsalted SHA-256, so anyone with a guess can check it:

```python title="Notebook cell"
import hashlib

hashlib.sha256(b"john.doe@example.com").hexdigest()[:8]
```

```output real
'836f82db'
```

Hashed values are pseudonymous, not anonymous; under the GDPR, pseudonymised data is still personal data.

## What the detectors catch

```python title="Notebook cell"
from langchain.agents.middleware.pii import detect_credit_card, detect_email, detect_ip, detect_url

samples = [
    (detect_credit_card, "4111 1111 1111 1111"),  # a test Visa number
    (detect_credit_card, "4111 1111 1111 1112"),  # one digit changed: fails the Luhn check
    (detect_credit_card, "3782 822463 10005"),    # a test American Express number: 15 digits
    (detect_email, "john dot doe at example dot com"),
    (detect_ip, "2001:db8::1"),                   # an IPv6 address
    (detect_url, "example.com"),
    (detect_url, "example.com/login"),
]
for detect, text in samples:
    found = [m["value"] for m in detect(text)]
    print(f"{detect.__name__:18} {text!r:35} {found}")
```

```output real
detect_credit_card '4111 1111 1111 1111'               ['4111 1111 1111 1111']
detect_credit_card '4111 1111 1111 1112'               []
detect_credit_card '3782 822463 10005'                 []
detect_email       'john dot doe at example dot com'   []
detect_ip          '2001:db8::1'                       []
detect_url         'example.com'                       []
detect_url         'example.com/login'                 ['example.com/login']
```

The detectors are regular expressions plus a check where one exists: the Luhn checksum for cards, Python's `ipaddress` for IP addresses. What doesn't fit the pattern passes: 15-digit American Express numbers, IPv6 addresses, spelled-out emails, bare domains. Names, phone numbers, postal addresses, dates of birth and national ID numbers have no built-in type at all. For those, write your own detector, or call a library that finds such entities with named-entity recognition, such as Microsoft Presidio, from inside one.

## Custom detectors

`detector=` takes a regular expression as a string, as the API-key middleware above does, or a function that receives the text and returns a list of matches, each a dict with `type`, `value`, `start` and `end` (`PIIMatch`). A function can check what its pattern found before reporting it, as the card detector checks Luhn. The practice task below writes one for phone numbers. LangChain's docs also show a compiled pattern, `detector=re.compile(...)`; in langchain 1.4.7 that fails the first time the hook runs, with `TypeError: 're.Pattern' object is not callable`. Pass the pattern as a string, or wrap it in a function.

## Input, output and tool results

| Flag | Default | What it checks | When |
|---|---|---|---|
| `apply_to_input` | `True` | The newest `HumanMessage` | Before every model call |
| `apply_to_output` | `False` | The text of the newest `AIMessage` | After every model call; since langchain 1.3.2 also the streamed tokens |
| `apply_to_tool_results` | `False` | The `ToolMessage`s since the model's last reply | Before the next model call |

- **Only the newest user message is checked.** Earlier ones were checked when they were the newest; a blocked one, as above, is the exception.
- **`apply_to_input` stays on unless you turn it off.** `PIIMiddleware("email", apply_to_output=True)` redacts the user's message too, so the model can't see an address the user asked it to write to ([lesson 17.4](lesson:17.4) runs into this).
- **Output checks cover text, not tool calls.** `apply_to_output` rewrites the reply's text but leaves the arguments of its tool calls alone (checked): a model that puts an address in a `send_email` call sends it. Check arguments around the tool ([lesson 17.3](lesson:17.3)) or put the tool behind approval.
- **Tools bring data in too.** A CRM lookup that returns a customer's email puts it in the conversation; `apply_to_tool_results=True` cleans it before the next model call.

## Approval as a guardrail

[Lesson 9.7](lesson:9.7) explains human approval in full: the pause, the interrupt, the four decisions and resuming. As a guardrail it is the strongest one for actions, because the model only proposes and a person decides. Gate the tools that change things, and let reads run:

```python title="Notebook cell"
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command
from langchain_core.tools import tool


@tool
def search_web(query: str) -> str:
    """Search the web for information."""
    return f"Search results for: {query}"


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to a recipient."""
    return f"Email sent to {to} with subject: {subject}"


@tool
def delete_records(table: str, condition: str) -> str:
    """Delete records from the database."""
    return f"Deleted records from {table} where {condition}"


# Create agent with HITL middleware
hitl_agent = create_agent(
    model="gpt-4o",
    tools=[search_web, send_email, delete_records],
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                "send_email": True,       # Require approval
                "delete_records": True,   # Require approval
                "search_web": False,      # Auto-approve
            }
        ),
    ],
    checkpointer=InMemorySaver(),  # Required for state persistence
)

print("Human-in-the-Loop agent created!")
```

```output real
Human-in-the-Loop agent created!
```

```python title="Notebook cell" norun
# Step 1: Invoke — agent will pause before send_email
config = {"configurable": {"thread_id": "session_001"}}

result = hitl_agent.invoke(
    {"messages": [{"role": "user", "content": "Send an email to team@company.com about the Q4 results"}]},
    config=config
)

print("=== Agent paused — awaiting human approval ===")
print(result)
```

```output saved note="message metadata trimmed and the interrupt shortened"
=== Agent paused — awaiting human approval ===
{'messages': [HumanMessage(content='Send an email to team@company.com about the Q4 results', ...), AIMessage(content='', ..., tool_calls=[{'name': 'send_email', 'args': {'to': 'team@company.com', 'subject': 'Q4 Results', 'body': 'Hello Team,\n\nI hope this message finds you well. I am writing to share the results for Q4. Please review the attached documentation for detailed insights.\n\nBest regards,\n\n[Your Name]'}, 'id': 'call_F70y6jaoPpXgeYUsT7ji5Hny', 'type': 'tool_call'}], ...)], '__interrupt__': [Interrupt(value={'action_requests': [{'name': 'send_email', 'args': {...}, 'description': "Tool execution requires approval\n\nTool: send_email\nArgs: {...}"}], 'review_configs': [...]}, ...)]}
```

The model wrote the whole email, signed "[Your Name]", and promised an attachment that doesn't exist. That is exactly what a reviewer is for.

```python title="Notebook cell" norun
# Step 2: Human reviews and APPROVES
approved_result = hitl_agent.invoke(
    Command(resume={"decisions": [{"type": "approve"}]}),
    config=config   # Same thread_id resumes the paused session
)

print("=== Approved! Final response ===")
print(approved_result["messages"][-1].content)
```

```output saved note="answers vary per run"
=== Approved! Final response ===
I've sent the email to team@company.com about the Q4 results.
```

```python title="Notebook cell" norun
# Step 3: Alternative — Human REJECTS
config2 = {"configurable": {"thread_id": "session_002"}}

hitl_agent.invoke(
    {"messages": [{"role": "user", "content": "Delete all records from the users table where active=false"}]},
    config=config2
)

rejected_result = hitl_agent.invoke(
    Command(resume={"decisions": [{"type": "reject", "message": "Too risky, needs DBA review"}]}),
    config=config2
)

print("=== Rejected! Final response ===")
print(rejected_result["messages"][-1].content)
```

```output saved note="from a run that sent the reason under a 'reason' key, which LangChain ignores"
=== Rejected! Final response ===
It seems that you've decided not to proceed with the deletion. If you have any questions or need further assistance, feel free to ask!
```

A rejection's reason goes under `"message"`. The code this run came from used `"reason"`, which LangChain ignores, so the model was told only that the call was rejected; since LangChain 1.4 that default text adds "The tool was not executed. Do not retry this tool call unless the user explicitly requests it." With `"message"` the model reads "User rejected the tool call for `delete_records` with reason: Too risky, needs DBA review" (checked) and can pass the reason on. Both steps also assume the first `invoke` paused; if the model asks a question instead of calling the tool, there is nothing to resume ([lesson 17.4](lesson:17.4) shows it), so check `"__interrupt__" in result` first, as the loop of [lesson 9.8](lesson:9.8) does.

Approval fits actions that can't be undone or that affect other people, rules too fuzzy to write as code, and processes where a person must sign off by law. It costs time (a pause can last days, so it needs a database checkpointer) and attention: gate too many tools and reviewers stop reading.

## Interview questions

::: check
A support agent must look up orders by card number, but card numbers must not reach the model provider. How do you build it?

Let the model work with tokens and the tool with values. Hash or mask the number before the model call, and have the lookup tool resolve the token on your side, from a table that maps tokens to card numbers, or from data kept outside the messages where tool code can read it and the model can't. Plain redaction breaks the lookup, as the saved run shows: the tool received the masked number.
:::

::: check
Why doesn't `apply_to_output=True` stop an agent from emailing a card number?

Output redaction rewrites the text of the model's reply, not the arguments of its tool calls, and the tool runs with whatever arguments the model wrote. Keep the number from reaching the model at all (input and tool-result redaction), check outgoing arguments in a hook around the tool, and gate external email with approval.
:::

::: check
Redact, mask or hash for chat transcripts you keep for analytics?

Hash when you need to count or join by the same value, such as repeat customers; redact everything else. A hash of a guessable value (an email, a card number) can be reversed by trying candidates, so hashed transcripts are still personal data and need the same protection. Masking is for people reading a screen, and it leaks part of the value.
:::

::: check
Users sometimes paste API keys into your assistant, which has memory, and you use `strategy="block"`. What can still go wrong?

The exception ends the run with no reply, so the application must catch `PIIDetectionError` and answer. The blocked message is already in the thread's saved state, and the next turn sends it to the model, because only the newest message is checked. The pattern may not match current key formats, and logging the error's matches logs the key. Redact instead, or move the user to a new thread, and test the pattern on real formats.
:::

## Practice

::: practice
**Phone numbers.** Write `detect_phone(content)` for numbers such as `+44 7700 900123`, `07700 900123` and `+1 (555) 010-9999`: find candidates with a regular expression, keep those with 10 to 15 digits, and return them as matches. Use it in `PIIMiddleware("phone", detector=detect_phone, strategy="mask")` and test it through `before_model`, without a model.

```python title="Notebook cell"
import re

from langchain.agents.middleware import PIIMatch

PHONE = re.compile(r"\+?\(?\d[\d\s().-]{8,}\d")


def detect_phone(content: str) -> list[PIIMatch]:
    matches = []
    for m in PHONE.finditer(content):
        digits = sum(ch.isdigit() for ch in m.group())
        if 10 <= digits <= 15:
            matches.append({"type": "phone", "value": m.group(), "start": m.start(), "end": m.end()})
    return matches


phone_guard = PIIMiddleware("phone", detector=detect_phone, strategy="mask")
for text in [
    "Call me on +44 7700 900123 tomorrow.",
    "My number is 07700 900123.",
    "US office: +1 (555) 010-9999",
    "Order 1042 ships in 3 days.",
    "The meeting is on 2026-11-05 10:30.",
]:
    update = phone_guard.before_model({"messages": [HumanMessage(text)]}, None)
    print(update["messages"][0].content if update else f"unchanged: {text}")
```

```output real
Call me on ****0123 tomorrow.
My number is ****0123.
US office: ****9999
unchanged: Order 1042 ships in 3 days.
The meeting is on ****5 10:30.
```

`before_model` returns `None` when nothing matched. A custom type is masked to its last four characters. The last line is a false positive: a date and an hour have ten digits too. Tighter patterns, a check of the digits that follow a country code, or a library built for phone numbers would fix it; every pattern trades misses against false alarms.
:::
