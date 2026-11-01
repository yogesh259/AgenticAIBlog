+++
number = "14.4"
title = "Time travel"
lede = "A checkpoint after every step turns a thread into a history you can walk back through. Replay a run from any checkpoint, or change the state there and fork a new branch; the original stays as it was."
summary = "Why rewind, a thread's history newest first, finding a checkpoint, replaying from it and what runs again, forking with update_state on an old checkpoint, the history as a tree of branches, interrupts during time travel, uses and costs, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "14 Human in the loop: 1-Humanintheloop.ipynb (cells 1, 9 and 11: rewinding as a goal, get_state_history, the figure of checkpoints, threads and snapshots); LangGraph's time-travel and checkpointer guides; replay, fork, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

The second reason to pause a run, in [lesson 14.1](lesson:14.1), was debugging: rewind the graph to reproduce a problem or avoid it. The checkpointer already makes that possible. It saves a checkpoint after every super-step and never overwrites one, so a thread holds the history of every run on it, not just the latest state. LangGraph calls going back through that history *time travel*, and offers two moves: **replay** a run from an earlier checkpoint as it was, or **fork** it by changing the state there first.

## A thread's history

The arithmetic agent again, with a stand-in for the model. The tool and the stand-in print a line whenever they run, to show what runs again later:

```python title="Notebook cell"
import re

from langchain_core.messages import AIMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import MessagesState, StateGraph, START
from langgraph.prebuilt import ToolNode, tools_condition


def multiply(a: int, b: int) -> int:
    """Multiply a and b."""
    print(f"  multiply({a}, {b}) runs")
    return a * b


def tool_caller(state: MessagesState):
    """Stand-in for the model: asks multiply for the last two numbers, then reports the result."""
    print("  the model runs")
    last = state["messages"][-1]
    if isinstance(last, ToolMessage):
        return {"messages": [AIMessage(content=f"The result is {last.content}.")]}
    a, b = map(int, re.findall(r"\d+", last.content)[-2:])
    return {"messages": [AIMessage(content="", tool_calls=[{"name": "multiply", "args": {"a": a, "b": b}, "id": "call_1"}])]}


builder = StateGraph(MessagesState)
builder.add_node("assistant", tool_caller)
builder.add_node("tools", ToolNode([multiply]))
builder.add_edge(START, "assistant")
builder.add_conditional_edges("assistant", tools_condition)
builder.add_edge("tools", "assistant")
graph = builder.compile(checkpointer=MemorySaver())

thread = {"configurable": {"thread_id": "1"}}
graph.invoke({"messages": "Multiply 2 and 3"}, thread)["messages"][-1].content
```

```output real
  the model runs
  multiply(2, 3) runs
  the model runs
'The result is 6.'
```

`get_state_history` returns the thread's checkpoints, newest first ([lesson 14.1](lesson:14.1) met it as a generator). A small function prints each one on a line: its step, source, `next`, and the last message at that point:

```python title="Notebook cell"
def show(history):
    for snapshot in history:
        messages = snapshot.values.get("messages", [])
        last = messages[-1] if messages else None
        if last is None:
            said = ""
        elif getattr(last, "tool_calls", None):
            call = last.tool_calls[0]
            said = f"asks {call['name']}{call['args']}"
        else:
            said = last.content
        print(f"{snapshot.metadata['step']:>2} {snapshot.metadata['source']:<6} next={str(snapshot.next):<15} {said}")


history = list(graph.get_state_history(thread))
show(history)
```

```output real
 3 loop   next=()              The result is 6.
 2 loop   next=('assistant',)  6
 1 loop   next=('tools',)      asks multiply{'a': 2, 'b': 3}
 0 loop   next=('assistant',)  Multiply 2 and 3
-1 input  next=('__start__',)
```

