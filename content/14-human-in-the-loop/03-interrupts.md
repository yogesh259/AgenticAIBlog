+++
number = "14.3"
title = "Interrupts"
lede = "Call interrupt() inside a node and the run pauses on that line, hands its question to the caller, and waits. Command(resume=...) brings the answer back as interrupt's return value. This is how LangGraph recommends waiting for people."
summary = "Breakpoints and interrupts, the feedback node rewritten with interrupt, what the caller receives and sends back, why the node runs again on resume, approving, editing or rejecting a tool call in a review node, the rules of interrupts, typed answers and several interrupts at once, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "14 Human in the loop: 1-Humanintheloop.ipynb (cells 22-25, the feedback node rewritten with interrupt); LangGraph's Interrupts guide (interrupt and Command, the rules, response schemas, several interrupts); the review node, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

The feedback node of [lesson 14.2](lesson:14.2) works, but its protocol lives outside the graph. The caller has to know that the run paused, what to ask the person, and which node to credit the answer to, and nothing stops it from continuing without asking at all. For human input, LangGraph's documentation recommends the `interrupt` function instead. A node calls `interrupt(question)`; the run pauses on that line and returns the question to the caller; the caller continues with `Command(resume=answer)`, and the answer becomes `interrupt`'s return value inside the node. The question, the pause and the answer all live in the node that needs them. Breakpoints stay the tool for debugging ([lesson 14.1](lesson:14.1)).

## The feedback node, rewritten

The graph of [lesson 14.2](lesson:14.2)'s feedback section, with the question asked inside the node. A stand-in plays the model, as in lesson 14.2, so every cell runs without a key:

```python title="Notebook cell"
import re

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import MessagesState, StateGraph, START, END
from langgraph.types import Command, interrupt


def calculator(state: MessagesState):
    """Stand-in for the model: multiplies the last two numbers of the last message."""
    a, b = map(int, re.findall(r"\d+", state["messages"][-1].content)[-2:])
    return {"messages": [AIMessage(content=f"{a} times {b} is {a * b}.")]}


def human_feedback(state: MessagesState):
    feedback = interrupt("Tell me how you want to update the state:")
    return {"messages": [HumanMessage(content=feedback)]}


builder = StateGraph(MessagesState)
builder.add_node("human_feedback", human_feedback)
builder.add_node("assistant", calculator)
builder.add_edge(START, "human_feedback")
builder.add_edge("human_feedback", "assistant")
builder.add_edge("assistant", END)
graph = builder.compile(checkpointer=MemorySaver())
```

Two changes: `human_feedback` asks with `interrupt` and returns the answer as a message, and `compile` has no `interrupt_before`. The checkpointer stays, because the pause is saved like any other step.

```python title="Notebook cell"
thread = {"configurable": {"thread_id": "5"}}
result = graph.invoke({"messages": "Multiply 2 and 3"}, thread)
result
```

```output real note="IDs vary per run"
{'messages': [HumanMessage(content='Multiply 2 and 3', additional_kwargs={}, response_metadata={}, id='ca48acf3-9622-491e-8348-57b2ea4a0917')],
 '__interrupt__': [Interrupt(value='Tell me how you want to update the state:', id='ffc87d301f87298ca6d790376cb7cb09', response_schema=None)]}
```

`invoke` returned the state so far plus an `__interrupt__` key: a list of `Interrupt` objects, each with the `value` passed to `interrupt`, an `id`, and a `response_schema` (see "More options"). The value can be any JSON-serialisable data: a question, a draft to review, a tool call to approve. The snapshot shows the pause too:

```python title="Notebook cell"
snapshot = graph.get_state(thread)
snapshot.next, snapshot.interrupts
```

```output real note="the interrupt ID varies per run"
(('human_feedback',),
 (Interrupt(value='Tell me how you want to update the state:', id='ffc87d301f87298ca6d790376cb7cb09', response_schema=None),))
```

Now answer:

```python title="Notebook cell"
result = graph.invoke(Command(resume="please multiply 5 and 6"), thread)
for m in result["messages"]:
    m.pretty_print()
```

```output real
================================ Human Message =================================

Multiply 2 and 3
================================ Human Message =================================

please multiply 5 and 6
================================== Ai Message ==================================

5 times 6 is 30.
```

`Command(resume=...)` is the input that continues a paused thread. Its value became `feedback` inside the node, the node returned it as a message, and the run went on: no `update_state`, no `as_node`. The caller's whole job is a loop: invoke, and while the result has an `__interrupt__`, show its value to the person and invoke again with their answer (practice 2).

## The node runs again

`interrupt` pauses by raising a special exception, `GraphInterrupt`, which stops the node; LangGraph saves the pause in a checkpoint. On resume it runs the node again from its first line, and this time `interrupt` returns the answer instead of raising. Two prints show it:

