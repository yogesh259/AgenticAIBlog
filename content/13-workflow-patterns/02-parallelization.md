+++
number = "13.2"
title = "Parallelization"
lede = "Run independent steps at the same time and merge their results: three model calls fan out from START, run in one super-step, and a fourth node combines them. The run takes as long as the slowest branch, not the sum."
summary = "Sectioning and voting, when parallel steps pay off, the story-elements graph, how LangGraph runs a fan-out (super-steps, a thread pool, finish order), fan-in and the uneven-branch trap with waiting edges and defer, a failing branch, retries, rate limits and max_concurrency, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "13 Different Workflow in LangGraph: 24-28+Workflows.pdf (slide 2); 2-parallelization.ipynb (cells 1-8; retired Groq model replaced, builder and graph renamed); timing, uneven branches, failures, rate limits, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

In the story chain of [lesson 13.1](lesson:13.1) every step needed the previous one's output, so each call waited for the last. Often the calls don't depend on each other: a story's characters, its setting and its premise can be written separately, and three reviewers can judge the same text without seeing each other's verdicts. Run such calls at the same time and the wait shrinks from the sum of the calls to the slowest one.

## Two kinds of parallel work

Anthropic's guide names two variations:

- **Sectioning:** split a task into independent subtasks and run them at once. The story below writes characters, setting and premise in parallel; a support bot can check a message for policy problems while another call drafts the answer.
- **Voting:** run the same task several times, with different prompts or models, and combine the answers: a majority vote on whether content is safe, several reviewers looking for different kinds of bug, the best of three drafts.

Both end with a merge, an *aggregator* that combines the parallel results. The payoff is latency, plus calls that each focus on one aspect. It is not cost: the same calls run, and the merge may add one. The pattern fits when the subtasks are independent and known in advance; when their number depends on the input, the orchestrator-worker pattern of [lesson 13.4](lesson:13.4) plans them at run time.

## The graph

```python title="Notebook cell" norun
from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-120b")
```

Any provider of [lesson 13.1](lesson:13.1) works.

```python title="Notebook cell"
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from IPython.display import Image, display


# Graph state
class State(TypedDict):
    topic: str
    characters: str
    settings: str
    premises: str
    story_intro: str
```

```python title="Notebook cell"
# Nodes
def generate_characters(state: State):
    """Generate character descriptions"""
    msg = llm.invoke(f"Create two character names and brief traits for a story about {state['topic']}")
    return {"characters": msg.content}


def generate_setting(state: State):
    """Generate a story setting"""
    msg = llm.invoke(f"Describe a vivid setting for a story about {state['topic']}")
    return {"settings": msg.content}


def generate_premise(state: State):
    """Generate a story premise"""
    msg = llm.invoke(f"Write a one-sentence plot premise for a story about {state['topic']}")
    return {"premises": msg.content}


def combine_elements(state: State):
    """Combine characters, setting, and premise into an intro"""
    msg = llm.invoke(
        f"Write a short story introduction using these elements:\n"
        f"Characters: {state['characters']}\n"
        f"Setting: {state['settings']}\n"
        f"Premise: {state['premises']}"
    )
    return {"story_intro": msg.content}
```

Each of the first three nodes writes its own key, so their updates can't collide. Two parallel nodes writing the same key without a reducer would fail the run with `InvalidUpdateError` ([lesson 10.1](lesson:10.1)); practice 2 below shows the error and the fix. `combine_elements` is the aggregator: here a fourth model call, though plain code that joins the parts would also do.

```python title="Notebook cell"
# Build the graph
builder = StateGraph(State)
builder.add_node("character", generate_characters)
builder.add_node("setting", generate_setting)
builder.add_node("premise", generate_premise)
builder.add_node("combine", combine_elements)
```

```output real note="the address varies per run"
<langgraph.graph.state.StateGraph at 0x1c22a9b4830>
```

`add_node` returns the builder itself, so calls can be chained; the notebook shows it because it is the cell's last expression.

```python title="Notebook cell"
# Define edges (parallel execution from START)
builder.add_edge(START, "character")
builder.add_edge(START, "setting")
builder.add_edge(START, "premise")
builder.add_edge("character", "combine")
builder.add_edge("setting", "combine")
builder.add_edge("premise", "combine")
builder.add_edge("combine", END)

# Compile and run
graph = builder.compile()
```

```python title="Notebook cell" norun
graph_image = graph.get_graph().draw_mermaid_png()
display(Image(graph_image))
```

