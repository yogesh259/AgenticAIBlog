+++
number = "14.2"
title = "Editing the state"
lede = "A paused run is saved state, and saved state can be changed. update_state writes to a thread from outside the graph: correct the request, replace or delete a message, or hand the run a person's input as if a node had produced it."
summary = "Correcting a request at a breakpoint, what update_state does (reducers, a new checkpoint), replacing and deleting messages, what deleting leaves in the history, a feedback node that waits for typed input, as_node and what it changes, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "14 Human in the loop: 1-Humanintheloop.ipynb (cells 15-25; the graph image cell kept but not run); update_state through the reducers, replacing and deleting messages, as_node compared, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

At a breakpoint the run is nothing but a saved state and a note of what runs next ([lesson 14.1](lesson:14.1)). Change the state before continuing and the rest of the run works from the changed version: the model reads a corrected request, a tool runs with fixed arguments, a message that should never have been stored is gone. `update_state` makes such changes from outside the graph. It is the editing tool of human-in-the-loop, and the way a person's input gets into a paused run.

## Correct the request

The graph is the agent of [lesson 14.1](lesson:14.1), compiled with `interrupt_before=["assistant"]`. A new thread, the same question:

```python title="Notebook cell" norun
initial_input = {"messages": HumanMessage(content="Multiply 2 and 3")}

thread = {"configurable": {"thread_id": "1"}}
for event in graph.stream(initial_input, thread, stream_mode="values"):
    event['messages'][-1].pretty_print()
```

```output saved
================================ Human Message =================================

Multiply 2 and 3
```

```python title="Notebook cell" norun
state = graph.get_state(thread)
state.next
```

```output saved
('assistant',)
```

The run waits before the model. The person reviewing it changes their mind:

```python title="Notebook cell" norun
graph.update_state(thread, {"messages": [HumanMessage(content="No,please multiply 15 and 6")]})
```

```output saved note="the checkpoint ID varies per run"
{'configurable': {'thread_id': '1',
  'checkpoint_ns': '',
  'checkpoint_id': '1f01abdb-f66c-6ea0-8001-4e8d367673c7'}}
```

`update_state` takes the thread's config and an update shaped like a node's return value. It returns a config with a new `checkpoint_id`: the edit was saved as a new checkpoint, and the one before it is untouched.

```python title="Notebook cell" norun
new_state = graph.get_state(thread).values

for m in new_state['messages']:
    m.pretty_print()
```

```output saved
================================ Human Message =================================

Multiply 2 and 3
================================ Human Message =================================

No,please multiply 15 and 6
```

The correction didn't replace the question, it was appended. The update went through the state's reducer, `add_messages`, exactly as a node's return value would ([lesson 10.3](lesson:10.3)). Continue the run:

```python title="Notebook cell" norun
for event in graph.stream(None, thread, stream_mode="values"):
    event['messages'][-1].pretty_print()
```

```output saved note="from a run with QwQ 32B, since retired; tool call IDs vary per run"
================================ Human Message =================================

No,please multiply 15 and 6
================================== Ai Message ==================================
Tool Calls:
  multiply (call_3qk7)
 Call ID: call_3qk7
  Args:
    a: 15
    b: 6
================================= Tool Message =================================
Name: multiply

90
```

```python title="Notebook cell" norun
for event in graph.stream(None, thread, stream_mode="values"):
    event['messages'][-1].pretty_print()
```

```output saved note="from a run with QwQ 32B, since retired"
================================= Tool Message =================================
Name: multiply

90
================================== Ai Message ==================================

The result of multiplying 15 and 6 is **90**.
```

The model read both requests and followed the later one. A model usually does with "No, please...", but nothing guarantees it: the first request is still in the conversation. To leave only the corrected request, replace the message instead.

## What update_state does

`update_state` applies its update as if a node had returned it: every key goes through its reducer, and a key without one is overwritten. For a `messages` key, `add_messages` gives three operations:

| To | Send | Result |
|---|---|---|
| Add a message | A new message | Appended to the list |
| Change a message | A message with the same `id` | Replaces that message in place |
| Delete a message | `RemoveMessage(id=...)` | That message is removed |

A small graph shows all three without a model. Its `assistant` node runs a stand-in, `calculator`, that plays the model's part by a fixed rule: it multiplies the last two numbers of the last message.