Five checkpoints for one call: the input (step -1), the state before the first node (step 0), and one after each node that ran. Each is a full `StateSnapshot`, and its `next` says what would run if the run continued from there. `get_state_history` also takes `limit=` (the newest few), `before=` (a config: only older checkpoints) and `filter=` (metadata, such as `{"source": "update"}`).

## Find a checkpoint

Search the list for what you know: the node that was about to run, the step, or the source.

```python title="Notebook cell"
before_tools = next(s for s in history if s.next == ("tools",))
before_tools.config
```

```output real note="the checkpoint ID varies per run"
{'configurable': {'thread_id': '1',
  'checkpoint_ns': '',
  'checkpoint_id': '1f1d55c7-5af5-6304-8001-7a0985a16c96'}}
```

The config names the thread and one checkpoint. Wherever a method takes the thread's config, this one works too, and LangGraph then uses that checkpoint instead of the latest: `graph.get_state(before_tools.config)` reads it, and the two moves below continue from it.

## Replay

Continue the run from the past checkpoint, with `None` as the input:

```python title="Notebook cell"
graph.invoke(None, before_tools.config)["messages"][-1].content
```

```output real
  multiply(2, 3) runs
  the model runs
'The result is 6.'
```

The nodes after the checkpoint ran again, the tool and the model; the model call before it didn't, since its result was in the checkpoint. A replay re-executes, it doesn't read from a cache: a real model may answer differently this time, and a tool acts again. That is what makes replays useful for debugging, since a failing step can be run again with tracing on ([lesson 12.1](lesson:12.1)), and risky for tools with side effects, since an email can go out twice. What the replay did to the history:

```python title="Notebook cell"
show(graph.get_state_history(thread))
```

```output real
 4 loop   next=()              The result is 6.
 3 loop   next=('assistant',)  6
 2 fork   next=('tools',)      asks multiply{'a': 2, 'b': 3}
 3 loop   next=()              The result is 6.
 2 loop   next=('assistant',)  6
 1 loop   next=('tools',)      asks multiply{'a': 2, 'b': 3}
 0 loop   next=('assistant',)  Multiply 2 and 3
-1 input  next=('__start__',)
```

Nothing was overwritten: the replay started a branch. Its first checkpoint, with `source='fork'`, is a copy of the one replayed from, and the run went on from there; the original steps are still listed below it. The thread's latest checkpoint is now the end of the replay, so `get_state(thread)` returns it and the next ordinary call on the thread continues from it.

## Fork

To try something different, change the state at the past checkpoint before continuing. `update_state` with the past checkpoint's config writes a new checkpoint as its child ([lesson 14.2](lesson:14.2) used it on the latest one). Here the fork changes the pending tool call, as if the model had asked for `multiply(20, 3)`:

```python title="Notebook cell"
call = before_tools.values["messages"][-1]
edited = call.model_copy(update={"tool_calls": [{**call.tool_calls[0], "args": {"a": 20, "b": 3}}]})
fork_config = graph.update_state(before_tools.config, {"messages": [edited]})
graph.invoke(None, fork_config)["messages"][-1].content
```

```output real
  multiply(20, 3) runs
  the model runs
'The result is 60.'
```

```python title="Notebook cell"
show(graph.get_state_history(thread))
```

```output real
 4 loop   next=()              The result is 60.
 3 loop   next=('assistant',)  60
 2 update next=('tools',)      asks multiply{'a': 20, 'b': 3}
 4 loop   next=()              The result is 6.
 3 loop   next=('assistant',)  6
 2 fork   next=('tools',)      asks multiply{'a': 2, 'b': 3}
 3 loop   next=()              The result is 6.
 2 loop   next=('assistant',)  6
 1 loop   next=('tools',)      asks multiply{'a': 2, 'b': 3}
 0 loop   next=('assistant',)  Multiply 2 and 3
-1 input  next=('__start__',)
```

Three branches now grow from step 1: the original run, the replay, and the fork, which begins with the `update` checkpoint. `get_state_history` lists every checkpoint of the thread, newest first, whatever its branch; to follow one branch back to the start, follow `parent_config` from checkpoint to checkpoint (practice 1 does).

