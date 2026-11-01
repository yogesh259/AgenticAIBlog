+++
number = "10.2"
title = "Your first graph"
lede = "The smallest graph with every part: a state, three nodes and a branch chosen by a function. Build it, draw it, run it, and see which mistakes compile catches and which it lets through."
summary = "Install LangGraph, define a TypedDict state, write nodes that return updates and a routing function with a Literal hint, build and compile a StateGraph, draw it, invoke it, follow the state through a run, the mistakes compile catches and those it doesn't, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "10 Intro to LangGraph: 1-simplegraph.ipynb (cells 1-9; the user's name replaced, builder and graph renamed); the drawing note, common mistakes, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

[Lesson 10.1](lesson:10.1) named the parts of a graph. This lesson builds the smallest graph that uses all of them, with no model involved, so every cell runs without an API key. The graph finishes a sentence about the game Alice will play: one node starts the sentence, a routing function tosses a coin, and one of two nodes ends it.

## Install LangGraph

Add one line to `requirements.txt` and run your install command again ([lesson 0.1](lesson:0.1)):

```text title="requirements.txt"
langgraph
```

`langchain` already installs LangGraph ([lesson 9.1](lesson:9.1)); listing it names a package your code imports directly.

## Define the state

```python title="Notebook cell"
from typing_extensions import TypedDict


class State(TypedDict):
    graph_info: str
```

The state is the data a run carries from node to node, here a single string. Its class is the schema of the whole graph: every node and routing function receives the state in this shape, and `invoke` takes and returns a dict with these keys. A `TypedDict` only declares them; nothing checks the values while the graph runs ([lesson 4.1](lesson:4.1)). `typing_extensions` is a backport package; on Python 3.12, `from typing import TypedDict` does the same ([lesson 5.2](lesson:5.2), section 2).

## Write the nodes

```python title="Notebook cell"
def start_play(state: State):
    print("Start_Play node has been called")
    return {"graph_info": state["graph_info"] + " I am planning to play"}


def cricket(state: State):
    print("My Cricket node has been called")
    return {"graph_info": state["graph_info"] + " Cricket"}


def badminton(state: State):
    print("My badminton node has been called")
    return {"graph_info": state["graph_info"] + " Badminton"}
```

A node is a plain function. It receives the current state, all of it, and returns a dict with only the keys it changes: an *update*. `graph_info` has no reducer, so the graph replaces the old value with the returned one. A node that returns `{}` or `None` changes nothing. The prints are there only to show the order in which the nodes run.

## Route with a function

```python title="Notebook cell"
import random
from typing import Literal


def random_play(state: State) -> Literal["cricket", "badminton"]:
    graph_info = state["graph_info"]

    if random.random() > 0.5:
        return "cricket"
    else:
        return "badminton"
```

A routing function receives the state too, but returns the *name* of the node to run next instead of an update. This one reads `graph_info` and then ignores it: the choice is a coin toss. The return hint matters more than it looks. LangGraph reads the `Literal` to learn every node the edge can lead to: it draws the graph from that list, and checks when compiling that each name is a real node.

## Build the graph

```python title="Notebook cell"
from IPython.display import Image, display
from langgraph.graph import StateGraph, START, END

## Build Graph
builder = StateGraph(State)

## Adding the nodes
builder.add_node("start_play", start_play)
builder.add_node("cricket", cricket)
builder.add_node("badminton", badminton)

## Schedule the flow of the graph
builder.add_edge(START, "start_play")
builder.add_conditional_edges("start_play", random_play)
builder.add_edge("cricket", END)
builder.add_edge("badminton", END)

## Compile the graph
graph = builder.compile()
```

- `StateGraph(State)` creates a *builder* for a graph over that state.
- `add_node(name, function)` registers a node; edges refer to it by name.
- `add_edge(a, b)` always runs `b` after `a`. `START` and `END` are not functions: `START` marks where the input goes in, `END` where the run stops.
- `add_conditional_edges("start_play", random_play)` calls the routing function after `start_play` and runs the node whose name it returns.
- `compile()` checks the structure and returns the runnable graph, a `CompiledStateGraph`. It has the Runnable methods of [lesson 7.1](lesson:7.1): `invoke`, `stream`, `batch` and their async versions. Checkpointers and breakpoints are passed to `compile` too (lessons [11.5](lesson:11.5) and [14.1](lesson:14.1)).

To see the graph, ask the compiled graph for a drawing:

```python title="Notebook cell" norun
## View
display(Image(graph.get_graph().draw_mermaid_png()))
```

`draw_mermaid_png()` sends the graph's description to mermaid.ink, a web service that renders it as a picture, so it needs internet access; offline, `print(graph.get_graph().draw_mermaid())` gives the same description as text. The picture draws fixed edges as solid arrows and conditional edges as dotted ones, the same edges this loop prints:

```python title="Notebook cell"
for edge in graph.get_graph().edges:
    kind = " (conditional)" if edge.conditional else ""
    print(f"{edge.source} -> {edge.target}{kind}")
```

```output real
__start__ -> start_play
start_play -> badminton (conditional)
start_play -> cricket (conditional)
badminton -> __end__
cricket -> __end__
```

`__start__` and `__end__` are the names behind `START` and `END`. The two conditional edges come from the `Literal` hint.

## Run it

```python title="Notebook cell"
graph.invoke({"graph_info": "Hey My name is Alice"})
```

```output real note="the coin picks the sport, so the output varies per run"
Start_Play node has been called
My Cricket node has been called
{'graph_info': 'Hey My name is Alice I am planning to play Cricket'}
```

The input dict becomes the state. The printed lines come first, in the order the nodes ran; then `invoke` returns the final state, the whole dict. Run the cell a few times and the coin takes the other branch now and then.

::: visual graph-run | Run player | A state through a graph
The same run one step at a time: which node runs, what it returns, and how the state changes.
:::

## What compile catches, and what it doesn't

`compile` checks the structure; everything else shows up only when the graph runs, if at all. With this lesson's names, checked with LangGraph 1.2:

| Mistake | What happens |
|---|---|
| No edge from `START` | `compile` raises `ValueError: Graph must have an entrypoint: add at least one edge from START to another node` |
| `"end"` written instead of `END` | `compile` raises `` ValueError: Found edge ending at unknown node `end` `` |
| A `Literal` value that is not a node, such as `"tennis"` | `compile` raises `ValueError: At 'start_play' node, 'random_play' branch found unknown target 'tennis'` |
| The router returns a name missing from its `Literal` | `invoke` raises `KeyError` with that name |
| No `Literal` hint (and no `path_map` list of targets) | Runs, but LangGraph doesn't know the targets: the drawing shows `start_play` going straight to `__end__`, and the sports unconnected |
| A node returns a string instead of a dict | `invoke` raises `InvalidUpdateError: Expected dict, got Hey My name is Alice I am planning to play` |
| A node returns a key the state doesn't have | Nothing: the update is dropped and the state keeps its old value |
| A value of the wrong type | Accepted; the error comes later, in whichever node uses the value ([lesson 11.1](lesson:11.1) validates state with Pydantic) |
| A node that nothing leads to | Compiles, and never runs |
| A loop with no way out | `invoke` raises `GraphRecursionError` when the step limit is reached ([lesson 10.1](lesson:10.1)) |

The quietest is the misspelt key:

```python title="Notebook cell"
def start_play_typo(state: State):
    return {"graph_infos": state["graph_info"] + " I am planning to play"}


broken = StateGraph(State)
broken.add_node("start_play", start_play_typo)
broken.add_edge(START, "start_play")
broken.add_edge("start_play", END)
broken.compile().invoke({"graph_info": "Hey My name is Alice"})
```

```output real
{'graph_info': 'Hey My name is Alice'}
```

No error and no warning. `graph_infos` is not a key of the state, so LangGraph drops it; even the stream of updates reports `{'start_play': None}`. A test that checks the state after a run is what catches it.

## Interview questions

::: check
A node returns `{"graph_infos": ...}` by mistake. What happens, and how would you catch it?

LangGraph drops keys the state doesn't declare, without an error or a warning: the state keeps its old value, the run carries on, and the bug surfaces later as an update that never happened. Even streaming the updates shows nothing for that node. Catch it with tests that run the graph, or a single node, on a known state and check the result, and keep update keys in one place, the state class, so a misspelling stands out in review.
:::

::: check
Why does the routing function's return hint matter, when routing works without it?

LangGraph reads the `Literal` values as the edge's possible targets. `compile` checks that each is a node, the drawing gets a dotted edge to each, and a returned name outside the list fails loudly. Without the hint, or a `path_map` listing the targets, routing still works at run time, but LangGraph doesn't know where the edge can go: the drawing shows an edge to `__end__` and leaves the real targets unconnected, which misleads anyone reading the graph or debugging it in a visual tool.
:::

::: check
What does `compile` check, and what does it leave to run time?

It checks that `START` has an edge, that every edge joins known nodes, and that routers' declared targets exist; it is also where checkpointers and breakpoints are attached. It runs nothing, so a node nothing leads to, a node with no way out (the run just stops there), a loop without an exit, values of the wrong type and misspelt update keys all compile. Tests that invoke the graph catch those.
:::

## Practice

::: practice
**Pick the sport from the text.** Add a `football` node, and replace the coin with a router that reads `graph_info`: cricket or football when the text mentions one, badminton otherwise. Run the graph on three sentences.

```python title="Notebook cell"
def football(state: State):
    print("My football node has been called")
    return {"graph_info": state["graph_info"] + " Football"}


def choose_sport(state: State) -> Literal["cricket", "badminton", "football"]:
    text = state["graph_info"].lower()
    if "cricket" in text:
        return "cricket"
    if "football" in text:
        return "football"
    return "badminton"


builder = StateGraph(State)
builder.add_node("start_play", start_play)
builder.add_node("cricket", cricket)
builder.add_node("badminton", badminton)
builder.add_node("football", football)
builder.add_edge(START, "start_play")
builder.add_conditional_edges("start_play", choose_sport)
for sport in ["cricket", "badminton", "football"]:
    builder.add_edge(sport, END)
sports = builder.compile()

for text in ["Alice loves football", "Bob likes cricket", "Carol has no idea"]:
    print(sports.invoke({"graph_info": text})["graph_info"])
```

```output real
Start_Play node has been called
My football node has been called
Alice loves football I am planning to play Football
Start_Play node has been called
My Cricket node has been called
Bob likes cricket I am planning to play Cricket
Start_Play node has been called
My badminton node has been called
Carol has no idea I am planning to play Badminton
```

The router decides from the state, so the same input always takes the same path, which makes the graph testable. The third value in the `Literal` is all LangGraph needs to know about the new edge; the nodes and the other edges are reused unchanged.
:::

::: practice
**Roll until six.** Build a graph whose `roll` node rolls a die and counts the rolls, with a conditional edge that goes back to `roll` until it rolls a six. Stream the run with a `recursion_limit` of 10, and catch the error an unlucky run raises.

```python title="Notebook cell"
import random
from typing import Literal

from langgraph.errors import GraphRecursionError


class Dice(TypedDict):
    last: int
    rolls: int


def roll(state: Dice):
    return {"last": random.randint(1, 6), "rolls": state["rolls"] + 1}


def again(state: Dice) -> Literal["roll", END]:
    return END if state["last"] == 6 else "roll"


builder = StateGraph(Dice)
builder.add_node("roll", roll)
builder.add_edge(START, "roll")
builder.add_conditional_edges("roll", again)
dice = builder.compile()

try:
    for update in dice.stream({"last": 0, "rolls": 0}, {"recursion_limit": 10}):
        print(update)
except GraphRecursionError:
    print("No six in nine rolls: the step limit stopped the run")
```

```output real note="random rolls: the output varies per run"
{'roll': {'last': 5, 'rolls': 1}}
{'roll': {'last': 3, 'rolls': 2}}
{'roll': {'last': 1, 'rolls': 3}}
{'roll': {'last': 1, 'rolls': 4}}
{'roll': {'last': 3, 'rolls': 5}}
{'roll': {'last': 5, 'rolls': 6}}
{'roll': {'last': 4, 'rolls': 7}}
{'roll': {'last': 1, 'rolls': 8}}
{'roll': {'last': 5, 'rolls': 9}}
{'roll': {'last': 1, 'rolls': 10}}
No six in nine rolls: the step limit stopped the run
```

The edge from `roll` back to itself makes a cycle, and `END` in the `Literal` lists the way out. `stream` yields one update per step, so you can watch the loop. With a limit of 10, the run must reach `END` within nine node runs: a tenth step still runs, then the run stops with `GraphRecursionError`, as in the run above. About one run in five finds no six in nine rolls. A real loop should count its own attempts in the state and route to `END` after a few; the limit catches the loops you didn't foresee.
:::