```python title="Notebook cell"
def human_feedback(state: MessagesState):
    print("human_feedback starts")
    feedback = interrupt("Tell me how you want to update the state:")
    print(f"interrupt returned {feedback!r}")
    return {"messages": [HumanMessage(content=feedback)]}


builder = StateGraph(MessagesState)
builder.add_node("human_feedback", human_feedback)
builder.add_node("assistant", calculator)
builder.add_edge(START, "human_feedback")
builder.add_edge("human_feedback", "assistant")
builder.add_edge("assistant", END)
graph = builder.compile(checkpointer=MemorySaver())

thread = {"configurable": {"thread_id": "6"}}
graph.invoke({"messages": "Multiply 2 and 3"}, thread)
print("--- the person answers")
graph.invoke(Command(resume="please multiply 5 and 6"), thread)["messages"][-1].content
```

```output real
human_feedback starts
--- the person answers
human_feedback starts
interrupt returned 'please multiply 5 and 6'
'5 times 6 is 30.'
```

The first line of the node ran twice. Whatever comes before `interrupt` repeats on resume: a log line is harmless, an email sent or a row inserted is not. Put side effects after the `interrupt` call or in a node of their own, or make them idempotent (an upsert instead of an insert).

::: visual pause-and-resume | Figure | Two ways to pause
Where a breakpoint and an interrupt stop, what the caller gets, how each run continues, and what runs again.
:::

| | Breakpoint | `interrupt()` |
|---|---|---|
| Set | By node name, at compile or per call | In a node's code |
| Pauses | Every time, before or after the node | When the code calls it, so it can depend on the state |
| The caller learns | Nothing; it checks `get_state(config).next` | The value, under `__interrupt__` |
| Continue with | `invoke(None, config)` | `invoke(Command(resume=answer), config)` |
| The person's input | Written with `update_state` and `as_node` | Returned by `interrupt` inside the node |
| On continue | The node runs for the first time | The node runs again from its first line |
| Best for | Debugging, stepping through a run, Studio | Approvals, questions, reviews |

## Approve, edit or reject a tool call

The approval step of [lesson 9.7](lesson:9.7), built into a graph: a `review` node between the model and the tools shows the person the pending tool calls and routes by their decision. A node can return a `Command` too ([lesson 13.3](lesson:13.3)): `goto` names the next node, `update` changes the state on the way. The stand-in model this time asks for a tool:

```python title="Notebook cell"
from typing import Literal

from langchain_core.messages import ToolMessage
from langgraph.prebuilt import ToolNode, tools_condition


def multiply(a: int, b: int) -> int:
    """Multiply a and b."""
    return a * b


def tool_caller(state: MessagesState):
    """Stand-in for a model with tools: asks multiply for the last two numbers, then reports the tool's answer."""
    last = state["messages"][-1]
    if isinstance(last, ToolMessage):
        return {"messages": [AIMessage(content=f"The tool said: {last.content}")]}
    a, b = map(int, re.findall(r"\d+", last.content)[-2:])
    return {"messages": [AIMessage(content="", tool_calls=[{"name": "multiply", "args": {"a": a, "b": b}, "id": "call_1"}])]}


def review(state: MessagesState) -> Command[Literal["tools", "assistant"]]:
    request = state["messages"][-1]
    decision = interrupt({"tool_calls": request.tool_calls})
    if decision["type"] == "approve":
        return Command(goto="tools")
    if decision["type"] == "edit":
        calls = [{**call, "args": decision["args"]} for call in request.tool_calls]
        return Command(goto="tools", update={"messages": [request.model_copy(update={"tool_calls": calls})]})
    refusals = [ToolMessage(content=f"Not run: {decision['reason']}", tool_call_id=call["id"], status="error")
                for call in request.tool_calls]
    return Command(goto="assistant", update={"messages": refusals})


builder = StateGraph(MessagesState)
builder.add_node("assistant", tool_caller)
builder.add_node("review", review)
builder.add_node("tools", ToolNode([multiply]))
builder.add_edge(START, "assistant")
builder.add_conditional_edges("assistant", tools_condition, {"tools": "review", END: END})
builder.add_edge("tools", "assistant")
agent = builder.compile(checkpointer=MemorySaver())

for edge in agent.get_graph().edges:
    kind = " (conditional)" if edge.conditional else ""
    print(f"{edge.source} -> {edge.target}{kind}")
```

```output real
__start__ -> assistant
assistant -> __end__ (conditional)
assistant -> review (conditional)
review -> assistant (conditional)
review -> tools (conditional)
tools -> assistant
```