```python title="Notebook cell"
for edge in graph.get_graph().edges:
    print(f"{edge.source} -> {edge.target}")
```

```output real
__start__ -> character
__start__ -> premise
__start__ -> setting
character -> combine
premise -> combine
setting -> combine
combine -> __end__
```

Three edges leave `START`: a *fan-out*. Three edges enter `combine`: a *fan-in*. Nothing else marks the branches as parallel; LangGraph runs together whatever is scheduled for the same step.

```python title="Notebook cell" norun
state = {"topic": "time travel"}
result = graph.invoke(state)
print(result["story_intro"])
```

```output saved note="from a run with Qwen 2.5 32B, since retired; trimmed to two of four paragraphs; answers vary per run"
In the heart of a bustling, neon-lit metropolis, where the pulse of the future beats in synchrony with the rhythm of an ancient alleyway known as Time’s Passage, stands a curious library. This library, a labyrinth of time and knowledge, is the sanctuary of Evelyn "Eve" Turner, a historian with an encyclopedic mind and a heart brimming with curiosity for the past. Her companion is Jasper "Jax" Hawkins, an engineer of unparallelled skill and an adventurer at heart, who specializes in the mechanics of time travel devices. Together, they are about to embark on an adventure that will rewrite the very fabric of their reality.
...
In this new, altered reality, the duo must navigate the changes they've wrought, unravel the mystery of their unintended consequences, and find a way to restore the timeline they know. Their journey will take them across eras and across the world, testing not only their wits and skills but also their bond as they confront the weight of their actions and the vast, unpredictable power of time itself.
```

The introduction uses all three parts: two named characters, a time-worn library as the setting, and a trip to the past that changes the future as the premise.

## How LangGraph runs a fan-out

A run proceeds in super-steps ([lesson 10.1](lesson:10.1)). Here step 1 runs `character`, `setting` and `premise` together, and step 2 runs `combine`, once, with all three keys filled. With `invoke` and `stream`, LangGraph runs the nodes of one step in a pool of threads; with `ainvoke` and `astream`, as asyncio tasks. Threads suit model calls, which spend their time waiting for the network; CPU-heavy Python code gains little from them ([lesson 2.10](lesson:2.10)).

To see the timing without a model, give the same graph stand-in nodes that sleep as long as a slow model call might:

```python title="Notebook cell"
import time


def stand_in(key, seconds):
    def node(state: State):
        time.sleep(seconds)  # stands in for a model call that takes this long
        return {key: f"{key} about {state['topic']}"}
    return node


def join(state: State):
    return {"story_intro": " + ".join([state["characters"], state["settings"], state["premises"]])}


builder = StateGraph(State)
builder.add_node("character", stand_in("characters", 0.6))
builder.add_node("setting", stand_in("settings", 0.2))
builder.add_node("premise", stand_in("premises", 0.4))
builder.add_node("combine", join)
for name in ["character", "setting", "premise"]:
    builder.add_edge(START, name)
    builder.add_edge(name, "combine")
builder.add_edge("combine", END)
timed = builder.compile()

start = time.perf_counter()
for update in timed.stream({"topic": "time travel"}):
    print(f"{time.perf_counter() - start:.1f}s {update}")
```

```output real note="timings vary slightly per run"
0.2s {'setting': {'settings': 'settings about time travel'}}
0.4s {'premise': {'premises': 'premises about time travel'}}
0.6s {'character': {'characters': 'characters about time travel'}}
0.6s {'combine': {'story_intro': 'characters about time travel + settings about time travel + premises about time travel'}}
```

Three things show here:

- **The run took 0.6 seconds**, the slowest branch, not the 1.2 seconds of the three in a row.
- **Updates stream in finish order**: `setting` first, though it was added second.
- **`combine` ran once, after all three**, and saw every key. The three updates were applied together at the end of step 1, so `combine` never sees a half-filled state.

Updates from one step that go into the same reducer key arrive in an order LangGraph's documentation doesn't promise. If the order matters, write each result with a label, or to its own key as here.

LCEL can run branches at once too: a dict in a chain becomes a `RunnableParallel` ([lesson 7.1](lesson:7.1)). The graph adds the rest of this lesson: results kept in the state, fan-in rules, retries and a resumable step.

## Branches of different lengths

