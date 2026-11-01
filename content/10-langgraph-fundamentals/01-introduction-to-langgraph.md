+++
number = "10.1"
title = "Introduction to LangGraph"
lede = "LangGraph runs an LLM application as a graph: steps that share one state, and edges that decide which step runs next, including loops that a chain can't express. Learn its parts, how a run proceeds, and when it is the right tool."
summary = "Why agents outgrow chains, what LangGraph is and where it fits, state, nodes and edges, chains as DAGs and graphs with loops, how a run proceeds in super-steps, what the runtime adds, when to use it, interview questions and two practice tasks in plain Python."
type = "concept"
status = "published"
source = "10 Intro to LangGraph: 3 Intro to LangGraph.pdf (slides 1-2); the run model, runtime features, comparisons, interview questions and practice added"
chips = [["i-layers", "Concept"]]
+++

Modules [06](module:06) and [07](module:07) built chains: a prompt, a model and a parser, or a retriever feeding a prompt, run once and in a fixed order. An agent doesn't fit that shape. It calls the model, perhaps a tool, then the model again, as many times as the task needs ([lesson 8.1](lesson:8.1)), and `create_agent` packages exactly that loop ([lesson 9.4](lesson:9.4)). Real applications need control flow of their own: a fixed step before the model, a branch chosen by code, a retry until a check passes, a pause for a person's approval, several agents taking turns. LangGraph is the library for that. You describe the application as a graph of steps that share one state; LangGraph runs it, can save the state after every step, and streams what happens.

## What LangGraph is

LangGraph is a library for building stateful LLM applications with one or more actors: single agents, and workflows in which several agents work together. Its documentation calls it a low-level orchestration framework and runtime for long-running, stateful agents. Three words in those descriptions carry the meaning:

- **Stateful:** every step reads and updates one shared state, which the runtime can save after every step.
- **Multi-actor:** several model-driven steps, or whole agents, can share one graph, each as a node.
- **Low-level:** it doesn't write your prompts or choose an architecture. You decide which steps exist and how control moves between them, so coded steps (validate, fetch, format) and model-driven steps (decide, write) sit in one graph, each where you want it.

Its design borrows from three projects. Pregel, Google's system for computations on very large graphs, runs in rounds called super-steps, and so does LangGraph; its runtime class is even called `Pregel`. Apache Beam is a model for batch and streaming data pipelines. NetworkX, Python's graph library, lent the method names `add_node` and `add_edge`.

LangGraph is built by the company behind LangChain but doesn't need the `langchain` package: a node can call any SDK or plain Python. It does build on `langchain-core`, the package with LangChain's message classes, and most examples, these lessons included, use LangChain's chat models inside nodes.

LangGraph offers two ways to write a graph. The Graph API, used throughout these lessons, declares the steps and edges explicitly with `StateGraph`. The Functional API writes the same workflow as ordinary functions and loops, with `@entrypoint` marking the workflow and `@task` marking steps whose results are saved. Both run on the same runtime; the Graph API keeps the structure visible, to you, in drawings and in debugging tools.

## Where it fits

| You need | Use | Where |
|---|---|---|
| One model call, or fixed steps in a row such as a RAG chain | A LangChain chain | [6.1](lesson:6.1), [7.1](lesson:7.1) |
| A model that calls tools until it can answer | `create_agent`, a prebuilt LangGraph graph | [9.4](lesson:9.4) |
| Your own control flow: coded and model-driven steps, branches, loops, pauses, several agents | A LangGraph graph | This module to [module 15](module:15) |
| A record of every step of every run, and evaluations | LangSmith | [12.1](lesson:12.1) |
| A graph served as an API, with its state stored | LangSmith Deployment, formerly LangGraph Platform | [7.2](lesson:7.2) |

The layers stack: a chain can run inside a node, and `create_agent` returns a compiled LangGraph graph, so a whole agent can be one node of a bigger graph. Start with the highest layer that does the job, and drop down when it doesn't.

## The parts of a graph

The name says it: a language model application drawn as a graph, nodes joined by edges. Nodes do the work; edges decide which node works next; everything they share lives in the state.