`tools_condition` returns `"tools"` when the model asks for tools; the path map `{"tools": "review", END: END}` sends that route to `review` instead. `review` has no outgoing edges of its own: its return hint, `Command[Literal["tools", "assistant"]]`, tells LangGraph where it may go, which is why the edges list both. The same question, three decisions:

```python title="Notebook cell"
decisions = [
    {"type": "approve"},
    {"type": "edit", "args": {"a": 2, "b": 30}},
    {"type": "reject", "reason": "wrong numbers, ask the user again"},
]
for i, decision in enumerate(decisions):
    thread = {"configurable": {"thread_id": f"review-{i}"}}
    result = agent.invoke({"messages": "Multiply 2 and 3"}, thread)
    pending = result["__interrupt__"][0].value["tool_calls"][0]
    result = agent.invoke(Command(resume=decision), thread)
    print(f"{decision['type']:<7} {pending['name']}{pending['args']} -> {result['messages'][-1].content}")
```

```output real
approve multiply{'a': 2, 'b': 3} -> The tool said: 6
edit    multiply{'a': 2, 'b': 3} -> The tool said: 60
reject  multiply{'a': 2, 'b': 3} -> The tool said: Not run: wrong numbers, ask the user again
```

- **Approve** goes to `tools`, which runs the call as the model asked.
- **Edit** replaces the model's message with a copy carrying the person's arguments (same ID, so `add_messages` swaps it, [lesson 14.2](lesson:14.2)) and then runs the tools.
- **Reject** runs nothing. Every pending call gets a `ToolMessage` with `status="error"` and the reason, and the run goes back to the model. Providers refuse a conversation in which a tool call has no result, and the reason gives the model something to act on instead of retrying blindly.

`HumanInTheLoopMiddleware` ([lesson 9.7](lesson:9.7)) is this node, packaged for `create_agent`: it calls `interrupt` after the model with the pending calls, and its decisions map onto the same three routes, plus `respond`. Build the node yourself when the graph is your own, or when the review needs more than a decision per call: the state, a diff, a second reviewer.

## Rules of interrupts

| Rule | Because |
|---|---|
| Compile with a checkpointer and pass a `thread_id` | The pause is a checkpoint. Without a checkpointer, `interrupt` still stops the run, but resuming raises `RuntimeError: Cannot use Command(resume=...) without checkpointer` |
| Resume on the same thread | The thread ID is how LangGraph finds the paused run |
| Put side effects after `interrupt`, or make them idempotent | The node runs again from its first line on resume |
| Don't wrap `interrupt` in a bare `try`/`except Exception` | `GraphInterrupt` is an `Exception`: the handler swallows the pause and the node carries on without an answer |
| Keep several `interrupt` calls in one node in a fixed order | Answers are matched to calls by position; don't skip one conditionally or loop over a list that can change |
| Pass JSON-serialisable values | The value is saved with the checkpoint and sent to whatever shows it to the person |
| Pass only `Command(resume=...)` as input | `goto` and `update` are for nodes to return; a new turn of a conversation is a plain input dict |

To ask the same question until the answer is valid, call `interrupt` once per node run and loop with an edge back to the node, not with a `while` loop around `interrupt` inside it (practice 1).

## More options

| Option | What it does |
|---|---|
| `interrupt(value, response_schema=Decision)` | A Pydantic model, `TypedDict` or dataclass for the answer (LangGraph 1.2.12 and later). Its JSON schema travels with the interrupt, so a UI can draw a form; the answer is validated (a bad one raises `ValidationError`, and you resume again) and `interrupt` returns the parsed object |
| Several interrupts at once | Parallel nodes can pause in the same step. Resume them together with a dict from each interrupt's `id` to its answer: `Command(resume={i.id: answer_for(i) for i in result["__interrupt__"]})` |
| `invoke(..., version="v2")` | Returns an object with `.value`, the state, and `.interrupts`, instead of the `__interrupt__` key |
| `stream_events(..., version="v3")` | The event streaming LangGraph 1.2's documentation recommends; after the run, `stream.interrupted` and `stream.interrupts` report the pause. Experimental in 1.2.19: it warns with `LangChainBetaWarning` |

## Interview questions

::: check
A node sends the customer a confirmation email, then calls `interrupt()` to ask an agent whether to issue a refund. Customers get the email twice. Why, and how do you fix it?

On resume, LangGraph runs the node again from its first line; only the `interrupt` call behaves differently, returning the answer instead of pausing. So the email goes out once when the node pauses and again when it resumes. Move the email after the `interrupt` call, or into its own node before the review node (which ran once and is saved), or make it idempotent with a sent flag or a deduplication key on the email service.
:::

::: check
When would you still use a breakpoint instead of `interrupt()`?

