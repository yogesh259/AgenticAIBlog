+++
number = "13.4"
title = "Orchestrator-worker"
lede = "When the subtasks depend on the input, let a model plan them at run time: an orchestrator splits a report into sections, Send starts one worker per section in parallel, and a synthesizer joins their results."
summary = "When the subtasks can't be fixed in advance, the planner with structured output, the Send API and what each worker receives, the report graph, a run with stand-in workers, the shared key and its reducer, empty and oversized plans, the order of results, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "13 Different Workflow in LangGraph: 24-28+Workflows.pdf (slide 4); 4-orchestrator-worker.ipynb (cells 1-9; retired Groq model replaced, the blank Send target fixed, the planner split from its schema so the graph builds without a key); stand-in run, failure cases, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

The parallel graph of [lesson 13.2](lesson:13.2) has its branches fixed before it runs: three edges, three nodes. A report can't be planned that way. One topic needs three sections and another seven, and what each section covers depends on the topic. In the orchestrator-worker pattern a central model, the orchestrator, breaks the task into subtasks at run time; one worker handles each subtask; and a final step, the synthesizer, combines their results. It is how a manager splits a report among writers and an editor assembles it.

## When it fits

Use it when you can't predict the subtasks: the sections of a report, the files a code change touches, the sub-questions a research question raises, the documents a summary must cover. The shape looks like parallelization, with many workers between a start and a merge; the difference is that the orchestrator decides how many workers run and what each one does.

A run costs one planning call, one call per worker and whatever the synthesizer does; it takes as long as the plan, the slowest worker and the synthesis. The orchestrator plans once. An agent ([lesson 8.1](lesson:8.1)) plans again after every step, so when later subtasks depend on what earlier ones found, an agent or a loop back to the orchestrator fits better.

## The plan

```python title="Notebook cell" norun
from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-120b")
```

Any provider of [lesson 13.1](lesson:13.1) works.

```python title="Notebook cell"
from typing import Annotated, List
import operator
from typing_extensions import Literal
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from typing_extensions import TypedDict
```

```python title="Notebook cell"
# Schema for structured output to use in planning
class Section(BaseModel):
    name: str = Field(description="Name for this section of the report")
    description: str = Field(description="Brief Overview of the main topics and concepts of the section")


class Sections(BaseModel):
    sections: List[Section] = Field(
        description="Sections of the report"
    )
```

```python title="Notebook cell" norun
# Augment the LLM with schema for structured output
planner = llm.with_structured_output(Sections)
```

The plan is structured output with a list inside ([lesson 9.5](lesson:9.5)): the model fills `Sections`, a list of `Section` objects, each with a `name` that becomes the heading and a `description` that tells the worker what to cover. The schema leaves the number of sections to the model.

## Send: one worker per section

A normal edge names a node, and the node receives the graph's state. To start a node several times, each time with different input, a conditional edge function returns a list of `Send` objects instead of a name. `Send("llm_call", {"section": s})` means "run `llm_call` once, with this dict as its whole input". LangGraph runs all the sends of a step in the next super-step, in parallel, like the branches of [lesson 13.2](lesson:13.2). Each worker returns an update for the graph's state, and a reducer collects them.

```python title="Notebook cell"
from langgraph.constants import Send


# Graph state
class State(TypedDict):
    topic: str  # Report topic
    sections: list[Section]  # List of report sections
    completed_sections: Annotated[
        list, operator.add
    ]  # All workers write to this key in parallel
    final_report: str  # Final report


# Worker state
class WorkerState(TypedDict):
    section: Section
    completed_sections: Annotated[list, operator.add]
```

```output real
LangGraphDeprecatedSinceV10: Importing Send from langgraph.constants is deprecated. Please use 'from langgraph.types import Send' instead. Deprecated in LangGraph V1.0 to be removed in V2.0.
```

`Send` moved to `langgraph.types` in LangGraph 1.0; the old import still works, with this warning, until version 2.0. New code writes `from langgraph.types import Send`.

The two classes describe two views of the data. `State` is the graph's: the topic, the plan, the finished sections and the report. `WorkerState` is what one worker works with: one `section`. The worker writes `completed_sections`, a key of the graph's state; `operator.add` joins the one-item lists that all the workers return in the same step. Without the reducer, two workers writing the key in one step would fail the run with `InvalidUpdateError` ([lesson 10.1](lesson:10.1)).

## The nodes

