+++
number = "14.1"
title = "Breakpoints"
lede = "Compile a graph with interrupt_before and it stops before that node, with its state saved. Read where it stopped and what it holds, then let it continue with None: the first step towards approval, debugging and editing."
summary = "Why pause a run (approval, debugging, editing), the arithmetic agent on MessagesState, compiling with interrupt_before and a checkpointer, running to the breakpoint, get_state and the StateSnapshot, resuming with None, a loop that meets the breakpoint again, interrupt_after and breakpoints per call, what happens without a checkpointer, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "14 Human in the loop: 1-Humanintheloop.ipynb (cells 1-14; retired Groq model replaced, the model test and the binding's printout dropped, the graph image replaced by its edges, the snapshot re-run); interrupt_after, breakpoints per call, the run without a checkpointer, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

An agent that runs from question to answer on its own is fine for arithmetic. For most real work you want to be able to stop it on the way, for three reasons:

- **Approval.** Stop before a step, show a person what is about to happen, and go on only if they accept it.
- **Debugging.** Stop at a step, look at the state, and rewind the run to reproduce a problem or avoid it.
- **Editing.** Change the state before the run goes on: correct the request, a value, a tool call.

All three rest on the checkpointer of [lesson 11.5](lesson:11.5). The state is saved after every step under a thread ID, so a run can stop, wait as long as it takes, and continue exactly where it was. [Lesson 9.7](lesson:9.7) did this for `create_agent` agents with middleware; this module does it in your own graphs, starting with the simplest tool: a breakpoint, a node the graph stops before.

## The agent

Nothing new to install: the providers come from [lesson 6.1](lesson:6.1)'s `requirements.txt` and LangGraph from [lesson 10.2](lesson:10.2). The example is an arithmetic agent like [lesson 11.4](lesson:11.4)'s. Pick a provider:

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

:::: tabs
::: tab Groq
```python title="Notebook cell" norun
from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-120b")
```

Groq has retired `qwen-qwq-32b`, the model the saved runs below came from; `openai/gpt-oss-120b` is the replacement it names ([lesson 9.1](lesson:9.1)).
:::
::: tab Gemini
```python title="Notebook cell" norun
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
```
:::
::: tab OpenAI
```python title="Notebook cell" norun
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")
```

OpenAI retires `gpt-4o` on 14 January 2027 and names `gpt-6-luna` as its replacement: change the name then.
:::
::: tab Ollama
```python title="Notebook cell" norun
from langchain_ollama import ChatOllama

llm = ChatOllama(model="qwen3.5")
```
:::
::::

Three plain functions are the tools:

```python title="Notebook cell"
### Custom tools
def multiply(a: int, b: int) -> int:
    """Multiply a and b.

    Args:
        a: first int
        b: second int
    """
    return a * b


def add(a: int, b: int) -> int:
    """Adds a and b.

    Args:
        a: first int
        b: second int
    """
    return a + b


def divide(a: int, b: int) -> float:
    """Divide a by b.

    Args:
        a: first int
        b: second int
    """
    return a / b


tools = [add, multiply, divide]
tools
```

```output real
[<function __main__.add(a: int, b: int) -> int>,
 <function __main__.multiply(a: int, b: int) -> int>,
 <function __main__.divide(a: int, b: int) -> float>]
```

```python title="Notebook cell" norun
## Integrate tools with llm
llm_with_tools = llm.bind_tools(tools)
```

`bind_tools` attaches the three schemas, built from the names, type hints and docstrings, to every request ([lesson 11.2](lesson:11.2)).

## Compile with a breakpoint

```python title="Notebook cell"
### Workflow with LangGraph
from IPython.display import Image, display

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import MessagesState
from langgraph.graph import START, StateGraph
from langgraph.prebuilt import tools_condition, ToolNode
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

## system Message
sys_msg = SystemMessage(content="You are a helpful assistant tasked with performing arithmetic on a set of inputs.")


## node definition
def assistant(state: MessagesState):
    return {"messages": [llm_with_tools.invoke([sys_msg] + state["messages"])]}


# Graph
builder = StateGraph(MessagesState)

## Define nodes:
builder.add_node("assistant", assistant)
builder.add_node("tools", ToolNode(tools))

## Define the Edges

builder.add_edge(START, "assistant")
builder.add_conditional_edges(
    "assistant",
    # If the latest message (result) from assistant is a tool call -> tools_condition routes to tools
    # If the latest message (result) from assistant is a not a tool call -> tools_condition routes to END
    tools_condition,
)
builder.add_edge("tools", "assistant")

memory = MemorySaver()

### human in the loop
graph = builder.compile(interrupt_before=["assistant"], checkpointer=memory)
```

```python title="Notebook cell" norun
# Show
display(Image(graph.get_graph().draw_mermaid_png()))
```

The graph is the ReAct agent of [lesson 11.4](lesson:11.4) on `MessagesState`, the ready-made state with one `messages` key merged by `add_messages` ([lesson 10.3](lesson:10.3)). The `assistant` node puts the system message in front of the conversation on every call, without storing it in the state. Two arguments to `compile` make the difference:

- `interrupt_before=["assistant"]` names the node to stop before, every time it is about to run.
- `checkpointer=memory` saves the state after every step, so the stopped run can be continued.

A breakpoint is a setting of the compiled graph, not a node or an edge, so the drawing doesn't show it. The edges are those of any ReAct graph:

```python title="Notebook cell"
for edge in graph.get_graph().edges:
    kind = " (conditional)" if edge.conditional else ""
    print(f"{edge.source} -> {edge.target}{kind}")
```

```output real
__start__ -> assistant
assistant -> __end__ (conditional)
assistant -> tools (conditional)
tools -> assistant
```

## Run to the breakpoint

```python title="Notebook cell"
thread = {"configurable": {"thread_id": "123"}}
initial_input = {"messages": HumanMessage(content="Multiply 2 and 3")}
```

```python title="Notebook cell"
for event in graph.stream(initial_input, thread, stream_mode="values"):
    event['messages'][-1].pretty_print()
```

```output real
================================ Human Message =================================

Multiply 2 and 3
```

With `stream_mode="values"` the stream yields the whole state after each step ([lesson 11.6](lesson:11.6)), and there was only one: the input. Then the stream ended, before `assistant` ran, so the model hasn't been called yet. Nothing was raised and nothing says "paused": to find out, ask the checkpointer.

## Where the run stopped

```python title="Notebook cell"
state = graph.get_state(thread)
state.next
```

```output real
('assistant',)
```

`get_state` returns the thread's latest checkpoint. Its `next` names the nodes that will run when the run continues: `assistant`, the breakpoint. An empty tuple would mean the run is finished. The checkpointer also keeps every earlier checkpoint of the thread:

```python title="Notebook cell"
graph.get_state_history(thread)
```

```output real note="the address varies per run"
<generator object Pregel.get_state_history at 0x000001DD4B1878B0>
```

A generator over the thread's checkpoints, newest first; [lesson 14.4](lesson:14.4) reads it to rewind runs. The latest one in full:

```python title="Notebook cell"
state
```

```output real note="IDs and timestamps vary per run"
StateSnapshot(values={'messages': [HumanMessage(content='Multiply 2 and 3', additional_kwargs={}, response_metadata={}, id='52df7da6-da83-4032-b61d-f4154b495165')]}, next=('assistant',), config={'configurable': {'thread_id': '123', 'checkpoint_ns': '', 'checkpoint_id': '1f1d55b2-7684-65b5-8000-33da71bd2ec9'}}, metadata={'source': 'loop', 'step': 0, 'parents': {}}, created_at='2026-10-31T18:44:50.508126+00:00', parent_config={'configurable': {'thread_id': '123', 'checkpoint_ns': '', 'checkpoint_id': '1f1d55b2-7679-6c05-bfff-a618fce82926'}}, tasks=(PregelTask(id='25549370-4d8d-ac11-27f0-4268eedb8d66', name='assistant', path=('__pregel_pull', 'assistant'), error=None, interrupts=(), state=None, result=None),), interrupts=())
```

A `StateSnapshot` is a named tuple:

| Field | Here | What it holds |
|---|---|---|
| `values` | One `HumanMessage` | The state at this checkpoint |
| `next` | `('assistant',)` | The nodes that run when the run continues; `()` when it is finished |
| `config` | Thread `123` and a `checkpoint_id` | The address of this checkpoint; pass it back to read or rewind to exactly this point ([lesson 14.4](lesson:14.4)) |
| `metadata` | `source='loop'`, `step=0` | `source` is `input` for the checkpoint that stores a call's input, `loop` for one saved after a step, `update` for one written by hand ([lesson 14.2](lesson:14.2)); `step` counts super-steps from -1, the input |
| `created_at` | A timestamp | When the checkpoint was saved |
| `parent_config` | The previous checkpoint's config | Checkpoints form a chain, each pointing at the one before |
| `tasks` | One task, `assistant` | What runs next, with any error it raised or interrupt it is waiting on |
| `interrupts` | `()` | Questions raised inside nodes, waiting for an answer ([lesson 14.3](lesson:14.3)); a breakpoint leaves it empty |

## Continue the run

To continue, call `stream` (or `invoke`) again on the same thread with `None` as the input. `None` means no new input: load the thread's latest checkpoint and run what its `next` says.

```python title="Notebook cell" norun
## Continue the execution to Assistant
for event in graph.stream(None, thread, stream_mode="values"):
    event['messages'][-1].pretty_print()
```

```output saved note="from a run with QwQ 32B, since retired; tool call IDs vary per run"
================================ Human Message =================================

Multiply 2 and 3
================================== Ai Message ==================================
Tool Calls:
  multiply (call_z7ed)
 Call ID: call_z7ed
  Args:
    a: 2
    b: 3
================================= Tool Message =================================
Name: multiply

6
```

The first chunk is the state the run resumed from, so the question prints again. Then `assistant` ran: the model asked for `multiply(2, 3)`, `tools_condition` sent the run to `tools`, which returned 6, and the edge back led to `assistant` again, where the breakpoint fired a second time:

```python title="Notebook cell" norun
state = graph.get_state(thread)
state.next
```

```output saved
('assistant',)
```

A breakpoint fires every time its node is about to run, so a loop through it pauses on every round. One more resume:

```python title="Notebook cell" norun
## Continue the execution of Assistant and then end
for event in graph.stream(None, thread, stream_mode="values"):
    event['messages'][-1].pretty_print()
```

```output saved note="from a run with QwQ 32B, since retired; the tags around the answer are that model's habit"
================================= Tool Message =================================
Name: multiply

6
================================== Ai Message ==================================

The result of multiplying 2 and 3 is 6.

<final_answer>
6
</final_answer>
```

The model read the tool's result and answered, `tools_condition` routed to the end, and `next` is now `()`. The run took three calls: one with the input and two with `None`, and between them it sat in the checkpointer, for a second or for a week.

::: visual breakpoint-run | Run player | Pause, look, resume
The saved run step by step: where it stops, the checkpoints the thread collects, and what get_state returns at each pause.
:::

## Breakpoints in detail

| Need | How |
|---|---|
| Stop before a node | `interrupt_before=["assistant"]` |
| Stop after a node, to see what it produced before anything uses it | `interrupt_after=["tools"]` |
| Stop around every node, stepping through a run | `interrupt_after="*"` (practice 1) |
| Breakpoints for one run only | The same arguments on the call: `graph.invoke(initial_input, thread, interrupt_before=["tools"])` (practice 2) |
| Know whether a run is paused | `graph.get_state(thread).next`: not empty means paused, and names where |

`invoke` returns the state as it is at the pause, with nothing in it to say the run stopped early; `stream` with `stream_mode="updates"` ends with a `{'__interrupt__': ()}` chunk. A node name that doesn't exist fails at `compile`, with `` ValueError: Interrupt node `assistnt` not found ``. Breakpoints can also be set by clicking on a node in LangGraph Studio ([lesson 12.2](lesson:12.2)).

## Without a checkpointer

The checkpointer is easy to forget, and nothing reminds you:

```python title="Notebook cell"
no_memory = builder.compile(interrupt_before=["assistant"])
no_memory.invoke(initial_input)
```

```output real note="the message ID varies per run"
{'messages': [HumanMessage(content='Multiply 2 and 3', additional_kwargs={}, response_metadata={}, id='52df7da6-da83-4032-b61d-f4154b495165')]}
```

```python title="Notebook cell"
no_memory.get_state(thread)
```

```output real
ValueError: No checkpointer set
```

The run stopped before `assistant` as configured, but nothing was saved, so there is nothing to continue: the run simply ended early, and the caller got a state with an unanswered question. The same goes for a pause that needs to outlive the process: `MemorySaver` keeps checkpoints in memory, so a server that restarts forgets every paused run. Pauses that wait for people belong in a database checkpointer such as `SqliteSaver` or `PostgresSaver` ([lesson 11.5](lesson:11.5)).

## Interview questions

::: check
Why does a breakpoint need a checkpointer, and what happens without one?

The pause ends the call; continuing later means loading the state from somewhere, and the checkpointer is that somewhere, keyed by thread ID. Without one, LangGraph still stops before the node and returns the state, raises nothing, and leaves nothing to resume (`get_state` raises `ValueError: No checkpointer set`). With an in-memory checkpointer, the pause is lost when the process stops, so pauses that wait for people need a database checkpointer.
:::

::: check
The agent is compiled with `interrupt_before=["assistant"]`. A user resumes it and it pauses again straight away. Is that a bug?

No. A breakpoint fires every time its node is about to run, and the ReAct loop comes back to `assistant` after every tool round, so a request with two tool rounds pauses three times. To pause once per request, put the breakpoint before `tools` (only when a tool is about to run), pass breakpoints per call, or decide in code whether to pause with `interrupt()` ([lesson 14.3](lesson:14.3)).
:::

::: check
Your service calls `graph.invoke(...)` on a graph with breakpoints. How does it know whether the run finished or stopped?

By reading `graph.get_state(config).next` after the call: an empty tuple means finished, anything else means paused and names the node it stopped before. The returned state looks the same in both cases. With `stream` in `updates` mode a final `{'__interrupt__': ()}` chunk also marks the pause, and pauses raised with `interrupt()` add an `__interrupt__` key to the result.
:::

::: check
When is a breakpoint the right tool for human-in-the-loop, and when not?

It suits debugging and development: stepping through a run, stopping before a node to inspect the state, setting breakpoints in LangGraph Studio. As a production approval step it is limited: it fires every time regardless of the state, it can't carry a question to the person, and the person's answer has to be written into the state from outside with `update_state` ([lesson 14.2](lesson:14.2)). LangGraph's documentation recommends the `interrupt` function for human input ([lesson 14.3](lesson:14.3)).
:::

## Practice

::: practice
**Step through a graph.** Build a pipeline of three nodes without a model, on a state with `text`, `total` and `status`: `parse` reads the total from the last word of `text`, `check` sets `status` to `"ok"` below 1000 and `"review"` otherwise, and `save` appends `", saved"` to the status. Compile it with `interrupt_after="*"`, start it on `"order total 250"`, and step through: print the step, the values and `next` at every pause, and continue with `None` until the run is finished.

```python title="Notebook cell"
from typing_extensions import TypedDict
from langgraph.graph import END


class Order(TypedDict):
    text: str
    total: float
    status: str


def parse(state: Order):
    return {"total": float(state["text"].split()[-1])}


def check(state: Order):
    return {"status": "ok" if state["total"] < 1000 else "review"}


def save(state: Order):
    return {"status": state["status"] + ", saved"}


builder = StateGraph(Order)
builder.add_node("parse", parse)
builder.add_node("check", check)
builder.add_node("save", save)
builder.add_edge(START, "parse")
builder.add_edge("parse", "check")
builder.add_edge("check", "save")
builder.add_edge("save", END)
debugger = builder.compile(checkpointer=MemorySaver(), interrupt_after="*")

config = {"configurable": {"thread_id": "debug"}}
debugger.invoke({"text": "order total 250", "total": 0.0, "status": ""}, config)
while True:
    snapshot = debugger.get_state(config)
    print(f"step {snapshot.metadata['step']}: {snapshot.values}  next: {snapshot.next}")
    if not snapshot.next:
        break
    debugger.invoke(None, config)
```

```output real
step 1: {'text': 'order total 250', 'total': 250.0, 'status': ''}  next: ('check',)
step 2: {'text': 'order total 250', 'total': 250.0, 'status': 'ok'}  next: ('save',)
step 3: {'text': 'order total 250', 'total': 250.0, 'status': 'ok, saved'}  next: ()
```

Each `invoke(None, config)` runs one node and stops after it, like a debugger's "step over": the state after `parse` holds the parsed total, the one after `check` the status. `"*"` puts a breakpoint after every node; with `interrupt_before="*"` the run would stop before each node instead.
:::

::: practice
**Pause only for large refunds.** Compile the same pipeline without breakpoints. For `"refund 40"` and `"refund 900"`, run it on its own thread and pause before `save` only when the amount is over 100, by passing `interrupt_before` to `invoke`. Print the result and what is pending.

```python title="Notebook cell"
pipeline = builder.compile(checkpointer=MemorySaver())

for text in ["refund 40", "refund 900"]:
    amount = float(text.split()[-1])
    config = {"configurable": {"thread_id": text}}
    gate = ["save"] if amount > 100 else None
    result = pipeline.invoke({"text": text, "total": 0.0, "status": ""}, config, interrupt_before=gate)
    print(f"{text}: {result['status']!r}, pending: {pipeline.get_state(config).next}")
```

```output real
refund 40: 'ok, saved', pending: ()
refund 900: 'ok', pending: ('save',)
```

The small refund ran to the end; the large one stopped before `save` and waits on its thread until someone continues it with `pipeline.invoke(None, config)`. Breakpoints passed to a call apply to that call only. The decision here sits outside the graph, in the code that calls it; [lesson 14.3](lesson:14.3) moves it inside a node with `interrupt()`.
:::