For debugging and development: stepping through a run, stopping before a node to inspect or edit the state, setting breakpoints in Studio, or pausing one particular run with breakpoints passed to the call. They need no code change in the nodes. For production human-in-the-loop, `interrupt()` is the better fit: it pauses only when the code decides to, it carries the question and the data to show, the answer is handled and validated inside the node, and the caller just resumes.
:::

::: check
In a hand-built review node, how do you reject a tool call, and what must the state contain afterwards?

Route back to the model, not to the tools, with one `ToolMessage` per pending call, each with the call's `tool_call_id`, `status="error"` and the reason. The next model call fails if a tool call has no result, and the reason lets the model ask the user or choose another action instead of repeating the call. Keep the gate in place for any retry, and limit how many times the model may try again.
:::

::: check
A reviewer approves a paused run three hours later, from a web page served by another machine. What has to be true for the run to resume correctly?

The checkpoints must live in a database both machines use, such as Postgres, not in one process's memory. The application must have stored the thread ID with the review task and resume on that thread, with the interrupt ID if several are pending. The graph code must still match, with the same node names. The value shown to the reviewer must have been JSON-serialisable, and the decision should be validated (a `response_schema` does that) and logged with who made it.
:::

## Practice

::: practice
**Ask until the answer is valid.** Build a one-node form on a state with `age` (an `int` or `None`) and `question`. The node calls `interrupt` once with the current question; a valid answer (a positive whole number) sets `age`, anything else sets a new question that says what was wrong. A conditional edge loops back to the node until `age` is set. Answer `"thirty"`, then `"30"`.

```python title="Notebook cell"
from typing_extensions import TypedDict


class Form(TypedDict):
    age: int | None
    question: str


def ask_age(state: Form):
    answer = interrupt(state["question"])
    if answer.isdigit() and int(answer) > 0:
        return {"age": int(answer)}
    return {"question": f"{answer!r} is not a valid age. Please enter a positive number."}


def route(state: Form):
    return END if state["age"] is not None else "ask_age"


builder = StateGraph(Form)
builder.add_node("ask_age", ask_age)
builder.add_edge(START, "ask_age")
builder.add_conditional_edges("ask_age", route)
form = builder.compile(checkpointer=MemorySaver())

config = {"configurable": {"thread_id": "form"}}
result = form.invoke({"age": None, "question": "What is your age?"}, config)
for answer in ["thirty", "30"]:
    print("asked:", result["__interrupt__"][0].value)
    print("answer:", answer)
    result = form.invoke(Command(resume=answer), config)
print("age:", result["age"])
```

```output real
asked: What is your age?
answer: thirty
asked: 'thirty' is not a valid age. Please enter a positive number.
answer: 30
age: 30
```

Each node run calls `interrupt` exactly once, so resuming never replays earlier questions. The invalid answer ended the node's run with a new question in the state, the edge sent the run back, and the next run of the node paused with that question. A `while True` loop around `interrupt` inside the node would replay every earlier iteration on each resume.
:::

::: practice
**Drive a paused graph from a loop.** Write `ask(value)`, which prints the pending tool call from an interrupt's value and reads a decision with `input()`: `y` approves, anything else asks for a reason and rejects. Then write `run(graph, inputs, config)`, which invokes the graph and keeps resuming with `ask`'s decision while the result has an `__interrupt__`, and returns the last message. Run it twice on the review agent: approve the first request, reject the second.

```python title="Notebook cell" input="y|n|use 4 and 6"
def ask(value):
    call = value["tool_calls"][0]
    print(f"Run {call['name']}{call['args']}?")
    if input("(y/n) ").strip().lower() == "y":
        return {"type": "approve"}
    return {"type": "reject", "reason": input("Why not? ")}


def run(graph, inputs, config):
    result = graph.invoke(inputs, config)
    while "__interrupt__" in result:
        decision = ask(result["__interrupt__"][0].value)
        result = graph.invoke(Command(resume=decision), config)
    return result["messages"][-1].content


print(run(agent, {"messages": "Multiply 4 and 5"}, {"configurable": {"thread_id": "loop-1"}}))
print(run(agent, {"messages": "Multiply 4 and 5"}, {"configurable": {"thread_id": "loop-2"}}))
```

```output real
Run multiply{'a': 4, 'b': 5}?
The tool said: 20
Run multiply{'a': 4, 'b': 5}?
The tool said: Not run: use 4 and 6
```

The loop doesn't know what the graph asks or how often: a real model might call a tool, be refused, and call another, and each call pauses again. That loop is all a terminal, a chat window or a review queue needs; [lesson 14.5](lesson:14.5) runs it with Gemini.
:::

## Further reading

- LangGraph, [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts): the rules, typed answers, interrupts in tools and in subgraphs.
- LangChain, [Human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop): the same pause packaged as middleware for agents.