::: visual checkpoint-history | Figure | One thread, three branches
The thread's checkpoints after the replay and the fork: where each branch starts, what get_state returns, and what get_state_history lists.
:::

| Move | Call | Runs again | Leaves behind |
|---|---|---|---|
| Read | `graph.get_state(past.config)` | Nothing | Nothing |
| Replay | `graph.invoke(None, past.config)` | Every node after the checkpoint | A branch starting with a `fork` checkpoint |
| Fork | `config = graph.update_state(past.config, values)`, then `graph.invoke(None, config)` | Every node after the checkpoint, on the changed state | A branch starting with an `update` checkpoint |

## Interrupts and time travel

A node that calls `interrupt` ([lesson 14.3](lesson:14.3)) runs again when a replay or a fork passes through it, so its question is asked again: the new branch pauses and waits for its own `Command(resume=...)`. A form or an approval flow can use that to let a person change one earlier answer without redoing the others: go back to the checkpoint between two questions and replay from there, and only the later one is asked again (practice 2).

## Uses and costs

- **Debugging.** Find the first checkpoint where the state is wrong, replay from just before it to reproduce the failure, then fork with a fix to see whether the rest of the run comes out right, without paying for the steps that were fine.
- **What if.** Fork with a different tool result, request or answer, and compare the branches.
- **Undo and regenerate in an app.** Point a conversation back at the checkpoint before the last question (practice 1), or replay the last model call for another answer.
- **Side effects happen again.** Replays and forks re-run every node after the checkpoint: model calls cost again, and tools act again. Replay production threads with idempotent tools, or with tools replaced by stand-ins.
- **Storage grows.** Every step of every branch is kept. Give threads a retention policy; the checkpointer's `delete_thread(thread_id)` removes one with all its branches.

## Interview questions

::: check
An agent gave a wrong answer in production after three tool rounds. How do you investigate it with the checkpointer?

Load the thread's history and find the first checkpoint where the state goes wrong: a tool call with bad arguments, a tool result the model misread. Replay from the checkpoint just before that step, with tracing on, to reproduce it; then fork from the same checkpoint with the state corrected, or with a changed prompt, to check that the rest of the run comes out right. The steps before the checkpoint are not repeated. Copy the thread or stub out tools with side effects first, because every node after the checkpoint runs again.
:::

::: check
What is the difference between a replay and a fork, and what does each leave behind?

A replay continues from a past checkpoint as it was: `invoke(None, past_config)`. A fork first writes a changed checkpoint with `update_state(past_config, values)` and continues from that. Both re-run every node after the checkpoint and both add a branch: a replay's starts with a `fork` checkpoint, a fork's with an `update` checkpoint. Neither touches the original checkpoints, and afterwards the thread's latest checkpoint is the end of the new branch.
:::

::: check
Does `update_state` on an old checkpoint roll the thread back?

No. It writes a new checkpoint whose parent is the old one; everything after the old checkpoint stays in the history. What changes is the thread's latest checkpoint, which is now on the new branch, so calls that use the plain thread config continue from there. Removing the other branches means deleting the thread (or pruning, where the checkpointer supports it).
:::

::: check
A user clicks "regenerate" on the last answer of a chat built on LangGraph. How do you implement it with checkpoints?

Find the checkpoint just before the model call that wrote the answer (the newest one on the current branch with `next == ("assistant",)` or whatever the model node is called) and replay from it with `invoke(None, that.config)`. The model runs again on the same messages, the new answer lands on a new branch and becomes the latest, and the old answer stays in the history, so the interface can let the user flip between versions.
:::

## Practice

::: practice
**Undo the last question.** Build a chat graph with one stand-in node, `echo`, that answers with every human message so far. Write `undo(graph, config)`: walk back from the latest checkpoint along `parent_config` to the checkpoint that stored the last input (`source == "input"`), and make its parent, the end of the previous turn, the thread's latest checkpoint with `update_state(parent, None)`. Return `False` when there is no earlier turn. Ask three questions, undo twice, and ask another.