```python title="Notebook cell"
# Nodes
def orchestrator(state: State):
    """Orchestrator that generates a plan for the report"""

    # Generate queries
    report_sections = planner.invoke(
        [
            SystemMessage(content="Generate a plan for the report."),
            HumanMessage(content=f"Here is the report topic: {state['topic']}"),
        ]
    )

    print("Report Sections:", report_sections)

    return {"sections": report_sections.sections}


def llm_call(state: WorkerState):
    """Worker writes a section of the report"""

    # Generate section
    section = llm.invoke(
        [
            SystemMessage(
                content="Write a report section following the provided name and description. Include no preamble for each section. Use markdown formatting."
            ),
            HumanMessage(
                content=f"Here is the section name: {state['section'].name} and description: {state['section'].description}"
            ),
        ]
    )

    # Write the updated section to completed sections
    return {"completed_sections": [section.content]}


# Conditional edge function to create llm_call workers that each write a section of the report
def assign_workers(state: State):
    """Assign a worker to each section in the plan"""

    # Kick off section writing in parallel via Send() API
    return [Send("llm_call", {"section": s}) for s in state["sections"]]


def synthesizer(state: State):
    """Synthesize full report from sections"""

    # List of completed sections
    completed_sections = state["completed_sections"]

    # Format completed section to str to use as context for final sections
    completed_report_sections = "\n\n---\n\n".join(completed_sections)

    return {"final_report": completed_report_sections}
```

Older copies of this code send to `" "`, a blank node name. LangGraph 1.2 drops a send to an unknown node with only a logged warning ("Ignoring unknown node name"), so no worker runs and the run ends without a report. The target must be the worker's node name, `"llm_call"`.

- `orchestrator` asks the planner for a plan and stores the list of sections.
- `assign_workers` is the conditional edge function: one `Send` per section.
- `llm_call` is the worker. It receives the `WorkerState` dict from its `Send`, writes one section and returns it in a one-item list.
- `synthesizer` joins the finished sections with horizontal rules. It is plain code here; a model call could add an introduction and smooth the transitions.

## Build the graph

```python title="Notebook cell"
# Build workflow
from langgraph.graph import StateGraph, START, END
from IPython.display import Image, display

orchestrator_worker_builder = StateGraph(State)

# Add the nodes
orchestrator_worker_builder.add_node("orchestrator", orchestrator)
orchestrator_worker_builder.add_node("llm_call", llm_call)
orchestrator_worker_builder.add_node("synthesizer", synthesizer)

# Add edges to connect nodes
orchestrator_worker_builder.add_edge(START, "orchestrator")
orchestrator_worker_builder.add_conditional_edges(
    "orchestrator", assign_workers, ["llm_call"]
)
orchestrator_worker_builder.add_edge("llm_call", "synthesizer")
orchestrator_worker_builder.add_edge("synthesizer", END)

# Compile the workflow
orchestrator_worker = orchestrator_worker_builder.compile()
```

```python title="Notebook cell" norun
# Show the workflow
display(Image(orchestrator_worker.get_graph().draw_mermaid_png()))
```

```python title="Notebook cell"
for edge in orchestrator_worker.get_graph().edges:
    kind = " (conditional)" if edge.conditional else ""
    print(f"{edge.source} -> {edge.target}{kind}")
```

```output real
__start__ -> orchestrator
llm_call -> synthesizer
orchestrator -> llm_call (conditional)
synthesizer -> __end__
```

The graph has one worker node however many sections there are; the number of runs is decided by the sends. `assign_workers` returns `Send` objects, not names, so the list `["llm_call"]` tells LangGraph where they can go. Without it the run still works, but the drawing shows `orchestrator` leading to `__end__` and the worker unconnected. The edge from `llm_call` to `synthesizer` is a fan-in: all the workers run in one step, so the synthesizer runs once, after the last of them.

## Run it

```python title="Notebook cell" norun
# Invoke
state = orchestrator_worker.invoke({"topic": "Create a report on Agentic AI RAGs"})

from IPython.display import Markdown
Markdown(state["final_report"])
```

```output saved note="from a run with Qwen 2.5 32B, since retired; the notebook then rendered the report as formatted Markdown, which was not saved"
Report Sections: sections=[Section(name='Introduction to Agentic AI RAGs', description='An overview of what Agentic AI RAGs are, their purpose, and their significance in the field of artificial intelligence.'), Section(name='Technical Foundations of Agentic AI RAGs', description='A detailed explanation of the technical aspects that underpin Agentic AI RAGs, including algorithms, data requirements, and computational models.'), Section(name='Applications of Agentic AI RAGs', description='Discussion on the various applications of Agentic AI RAGs in different industries and their impact.'), Section(name='Challenges and Limitations', description='An analysis of the challenges and limitations associated with Agentic AI RAGs and potential solutions.'), Section(name='Future Prospects and Research Directions', description='Speculation on the future of Agentic AI RAGs, upcoming trends, and key areas for further research.')]
```

