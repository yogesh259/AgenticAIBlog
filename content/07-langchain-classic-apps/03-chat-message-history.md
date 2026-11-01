+++
number = "7.3"
title = "A chatbot with message history"
lede = "A chat model remembers nothing between calls; a chatbot remembers because it sends the conversation again with every message. Keep that history by hand, then let LangChain keep one history per conversation."
summary = "Why chat models forget, a history passed by hand, RunnableWithMessageHistory with a store of sessions, what the wrapper does on each call, a system prompt with MessagesPlaceholder, extra inputs with input_messages_key, the usual errors, and what replaces these classes today."
type = "concept"
status = "published"
source = "7 AI agent with history using langchain: 1-chatbots.ipynb (cells 1-28; model changed, the user's name replaced); memory theory, errors and the LangGraph comparison added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Chat apps feel like a conversation, but a chat model is stateless: every call stands alone, and the model knows only the messages that call sends. A chatbot that remembers your name has simply sent your earlier message again. This lesson builds that memory, first by hand, then with LangChain's history wrapper, which keeps one history per conversation. The chatbot can talk but not act: it has no tools, which agents add in [module 09](module:09).

## How chat memory works

The application, not the model, keeps the conversation:

1. It stores the conversation as a list of messages: instructions, then the user's turns and the model's replies.
2. For each new message it sends the whole list plus the new message, then appends the reply to the list.
3. Each conversation has its own list, found by an ID called a session (or thread) ID, so two users never see each other's messages.
4. The lists live somewhere: a dict in memory for a demo; a database in production, so they survive a restart and every server process sees them.

Resending the history makes every turn cost more than the one before. With turns of about 100 tokens, the 20th call of a chat sends about 2,000 input tokens, and the whole chat about 20,000: the total grows with the square of the number of turns. [Lesson 7.4](lesson:7.4) keeps the history inside a budget.

## Create the model

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

:::: tabs
::: tab Groq
```python title="Notebook cell"
import os
from langchain_groq import ChatGroq

groq_api_key = os.getenv("GROQ_API_KEY")
model = ChatGroq(model="openai/gpt-oss-20b", groq_api_key=groq_api_key)
```

[Lesson 7.1](lesson:7.1) explains the model name. The key stays in its variable; a cell that ends with `groq_api_key` would print it into the notebook.
:::
::: tab Gemini
```python title="Notebook cell" norun
from langchain_google_genai import ChatGoogleGenerativeAI

model = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
```
:::
::: tab OpenAI
```python title="Notebook cell" norun
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o")
```
:::
::: tab Ollama
```python title="Notebook cell" norun
from langchain_ollama import ChatOllama

model = ChatOllama(model="qwen3.5")
```
:::
::::

## Pass the history yourself

```python title="Notebook cell" norun
from langchain_core.messages import HumanMessage

model.invoke([HumanMessage(content="Hi, my name is Alice and I am a software engineer")]).content
```

```output illustrative note="answers vary per run"
"Hello Alice! It's nice to meet you.\n\nAs a software engineer, what kind of projects are you working on these days?\n\nI'm always eager to learn more about the exciting work being done in the field."
```

A new call knows nothing of that one. To continue the conversation, send it again, with the model's reply as an `AIMessage`:

```python title="Notebook cell" norun
from langchain_core.messages import AIMessage

model.invoke(
    [
        HumanMessage(content="Hi, my name is Alice and I am a software engineer"),
        AIMessage(content="Hello Alice! It's nice to meet you.\n\nAs a software engineer, what kind of projects are you working on these days?"),
        HumanMessage(content="Hey, what's my name and what do I do?"),
    ]
).content
```

```output illustrative note="answers vary per run"
"You said your name is Alice and you are a software engineer!\n\nIs there anything else you'd like me to remember about you?"
```

The model answers correctly only because the first exchange is in the request. Keeping such lists for every conversation is what the next class automates.

## Keep a history per session

```python title="Notebook cell"
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

store = {}


def get_session_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]


with_message_history = RunnableWithMessageHistory(model, get_session_history)
```

