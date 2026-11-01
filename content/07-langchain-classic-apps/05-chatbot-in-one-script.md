+++
number = "7.5"
title = "A chatbot in one script"
lede = "The whole module in one Python file: a terminal chatbot with Gemini that keeps one history per conversation, trims what it sends, and streams its answers. Read the script to revise; press Explain on it for every step explained."
summary = "A complete chatbot with memory in one script: prompt with a placeholder, trimmer, LCEL chain, history wrapper and streamed answers, how to run it, and which line changes for each alternative."
type = "build"
status = "published"
source = "Summary of this module: 7 AI agent with history using langchain: 1-chatbots.ipynb (prompt, trimmer, history wrapper) with Gemini as in 5 OpenAI and Ollama: 1.1-openai/1.1.1-GettingStarted.ipynb (cell 4); the chat loop, streaming and session switching added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["GOOGLE_API_KEY"]
+++

Lessons 7.1 to 7.4 built chains from runnables, served one, and gave a chatbot a memory and a budget. This lesson puts the chatbot in one script, with Gemini as the model, so it can be read, run and remembered as a whole; it is the page to come back to for the syntax.

## Before you run it

- `GOOGLE_API_KEY` in your `.env` file, created in Google AI Studio ([lesson 6.1](lesson:6.1)).
- The packages of [lesson 6.1](lesson:6.1)'s `requirements.txt`; the script uses `langchain-google-genai` and `langchain-core`.

## The script

```python title="chatbot.py" explain
"""A terminal chatbot with Gemini: one history per conversation, trimmed to a budget, answers streamed."""
import sys
from operator import itemgetter

from dotenv import load_dotenv
from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory
from langchain_core.messages import HumanMessage, trim_messages
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()  # GOOGLE_API_KEY from .env

# 1. Model: messages in, an AIMessage out (lesson 6.1)
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")

# 2. Prompt: instructions, then the conversation so far (lesson 7.3)
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a helpful assistant. Answer in {language}, in at most three sentences."),
        MessagesPlaceholder(variable_name="messages"),
    ]
)

# 3. Trimmer: the newest messages that fit about 1,000 tokens (lesson 7.4)
trimmer = trim_messages(
    max_tokens=1000,
    strategy="last",
    token_counter="approximate",
    include_system=True,
    start_on="human",
)

# 4. Chain: trim the messages, fill the prompt, call the model, keep the text (lesson 7.1)
chain = (
    RunnablePassthrough.assign(messages=itemgetter("messages") | trimmer)
    | prompt
    | llm
    | StrOutputParser()
)

# 5. Memory: one history per session ID, kept in this process (lesson 7.3)
store: dict[str, BaseChatMessageHistory] = {}


def get_session_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in store:
        store[session_id] = InMemoryChatMessageHistory()
    return store[session_id]


chatbot = RunnableWithMessageHistory(chain, get_session_history, input_messages_key="messages")


def main() -> None:
    language = sys.argv[1] if len(sys.argv) > 1 else "English"
    session_id = "default"
    print("Type /session NAME to switch conversations, /quit to stop.")
    print(f"{len(get_session_history(session_id).messages)} messages in {session_id!r}")
    while True:
        text = input(f"[{session_id}] You: ").strip()
        if text == "/quit":
            break
        if text.startswith("/session "):
            session_id = text.removeprefix("/session ").strip()
            print(f"{len(get_session_history(session_id).messages)} messages in {session_id!r}")
            continue
        if not text:
            continue
        config = {"configurable": {"session_id": session_id}}
        print("Bot: ", end="", flush=True)
        for chunk in chatbot.stream({"messages": [HumanMessage(content=text)], "language": language}, config=config):
            print(chunk, end="", flush=True)
        print()


if __name__ == "__main__":
    main()
```

::: walkthrough

The script has three parts. Steps 1 to 4 build one chain that answers from a list of messages. Step 5 wraps it so that each conversation keeps its own history. `main` is the chat loop that reads your messages and prints the answers as they arrive.

```python title="Setup" norun
import sys
from operator import itemgetter

from dotenv import load_dotenv
from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory
from langchain_core.messages import HumanMessage, trim_messages
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()  # GOOGLE_API_KEY from .env
```

**Setup.** Everything but the model comes from `langchain_core`, the package every LangChain integration builds on: messages, prompts, parsers, runnables and the chat history classes. The model comes from its provider's package, `langchain_google_genai`. `load_dotenv()` copies `GOOGLE_API_KEY` from the `.env` file into the environment, where the Gemini class finds it, so the key never appears in the code.