The planner chose five sections, so five workers wrote in parallel: seven model calls in all, with the planning call. `Markdown(...)` from IPython displays the joined sections as a formatted document in the notebook: headings, lists and the rules between sections.

## Watch the workers

Stand-ins for the planner and the worker show what happens inside, without a model. The plan is fixed, and each worker sleeps as long as a model call might, then reports what it received. `assign_workers` and `synthesizer` are the lesson's own:

```python title="Notebook cell"
import time

PLAN = [
    Section(name="Introduction", description="What agentic AI systems are"),
    Section(name="History", description="From chatbots to agents"),
    Section(name="Current trends", description="What teams build with agents today"),
]
DELAY = {"Introduction": 0.3, "History": 0.1, "Current trends": 0.2}


def plan_stand_in(state: State):
    return {"sections": PLAN}


def write_stand_in(state: WorkerState):
    section = state["section"]
    time.sleep(DELAY[section.name])  # stands in for a model call of this length
    print(f"wrote {section.name!r}; the worker received {list(state)}")
    return {"completed_sections": [f"## {section.name}\n{section.description}."]}


builder = StateGraph(State)
builder.add_node("orchestrator", plan_stand_in)
builder.add_node("llm_call", write_stand_in)
builder.add_node("synthesizer", synthesizer)
builder.add_edge(START, "orchestrator")
builder.add_conditional_edges("orchestrator", assign_workers, ["llm_call"])
builder.add_edge("llm_call", "synthesizer")
builder.add_edge("synthesizer", END)
demo = builder.compile()

start = time.perf_counter()
state = demo.invoke({"topic": "Agentic AI systems"})
print(f"took {time.perf_counter() - start:.1f}s")
print(state["final_report"])
```

```output real note="timings vary slightly per run"
wrote 'History'; the worker received ['section']
wrote 'Current trends'; the worker received ['section']
wrote 'Introduction'; the worker received ['section']
took 0.3s
## Introduction
What agentic AI systems are.

---

## History
From chatbots to agents.

---

## Current trends
What teams build with agents today.
```

- **Each worker received only its section**: not the topic, not the other sections, not the graph's state. A `Send` payload is the worker's entire input.
- **The workers ran in parallel**: three calls of 0.3, 0.1 and 0.2 seconds took 0.3 seconds.
- **They finished in another order than the plan's**, History first, yet the report follows the plan. In this run LangGraph applied the step's updates in the order of the sends, not as they finished. Its documentation doesn't promise an order for parallel updates, so when the order matters, send each worker its position and sort (practice 1).

::: visual send-workers | Run player | One worker per section
The stand-in run step by step: the plan, three sends, three workers with their own input, and the reducer that joins their results.
:::

## What goes wrong

| Problem | What happens | What to do |
|---|---|---|
| Empty plan | No sends, so no worker runs; the run ends after the orchestrator, the synthesizer never runs, and `state["final_report"]` raises `KeyError` | Route to the synthesizer, or to a fallback, when the plan is empty (practice 2) |
| Oversized plan | Forty sections start forty parallel calls: cost, rate limits, a report nobody reads | Ask for a range ("three to five sections"), cut the list in `assign_workers`, cap parallel calls with `{"max_concurrency": 5}` in the config |
| Workers lack context | Each worker sees only its payload, so it writes without the topic, the audience or the other sections | Put what every worker needs into each `Send`: topic, style notes, the section list |
| Overlapping sections | Two workers cover the same ground, unaware of each other | A clearer planner prompt, section descriptions that state the boundaries, a synthesizer that edits |
| A wrong target name | The send is dropped with a logged warning, and nothing fails | Use the node name; the path map list documents it |
| One worker fails | The step fails; with a checkpointer, a resume reruns only the failed worker ([lesson 13.2](lesson:13.2)) | A `RetryPolicy` on the worker node |

## Interview questions

::: check
How does orchestrator-worker differ from parallelization, and from an agent?

Parallelization has its branches in the graph: a fixed number of nodes, each with a fixed job. In orchestrator-worker a model decides at run time how many subtasks there are and what each covers, and `Send` starts one worker per subtask. An agent goes further: it decides one step at a time and can change course after each result, while the orchestrator plans once and the workers don't talk to each other. Pick the least flexible pattern that handles your inputs, because each step up adds cost and unpredictability.
:::

::: check
How does `Send` differ from a normal edge?

A normal edge names a node, which then runs once with the graph's state. A conditional edge function can return a list of `Send(node, payload)` objects: each starts its own run of the node with the payload as its whole input, all in the same super-step, in parallel. The workers' return values are updates to the graph's state, merged by the keys' reducers. It is LangGraph's map-reduce: map with `Send`, reduce with a reducer and a fan-in node.
:::