```python title="Notebook cell"
import re

from langchain_core.messages import AIMessage, HumanMessage, RemoveMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import MessagesState, StateGraph, START, END


def calculator(state: MessagesState):
    """Stand-in for the model: multiplies the last two numbers of the last message."""
    a, b = map(int, re.findall(r"\d+", state["messages"][-1].content)[-2:])
    return {"messages": [AIMessage(content=f"{a} times {b} is {a * b}.")]}


builder = StateGraph(MessagesState)
builder.add_node("assistant", calculator)
builder.add_edge(START, "assistant")
builder.add_edge("assistant", END)
graph = builder.compile(interrupt_before=["assistant"], checkpointer=MemorySaver())

thread = {"configurable": {"thread_id": "edit"}}
graph.invoke({"messages": "Multiply 2 and 3"}, thread)
question = graph.get_state(thread).values["messages"][-1]
graph.update_state(thread, {"messages": [HumanMessage(content="Multiply 15 and 6", id=question.id)]})
[m.content for m in graph.get_state(thread).values["messages"]]
```

```output real
['Multiply 15 and 6']
```

One message, edited in place: the update carried the question's ID, so `add_messages` swapped it. Continue, and the stand-in answers the corrected question:

```python title="Notebook cell"
graph.invoke(None, thread)["messages"][-1].content
```

```output real
'15 times 6 is 90.'
```

Now delete the question from the finished conversation:

```python title="Notebook cell"
graph.update_state(thread, {"messages": [RemoveMessage(id=question.id)]})
[m.content for m in graph.get_state(thread).values["messages"]]
```

```output real
['15 times 6 is 90.']
```

Edits work on any thread with a checkpointer, paused or finished. Each one is a checkpoint of its own, with `source='update'`:

```python title="Notebook cell"
for snapshot in graph.get_state_history(thread):
    contents = [m.content for m in snapshot.values.get("messages", [])]
    print(snapshot.metadata["step"], snapshot.metadata["source"], snapshot.next, contents)
```

```output real
3 update () ['15 times 6 is 90.']
2 loop () ['Multiply 15 and 6', '15 times 6 is 90.']
1 update ('assistant',) ['Multiply 15 and 6']
0 loop ('assistant',) ['Multiply 2 and 3']
-1 input ('__start__',) []
```

Read from the bottom: the input, the pause before `assistant` (step 0), the replaced question (step 1), the answer (step 2), the deletion (step 3). Nothing was overwritten. That matters when the reason for deleting is privacy: `RemoveMessage` takes a message out of everything the model sees from now on, but the earlier checkpoints still hold it. To erase it from storage, delete the thread's checkpoints with the checkpointer's `delete_thread(thread_id)`, after copying what should survive to a new thread. [Lesson 14.4](lesson:14.4) uses the old checkpoints on purpose, to rewind runs.

## Wait for the user's input

An edit can also be part of the design: a node whose only job is to mark where a person speaks. The graph pauses before it, the person's text is written into the state as that node's output, and the run goes on. The model, tools and `sys_msg` are those of [lesson 14.1](lesson:14.1):

```python title="Notebook cell" norun
# System message
sys_msg = SystemMessage(content="You are a helpful assistant tasked with performing arithmetic on a set of inputs.")


## Human feedback node

def human_feedback(state: MessagesState):
    pass


### Assistant node
def assistant(state: MessagesState):
    return {"messages": [llm_with_tools.invoke([sys_msg] + state["messages"])]}


## Graph

# Graph
builder = StateGraph(MessagesState)

# Define nodes: these do the work
builder.add_node("assistant", assistant)
builder.add_node("tools", ToolNode(tools))
builder.add_node("human_feedback", human_feedback)


## Define the edges
builder.add_edge(START, "human_feedback")
builder.add_edge("human_feedback", "assistant")
builder.add_conditional_edges(
    "assistant",
    # If the latest message (result) from assistant is a tool call -> tools_condition routes to tools
    # If the latest message (result) from assistant is a not a tool call -> tools_condition routes to END
    tools_condition,
)
builder.add_edge("tools", "human_feedback")

memory = MemorySaver()
graph = builder.compile(interrupt_before=["human_feedback"], checkpointer=memory)

display(Image(graph.get_graph().draw_mermaid_png()))
```

The edges: `START` to `human_feedback`, then `assistant`, then `tools` or the end, and from `tools` back to `human_feedback`, so the person gets a turn before every model call. `human_feedback` does nothing: a node may return `None`, which updates nothing. It exists to be a place to pause, and a name for the person's input.

```python title="Notebook cell" norun
# Input
initial_input = {"messages": "Multiply 2 and 3"}

# Thread
thread = {"configurable": {"thread_id": "5"}}

# Run the graph until the first interruption
for event in graph.stream(initial_input, thread, stream_mode="values"):
    event["messages"][-1].pretty_print()

## get user input

user_input = input("Tell me how you want to update the state:")
graph.update_state(thread, {"messages": user_input}, as_node="human_feedback")

# Continue the graph execution
for event in graph.stream(None, thread, stream_mode="values"):
    event["messages"][-1].pretty_print()
```

