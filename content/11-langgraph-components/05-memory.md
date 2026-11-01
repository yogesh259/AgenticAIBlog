+++
number = "11.5"
title = "Memory with checkpointers"
lede = "Compile the agent with a checkpointer and give each conversation a thread ID: the state is saved after every step and loaded on the next call, so the agent remembers what \"that number\" was. Then see where the saves live and how facts outlast a thread."
summary = "Why the agent forgets, MemorySaver and compile, threads and thread IDs, three turns of one conversation, what a checkpointer saves and when, the chatbot with memory, in-memory and database checkpointers, long-term memory with a store, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "11 LangGraph Components: 7-ReActAgents.ipynb (cells 19-28); 8-streaming.ipynb (cells 7-10; builder and graph renamed, the user's name replaced); checkpoints per step, database checkpointers, the store, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

The agent of [lesson 11.4](lesson:11.4) added 5 and 8, and the next question, "Divide that by 5", found it knowing nothing: every `invoke` starts from an empty state. [Lesson 10.3](lesson:10.3) worked around that by passing the whole conversation back in with each call. LangGraph can keep it instead. Compile the graph with a *checkpointer* and it saves the state after every step; pass a *thread ID* with each call and the next call on that thread continues from the saved state. The same mechanism lets a run pause for a person and resume later ([lesson 14.1](lesson:14.1)).

## Compile with a checkpointer

The model this time is OpenAI's, with the tools of [lesson 11.4](lesson:11.4):

```python title="Notebook cell" norun
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="gpt-4o")
llm_with_tools = llm.bind_tools(tools)
```

OpenAI retires `gpt-4o` on 14 January 2027 and names `gpt-6-luna` as its replacement; any provider of [lesson 11.2](lesson:11.2) works. The graph is the ReAct graph of [lesson 11.4](lesson:11.4), built without compiling:

```python title="Notebook cell" norun
### Entire Chatbot With LangGraph
from IPython.display import Image, display
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langgraph.prebuilt import tools_condition


### Node definition
def tool_calling_llm(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


# Build graph
builder = StateGraph(State)
builder.add_node("tool_calling_llm", tool_calling_llm)
builder.add_node("tools", ToolNode(tools))

builder.add_edge(START, "tool_calling_llm")
builder.add_conditional_edges(
    "tool_calling_llm",
    # If the latest message (result) from assistant is a tool call -> tools_condition routes to tools
    # If the latest message (result) from assistant is a not a tool call -> tools_condition routes to END
    tools_condition,
)
builder.add_edge("tools", "tool_calling_llm")
```

```python title="Notebook cell" norun
from langgraph.checkpoint.memory import MemorySaver
memory = MemorySaver()
graph_memory = builder.compile(checkpointer=memory)

# View
display(Image(graph_memory.get_graph().draw_mermaid_png()))
```

The checkpointer is passed to `compile`; the graph's nodes and edges don't change, and neither does its drawing. `MemorySaver` keeps the saved states in a dict in this process's memory. It is the older name of `InMemorySaver`, the same class ([lesson 9.4](lesson:9.4) uses the newer name).

## Threads

A thread is one conversation's saved state, named by the `thread_id` in the call's config:

```python title="Notebook cell" norun
## Specify the thread

config = {"configurable": {"thread_id": "1"}}
# Specify an input
messages = [HumanMessage(content="Add 12 and 13.")]
messages = graph_memory.invoke({"messages": messages}, config=config)
for m in messages['messages']:
    m.pretty_print()
```

```output saved note="tool call IDs and answers vary per run"
================================ Human Message =================================

Add 12 and 13.
================================== Ai Message ==================================
Tool Calls:
  add (call_jDz62Hs4iwMF1oHCkyTUdL6S)
 Call ID: call_jDz62Hs4iwMF1oHCkyTUdL6S
  Args:
    a: 12
    b: 13
================================= Tool Message =================================
Name: add

25
================================== Ai Message ==================================

12 plus 13 equals 25.
```

```python title="Notebook cell" norun
messages = [HumanMessage(content="add that number to 25")]
messages = graph_memory.invoke({"messages": messages}, config=config)
for m in messages['messages']:
    m.pretty_print()
```

```output saved note="the first turn's four messages trimmed; tool call IDs and answers vary per run"
================================ Human Message =================================

Add 12 and 13.
[... the first turn: the tool call, 25, and "12 plus 13 equals 25." ...]
================================ Human Message =================================

add that number to 25
================================== Ai Message ==================================
Tool Calls:
  add (call_PxVDhd8nJpXlzzRjd8QjRSs0)
 Call ID: call_PxVDhd8nJpXlzzRjd8QjRSs0
  Args:
    a: 25
    b: 25
================================= Tool Message =================================
Name: add

50
================================== Ai Message ==================================

When you add 25 to 25, you get 50.
```

The call sent one message, yet the result holds eight. Before running, the graph loaded thread `1`'s saved state, the four messages of the first turn, and `add_messages` appended the new question to them, so the model read "that number" next to the 25 it had computed. One more turn:

```python title="Notebook cell" norun
messages = [HumanMessage(content="then multiplty that number by 2")]
messages = graph_memory.invoke({"messages": messages}, config=config)
for m in messages['messages']:
    m.pretty_print()
```

```output saved note="the first two turns trimmed; tool call IDs and answers vary per run"
[... the first two turns, eight messages ...]
================================ Human Message =================================

then multiplty that number by 2
================================== Ai Message ==================================
Tool Calls:
  multiply (call_0bHZBwLK0B8j6ftkcmzplZtD)
 Call ID: call_0bHZBwLK0B8j6ftkcmzplZtD
  Args:
    a: 50
    b: 2
================================= Tool Message =================================
Name: multiply

100
================================== Ai Message ==================================

When you multiply 50 by 2, you get 100.
```

The model resolved "that number" to 50 despite the typo. A call with `{"configurable": {"thread_id": "2"}}` would start an empty conversation, and a call without a `thread_id` is refused with a `ValueError` ([lesson 9.4](lesson:9.4) shows it).

::: visual thread-memory | Run player | One thread, two calls
The first two turns step by step: which node runs, the messages in the state, and what the checkpointer holds for thread 1.
:::

## What gets saved, and when

A checkpointer doesn't save once per call: it saves a *checkpoint*, a snapshot of the whole state, after every super-step, and each call starts from the thread's latest one. A stand-in node that echoes the last message shows the threads without a model:

```python title="Notebook cell"
from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages


class State(TypedDict):
    messages: Annotated[list, add_messages]


def echo(state: State):
    count = len(state["messages"])
    return {"messages": [AIMessage(content=f"You said: {state['messages'][-1].content} ({count} messages so far)")]}


builder = StateGraph(State)
builder.add_node("echo", echo)
builder.add_edge(START, "echo")
builder.add_edge("echo", END)
memory = MemorySaver()
echo_graph = builder.compile(checkpointer=memory)

for thread, text in [("1", "Hi, I'm Alice"), ("1", "I like cricket"), ("2", "Who am I?")]:
    result = echo_graph.invoke({"messages": text}, {"configurable": {"thread_id": thread}})
    print(f"thread {thread}: {result['messages'][-1].content}")

thread_1 = {"configurable": {"thread_id": "1"}}
print(len(list(memory.list(thread_1))), "checkpoints saved for thread 1")
```

```output real
thread 1: You said: Hi, I'm Alice (1 messages so far)
thread 1: You said: I like cricket (3 messages so far)
thread 2: You said: Who am I? (1 messages so far)
6 checkpoints saved for thread 1
```

Thread `1` grew from one message to three before `echo` ran the second time; thread `2` started empty. Each call saved three checkpoints, one for the input and one per step, so a run that crashes or pauses can resume from the last finished step rather than from the start. That is also what lets you read, edit and rewind a thread's state (lessons [14.1](lesson:14.1), [14.2](lesson:14.2) and [14.4](lesson:14.4)).

## The chatbot with memory

A checkpointer works the same for any graph. Here is [lesson 10.3](lesson:10.3)'s chatbot, compiled with one; [lesson 11.6](lesson:11.6) streams it:

```python title="Notebook cell" norun
from langchain_groq import ChatGroq

llm_groq = ChatGroq(model="openai/gpt-oss-120b")
```

```python title="Notebook cell" norun
from langgraph.checkpoint.memory import MemorySaver
memory = MemorySaver()


def superbot(state: State):
    return {"messages": [llm_groq.invoke(state['messages'])]}
```

```python title="Notebook cell" norun
builder = StateGraph(State)

## node
builder.add_node("SuperBot", superbot)
## Edges

builder.add_edge(START, "SuperBot")
builder.add_edge("SuperBot", END)


graph = builder.compile(checkpointer=memory)
```

```python title="Notebook cell" norun
## Invocation

config = {"configurable": {"thread_id": "1"}}

graph.invoke({'messages': "Hi,My name is Alice And I like cricket"}, config)
```

```output illustrative note="from a run with Qwen 2.5 32B, since retired; metadata trimmed; answers vary per run"
{'messages': [HumanMessage(content='Hi,My name is Alice And I like cricket', id='5ff70a7c-e695-42a2-bab3-eb2702e8840b'),
  AIMessage(content="Hello Alice! It's great to meet you. Cricket is a fantastic sport, isn't it? Do you enjoy playing cricket or are you more into watching the matches? Who is your favorite cricket player or team? Feel free to share more about what you like about the sport!", response_metadata={'model_name': 'qwen-2.5-32b', 'finish_reason': 'stop', ...}, id='run-df27f670-94da-4a98-9139-48c0b358d265-0', usage_metadata={'input_tokens': 39, 'output_tokens': 57, 'total_tokens': 96})]}
```

Ask "What is my name?" on the same thread and the model reads both earlier messages; the chat loop of [lesson 10.3](lesson:10.3)'s script no longer needs to carry the list.

## Where checkpoints live

| Checkpointer | Saves to | Use |
|---|---|---|
| `InMemorySaver` (`MemorySaver`) | This process's memory; gone when it stops | Notebooks, tests, demos |
| `SqliteSaver` (package `langgraph-checkpoint-sqlite`) | A SQLite file | One machine, small apps, local tools |
| `PostgresSaver` (package `langgraph-checkpoint-postgres`) | A Postgres database | Production: several server processes share every thread |
| LangSmith Deployment | Storage the platform manages | Graphs deployed on it ([lesson 7.2](lesson:7.2)) |

Switching is one line at `compile`; the graph doesn't change. With SQLite:

```python title="Notebook cell" norun
import sqlite3
from langgraph.checkpoint.sqlite import SqliteSaver

memory = SqliteSaver(sqlite3.connect("checkpoints.sqlite", check_same_thread=False))
graph_memory = builder.compile(checkpointer=memory)
```

Three things come with persistence. A thread keeps every message, so a long conversation costs more on every call: trim or summarise what the model sees ([lessons 7.4](lesson:7.4) and [9.6](lesson:9.6)), the full history stays saved. Threads hold personal data, so give them a retention policy. And a thread ID is a key to a conversation: generate it on the server, and check that the caller owns it before loading it.

## Long-term memory: the store

A checkpointer remembers within a thread. Facts that should outlast one conversation, such as a user's name or preferences, belong in a *store*: a key-value database that every thread can read, organised in namespaces such as `("users", "alice")`. Pass it to `compile` next to the checkpointer, and a node reaches it through its `runtime` argument:

```python title="Notebook cell"
from langgraph.runtime import Runtime
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()
store.put(("users", "alice"), "profile", {"sport": "cricket"})


def recall(state: State, runtime: Runtime):
    profile = runtime.store.get(("users", "alice"), "profile")
    return {"messages": [AIMessage(content=f"You like {profile.value['sport']}.")]}


builder = StateGraph(State)
builder.add_node("recall", recall)
builder.add_edge(START, "recall")
builder.add_edge("recall", END)
recall_graph = builder.compile(checkpointer=MemorySaver(), store=store)

recall_graph.invoke({"messages": "What do I like?"}, {"configurable": {"thread_id": "new"}})["messages"][-1].content
```

```output real
'You like cricket.'
```

A brand-new thread found the fact, because it lives in the store, not in any thread's state. In an application, a node writes such facts when the user states them (`runtime.store.put(...)`) and reads them at the start of each conversation; production stores sit in Postgres like the checkpoints. Deciding what to remember, and when, is the hard part ([lesson 7.4](lesson:7.4) lists the options).

## Interview questions

::: check
The agent remembers conversations on your laptop, but in production users say it forgets what they said a minute ago. What is going on?

Most likely an `InMemorySaver` behind several server processes: each process has its own memory, so a request that lands on another worker, or after a restart, finds no thread. Use a database checkpointer that all processes share, such as Postgres, and make sure every request carries the same `thread_id` for the conversation. Also check that the client really reuses the thread ID instead of generating a new one per request.
:::

::: check
A support thread has reached 300 messages and every reply is slow and expensive. The checkpointer is working as designed; what do you change?

What the model sees, not what is saved. The checkpointer keeps the full history, but the node can send a window: trim to the last turns or a token budget ([lesson 7.4](lesson:7.4)), or replace old turns with a summary ([lesson 9.6](lesson:9.6)). Keep facts that must survive the trimming in the state or a store, and start a new thread when the topic changes.
:::

::: check
What is the difference between a checkpointer and a store?

A checkpointer saves a graph's state per thread, after every step: short-term memory for one conversation, plus the ability to pause, resume and rewind a run. A store is a key-value database shared by all threads, organised by namespace: long-term memory such as user profiles and learned preferences. Most applications use both, compiled into the same graph.
:::

::: check
In a web app, what should a `thread_id` be, and who should choose it?

One ID per conversation, not per user: a user can have many threads, and a new topic deserves a new one. The server should create it, store which user owns it, and check that ownership on every request, because anyone who can pass another user's thread ID can read that conversation. Never take a thread ID from a client without that check.
:::

## Practice

::: practice
**A visit counter per thread.** Give a state one key, `visits`, with `operator.add` as its reducer, and a node that returns `{"visits": 1}`. Compile with a checkpointer, then invoke three times on thread `"alice"` and once on thread `"bob"`, printing the count each time.

```python title="Notebook cell"
import operator


class Visits(TypedDict):
    visits: Annotated[int, operator.add]


def visit(state: Visits):
    return {"visits": 1}


builder = StateGraph(Visits)
builder.add_node("visit", visit)
builder.add_edge(START, "visit")
builder.add_edge("visit", END)
counter = builder.compile(checkpointer=MemorySaver())

for thread in ["alice", "alice", "alice", "bob"]:
    result = counter.invoke({"visits": 0}, {"configurable": {"thread_id": thread}})
    print(thread, result["visits"])
```

```output real
alice 1
alice 2
alice 3
bob 1
```

Any state works with a checkpointer, not only messages. Each call's input `{"visits": 0}` goes through the reducer too, adding nothing, and the node adds one, so each thread counts its own calls. Without the checkpointer every call would print 1.
:::

::: practice
**A fact that outlasts the thread.** Write one node that saves the sport when the message says "I like ...", and otherwise answers from the store. Tell it your sport on thread `"monday"`, then ask on thread `"friday"`.

```python title="Notebook cell"
def sport_memory(state: State, runtime: Runtime):
    text = state["messages"][-1].content
    namespace = ("users", "alice")
    if text.startswith("I like "):
        runtime.store.put(namespace, "profile", {"sport": text.removeprefix("I like ")})
        return {"messages": [AIMessage(content="Noted.")]}
    profile = runtime.store.get(namespace, "profile")
    answer = f"You like {profile.value['sport']}." if profile else "I don't know yet."
    return {"messages": [AIMessage(content=answer)]}


builder = StateGraph(State)
builder.add_node("sport_memory", sport_memory)
builder.add_edge(START, "sport_memory")
builder.add_edge("sport_memory", END)
assistant = builder.compile(checkpointer=MemorySaver(), store=InMemoryStore())

for thread, text in [("friday", "What do I like?"), ("monday", "I like badminton"), ("friday", "What do I like?")]:
    result = assistant.invoke({"messages": text}, {"configurable": {"thread_id": thread}})
    print(f"{thread}: {result['messages'][-1].content}")
```

```output real
friday: I don't know yet.
monday: Noted.
friday: You like badminton.
```

The second question on thread `"friday"` gets an answer that thread never heard: the fact came from the store, written during thread `"monday"`. A real assistant would let the model decide what to save, often through a tool, and would key the namespace by the logged-in user instead of a fixed name.
:::

## Further reading

- LangChain, [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence): threads, checkpoints, checkpointer libraries and the store.