```python title="Step 1 · Model" norun
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
```

**1. The model.** A chat model takes a list of messages and returns an `AIMessage` with the answer. Creating it sends nothing; calls happen later, once per user message. A model is stateless: it remembers nothing between calls, so everything it should know about the conversation must be in the messages of each call, and keeping those messages is the job of steps 3 and 5. Any chat model with the same interface fits here: `ChatGroq`, `ChatOpenAI` or a local `ChatOllama`.

```python title="Step 2 · Prompt" norun
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a helpful assistant. Answer in {language}, in at most three sentences."),
        MessagesPlaceholder(variable_name="messages"),
    ]
)
```

**2. The prompt.** The system message sets the bot's behaviour for the whole conversation; `{language}` is filled from the input on each call. `MessagesPlaceholder` is a slot for a whole list of messages: the earlier conversation plus the new message, in order. The prompt therefore takes a dict with two keys, `language` and `messages`, and returns the finished list: the system message first, then the conversation.

```python title="Step 3 · Trimmer" norun
trimmer = trim_messages(
    max_tokens=1000,
    strategy="last",
    token_counter="approximate",
    include_system=True,
    start_on="human",
)
```

**3. The trimmer.** Without a limit, the history grows with every turn, and every call resends all of it: slower, costlier, and eventually too long for the model. The trimmer keeps the newest messages that fit 1,000 tokens (`strategy="last"`), keeps a leading system message, and makes the kept part start with a user message (`start_on="human"`). `token_counter="approximate"` counts locally, about 4 characters per token; asking Gemini to count would cost one API request per message on every turn. Trimming changes only what is sent: older messages stay in the history, but the model no longer sees them, so a fact mentioned long ago can be forgotten.

```python title="Step 4 · Chain" norun
chain = (
    RunnablePassthrough.assign(messages=itemgetter("messages") | trimmer)
    | prompt
    | llm
    | StrOutputParser()
)
```

**4. The chain.** `|` joins runnables into one: each step's output is the next step's input, and the result has the same `invoke` and `stream` methods as its parts. The first step takes the input dict, replaces its `messages` with the trimmed list (`itemgetter("messages")` picks the list out, `trimmer` shortens it) and passes `language` through unchanged. The prompt turns the dict into messages, the model answers, and `StrOutputParser` returns the answer's text, piece by piece when streaming.

```python title="Step 5 · Memory" norun
store: dict[str, BaseChatMessageHistory] = {}


def get_session_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in store:
        store[session_id] = InMemoryChatMessageHistory()
    return store[session_id]


chatbot = RunnableWithMessageHistory(chain, get_session_history, input_messages_key="messages")
```

**5. Memory.** `store` maps a session ID to that conversation's history, and `get_session_history` returns it, creating an empty one the first time. `RunnableWithMessageHistory` wraps the chain: on each call it reads the session ID from the config, puts that session's stored messages before the new ones under `messages` (`input_messages_key`), runs the chain, then saves the new message and the reply in the store. The store is a dict in this process, so the histories vanish when the script ends; a server would keep them in a database. Both classes print a deprecation warning: LangChain plans to remove them in version 2.0, in favour of LangGraph's checkpointers, which do the same job with a `thread_id` ([lesson 11.5](lesson:11.5)).

```python title="Chat loop" norun
def main() -> None:
    language = sys.argv[1] if len(sys.argv) > 1 else "English"
    session_id = "default"
    print("Type /session NAME to switch conversations, /quit to stop.")
    print(f"{len(get_session_history(session_id).messages)} messages in {session_id!r}")
    while True:
        text = input(f"[{session_id}] You: ").strip()
        if text == "/quit":
            break
        if text.startswith("/session "):
            session_id = text.removeprefix("/session ").strip()
            print(f"{len(get_session_history(session_id).messages)} messages in {session_id!r}")
            continue
        if not text:
            continue
        config = {"configurable": {"session_id": session_id}}
        print("Bot: ", end="", flush=True)
        for chunk in chatbot.stream({"messages": [HumanMessage(content=text)], "language": language}, config=config):
            print(chunk, end="", flush=True)
        print()


if __name__ == "__main__":
    main()
```