```output real
DeprecationWarning: `langchain-community` is being sunset and is no longer actively maintained. See https://github.com/langchain-ai/langchain-community/issues/674 for details and migration guidance toward standalone integration packages.
LangChainDeprecationWarning: RunnableWithMessageHistory is deprecated. Use LangGraph's built-in persistence instead.
```

Three pieces:

- `store` maps a session ID to that session's history. It is a plain dict in this notebook, so every history vanishes when the kernel stops.
- `get_session_history` is a factory: given a session ID, it returns that session's history, creating an empty `ChatMessageHistory` the first time. A history object holds `messages` and has `add_messages` and `clear`.
- `RunnableWithMessageHistory(model, get_session_history)` wraps the model: before each call it adds the session's earlier messages; after it, it saves the new ones.

Both are deprecation warnings: these classes still work, but LangChain plans to remove them in version 2.0 (see [What replaced these classes](#what-replaced-these-classes)). `ChatMessageHistory` is another name for `langchain_core.chat_history.InMemoryChatMessageHistory`; importing it from there avoids the first warning.

The session ID travels in the `config` argument ([lesson 7.1](lesson:7.1)):

```python title="Notebook cell"
config = {"configurable": {"session_id": "chat1"}}
```

```python title="Notebook cell" norun
response = with_message_history.invoke(
    [HumanMessage(content="Hi, my name is Alice and I am a software engineer")],
    config=config,
)
response.content
```

```output illustrative note="answers vary per run"
LangChainDeprecationWarning: The class `InMemoryChatMessageHistory` was deprecated in LangChain 1.6.4 and will be removed in 2.0.0 See the short-term memory documentation for recommended alternatives: https://docs.langchain.com/oss/python/langchain/short-term-memory
"Hi Alice!\n\nIt's great to meet you. Being a software engineer is a fascinating role. What kind of projects are you currently working on?"
```

```python title="Notebook cell" norun
with_message_history.invoke(
    [HumanMessage(content="What's my name?")],
    config=config,
).content
```

```output illustrative note="answers vary per run"
'Your name is Alice.\n\nI remember that you introduced yourself at the beginning of our conversation.\n\nIs there anything else I can help you with?'
```

Only the new question was passed in; the wrapper added the first exchange. A different session ID starts from nothing:

```python title="Notebook cell" norun
## change the config --> session id
config1 = {"configurable": {"session_id": "chat2"}}
response = with_message_history.invoke(
    [HumanMessage(content="Whats my name")],
    config=config1,
)
response.content
```

```output saved note="emoji removed; answers vary per run"
"As an AI, I have no memory of past conversations and don't know your name. If you'd like to tell me, I'd be happy to use it!  \n\n"
```

```python title="Notebook cell" norun
response = with_message_history.invoke(
    [HumanMessage(content="Hey My name is John")],
    config=config1,
)
response.content
```

```output saved note="answers vary per run"
"Hi John, it's nice to meet you! \n\nWhat can I do for you today?  \n"
```

```python title="Notebook cell" norun
response = with_message_history.invoke(
    [HumanMessage(content="Whats my name")],
    config=config1,
)
response.content
```

```output saved note="emoji removed; answers vary per run"
'Your name is John!  I remember.  \n\nIs there anything else I can help you with?\n'
```

## What the wrapper does

::: visual history-cycle | Figure | What the history wrapper does on each call
Four steps around every call: find the session, add its history, call the chain, save the new messages.
:::

The store now holds both conversations, each with the user's messages and the replies:

```python title="Notebook cell" norun
for session_id, history in store.items():
    print(session_id, [type(message).__name__ for message in history.messages])
```

```output illustrative note="after the calls above"
chat1 ['HumanMessage', 'AIMessage', 'HumanMessage', 'AIMessage']
chat2 ['HumanMessage', 'AIMessage', 'HumanMessage', 'AIMessage', 'HumanMessage', 'AIMessage']
```

## Add a system prompt

A prompt template gives the chatbot instructions. `MessagesPlaceholder` is a slot for a whole list of messages, here the conversation:

```python title="Notebook cell"
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a helpful assistant. Answer all questions to the best of your ability."),
        MessagesPlaceholder(variable_name="messages"),
    ]
)

chain = prompt | model
```

```python title="Notebook cell"
from langchain_core.messages import HumanMessage

prompt.invoke({"messages": [HumanMessage(content="Hi, my name is Alice")]}).to_messages()
```

```output real
[SystemMessage(content='You are a helpful assistant. Answer all questions to the best of your ability.', additional_kwargs={}, response_metadata={}),
 HumanMessage(content='Hi, my name is Alice', additional_kwargs={}, response_metadata={})]
```

The system message comes first, then every message of the list, history included.

```python title="Notebook cell" norun
chain.invoke({"messages": [HumanMessage(content="Hi, my name is Alice")]}).content
```

```output illustrative note="answers vary per run"
"Hi Alice, it's nice to meet you!\n\nHow can I help you today?"
```

```python title="Notebook cell"
with_message_history = RunnableWithMessageHistory(chain, get_session_history)
```

```output real
LangChainDeprecationWarning: RunnableWithMessageHistory is deprecated. Use LangGraph's built-in persistence instead.
```

```python title="Notebook cell" norun
config = {"configurable": {"session_id": "chat3"}}
response = with_message_history.invoke(
    [HumanMessage(content="Hi, my name is Alice")],
    config=config,
)
response.content
```

```output illustrative note="answers vary per run"
"Hello Alice, it's nice to meet you!\n\nHow can I help you today?"
```

```python title="Notebook cell" norun
response = with_message_history.invoke(
    [HumanMessage(content="What's my name?")],
    config=config,
)
response.content
```

```output illustrative note="answers vary per run"
'Your name is Alice. I remember!\n\nIs there anything else I can help you with?'
```

The chain expects a dict, yet a bare list works here: a prompt with a single variable accepts its value without the dict around it.

## Add more inputs

```python title="Notebook cell"
## Add more complexity

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a helpful assistant. Answer all questions to the best of your ability in {language}.",
        ),
        MessagesPlaceholder(variable_name="messages"),
    ]
)

chain = prompt | model
```

```python title="Notebook cell" norun
response = chain.invoke({"messages": [HumanMessage(content="Hi, my name is Alice")], "language": "Hindi"})
response.content
```

```output illustrative note="answers vary per run"
'नमस्ते ऐलिस!\n\nमुझे आपसे मिलकर अच्छा लगा।\n\nआप क्या करना चाहते हैं?'
```

Now the input is a dict with two keys, so the wrapper must be told which key holds the new messages, to add the history there and to save them afterwards:

```python title="Notebook cell"
with_message_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="messages",
)
```

```python title="Notebook cell" norun
config = {"configurable": {"session_id": "chat4"}}
response = with_message_history.invoke(
    {"messages": [HumanMessage(content="Hi, I am Alice")], "language": "Hindi"},
    config=config,
)
response.content
```

```output illustrative note="answers vary per run"
'नमस्ते ऐलिस!\n\nआप कैसी हैं? क्या मैं आपकी कोई मदद कर सकता हूँ?'
```

```python title="Notebook cell" norun
response = with_message_history.invoke(
    {"messages": [HumanMessage(content="whats my name?")], "language": "Hindi"},
    config=config,
)
response.content
```

```output illustrative note="answers vary per run"
'आपका नाम ऐलिस है।'
```

## Common problems

| Error or symptom | Cause | Fix |
|---|---|---|
| `ValueError: Missing keys ['session_id'] in config['configurable']` | The wrapper was called without a config | Pass `config={"configurable": {"session_id": ...}}` |
| `KeyError: 'input'` | A dict input without `input_messages_key`: the wrapper looks for a key named `input` | `input_messages_key="messages"` |
| `TypeError: Expected mapping type as input to ChatPromptTemplate. Received <class 'list'>.` | A bare list sent to a prompt with two variables | Send a dict with every variable |
| The bot forgets everything after a restart | The histories live in a dict in memory | Keep them in a database |
| The bot forgets things said long ago, or the request fails as too long | The history outgrew the budget or the context window | Trim or summarise it ([lesson 7.4](lesson:7.4)) |
| A user sees another user's conversation | Two users share a session ID | Build session IDs from the user and the conversation |

## What replaced these classes

`RunnableWithMessageHistory` has been deprecated since langchain-core 1.3.3, and `BaseChatMessageHistory` and `InMemoryChatMessageHistory` since 1.6.4; all three are due to be removed in LangChain 2.0. The ideas carry over unchanged to their replacement, LangGraph's persistence:

| Here | Today |
|---|---|
| `RunnableWithMessageHistory` wraps a chain | `create_agent(..., checkpointer=...)` from LangChain 1.0 ([lesson 9.4](lesson:9.4)), or a LangGraph graph compiled with a checkpointer ([lesson 11.5](lesson:11.5)) |
| `store` and `get_session_history` | The checkpointer: `InMemorySaver` for development, a database-backed saver in production |
| `{"configurable": {"session_id": "chat1"}}` | `{"configurable": {"thread_id": "1"}}` |
| The history: a list of messages | The graph's whole state, saved after every step, so a run can also pause and resume ([lesson 14.1](lesson:14.1)) |
| Trimming in the chain ([lesson 7.4](lesson:7.4)) | Trimming or summarising before each model call, for example `SummarizationMiddleware` ([lesson 9.6](lesson:9.6)) |

## Interview questions

::: check
A user complains that the chatbot forgot what they said five minutes ago. What could cause it?

A new session ID on each request (the client doesn't keep it); a server restart with histories in memory; several server processes, each with its own in-memory store; the history saved under one key but read from another (a wrong `input_messages_key` or placeholder name); or trimming that cut the message out of what the model receives ([lesson 7.4](lesson:7.4)). Check what the model actually received, for example in a trace.
:::

::: check
How would you store chat histories for 10,000 concurrent users across several servers?

Outside the servers, in a shared store such as Redis or a SQL database, keyed by user and conversation, so any server can handle any request. Load only what the next call needs (the newest messages, perhaps a summary), use async I/O, and set a retention policy: histories hold personal data, so encrypt them, expire old ones and support deletion. In LangGraph the same job is done by a database-backed checkpointer.
:::

::: check
Why does every turn of a long chat cost more than the one before, and how does the total grow?

Each call resends the whole history plus the new message, so the input grows by about one turn per call. Summed over the conversation that is 1 + 2 + ... + n turns: the total grows with the square of the number of turns, and so do cost and latency. Trimming, summarising or retrieving only relevant turns caps it.
:::

::: check
What is the difference between a session ID here and a thread ID in LangGraph?

They play the same role: a key that selects one conversation's saved history. A LangGraph thread saves more than messages: the graph's whole state after every step, including tool calls and intermediate values, which lets a run resume after an interruption, wait for a human, or be inspected and replayed.
:::

## Practice

::: practice
**Fill a history by hand.** Create an empty session with `get_session_history("demo")`, add a question and an answer with `add_user_message` and `add_ai_message`, and print each message as "role: text". No model needed.

```python title="Notebook cell"
history = get_session_history("demo")
history.add_user_message("What is LCEL?")
history.add_ai_message("The LangChain Expression Language: runnables joined with |.")

for message in history.messages:
    print(f"{message.type}: {message.content}")
print(len(store["demo"].messages))
```

```output real
LangChainDeprecationWarning: The class `InMemoryChatMessageHistory` was deprecated in LangChain 1.6.4 and will be removed in 2.0.0 See the short-term memory documentation for recommended alternatives: https://docs.langchain.com/oss/python/langchain/short-term-memory
human: What is LCEL?
ai: The LangChain Expression Language: runnables joined with |.
2
```

The wrapper does exactly this after each call, with `add_messages`. `message.type` is the short role name: `human`, `ai` or `system`.
:::

::: practice
**Save a history to a file.** Turn the `demo` session's messages into JSON with `messages_to_dict`, write them to `history.json`, read the file back with `messages_from_dict`, and check that the result equals the original. No model needed.

```python title="Notebook cell"
import json
from pathlib import Path

from langchain_core.messages import messages_from_dict, messages_to_dict

Path("history.json").write_text(json.dumps(messages_to_dict(store["demo"].messages), indent=2))
restored = messages_from_dict(json.loads(Path("history.json").read_text()))
print(restored == store["demo"].messages)
print(restored[0])
```

```output real
True
content='What is LCEL?' additional_kwargs={} response_metadata={}
```

Each message becomes a dict with its `type` and its data, which any database can store. Loading every session's file at start and saving it after each call is a first step toward histories that survive a restart.
:::
