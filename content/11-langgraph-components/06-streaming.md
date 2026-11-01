+++
number = "11.6"
title = "Streaming"
lede = "invoke waits for the end of a run; stream shows it as it happens: each node's update, the whole state after each step, or the model's tokens. Learn the modes and the events API, then put the module's agent in one script that streams its steps."
summary = "Why stream, updates and values on the chatbot with memory and on a graph without a model, several modes at once and the v2 format, tokens with the messages mode, astream_events and what one model call emits, which method to use, the ReAct agent with memory in one script with Gemini, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "11 LangGraph Components: 8-streaming.ipynb (cells 11-18; the user's name replaced, two repeated cells dropped, long outputs trimmed); the modes compared without a model, tokens, the events summary, the one-script agent with Gemini, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

An agent run can take many seconds: a model call, a search, another model call. `invoke` shows nothing until all of it is done, so a user stares at an empty screen and a developer can't see which step is slow. Streaming returns the run piece by piece while it happens. LangGraph can stream at three levels: what each node returned, the whole state after each step, and the tokens a model writes inside a node. [Lesson 10.3](lesson:10.3) used the first; this lesson covers all three and the events API under them.

## Stream the state: updates and values

The graph is the chatbot with memory from [lesson 11.5](lesson:11.5), one `SuperBot` node compiled with a `MemorySaver`. `stream` takes the same input and config as `invoke`, plus a `stream_mode`:

```python title="Notebook cell" norun
# Create a thread
config = {"configurable": {"thread_id": "3"}}

for chunk in graph.stream({'messages': "Hi,My name is Alice And I like cricket"}, config, stream_mode="updates"):
    print(chunk)
```

```output illustrative note="from a run with Qwen 2.5 32B, since retired; metadata trimmed; answers vary per run"
{'SuperBot': {'messages': [AIMessage(content="Hello Alice! Nice to meet you. Cricket is a fantastic sport, isn't it? Do you enjoy playing cricket or are you more into watching the matches? Who is your favorite cricket player?", response_metadata={'model_name': 'qwen-2.5-32b', 'finish_reason': 'stop', ...}, id='run-29b1bde0-9600-4760-94ac-00f1796d1ce3-0', usage_metadata={'input_tokens': 39, 'output_tokens': 40, 'total_tokens': 79})]}}
```

```python title="Notebook cell" norun
for chunk in graph.stream({'messages': "I also like football"}, config, stream_mode="values"):
    print(chunk)
```

```output illustrative note="from a run with Qwen 2.5 32B, since retired; messages trimmed; answers vary per run"
{'messages': [HumanMessage(content='Hi,My name is Alice And I like cricket', ...), AIMessage(content="Hello Alice! Nice to meet you. [...]", ...), HumanMessage(content='I also like football', ...)]}
{'messages': [HumanMessage(content='Hi,My name is Alice And I like cricket', ...), AIMessage(content="Hello Alice! Nice to meet you. [...]", ...), HumanMessage(content='I also like football', ...), AIMessage(content="That's great, Alice! Both cricket and football are incredibly popular sports. Do you have any favorite teams or players in football as well? And do you prefer playing or watching these sports?", ...)]}
```

- **`updates`** yields one chunk per node that ran, `{node name: what it returned}`: here just the reply. It is the default mode of `stream`.
- **`values`** yields the whole state after each step, starting with the state before any node ran. Thread `3` already held the first turn, so the first chunk has three messages (the saved two plus the new question) and the second has four.

A graph with two nodes and no model shows the difference in full, and runs anywhere:

```python title="Notebook cell"
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END


class State(TypedDict):
    topic: str
    joke: str


def refine_topic(state: State):
    return {"topic": state["topic"] + " and cats"}


def generate_joke(state: State):
    return {"joke": f"This is a joke about {state['topic']}"}


builder = StateGraph(State)
builder.add_node("refine_topic", refine_topic)
builder.add_node("generate_joke", generate_joke)
builder.add_edge(START, "refine_topic")
builder.add_edge("refine_topic", "generate_joke")
builder.add_edge("generate_joke", END)
jokes = builder.compile()

for mode in ["updates", "values"]:
    print(mode)
    for chunk in jokes.stream({"topic": "ice cream"}, stream_mode=mode):
        print("  ", chunk)
```

```output real
updates
   {'refine_topic': {'topic': 'ice cream and cats'}}
   {'generate_joke': {'joke': 'This is a joke about ice cream and cats'}}
values
   {'topic': 'ice cream'}
   {'topic': 'ice cream and cats'}
   {'topic': 'ice cream and cats', 'joke': 'This is a joke about ice cream and cats'}
```

Two nodes give two updates but three values. Updates are small and say who changed what, which suits progress displays and logs; values are complete and suit a screen that redraws the whole state. Pass a list to get several modes in one run; each chunk then arrives as a `(mode, data)` tuple, or, with `version="v2"` (LangGraph 1.1 and later), as a dict with the same shape for every mode:

```python title="Notebook cell"
for chunk in jokes.stream({"topic": "ice cream"}, stream_mode=["updates", "values"], version="v2"):
    print(chunk["type"], chunk["data"])
```

```output real
values {'topic': 'ice cream'}
updates {'refine_topic': {'topic': 'ice cream and cats'}}
values {'topic': 'ice cream and cats'}
updates {'generate_joke': {'joke': 'This is a joke about ice cream and cats'}}
values {'topic': 'ice cream and cats', 'joke': 'This is a joke about ice cream and cats'}
```

::: visual stream-modes | Figure | What each mode yields
One run of the chatbot, and what updates, values, messages and astream_events hand you along the way.
:::

## Stream tokens

Neither mode helps with the longest wait, the model writing its answer. `stream_mode="messages"` yields the model's output token by token, from inside whichever node calls it, as `(chunk, metadata)` pairs. The node doesn't change: LangGraph picks up the tokens even though `superbot` calls `invoke`.

```python title="Notebook cell" norun
for chunk, metadata in graph.stream({"messages": "Tell me one fact about cricket"}, config, stream_mode="messages"):
    if metadata["langgraph_node"] == "SuperBot":
        print(chunk.content, end="", flush=True)
```

Each `chunk` is an `AIMessageChunk` holding a few characters; printing them as they arrive types the answer out. `metadata` says which node and which step the tokens came from, so a graph with several model calls can show only the one the user should see. A model whose output feeds a router or a grader, not the user, can be kept out of the stream by giving it the tag `nostream`.

## Stream events

`astream_events` is the most detailed way to watch a run. It reports every runnable that starts, streams or ends inside the graph: the graph itself, each node, each model call and each tool.

```python title="Notebook cell" norun
config = {"configurable": {"thread_id": "3"}}

async for event in graph.astream_events({"messages": ["Hi My name is Alice and I like to play cricket"]}, config, version="v2"):
    print(event)
```

```output illustrative note="73 events from a run with Qwen 2.5 32B, since retired; most events and metadata trimmed"
{'event': 'on_chain_start', 'data': {'input': {'messages': ['Hi My name is Alice and I like to play cricket']}}, 'name': 'LangGraph', 'tags': [], 'run_id': '6d661a1d-1828-43de-a883-de3da8f22366', 'metadata': {'thread_id': '3'}, 'parent_ids': []}
{'event': 'on_chain_start', 'data': {'input': {'messages': ['Hi My name is Alice and I like to play cricket']}}, 'name': '__start__', 'tags': ['graph:step:12', 'langsmith:hidden'], 'run_id': '44fcc8c8-a766-44bf-8e37-c74c1093eca1', 'metadata': {'thread_id': '3', 'langgraph_step': 12, 'langgraph_node': '__start__', ...}, 'parent_ids': ['6d661a1d-1828-43de-a883-de3da8f22366']}
[...]
{'event': 'on_chain_start', 'name': 'SuperBot', ...}
{'event': 'on_chat_model_start', 'name': 'ChatGroq', ...}
{'event': 'on_chat_model_stream', 'data': {'chunk': AIMessageChunk(content='', ...)}, 'name': 'ChatGroq', 'metadata': {'thread_id': '3', 'langgraph_step': 13, 'langgraph_node': 'SuperBot', ...}, ...}
[... 55 more on_chat_model_stream events, one per token ...]
{'event': 'on_chat_model_end', 'data': {'output': AIMessage(content="Hello Alice! It's great to hear that you enjoy playing cricket. [...]", ...)}, 'name': 'ChatGroq', ...}
{'event': 'on_chain_end', 'name': 'SuperBot', ...}
{'event': 'on_chain_end', 'data': {'output': {'messages': [...]}}, 'name': 'LangGraph', ...}
```

Each event is a dict with `event` (the kind: `on_chain_start`, `on_chat_model_stream`, `on_tool_end` and so on), `name` (which runnable), `data` (its input, chunk or output) and `metadata` (the thread, the step and the node, as `langgraph_node`). One model call in one node produced 73 events: the graph and node starting and ending, LangGraph's internal steps (tagged `langsmith:hidden`), and 56 token chunks. `langgraph_step` is 12, not 1, because thread `3` already held earlier runs. To print only the tokens, filter:

```python title="Notebook cell" norun
async for event in graph.astream_events({"messages": ["What is my name?"]}, config, version="v2"):
    if event["event"] == "on_chat_model_stream":
        print(event["data"]["chunk"].content, end="", flush=True)
```

`astream_events` is asynchronous: a notebook runs `async for` directly, a script wraps it in an `async def` started with `asyncio.run(...)`. There is no synchronous `stream_events` with `version="v2"`; calling one raises `NotImplementedError`.

## Which to use

| You want | Use |
|---|---|
| Progress: which node finished, and what it changed | `stream_mode="updates"` (the default) |
| The whole state after each step | `stream_mode="values"` |
| The answer typed out as the model writes it | `stream_mode="messages"` |
| Your own progress messages from inside a node or tool | `stream_mode="custom"` with `get_stream_writer()` (practice 1) |
| Several of these | A list of modes, with `version="v2"` |
| Every start, chunk and end of every runnable, nested ones included | `astream_events(..., version="v2")` |

The stream modes come from LangGraph's runtime; `astream_events` comes from LangChain's Runnable interface ([lesson 7.1](lesson:7.1)) and works on chains too. For new applications, LangGraph 1.2's documentation recommends its newer event streaming, `stream_events(version="v3")`, which gives separate iterators for messages, values and output instead of one mixed stream; the modes above remain supported.

## The agent in one script

The module in one terminal program: the ReAct graph of [lesson 11.4](lesson:11.4), memory from [lesson 11.5](lesson:11.5), and each step streamed as it happens, with Gemini as the model. Read it to revise, press **Explain** on it for every step. It needs `GOOGLE_API_KEY` in `.env` ([lesson 6.1](lesson:6.1)), the packages of [lesson 6.1](lesson:6.1)'s `requirements.txt` plus `langgraph` ([lesson 10.2](lesson:10.2)), and internet access for arXiv and Wikipedia.

```python title="react_agent.py" explain
"""A ReAct agent as a LangGraph graph: tools, memory per thread and streamed steps; Gemini decides."""
from typing import Annotated

from dotenv import load_dotenv
from langchain_community.tools import ArxivQueryRun, WikipediaQueryRun
from langchain_community.utilities import ArxivAPIWrapper, WikipediaAPIWrapper
from langchain_core.messages import AnyMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing_extensions import TypedDict

load_dotenv()  # GOOGLE_API_KEY from .env


# 1. Tools: two searches with short results, and three plain functions
arxiv = ArxivQueryRun(api_wrapper=ArxivAPIWrapper(top_k_results=2, doc_content_chars_max=500))
wiki = WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper(top_k_results=1, doc_content_chars_max=500))


def add(a: int, b: int) -> int:
    """Adds a and b."""
    return a + b


def multiply(a: int, b: int) -> int:
    """Multiply a and b."""
    return a * b


def divide(a: int, b: int) -> float:
    """Divide a by b."""
    return a / b


tools = [arxiv, wiki, add, multiply, divide]

# 2. Model, with the tools' schemas attached to every request
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
llm_with_tools = llm.bind_tools(tools)
SYSTEM = SystemMessage(content="You are a helpful assistant. Use the tools for arithmetic and lookups, "
                               "one tool at a time when a step needs an earlier result. Answer briefly.")


# 3. State: the conversation, merged with add_messages
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


# 4. Node: the model reads the conversation and answers or asks for tools
def tool_calling_llm(state: State) -> dict:
    return {"messages": [llm_with_tools.invoke([SYSTEM] + state["messages"])]}


# 5. Graph: model -> tools -> model ... until the model answers; a checkpointer keeps each thread
builder = StateGraph(State)
builder.add_node("tool_calling_llm", tool_calling_llm)
builder.add_node("tools", ToolNode(tools, handle_tool_errors=True))
builder.add_edge(START, "tool_calling_llm")
builder.add_conditional_edges("tool_calling_llm", tools_condition)
builder.add_edge("tools", "tool_calling_llm")
graph = builder.compile(checkpointer=MemorySaver())


# 6. Show each node's update as it arrives
def show(update: dict) -> None:
    for change in update.values():
        for message in change["messages"]:
            if message.type == "ai" and message.tool_calls:
                for call in message.tool_calls:
                    print(f"  -> {call['name']}({call['args']})")
            elif message.type == "tool":
                print(f"  <- {message.name}: {' '.join(message.text.split())[:80]}")
            else:
                print(f"Bot: {message.text}")


def main() -> None:
    # 7. One thread for the whole session, and a cap on the steps of each run
    config = {"configurable": {"thread_id": "1"}, "recursion_limit": 12}
    print("Type /quit to stop.")
    while True:
        text = input("You: ").strip()
        if text == "/quit":
            break
        if not text:
            continue
        try:
            for update in graph.stream({"messages": text}, config, stream_mode="updates"):
                show(update)
        except GraphRecursionError:
            print("Bot: I couldn't finish that within the step limit.")


if __name__ == "__main__":
    main()
```

::: walkthrough

The script builds the agent graph once, then runs a chat loop that streams every run. Steps 1 to 5 are the graph, step 6 prints what it does, and step 7 is the conversation.

```python title="Setup" norun
from typing import Annotated

from dotenv import load_dotenv
from langchain_community.tools import ArxivQueryRun, WikipediaQueryRun
from langchain_community.utilities import ArxivAPIWrapper, WikipediaAPIWrapper
from langchain_core.messages import AnyMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing_extensions import TypedDict

load_dotenv()  # GOOGLE_API_KEY from .env
```

**Setup.** Tools come from `langchain_community`, messages from `langchain_core`, the model from its provider's package, and the graph parts from `langgraph`: the builder, the reducer, the prebuilt tools node and router, the in-memory checkpointer and the error a runaway loop raises. `load_dotenv()` puts `GOOGLE_API_KEY` from `.env` into the environment, where the Gemini class finds it. Importing `langchain_community` prints a deprecation warning; its tools still work ([lesson 6.4](lesson:6.4)).

```python title="Step 1 · Tools" norun
arxiv = ArxivQueryRun(api_wrapper=ArxivAPIWrapper(top_k_results=2, doc_content_chars_max=500))
wiki = WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper(top_k_results=1, doc_content_chars_max=500))


def add(a: int, b: int) -> int:
    """Adds a and b."""
    return a + b


def multiply(a: int, b: int) -> int:
    """Multiply a and b."""
    return a * b


def divide(a: int, b: int) -> float:
    """Divide a by b."""
    return a / b


tools = [arxiv, wiki, add, multiply, divide]
```

**1. Tools.** Two search tools, each wrapping an API client whose settings keep results to 500 characters, since every result is resent to the model on each later call. Three plain functions become tools from their names, type hints and docstrings, which is all the model ever sees of them. One list serves both the model and the tools node, so the two can't disagree about which tools exist.

```python title="Step 2 · Model" norun
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
llm_with_tools = llm.bind_tools(tools)
SYSTEM = SystemMessage(content="You are a helpful assistant. Use the tools for arithmetic and lookups, "
                               "one tool at a time when a step needs an earlier result. Answer briefly.")
```

**2. Model.** `bind_tools` returns the model with the five tool schemas attached to every request; it can now reply with tool calls instead of text. The system message is kept outside the state and sent first on every call. Its middle sentence guards against the failure of [lesson 11.4](lesson:11.4), dependent calls made in parallel with a guessed intermediate value. The model name is Google's at the time of writing; check Google's model list **VERIFY**, since Google retires older models.

```python title="Step 3 · State" norun
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
```

**3. State.** One key, the conversation. `add_messages` appends each node's new messages instead of replacing the list, and turns the plain string the loop sends into a `HumanMessage` ([lesson 10.3](lesson:10.3)).

```python title="Step 4 · Node" norun
def tool_calling_llm(state: State) -> dict:
    return {"messages": [llm_with_tools.invoke([SYSTEM] + state["messages"])]}
```

**4. Node.** The model reads the system message and the whole conversation, tool results included, and returns one `AIMessage`: either text, the answer, or tool calls, a request to act. This is the reason step of the loop; the node doesn't know which of the two it will get.

```python title="Step 5 · Graph" norun
builder = StateGraph(State)
builder.add_node("tool_calling_llm", tool_calling_llm)
builder.add_node("tools", ToolNode(tools, handle_tool_errors=True))
builder.add_edge(START, "tool_calling_llm")
builder.add_conditional_edges("tool_calling_llm", tools_condition)
builder.add_edge("tools", "tool_calling_llm")
graph = builder.compile(checkpointer=MemorySaver())
```

**5. Graph.** Two nodes and the ReAct loop. After the model, `tools_condition` goes to `tools` if the reply has tool calls and to the end otherwise; `ToolNode` runs every call (the act step) and appends one `ToolMessage` per call; the edge back to the model lets it observe the results. `handle_tool_errors=True` turns a tool that raises, such as a search refused for too many requests or a division by zero, into an error message the model reads, instead of a crash ([lesson 11.2](lesson:11.2)). Compiling with `MemorySaver` saves the state after every step under the call's thread ID, so the next question on the same thread sees the whole conversation.

```python title="Step 6 · Show" norun
def show(update: dict) -> None:
    for change in update.values():
        for message in change["messages"]:
            if message.type == "ai" and message.tool_calls:
                for call in message.tool_calls:
                    print(f"  -> {call['name']}({call['args']})")
            elif message.type == "tool":
                print(f"  <- {message.name}: {' '.join(message.text.split())[:80]}")
            else:
                print(f"Bot: {message.text}")
```

**6. Show.** With `stream_mode="updates"` each chunk is `{node name: update}`, and every update here holds new messages. A tool request prints as an arrow out with the arguments the model chose, a tool result as an arrow back (squeezed to one line of 80 characters), and a text reply as the bot's answer. `.text` gives the text for every provider, including Gemini, whose content can be a list of parts ([lesson 6.1](lesson:6.1)).

```python title="Step 7 · Chat loop" norun
def main() -> None:
    config = {"configurable": {"thread_id": "1"}, "recursion_limit": 12}
    print("Type /quit to stop.")
    while True:
        text = input("You: ").strip()
        if text == "/quit":
            break
        if not text:
            continue
        try:
            for update in graph.stream({"messages": text}, config, stream_mode="updates"):
                show(update)
        except GraphRecursionError:
            print("Bot: I couldn't finish that within the step limit.")


if __name__ == "__main__":
    main()
```

**7. Chat loop.** One config for the session: thread `1`, so every question continues the same conversation, and a `recursion_limit` of 12, which lets a run finish within eleven steps, five tool rounds. Each line you type is sent alone; the checkpointer supplies the rest of the conversation. `stream` prints each step the moment its node finishes, so you watch the agent act, observe and answer. A run that hits the limit raises `GraphRecursionError`, which the loop turns into a short apology instead of a crash.

In one sentence: the model reasons, `ToolNode` acts, the edge back lets the model observe, the checkpointer remembers the thread, and `stream` shows each step as it happens.

:::

### Run it

```zsh title="Terminal" norun
python react_agent.py
```

```output illustrative note="answers, tool choices and search results vary per run"
Type /quit to stop.
You: Please add 5 plus 5 and then multiply by 3
  -> add({'a': 5, 'b': 5})
  <- add: 10
  -> multiply({'a': 10, 'b': 3})
  <- multiply: 30
Bot: 5 plus 5 is 10, and 10 times 3 is 30.
You: Divide that by 6
  -> divide({'a': 30, 'b': 6})
  <- divide: 5.0
Bot: 30 divided by 6 is 5.
You: What is machine learning, in one sentence?
  -> wikipedia({'query': 'machine learning'})
  <- wikipedia: Page: Machine learning Summary: Machine learning (ML) is a field of study in ar
Bot: Machine learning is a field of AI in which algorithms learn patterns from data to make predictions on new data without being explicitly programmed.
You: /quit
```

"Divide that by 6" worked because the second run loaded the first from thread `1`; the first question took two tool rounds because the second step needed the first one's result.

### Swap one piece

| Piece | In the script | Alternatives |
|---|---|---|
| Model | `ChatGoogleGenerativeAI(...)` | The Groq, OpenAI and Ollama tabs of [lesson 11.2](lesson:11.2) |
| Tools | arXiv, Wikipedia and three functions | Web search with Tavily ([lesson 11.3](lesson:11.3)), your own `@tool` functions ([lesson 9.3](lesson:9.3)) |
| Memory | `MemorySaver`, one thread per session | `SqliteSaver` or `PostgresSaver` and a thread per conversation ([lesson 11.5](lesson:11.5)) |
| What streams | Each node's update | Tokens with `stream_mode="messages"`, or several modes with `version="v2"` |
| Step limit | `recursion_limit` of 12 | A round counter in the state that routes to an answer ([lesson 11.4](lesson:11.4)) |
| The loop | Built by hand | `create_agent` with the same tools and a checkpointer ([lesson 9.4](lesson:9.4)) |

## Interview questions

::: check
Users of your agent's chat page see nothing for fifteen seconds, then the whole answer at once. What do you stream, and how?

Two things. The model's tokens, with `stream_mode="messages"`, filtered by `metadata["langgraph_node"]` to the node whose output the user should read, so the answer appears as it is written. And the agent's steps, with `updates` (or `custom` messages such as "searching arXiv..."), so the wait during tool calls shows progress. Combine them in one call with a list of modes and `version="v2"`, and forward the chunks to the browser over server-sent events or a WebSocket.
:::

::: check
What is the difference between the `updates` and `values` modes, and which would you send to a front end?

`updates` yields what each node returned, keyed by the node's name; `values` yields the full state after each step, starting with the input. Updates are smaller and say who did what, so they suit progress displays and logs; values suit a client that redraws everything from the state, at the cost of resending the whole conversation every step. For a chat UI, updates (plus tokens) are usually enough.
:::

::: check
When would you use `astream_events` instead of `stream`?

When you need what the modes don't show: events from inside nested runnables, such as a chain called by a node, a retriever's documents, a tool's start and end with timings, or tokens from a model deep in a subgraph, all with run IDs and tags. It is verbose (73 events for one short reply here) and asynchronous, so filter by `event` and `name`. For tokens and progress alone, `stream` with modes is simpler, and LangGraph 1.2 adds `stream_events(version="v3")` for typed, separate streams.
:::

## Practice

::: practice
**Progress messages from a node.** In a node, call `get_stream_writer()` and write two progress messages before returning an update. Stream the graph with `stream_mode=["updates", "custom"]` and `version="v2"`, printing each chunk's type and data.

```python title="Notebook cell"
from langgraph.config import get_stream_writer


class Search(TypedDict):
    query: str
    results: list[str]


def search(state: Search):
    writer = get_stream_writer()
    writer({"progress": f"searching for {state['query']}..."})
    results = [f"{state['query']} result {i}" for i in range(1, 4)]
    writer({"progress": f"found {len(results)} results"})
    return {"results": results}


builder = StateGraph(Search)
builder.add_node("search", search)
builder.add_edge(START, "search")
builder.add_edge("search", END)
searcher = builder.compile()

for chunk in searcher.stream({"query": "LangGraph"}, stream_mode=["updates", "custom"], version="v2"):
    print(chunk["type"], chunk["data"])
```

```output real
custom {'progress': 'searching for LangGraph...'}
custom {'progress': 'found 3 results'}
updates {'search': {'results': ['LangGraph result 1', 'LangGraph result 2', 'LangGraph result 3']}}
```

The custom chunks arrive while the node is still running, before its update, which is what makes them useful during a slow API call. A tool can call `get_stream_writer()` the same way, so a long search inside `ToolNode` can report its progress too.
:::

::: practice
**A new conversation.** Add a `/new` command to `react_agent.py` that starts a fresh conversation on a new thread, keeping the old one saved.

```python title="react_agent.py (in main: a counter before the loop, a command inside it)" norun
    thread = 1
    config = {"configurable": {"thread_id": str(thread)}, "recursion_limit": 12}
    ...
        if text == "/new":
            thread += 1
            config = {"configurable": {"thread_id": str(thread)}, "recursion_limit": 12}
            print(f"New conversation (thread {thread}).")
            continue
```

Nothing is deleted: thread `1` stays in the checkpointer, and switching back to its ID would continue it. With a database checkpointer, that is how a chat app lists and reopens past conversations.
:::

## Further reading

- LangChain, [Streaming](https://docs.langchain.com/oss/python/langgraph/streaming): every stream mode, the v2 format, and filtering tokens by node or tag.