| Part | What it is | In code |
|---|---|---|
| State | The data of one run: a dict with declared keys that every node reads | `class State(TypedDict): ...` |
| Node | One step: a function that receives the state and returns the keys it changes | `builder.add_node("name", function)` |
| Edge | The next step, always the same one | `builder.add_edge("a", "b")` |
| Conditional edge | A function that reads the state and returns the name of the next node | `builder.add_conditional_edges("a", route)` |
| `START`, `END` | Where a run enters, and where it stops | `builder.add_edge(START, "a")`, `builder.add_edge("b", END)` |
| Compiled graph | The checked, runnable result | `graph = builder.compile()`, then `graph.invoke(...)` |

A node is ordinary Python. It can call a model, a tool, a database or nothing at all, which is how coded and model-driven steps share one graph. [Lesson 10.2](lesson:10.2) builds a graph from these parts without any model.

Two shapes show the range. A *specific workflow* takes the same path every time: the input enters at `START`, a chatbot node calls the model once, and the run ends at `END` ([lesson 10.3](lesson:10.3) builds it). In a *complex workflow* the path depends on the run: the chatbot decides whether it needs the weather or the temperature, the matching node fetches it, and the result goes back to the chatbot, which decides again. That loop of model and tools is the agent loop of [lesson 8.1](lesson:8.1); [lesson 11.4](lesson:11.4) builds it as a graph.

## Chains are DAGs, graphs can loop

A directed graph whose edges never lead back to a node already visited is a directed acyclic graph, a DAG. LCEL chains are DAGs, as are most data-pipeline tools: data flows one way, and each step runs once. LangGraph was created to add what a DAG forbids, cycles, because an agent is a model in a loop: call it, act on its decision, call it again.

::: visual chain-vs-graph | Figure | A chain and a graph
The same question answered by a one-way chain and by a graph with shared state and a loop.
:::

The two graphs of this module happen to have no cycle; the agent graphs from [module 11](module:11) on all have one. A cycle needs a way out: a conditional edge that leads to `END` once the work is done, and a limit for the run that never gets there.

## How a run proceeds

LangGraph runs a graph in rounds called super-steps, the model it takes from Pregel:

1. `invoke` writes the input into the state and schedules the node or nodes after `START`.
2. In each super-step, every scheduled node runs. When edges fan out to several nodes, those nodes run in the same step, in parallel.
3. When the step's nodes have finished, their updates are applied to the state together, key by key. A key without a reducer takes the new value; a key with a reducer combines the old value and the update ([lesson 10.3](lesson:10.3)).
4. The edges of the nodes that ran schedule the next ones; a conditional edge calls its routing function on the updated state.
5. When no node is scheduled, the run ends and `invoke` returns the final state.

Two consequences matter in practice. Nodes in the same step don't see each other's updates, and if two of them write the same key without a reducer, LangGraph can't choose one and raises `InvalidUpdateError: At key 'graph_info': Can receive only one value per step. Use an Annotated key to handle multiple values.` Inside the runtime each key is a *channel*: a key without a reducer is a `LastValue` channel, which accepts one value per step; a key with a reducer is a `BinaryOperatorAggregate`, which folds in every update it receives.

Every super-step also counts against the run's `recursion_limit`, and a run that reaches it stops with `GraphRecursionError: Recursion limit of 25 reached without hitting a stop condition`. Since LangGraph 1.1.4 the default is 10,007 steps (versions before 1.0.6 stopped at 25), far more than a healthy run needs, so set your own ([lesson 8.1](lesson:8.1)).

## What the runtime adds

The graph is half of LangGraph. The runtime that executes it can save the state after every super-step, under a thread ID, through a *checkpointer*, and most of its features grow from that:

| Feature | What it gives | Where |
|---|---|---|
| Memory | A conversation continues across calls, from the state saved for its thread | [9.4](lesson:9.4) for agents, [11.5](lesson:11.5) for graphs |
| Human in the loop | A run pauses before a step, waits for a person's decision, and resumes from the saved state | [9.7](lesson:9.7) for agents, [14.1](lesson:14.1) to [14.3](lesson:14.3) for graphs |
| Time travel | Look back through a run's saved states, change one, and continue from there | [14.4](lesson:14.4) |
| Durable execution | A run that crashes resumes from its last saved step instead of starting over | - |
| Streaming | Each node's update, the whole state after each step, or the model's tokens as they are written | [10.3](lesson:10.3), [11.6](lesson:11.6) |
| Tracing and Studio | Every step of every run recorded, and the graph drawn and run in a visual tool | [Module 12](module:12) |