::: check
Why does `completed_sections` need `operator.add`? What happens without it?

Every worker returns `{"completed_sections": [...]}`, and they all run in the same step. A key without a reducer accepts one value per step, so with two or more workers the run fails with `InvalidUpdateError`; with exactly one worker it happens to work, which hides the bug until the plan grows. `operator.add` concatenates the one-item lists into one list.
:::

::: check
The planner returned 40 sections. What happens, and what do you change?

Forty workers start in one step: forty parallel model calls, likely rate-limit errors (which fail the whole step), a large bill and a report too long to use. Constrain the plan in the prompt and schema, enforce a maximum in code by cutting the list before sending, and cap parallel calls with `max_concurrency`. If many sections are genuinely needed, batch them or group related sections per worker.
:::

## Practice

::: practice
**Keep the plan's order.** Make the order of the report independent of how LangGraph applies parallel updates: send each worker its position in the plan and the topic, have it return `(position, text)`, and sort in the synthesizer. Reuse the stand-in plan.

```python title="Notebook cell"
class OrderedState(TypedDict):
    topic: str
    sections: list[Section]
    completed_sections: Annotated[list, operator.add]
    final_report: str


class OrderedWorker(TypedDict):
    section: Section
    position: int
    topic: str


def assign_in_order(state: OrderedState):
    return [Send("llm_call", {"section": s, "position": i, "topic": state["topic"]})
            for i, s in enumerate(state["sections"])]


def write_in_order(state: OrderedWorker):
    section = state["section"]
    time.sleep(DELAY[section.name])
    return {"completed_sections": [(state["position"], f"## {section.name} ({state['topic']})")]}


def synthesize_in_order(state: OrderedState):
    ordered = [text for _, text in sorted(state["completed_sections"])]
    return {"final_report": "\n".join(ordered)}


builder = StateGraph(OrderedState)
builder.add_node("orchestrator", plan_stand_in)
builder.add_node("llm_call", write_in_order)
builder.add_node("synthesizer", synthesize_in_order)
builder.add_edge(START, "orchestrator")
builder.add_conditional_edges("orchestrator", assign_in_order, ["llm_call"])
builder.add_edge("llm_call", "synthesizer")
builder.add_edge("synthesizer", END)
print(builder.compile().invoke({"topic": "agentic AI"})["final_report"])
```

```output real
## Introduction (agentic AI)
## History (agentic AI)
## Current trends (agentic AI)
```

The payload carries everything the worker needs, including the topic, which a worker can't otherwise see. Sorting by position makes the order a property of your code, not of the runtime. `plan_stand_in` returns a plain dict update, so it works with the new state class too.
:::

::: practice
**Guard an empty plan.** When the plan has no sections, skip the workers and let the synthesizer write a fallback report. A conditional edge function may return either a list of sends or a node name; list both targets.

```python title="Notebook cell"
def assign_or_skip(state: State):
    if not state["sections"]:
        return "synthesizer"
    return [Send("llm_call", {"section": s}) for s in state["sections"]]


def synthesize_or_explain(state: State):
    if not state.get("completed_sections"):
        return {"final_report": "No sections were planned for this topic."}
    return {"final_report": "\n\n---\n\n".join(state["completed_sections"])}


def build_report(plan):
    builder = StateGraph(State)
    builder.add_node("orchestrator", lambda state: {"sections": plan})
    builder.add_node("llm_call", write_stand_in)
    builder.add_node("synthesizer", synthesize_or_explain)
    builder.add_edge(START, "orchestrator")
    builder.add_conditional_edges("orchestrator", assign_or_skip, ["llm_call", "synthesizer"])
    builder.add_edge("llm_call", "synthesizer")
    builder.add_edge("synthesizer", END)
    return builder.compile()


print(build_report([]).invoke({"topic": "nothing"})["final_report"])
print(build_report(PLAN[:1]).invoke({"topic": "agents"})["final_report"])
```

```output real
No sections were planned for this topic.
wrote 'Introduction'; the worker received ['section']
## Introduction
What agentic AI systems are.
```

Without the guard, the first run would end after the orchestrator with no `final_report` at all. The path map lists both targets, so the graph is drawn and checked with the shortcut. The synthesizer uses `state.get`, because on the shortcut no worker has written `completed_sections`.
:::

## Further reading

- LangChain, [Workflows and agents: orchestrator-worker](https://docs.langchain.com/oss/python/langgraph/workflows-agents): the pattern and the `Send` API.
- LangChain, [Use the graph API: map-reduce and the Send API](https://docs.langchain.com/oss/python/langgraph/use-graph-api#map-reduce-and-the-send-api): `Send` in a smaller example.
- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024): orchestrator-workers and when subtasks can't be predicted.