```output saved note="from a run with QwQ 32B, since retired; the person typed: please multiply 5 and 6; tool call IDs vary per run"
================================ Human Message =================================

Multiply 2 and 3
================================ Human Message =================================

please multiply 5 and 6
================================== Ai Message ==================================
Tool Calls:
  multiply (call_zvhz)
 Call ID: call_zvhz
  Args:
    a: 5
    b: 6
================================= Tool Message =================================
Name: multiply

30
```

One cell, three moves: run to the pause before `human_feedback`, read a line from the person, write it into the state with `as_node="human_feedback"`, and continue. The text became a `HumanMessage` through `add_messages`, and the model, which saw both requests, acted on the newer one. After `tools` the run came back to `human_feedback` and paused again, with the result:

```python title="Notebook cell" norun
# Continue the graph execution
for event in graph.stream(None, thread, stream_mode="values"):
    event["messages"][-1].pretty_print()
```

```output saved note="from a run with QwQ 32B, since retired"
================================= Tool Message =================================
Name: multiply

30
================================== Ai Message ==================================

30
```

This time nobody wrote anything: the run continued with `None`, the empty node ran, and the model answered.

## as_node: whose update it is

An update is recorded as if a node had returned it, and that node's edges decide what runs next. `as_node` names the node. Without it, LangGraph credits the node that wrote last, which at the first pause is the input. The difference, on a stand-in version of the feedback graph:

```python title="Notebook cell"
def human_feedback(state: MessagesState):
    pass


builder = StateGraph(MessagesState)
builder.add_node("human_feedback", human_feedback)
builder.add_node("assistant", calculator)
builder.add_edge(START, "human_feedback")
builder.add_edge("human_feedback", "assistant")
builder.add_edge("assistant", END)
feedback_graph = builder.compile(interrupt_before=["human_feedback"], checkpointer=MemorySaver())

for as_node in [None, "human_feedback"]:
    thread = {"configurable": {"thread_id": f"as_node={as_node}"}}
    feedback_graph.invoke({"messages": "Multiply 2 and 3"}, thread)
    feedback_graph.update_state(thread, {"messages": "please multiply 5 and 6"}, as_node=as_node)
    print(f"as_node={as_node!r}: next is {feedback_graph.get_state(thread).next}")
```

```output real
as_node=None: next is ('human_feedback',)
as_node='human_feedback': next is ('assistant',)
```

Credited to the input, the update leaves `human_feedback` still to run, so continuing would run the node on the person's text as if they hadn't answered yet. Harmless for an empty node; wrong for one that does work, such as validating or logging the answer. Credited to `human_feedback`, the update is that node's output, and the run moves straight on to `assistant`. Name `as_node` whenever an update stands for a node's work; it can also name a later node, to skip one (practice 2). The person's input arrives from outside, through the caller's code, which must know the right node; [lesson 14.3](lesson:14.3) moves the question and the answer into the node itself.

## Interview questions

::: check
At an approval pause, the reviewer sees that the agent is about to refund order 1042 instead of 1043. What are the ways to correct it with `update_state`, and what does the model see in each?

Append a message ("No, refund order 1043"): the model sees the mistake and the correction, and usually follows the later one. Replace the user's request (same message ID): the model sees only the corrected request, as if it had always been asked that way. Replace the pending tool call (the `AIMessage` with the same ID and edited arguments, practice 1): the tool runs with 1043 and the history shows the corrected call. Appending keeps a visible record of the correction; replacing keeps the conversation clean. Either way the earlier checkpoints keep the original.
:::

::: check
A user pasted a password into a chat that runs on a graph with a checkpointer. You remove the message with `RemoveMessage`. Is it gone?

From the conversation, yes: the newest checkpoint no longer has it, so the model won't see it again. From storage, no: `update_state` never rewrites checkpoints, so every earlier checkpoint of the thread still holds the message, and `get_state_history` returns it. To erase it, delete the thread with the checkpointer's `delete_thread` (after copying the cleaned conversation to a new thread if it should continue), and redact secrets before they reach the state in the first place ([lesson 17.2](lesson:17.2)).
:::

::: check
What does `as_node` do, and when must you set it?