**Chat loop.** `python chatbot.py French` answers in French; without an argument, in English. Each message you type becomes one `HumanMessage`; only the new message is passed in, since the wrapper adds the history. The session ID travels in `config["configurable"]`, which reaches every step of the chain, and `/session NAME` switches to another conversation: a new name starts empty, an old one continues where it stopped. `stream` yields the answer's text in pieces as the model writes it; `end=""` and `flush=True` print each piece at once, so the answer appears word by word. When the stream ends, the wrapper saves the whole reply. `if __name__ == "__main__":` runs the loop only when the file is run as a script, not when another file imports `chatbot`.

In one sentence: the model is stateless, so the app keeps each conversation, sends a trimmed window of it with every message, and saves the reply.

:::

The chat model name is Google's at the time of writing; check it in Google's model list **VERIFY**, since Google retires older models.

## Run it

```zsh title="Terminal" norun
python chatbot.py
```

```output illustrative note="the answers vary per run; the warnings' file path is shortened"
sys:1: LangChainDeprecationWarning: RunnableWithMessageHistory is deprecated. Use LangGraph's built-in persistence instead.
Type /session NAME to switch conversations, /quit to stop.
chatbot.py:50: LangChainDeprecationWarning: The class `InMemoryChatMessageHistory` was deprecated in LangChain 1.6.4 and will be removed in 2.0.0 See the short-term memory documentation for recommended alternatives: https://docs.langchain.com/oss/python/langchain/short-term-memory
  store[session_id] = InMemoryChatMessageHistory()
0 messages in 'default'
[default] You: Hi, I'm Alice and I'm learning LangChain.
Bot: Nice to meet you, Alice! LangChain is a good place to start building apps on language models. What would you like to learn first?
[default] You: What's my name?
Bot: Your name is Alice.
[default] You: /session work
0 messages in 'work'
[work] You: What's my name?
Bot: I don't know your name yet: you haven't told me in this conversation.
[work] You: /session default
4 messages in 'default'
[default] You: /quit
```

The two warnings appear once each, when the wrapper is created and when the first history is. The `work` session knows nothing of `default`, and `default` still holds its four messages: two questions and two replies.

## Swap one piece

| Step | In the script | Alternatives |
|---|---|---|
| Model | `ChatGoogleGenerativeAI(...)` | `ChatGroq(model="openai/gpt-oss-20b")` ([7.1](lesson:7.1)), `ChatOpenAI(model="gpt-4o")` ([6.1](lesson:6.1)), `ChatOllama(model="qwen3.5")` ([6.2](lesson:6.2)) |
| Counting tokens | `token_counter="approximate"` | `token_counter=llm`, the provider's count; `token_counter=len`, a number of messages ([7.4](lesson:7.4)) |
| Shortening the history | `trim_messages` | A summary of older turns: `SummarizationMiddleware` ([9.6](lesson:9.6)) |
| Memory | `InMemoryChatMessageHistory` in a dict | A checkpointer with a `thread_id`: `create_agent(..., checkpointer=...)` ([9.4](lesson:9.4)), a LangGraph graph ([11.5](lesson:11.5)) |
| Interface | A terminal loop | A web API with LangServe or FastAPI ([7.2](lesson:7.2)); a Streamlit page ([lesson 3.12](lesson:3.12)) |

## Practice

::: practice
**Start over.** Add a `/reset` command that empties the current session's history, so the bot forgets the conversation without switching sessions.

```python title="chatbot.py (in the loop, before the empty-text check)" norun
        if text == "/reset":
            get_session_history(session_id).clear()
            print(f"0 messages in {session_id!r}")
            continue
```

`clear()` empties the history object in the store; the next message starts a fresh conversation under the same session ID.
:::

::: practice
**Remember across runs.** Save every session to `histories.json` when the user types `/quit`, and load the file when the script starts, so conversations survive a restart.

```python title="chatbot.py (changed parts)" norun
import json
from pathlib import Path

from langchain_core.messages import messages_from_dict, messages_to_dict

HISTORY_FILE = Path("histories.json")


def load_store() -> None:
    if HISTORY_FILE.exists():
        for session_id, data in json.loads(HISTORY_FILE.read_text()).items():
            get_session_history(session_id).add_messages(messages_from_dict(data))


def save_store() -> None:
    data = {session_id: messages_to_dict(history.messages) for session_id, history in store.items()}
    HISTORY_FILE.write_text(json.dumps(data, indent=2))

# in main(): call load_store() before the loop, and save_store() before break on /quit
```

`messages_to_dict` turns messages into plain dicts that JSON can store, and `messages_from_dict` turns them back ([lesson 7.3](lesson:7.3)). A server would write to a database instead, after every turn rather than at the end.
:::