## When to use LangGraph

- **Not** for one model call or a fixed sequence of calls: a chain is shorter and does the same.
- **Not** for the standard tool loop on its own: `create_agent` is that graph, prebuilt, with middleware to customise it.
- **Yes** when the control flow is yours: steps in a set order around the model, branches decided by code, retries with a limit, a person's approval in the middle, parallel steps, several agents, or state beyond a list of messages.
- **Yes** when runs must outlive one call: long tasks that pause and resume, or conversations that continue on another server.

The advice of [lesson 8.1](lesson:8.1) holds: start with the simplest thing that works, and add graph structure when a real need appears.

## Interview questions

::: check
A teammate built a support flow as an LCEL chain. Now it must search again when retrieval finds nothing, and wait for a person before any refund. Why move it to LangGraph, and what would the graph look like?

Both needs break a one-way chain: searching again is a loop, and waiting for a person means saving the run's state while nobody is at the keyboard. As a graph: a retrieve node; a grade node whose router goes back to a rewrite-and-retrieve node or on to the answer, with a retry count in the state so the loop ends; a refund node that pauses for approval; and a checkpointer so the paused run can resume later (lessons [15.4](lesson:15.4) and [14.3](lesson:14.3)). The chain's prompt, model and parser can live on inside the answer node.
:::

::: check
When would you write your own `StateGraph` instead of using `create_agent`?

`create_agent` is a prebuilt graph: model, tools, repeat. Use it when that loop fits. Write a graph when steps must happen in a fixed order around the model (validate the input, retrieve, then answer), when code should decide a branch, when several agents or models take turns, when steps should run in parallel, or when the state holds more than messages. An agent can still be one node of that graph.
:::

::: check
What is a super-step, and why does it matter when two nodes run at once?

A super-step is one round of a run: every node scheduled for it runs, possibly in parallel, and their updates are applied together when all have finished, each key through its reducer. Nodes in the same step don't see each other's updates. If two of them write the same key and that key has no reducer, LangGraph can't choose and raises `InvalidUpdateError` ("Can receive only one value per step"). Give the key a reducer, such as `operator.add` for a list, and both updates are kept.
:::

::: check
A graph raised `GraphRecursionError` in production. What happened, and what do you change?

A loop never reached `END` within `recursion_limit` super-steps: a router that never routes out, a model that keeps calling tools, a check that never passes. Fix the exit first: count attempts in the state and route out after a few, and give the model a clear way to finish. Then set `recursion_limit` deliberately for each call (the default, 10,007, is far too generous for paid model calls), and catch the error to return a fallback answer. A trace of the failing run shows which loop spun ([lesson 12.1](lesson:12.1)).
:::

::: check
What does LangGraph give you that a hand-written `while` loop doesn't?

The loop itself is easy; the rest isn't. LangGraph saves the state after every step (so a run can pause for a person, resume after a crash, or continue a conversation on another server), streams updates and tokens while it runs, runs independent steps in parallel and merges their updates in a defined way, and records each step for tracing and visual debugging. For a small loop that needs none of that, a `while` loop is fine ([lesson 8.1](lesson:8.1)).
:::

## Practice

::: practice
**A graph runner.** Write `run(nodes, edges, state, max_steps)`: start at the node that `edges[START]` names, merge each node's update into the state, follow the node's edge (a node name, or a function of the state that returns one), stop at `END`, and raise an error after `max_steps` steps. Test it on a flaky API call that a routing function retries until it succeeds, then on one that never succeeds.