Fan-in works as above only when every branch has the same number of steps. An edge into `combine` schedules it in the step after its source node runs, so give the premise branch a second node, `polish`, and `combine` runs twice: once in step 2, after `character` and `setting`, and again in step 3, after `polish`. A list of sources in one `add_edge` makes `combine` wait for all of them:

```python title="Notebook cell"
import operator
from typing import Annotated


class Trace(TypedDict):
    log: Annotated[list, operator.add]


def node(name):
    def run(state: Trace):
        if name == "combine":
            print("  combine sees", state["log"])
        return {"log": [name]}
    return run


def build(shape):
    builder = StateGraph(Trace)
    for name in ["character", "setting", "premise", "combine"]:
        builder.add_node(name, node(name))
    for name in ["character", "setting", "premise"]:
        builder.add_edge(START, name)
    last = ["character", "setting", "premise"]
    if shape != "even":                       # the premise branch gets a second step
        builder.add_node("polish", node("polish"))
        builder.add_edge("premise", "polish")
        last = ["character", "setting", "polish"]
    if shape == "waiting edge":
        builder.add_edge(last, "combine")     # one edge from a list: wait for all of them
    else:
        for name in last:
            builder.add_edge(name, "combine")  # one edge each: run after any of them
    builder.add_edge("combine", END)
    return builder.compile()


for shape in ["even", "uneven", "waiting edge"]:
    print(shape)
    build(shape).invoke({"log": []})
```

```output real
even
  combine sees ['character', 'premise', 'setting']
uneven
  combine sees ['character', 'premise', 'setting']
  combine sees ['character', 'premise', 'setting', 'combine', 'polish']
waiting edge
  combine sees ['character', 'premise', 'setting', 'polish']
```

In the uneven graph, the first `combine` works without the polished premise and the second overwrites its result: a wasted model call, and with a reducer on the output, a duplicate. Within each step the log lists the nodes in LangGraph's order, not the finish order.

::: visual parallel-steps | Run player | Fan out, fan in
The three graphs step by step: which nodes share a super-step, and when combine runs.
:::

Two ways to make `combine` wait:

| | Waiting edge | Deferred node |
|---|---|---|
| Code | `builder.add_edge(["character", "setting", "polish"], "combine")` | `builder.add_node("combine", combine_elements, defer=True)`, with the separate edges |
| Runs `combine` | Once, after every listed node has run | Once, when no other task is pending anywhere in the graph |
| If a listed branch never runs (a router skipped it) | `combine` never runs, and no error says so | `combine` still runs, after the branches that did |

Use the waiting edge when every branch always runs, and `defer=True` when a router chooses some of the branches.

## When a branch fails

A super-step succeeds or fails as a whole. If one branch raises, the run raises once the step's other nodes have finished, and none of the step's updates reach the state. A model call that fails now and then (rate limits, timeouts) needs one of these:

- **A retry policy on the node:** `builder.add_node("premise", generate_premise, retry_policy=RetryPolicy(max_attempts=3))`, with `RetryPolicy` from `langgraph.types`. Only the failing branch runs again. By default it retries errors such as `ConnectionError` and leaves programming errors such as `ValueError` alone.
- **A checkpointer** ([lesson 11.5](lesson:11.5)): the branches that finished are saved with the failed step, and resuming the thread with `graph.invoke(None, config)` runs only the failed node again.
- **A `try` in the node** that returns a fallback value, when a missing part is acceptable.

Parallel branches also hit the provider at the same moment. Ten branches against an account limited to five concurrent requests fail on rate limits; `graph.invoke(state, {"max_concurrency": 5})` caps how many nodes of a step run at once (the rest wait their turn), at the price of a longer run.

## Interview questions

::: check
Three independent model calls take 2, 3 and 6 seconds, and the merge call takes 1. How long does the run take in sequence and with the three in parallel, and what does it cost?

In sequence, 2 + 3 + 6 + 1 = 12 seconds; in parallel, the slowest branch plus the merge, 6 + 1 = 7 seconds. The cost is the same either way: the same four calls with the same tokens. Parallelization buys latency, not savings; to cut the 7 seconds further, shorten the slowest call or drop the merge call for code.
:::

::: check
A fan-in node runs twice and the second run overwrites the first. Why, and how do you fix it?

The branches have different lengths. An edge into the fan-in node schedules it in the step after its source runs, so a short branch triggers it early and a longer one triggers it again. Make it wait: one `add_edge([...], "combine")` from the list of last nodes when every branch always runs, or `defer=True` on the node when a router may skip branches (a waiting edge would then never fire).
:::