It names the node the update is credited to; the run then continues with that node's successors, as if it had just returned the update. Set it when the update stands for a node's output (a person's answer in a feedback node), to skip a node (credit the update to it, and it never runs), and when LangGraph can't infer it: on a fresh thread with no history, or when parallel nodes wrote in the same step and the update is ambiguous. Without it, LangGraph credits the node that wrote last.
:::

::: check
What are the weaknesses of a no-op feedback node with `interrupt_before` as the way to collect a person's input?

The protocol lives outside the graph: every caller has to know to call `update_state` with the right `as_node`, and nothing stops one from resuming with `None` and skipping the person. The pause is unconditional, it can't carry the question or the data the person should look at, and the answer isn't validated where it is used. The `interrupt` function puts the question, the pause and the answer inside the node ([lesson 14.3](lesson:14.3)).
:::

## Practice

::: practice
**Fix a tool call before it runs.** Write a stand-in model that asks `multiply` for the last two numbers of the last message and, once a tool result is in, reports it. Build the agent graph with `ToolNode([multiply])`, compiled with `interrupt_before=["tools"]`. Ask "Multiply 2 and 3", and at the pause change the pending call's `b` to 30 by replacing the model's message (same ID), then continue and print the conversation.

```python title="Notebook cell"
from langchain_core.messages import ToolMessage
from langgraph.prebuilt import ToolNode, tools_condition


def multiply(a: int, b: int) -> int:
    """Multiply a and b."""
    return a * b


def tool_caller(state: MessagesState):
    """Stand-in for a model with tools: asks multiply for the last two numbers, then reports the result."""
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
agent = builder.compile(interrupt_before=["tools"], checkpointer=MemorySaver())

thread = {"configurable": {"thread_id": "fix"}}
agent.invoke({"messages": "Multiply 2 and 3"}, thread)
request = agent.get_state(thread).values["messages"][-1]
print("pending:", request.tool_calls[0]["args"])
fixed = request.model_copy(update={"tool_calls": [{**request.tool_calls[0], "args": {"a": 2, "b": 30}}]})
agent.update_state(thread, {"messages": [fixed]})
for m in agent.invoke(None, thread)["messages"]:
    m.pretty_print()
```

```output real
pending: {'a': 2, 'b': 3}
================================ Human Message =================================

Multiply 2 and 3
================================== Ai Message ==================================
Tool Calls:
  multiply (call_1)
 Call ID: call_1
  Args:
    a: 2
    b: 30
================================= Tool Message =================================
Name: multiply

60
================================== Ai Message ==================================

The result is 60.
```

`model_copy` keeps everything about the model's message, its ID included, and changes only the tool calls, so `add_messages` replaced it and `ToolNode` ran the corrected call. Keeping the call's own `id` matters too: the tool's result is matched to the call by it. With a real model, the copy also keeps provider data that some models need to see again on the next call.
:::

::: practice
**Cancel a step.** Build a graph with a `plan` node that writes `"refund planned for order ..."` into `status` and a `refund` node that prints `"refunding order ..."` and sets `status` to `"refunded"`, paused before `refund`. Run orders `"1042"` (approved: continue) and `"1043"` (declined: credit an update `{"status": "cancelled by a person"}` to `refund`, so it never runs). Print each order's status and `next`.

```python title="Notebook cell"
from typing_extensions import TypedDict


class Refund(TypedDict):
    order: str
    status: str


def plan(state: Refund):
    return {"status": f"refund planned for order {state['order']}"}


def refund(state: Refund):
    print(f"refunding order {state['order']}")
    return {"status": "refunded"}


builder = StateGraph(Refund)
builder.add_node("plan", plan)
builder.add_node("refund", refund)
builder.add_edge(START, "plan")
builder.add_edge("plan", "refund")
builder.add_edge("refund", END)
refunds = builder.compile(interrupt_before=["refund"], checkpointer=MemorySaver())

for order, approved in [("1042", True), ("1043", False)]:
    thread = {"configurable": {"thread_id": order}}
    refunds.invoke({"order": order, "status": ""}, thread)
    if approved:
        refunds.invoke(None, thread)
    else:
        refunds.update_state(thread, {"status": "cancelled by a person"}, as_node="refund")
    snapshot = refunds.get_state(thread)
    print(f"{order}: {snapshot.values['status']}, next: {snapshot.next}")
```

```output real
refunding order 1042
1042: refunded, next: ()
1043: cancelled by a person, next: ()
```

Order 1043 is finished without `refund` ever running: the update was credited to `refund`, so the graph moved on to what follows it, the end. `status` has no reducer, so the update replaced it. Skipping a node this way is the breakpoint version of a rejection; [lesson 14.3](lesson:14.3) builds the same decision into the graph.
:::