```python title="Notebook cell"
START, END = "__start__", "__end__"


def run(nodes, edges, state, max_steps=10):
    node = edges[START]
    for step in range(1, max_steps + 1):
        update = nodes[node](state)
        state = {**state, **update}              # no reducers: each returned key replaces the old value
        print(f"step {step}: {node} -> {update}")
        follow = edges[node]
        node = follow(state) if callable(follow) else follow
        if node == END:
            return state
    raise RuntimeError(f"stopped after {max_steps} steps without reaching END")


def call_api(state):
    attempts = state["attempts"] + 1
    return {"attempts": attempts, "ok": attempts >= state["succeeds_on"]}


def retry_or_finish(state):
    return END if state["ok"] else "call_api"


nodes = {"call_api": call_api}
edges = {START: "call_api", "call_api": retry_or_finish}

print(run(nodes, edges, {"attempts": 0, "ok": False, "succeeds_on": 3}))
try:
    run(nodes, edges, {"attempts": 0, "ok": False, "succeeds_on": 99}, max_steps=4)
except RuntimeError as error:
    print("RuntimeError:", error)
```

```output real
step 1: call_api -> {'attempts': 1, 'ok': False}
step 2: call_api -> {'attempts': 2, 'ok': False}
step 3: call_api -> {'attempts': 3, 'ok': True}
{'attempts': 3, 'ok': True, 'succeeds_on': 3}
step 1: call_api -> {'attempts': 1, 'ok': False}
step 2: call_api -> {'attempts': 2, 'ok': False}
step 3: call_api -> {'attempts': 3, 'ok': False}
step 4: call_api -> {'attempts': 4, 'ok': False}
RuntimeError: stopped after 4 steps without reaching END
```

That is LangGraph's contract in miniature: nodes return updates, edges choose the next node, a loop ends when a router returns `END`, and the step limit (`recursion_limit`) stops a loop that never does. A real retry loop would also give up on its own, with `END if state["ok"] or state["attempts"] >= 3`; the limit is the last line of defence. LangGraph adds what this runner lacks: super-steps with parallel nodes, reducers, saved state and streaming.
:::

::: practice
**Check a graph.** Describe a graph as data: `edges` maps each node to the nodes it may go to (a router lists all its targets, as a `Literal` hint does). Write `check(nodes, edges)` that reports a missing entry point, edges to unknown nodes, nodes that `START` never reaches, and nodes that can't reach `END`. Try it on the game graph of [lesson 10.2](lesson:10.2) with a typo and a forgotten node.

```python title="Notebook cell"
from collections import deque

START, END = "__start__", "__end__"


def reachable(first, edges):
    seen, queue = {first}, deque([first])
    while queue:
        for nxt in edges.get(queue.popleft(), []):
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return seen


def check(nodes, edges):
    problems = []
    if START not in edges:
        problems.append("no edge from START")
    known = set(nodes) | {START, END}
    for source, targets in edges.items():
        problems += [f"{source} -> {target}: unknown node" for target in targets if target not in known]
    from_start = reachable(START, edges)
    problems += [f"{node}: START never reaches it" for node in nodes if node not in from_start]
    backwards = {}
    for source, targets in edges.items():
        for target in targets:
            backwards.setdefault(target, []).append(source)
    to_end = reachable(END, backwards)
    problems += [f"{node}: can't reach END" for node in nodes if node not in to_end]
    return problems or ["ok"]


nodes = ["start_play", "cricket", "badminton", "football"]
edges = {
    START: ["start_play"],
    "start_play": ["cricket", "badmington"],     # a typo
    "cricket": [END],
    "badminton": [END],
}
for problem in check(nodes, edges):
    print(problem)
```

```output real
start_play -> badmington: unknown node
badminton: START never reaches it
football: START never reaches it
football: can't reach END
```

Two breadth-first searches do the work: forwards from `START`, and backwards from `END` over reversed edges. LangGraph's `compile` catches the first kinds of mistake (no entry point, unknown targets) but accepts a node nothing leads to and a node with no way out ([lesson 10.2](lesson:10.2)). Cycles are allowed in both: a node in a loop still reaches `END` as long as some router leads out.
:::

## Further reading

- LangChain, [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview): what LangGraph is for, its core benefits, and how it relates to LangChain and LangSmith.
- LangChain, [Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api): state, reducers, nodes, edges, super-steps and the recursion limit.
- LangChain blog, [LangGraph](https://www.langchain.com/blog/langgraph) (2024): why LangGraph added cycles to LangChain's chains.
- Malewicz and others, [Pregel: a system for large-scale graph processing](https://research.google/pubs/pregel-a-system-for-large-scale-graph-processing/) (2010): the super-step model LangGraph runs on.