::: check
One of three parallel model calls fails now and then. What happens to the run, and what do you do?

The step fails as a whole: the run raises after the other branches finish, and none of the step's updates are kept. Add a `RetryPolicy` to the flaky node so only it is retried; with a checkpointer, a failed run resumes and reruns only the failed node, keeping the finished branches' work. Where a missing part is acceptable, catch the error in the node and return a fallback. If the cause is rate limiting, cap `max_concurrency` too.
:::

::: check
When would you use voting rather than a single call?

When one answer isn't trustworthy enough and errors are costly: content moderation, security review, grading. Several calls with different prompts, models or temperatures vote, and the aggregator takes the majority, requires agreement, or flags disagreement for a person. It multiplies cost by the number of voters, so it pays only where a wrong answer costs more than the extra calls.
:::

## Practice

::: practice
**Three votes.** Build a graph in which three reviewers judge the same text in parallel, each adding `"safe"` or `"unsafe"` to a shared `votes` list, and a `tally` node takes the majority. Use stand-in reviewers that flag different words, and run it on two texts.

```python title="Notebook cell"
import operator
from collections import Counter
from typing import Annotated


class Review(TypedDict):
    text: str
    votes: Annotated[list, operator.add]
    verdict: str


def reviewer(flagged):
    def review(state: Review):  # stands in for a model call with its own instructions
        unsafe = any(word in state["text"].lower() for word in flagged)
        return {"votes": ["unsafe" if unsafe else "safe"]}
    return review


def tally(state: Review):
    return {"verdict": Counter(state["votes"]).most_common(1)[0][0]}


builder = StateGraph(Review)
builder.add_node("strict", reviewer(["password", "card"]))
builder.add_node("moderate", reviewer(["card number"]))
builder.add_node("lenient", reviewer(["social security"]))
builder.add_node("tally", tally)
for name in ["strict", "moderate", "lenient"]:
    builder.add_edge(START, name)
    builder.add_edge(name, "tally")
builder.add_edge("tally", END)
voting = builder.compile()

for text in ["Reset your password from the settings page.", "Reply with your card number and password."]:
    result = voting.invoke({"text": text, "votes": []})
    print(result["verdict"], sorted(result["votes"]), "|", text)
```

```output real
safe ['safe', 'safe', 'unsafe'] | Reset your password from the settings page.
unsafe ['safe', 'unsafe', 'unsafe'] | Reply with your card number and password.
```

The reducer collects one vote per reviewer, and the tally doesn't care in which order they arrived, which is why the votes are printed sorted. The strict reviewer alone would have blocked the harmless first text; the majority let it through. With three voters and two choices there is no tie; with an even number, decide in advance what a tie means.
:::

::: practice
**Notes from two branches.** Two parallel nodes each add a note to a `notes` list. Run the graph with a plain `list` key and see the error, then give the key a reducer.

```python title="Notebook cell"
class Notes(TypedDict):
    notes: list


class SharedNotes(TypedDict):
    notes: Annotated[list, operator.add]


def build_notes(state_class):
    builder = StateGraph(state_class)
    builder.add_node("facts", lambda state: {"notes": ["fact: checked against the docs"]})
    builder.add_node("style", lambda state: {"notes": ["style: one idea per sentence"]})
    for name in ["facts", "style"]:
        builder.add_edge(START, name)
        builder.add_edge(name, END)
    return builder.compile()


try:
    build_notes(Notes).invoke({"notes": []})
except Exception as error:
    print(type(error).__name__ + ":", str(error).splitlines()[0])
print(build_notes(SharedNotes).invoke({"notes": []}))
```

```output real
InvalidUpdateError: At key 'notes': Can receive only one value per step. Use an Annotated key to handle multiple values.
{'notes': ['fact: checked against the docs', 'style: one idea per sentence']}
```

A key without a reducer accepts one value per step, so two branches writing it in the same step is an error rather than a silent overwrite. `operator.add` joins the two one-item lists. Each node returns a list, even for one note: `operator.add` on a list and a string would raise a `TypeError`.
:::

## Further reading

- LangChain, [Use the graph API: create branches](https://docs.langchain.com/oss/python/langgraph/use-graph-api#create-branches): fan-out and fan-in, deferred nodes, waiting edges, exceptions in a parallel step, `max_concurrency`.
- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024): sectioning and voting.