```python title="Notebook cell"
from langgraph.graph import END


def echo(state: MessagesState):
    said = [m.content for m in state["messages"] if m.type == "human"]
    return {"messages": [AIMessage(content=f"You have said: {', '.join(said)}")]}


builder = StateGraph(MessagesState)
builder.add_node("echo", echo)
builder.add_edge(START, "echo")
builder.add_edge("echo", END)
chat = builder.compile(checkpointer=MemorySaver())


def undo(graph, config):
    """Make the state before the last input the thread's latest checkpoint."""
    snapshot = graph.get_state(config)
    while snapshot.metadata and snapshot.metadata["source"] != "input":
        snapshot = graph.get_state(snapshot.parent_config)
    if not snapshot.metadata or snapshot.parent_config is None:
        return False
    graph.update_state(snapshot.parent_config, None)
    return True


config = {"configurable": {"thread_id": "chat"}}
for text in ["red", "green", "blue"]:
    print(chat.invoke({"messages": text}, config)["messages"][-1].content)
print("undo:", undo(chat, config), undo(chat, config), undo(chat, config))
print(chat.invoke({"messages": "yellow"}, config)["messages"][-1].content)
```

```output real
You have said: red
You have said: red, green
You have said: red, green, blue
undo: True True False
You have said: red, yellow
```

Walking back along `parent_config` keeps to the current branch. Searching the whole history for the newest `input` checkpoint would not: after one undo it would find the same input again, on the abandoned branch. `update_state` with `None` writes nothing new, it only makes a copy of the old checkpoint the latest, credited to the node that ran last (`echo`), so `next` stays empty and the next question continues from there. The first question can't be undone this way, since nothing precedes it; start a new thread instead.
:::

::: practice
**Change one answer.** Build a form with two nodes that each call `interrupt` once: `ask_name` ("What is your name?") and `ask_age` ("How old are you?"). Fill it in with Alice and 30. Then go back to the checkpoint between the two questions, replay it, and answer the age question again with 31, without being asked the name.

```python title="Notebook cell"
from typing_extensions import TypedDict
from langgraph.types import Command, interrupt


class Profile(TypedDict):
    name: str
    age: str


def ask_name(state: Profile):
    return {"name": interrupt("What is your name?")}


def ask_age(state: Profile):
    return {"age": interrupt("How old are you?")}


builder = StateGraph(Profile)
builder.add_node("ask_name", ask_name)
builder.add_node("ask_age", ask_age)
builder.add_edge(START, "ask_name")
builder.add_edge("ask_name", "ask_age")
builder.add_edge("ask_age", END)
profile = builder.compile(checkpointer=MemorySaver())

config = {"configurable": {"thread_id": "profile"}}
profile.invoke({"name": "", "age": ""}, config)
profile.invoke(Command(resume="Alice"), config)
print(profile.invoke(Command(resume="30"), config))

between = next(s for s in profile.get_state_history(config) if s.next == ("ask_age",))
result = profile.invoke(None, between.config)
print("asked again:", result["__interrupt__"][0].value)
print(profile.invoke(Command(resume="31"), config))
```

```output real
{'name': 'Alice', 'age': '30'}
asked again: How old are you?
{'name': 'Alice', 'age': '31'}
```

The replay started at the checkpoint where the name was already saved and the age question was next, so only `ask_age` ran again, and its `interrupt` paused the new branch. The answer was sent with the plain thread config: the paused replay is the thread's latest checkpoint, so `Command(resume=...)` reaches it.
:::

## Further reading

- LangGraph, [Use time-travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel): replay, fork, `as_node`, and time travel in subgraphs.
- LangGraph, [Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers): super-steps, the snapshot's fields, durability modes and storage.
