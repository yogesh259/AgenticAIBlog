+++
number = "13.6"
title = "Combining the patterns"
lede = "Real workflows nest the five patterns. Compare them side by side, then build a report writer in one script with Gemini: a planner, parallel writers, and a reviewer that sends the report back to an editor, at most twice."
summary = "The five patterns side by side, how to choose one, how they nest, a report writer in one script with Gemini (orchestrator-worker plus evaluator-optimizer, structured output, Send, a review limit and max_concurrency), how to run it, which piece to swap, interview questions and a practice task without a model."
type = "build"
status = "published"
source = "Summary of this module: 13 Different Workflow in LangGraph: 24-28+Workflows.pdf (slides 1-5) and 4-orchestrator-worker.ipynb with an evaluator loop from 5-Evaluator-optimizer.ipynb, on Gemini; the comparison, the review limit, the editor and the practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["GOOGLE_API_KEY"]
+++

Lessons 13.1 to 13.5 built each workflow pattern on its own. Real applications combine them: a router in front of chains, a parallel vote as a gate, workers that are themselves small chains, an evaluator after the merge. This lesson puts the five side by side, then builds one combination in a single script: a report writer whose planner and parallel writers come from [lesson 13.4](lesson:13.4) and whose review loop comes from [lesson 13.5](lesson:13.5).

## Five shapes

::: visual five-shapes | Figure | Five workflow shapes
Each pattern as a graph, with the LangGraph feature that builds it.
:::

| Pattern | Use it when | Built with | Model calls per run | Main risk |
|---|---|---|---|---|
| Prompt chaining ([13.1](lesson:13.1)) | The task splits into fixed steps, each needing the last one's output | Edges in a line; a gate on a conditional edge | One per step, plus retries | Errors compound; an unbounded retry loop |
| Parallelization ([13.2](lesson:13.2)) | Independent subtasks, or several opinions on one task | Several edges from one node; fan-in to an aggregator | One per branch, plus the merge | Uneven branches; rate limits |
| Routing ([13.3](lesson:13.3)) | Inputs fall into categories that need different handling | A classifier node and a conditional edge, or `Command` | One to classify, plus the handler's | Silent misroutes |
| Orchestrator-worker ([13.4](lesson:13.4)) | The subtasks depend on the input | `Send` from a conditional edge; a reducer; fan-in | One to plan, one per subtask, plus the merge | Empty or oversized plans; workers without context |
| Evaluator-optimizer ([13.5](lesson:13.5)) | Clear criteria, and feedback that improves the next attempt | A conditional edge back to the generator | Two per round | Loops that never pass; unreliable judges |

Choose by asking two questions. Are the steps known before the run? Then chain them, or run them in parallel when they don't depend on each other. If not, does the input decide the steps once (routing, orchestrator-worker) or does each result decide the next step? The last is an agent ([lesson 8.1](lesson:8.1)), the next level of autonomy, with the next level of cost and unpredictability. An evaluator loop can be added to any of them where quality matters more than latency.

## Patterns nest

Each pattern is a few nodes and edges, so one pattern's node can hold another pattern:

- **Routing, then a chain per route:** a support router sends refunds to a three-step chain (look up the order, check the policy, draft the reply) and general questions to a single call.
- **Parallel voting as a gate:** three judges vote on a draft before a chain continues.
- **Workers that are chains or agents:** each section writer first searches, then writes, then checks its facts; or a whole agent built with `create_agent` ([lesson 9.4](lesson:9.4)) is the worker node.
- **An evaluator after the merge:** the synthesizer's result goes to a reviewer, the script below.

Each nesting multiplies calls, so count them before you build: the report writer below makes one call to plan, one per section, and two per review round.

## The report writer in one script

The script below is the module as one terminal program, with Gemini as the model: read it to revise, and press **Explain** on it for every step. It needs `GOOGLE_API_KEY` in `.env` ([lesson 6.1](lesson:6.1)) and the packages of [lesson 6.1](lesson:6.1)'s `requirements.txt` plus `langgraph` ([lesson 10.2](lesson:10.2)).

```python title="report_writer.py" explain
"""A report writer: a planner splits the topic into sections, writers draft them in parallel,
and a reviewer sends the report to an editor until it passes or three reviews are used up."""
import operator
from typing import Annotated, Literal

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

load_dotenv()  # GOOGLE_API_KEY from .env

MAX_REVIEWS = 3  # the reviewer may send the report back twice


# 1. Schemas for structured output: the plan and the review
class Section(BaseModel):
    name: str = Field(description="Name for this section of the report")
    description: str = Field(description="Brief overview of the main topics and concepts of the section")


class Sections(BaseModel):
    sections: list[Section] = Field(description="Sections of the report")


class Review(BaseModel):
    grade: Literal["pass", "revise"] = Field(description="pass if the report is accurate, clear and complete")
    feedback: str = Field(description="If the grade is revise, the specific changes the report needs")


# 2. State: the graph's, and the input each writer receives
class State(TypedDict):
    topic: str
    sections: list[Section]
    completed_sections: Annotated[list, operator.add]  # every writer adds its section here
    report: str
    grade: str
    feedback: str
    reviews: int


class WorkerState(TypedDict):
    topic: str
    section: Section


# 3. Model, and two structured views of it
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
planner = llm.with_structured_output(Sections)
reviewer = llm.with_structured_output(Review)


# 4. Nodes: plan, write in parallel, join, review, edit
def orchestrator(state: State) -> dict:
    plan = planner.invoke([
        SystemMessage(content="Plan a short report of three to five sections."),
        HumanMessage(content=f"Report topic: {state['topic']}"),
    ])
    print("Plan:", ", ".join(section.name for section in plan.sections))
    return {"sections": plan.sections}


def assign_workers(state: State) -> list[Send]:
    return [Send("write_section", {"topic": state["topic"], "section": s}) for s in state["sections"]]


def write_section(state: WorkerState) -> dict:
    section = state["section"]
    reply = llm.invoke([
        SystemMessage(content="Write one section of a report in Markdown, starting with a '## ' heading. "
                              "At most 150 words, no preamble."),
        HumanMessage(content=f"Report topic: {state['topic']}\nSection: {section.name}\n"
                             f"Cover: {section.description}"),
    ])
    print("Wrote:", section.name)
    return {"completed_sections": [reply.text]}


def synthesizer(state: State) -> dict:
    return {"report": "\n\n".join(state["completed_sections"])}


def review(state: State) -> dict:
    verdict = reviewer.invoke([
        SystemMessage(content="You review reports. Pass a report that is accurate, clear and covers its topic; "
                              "otherwise list the specific changes it needs."),
        HumanMessage(content=f"Topic: {state['topic']}\n\n{state['report']}"),
    ])
    reviews = state["reviews"] + 1
    print(f"Review {reviews}: {verdict.grade}" + (f" - {verdict.feedback}" if verdict.grade == "revise" else ""))
    return {"grade": verdict.grade, "feedback": verdict.feedback, "reviews": reviews}


def after_review(state: State) -> Literal["edit", END]:
    if state["grade"] == "pass" or state["reviews"] >= MAX_REVIEWS:
        return END
    return "edit"


def edit(state: State) -> dict:
    reply = llm.invoke([
        SystemMessage(content="Revise the report to address the feedback. Keep its Markdown structure "
                              "and return only the revised report."),
        HumanMessage(content=f"Feedback: {state['feedback']}\n\nReport:\n{state['report']}"),
    ])
    return {"report": reply.text}


# 5. Graph: orchestrator -> writers in parallel -> synthesizer -> review, with edits until it passes
builder = StateGraph(State)
builder.add_node("orchestrator", orchestrator)
builder.add_node("write_section", write_section)
builder.add_node("synthesizer", synthesizer)
builder.add_node("review", review)
builder.add_node("edit", edit)
builder.add_edge(START, "orchestrator")
builder.add_conditional_edges("orchestrator", assign_workers, ["write_section"])
builder.add_edge("write_section", "synthesizer")
builder.add_edge("synthesizer", "review")
builder.add_conditional_edges("review", after_review)
builder.add_edge("edit", "review")
graph = builder.compile()


def main() -> None:
    topic = input("Report topic: ").strip() or "Agentic AI systems"
    result = graph.invoke({"topic": topic, "reviews": 0}, {"max_concurrency": 5})
    if "report" not in result:
        print("The planner returned no sections.")
        return
    verdict = "Accepted" if result["grade"] == "pass" else "Not accepted"
    print(f"{verdict} after {result['reviews']} review(s).\n")
    print(result["report"])


if __name__ == "__main__":
    main()
```

::: walkthrough

The script has three parts: the data (schemas and state), the steps (five nodes and two routing functions), and the graph that connects them. `main` runs it once for a topic you type.

```python title="Setup" norun
import operator
from typing import Annotated, Literal

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

load_dotenv()  # GOOGLE_API_KEY from .env

MAX_REVIEWS = 3  # the reviewer may send the report back twice
```

**Setup.** `operator.add` will be a reducer and `Annotated` attaches it; `Literal` restricts values in a schema and a routing hint. The message classes come from `langchain_core`, the model from its provider's package, the graph parts from `langgraph`, with `Send` from its current home, `langgraph.types`. `load_dotenv()` puts `GOOGLE_API_KEY` from `.env` into the environment, where the Gemini class finds it. `MAX_REVIEWS` bounds the review loop: three reviews means at most two rounds of edits.

```python title="Step 1 · Schemas" norun
class Section(BaseModel):
    name: str = Field(description="Name for this section of the report")
    description: str = Field(description="Brief overview of the main topics and concepts of the section")


class Sections(BaseModel):
    sections: list[Section] = Field(description="Sections of the report")


class Review(BaseModel):
    grade: Literal["pass", "revise"] = Field(description="pass if the report is accurate, clear and complete")
    feedback: str = Field(description="If the grade is revise, the specific changes the report needs")
```

**1. Schemas.** Two model calls must answer with data rather than prose. `Sections` is the plan: a list of sections, each with a name and a description of what to cover, the schema of [lesson 13.4](lesson:13.4). `Review` is the verdict: a grade the code can route on, limited by `Literal` to two values, and feedback the editor can act on, as in [lesson 13.5](lesson:13.5). The descriptions are instructions: the model reads them as part of the schema.

```python title="Step 2 · State" norun
class State(TypedDict):
    topic: str
    sections: list[Section]
    completed_sections: Annotated[list, operator.add]  # every writer adds its section here
    report: str
    grade: str
    feedback: str
    reviews: int


class WorkerState(TypedDict):
    topic: str
    section: Section
```

**2. State.** `State` is everything the run keeps: the topic, the plan, the written sections, the report, the latest review and the number of reviews so far. All writers return `completed_sections` in the same step, so the key has a reducer that adds their lists together; without it, two writers would fail the run with `InvalidUpdateError`. `WorkerState` is the input one writer gets from its `Send`: the topic and its own section, nothing else.

```python title="Step 3 · Model" norun
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
planner = llm.with_structured_output(Sections)
reviewer = llm.with_structured_output(Review)
```

**3. The model.** One chat model serves every step. `with_structured_output` wraps it twice: `planner` answers with a `Sections` object, `reviewer` with a `Review`, and both validate the answer against the schema ([lesson 9.5](lesson:9.5)). The writers and the editor use `llm` directly and read the reply's `.text`, which works for every provider, including Gemini, whose `content` can be a list of blocks. The model name is Google's at the time of writing; check Google's model list **VERIFY**, since Google retires older models.

```python title="Step 4a · Plan and send" norun
def orchestrator(state: State) -> dict:
    plan = planner.invoke([
        SystemMessage(content="Plan a short report of three to five sections."),
        HumanMessage(content=f"Report topic: {state['topic']}"),
    ])
    print("Plan:", ", ".join(section.name for section in plan.sections))
    return {"sections": plan.sections}


def assign_workers(state: State) -> list[Send]:
    return [Send("write_section", {"topic": state["topic"], "section": s}) for s in state["sections"]]
```

**4a. The orchestrator.** The planner turns the topic into a list of sections; the system message asks for three to five, which keeps the number of parallel calls small. `assign_workers` is the conditional edge function after it: one `Send` per section, each starting `write_section` with its own input. The topic goes into every payload, because a worker sees only what its `Send` carries.

```python title="Step 4b · Write and join" norun
def write_section(state: WorkerState) -> dict:
    section = state["section"]
    reply = llm.invoke([
        SystemMessage(content="Write one section of a report in Markdown, starting with a '## ' heading. "
                              "At most 150 words, no preamble."),
        HumanMessage(content=f"Report topic: {state['topic']}\nSection: {section.name}\n"
                             f"Cover: {section.description}"),
    ])
    print("Wrote:", section.name)
    return {"completed_sections": [reply.text]}


def synthesizer(state: State) -> dict:
    return {"report": "\n\n".join(state["completed_sections"])}
```

**4b. The workers and the synthesizer.** All the writers run in one super-step, in parallel; each writes one section and returns it in a one-item list, which the reducer adds to `completed_sections`. Their "Wrote" lines appear in the order they finish. The synthesizer runs once, after the last writer, and joins the sections into the report: plain code, no model call.

```python title="Step 4c · Review and edit" norun
def review(state: State) -> dict:
    verdict = reviewer.invoke([
        SystemMessage(content="You review reports. Pass a report that is accurate, clear and covers its topic; "
                              "otherwise list the specific changes it needs."),
        HumanMessage(content=f"Topic: {state['topic']}\n\n{state['report']}"),
    ])
    reviews = state["reviews"] + 1
    print(f"Review {reviews}: {verdict.grade}" + (f" - {verdict.feedback}" if verdict.grade == "revise" else ""))
    return {"grade": verdict.grade, "feedback": verdict.feedback, "reviews": reviews}


def after_review(state: State) -> Literal["edit", END]:
    if state["grade"] == "pass" or state["reviews"] >= MAX_REVIEWS:
        return END
    return "edit"


def edit(state: State) -> dict:
    reply = llm.invoke([
        SystemMessage(content="Revise the report to address the feedback. Keep its Markdown structure "
                              "and return only the revised report."),
        HumanMessage(content=f"Feedback: {state['feedback']}\n\nReport:\n{state['report']}"),
    ])
    return {"report": reply.text}
```

**4c. The review loop.** `review` grades the whole report and counts the reviews in the state. `after_review` is the routing function: it ends the run when the report passes or when the reviews are used up, and otherwise sends it to `edit`; its `Literal` hint lists both targets for LangGraph. The editor gets the feedback together with the report it refers to, so it revises instead of starting over, and its result replaces `report`. Because the loop works on the joined report, nothing needs to undo the writers' additions to `completed_sections`.

```python title="Step 5 · Graph" norun
builder = StateGraph(State)
builder.add_node("orchestrator", orchestrator)
builder.add_node("write_section", write_section)
builder.add_node("synthesizer", synthesizer)
builder.add_node("review", review)
builder.add_node("edit", edit)
builder.add_edge(START, "orchestrator")
builder.add_conditional_edges("orchestrator", assign_workers, ["write_section"])
builder.add_edge("write_section", "synthesizer")
builder.add_edge("synthesizer", "review")
builder.add_conditional_edges("review", after_review)
builder.add_edge("edit", "review")
graph = builder.compile()
```

**5. The graph.** Five nodes and their edges: `START` to the orchestrator; a conditional edge whose sends can only go to `write_section` (the list says so, since `Send` objects carry no name LangGraph could read in advance); a fan-in from the writers to the synthesizer; then the review loop, where `after_review` chooses between `edit` and `END` and `edit` always leads back to `review`. `compile()` checks that every edge joins known nodes.

```python title="Main" norun
def main() -> None:
    topic = input("Report topic: ").strip() or "Agentic AI systems"
    result = graph.invoke({"topic": topic, "reviews": 0}, {"max_concurrency": 5})
    if "report" not in result:
        print("The planner returned no sections.")
        return
    verdict = "Accepted" if result["grade"] == "pass" else "Not accepted"
    print(f"{verdict} after {result['reviews']} review(s).\n")
    print(result["report"])


if __name__ == "__main__":
    main()
```

**Main.** One run per topic. The input starts the review count at 0, since a `TypedDict` state has no defaults. `max_concurrency` caps how many writers call the model at once, which keeps a long plan from tripping the provider's rate limit. An empty plan starts no writers, so the run ends after the orchestrator with no report; `main` says so instead of failing with a `KeyError`. Otherwise it prints whether the reviewer accepted the report, then the report.

In one sentence: a planner decides the sections, `Send` writes them in parallel, a reducer collects them, and a bounded review loop edits the joined report until it passes.

:::

### Run it

```zsh title="Terminal" norun
python report_writer.py
```

```output illustrative note="reports and reviews vary per run; the report is cut after its first section here"
Report topic: Agentic AI systems
Plan: What agentic AI systems are, How they work, Where they are used, Risks and limits
Wrote: How they work
Wrote: What agentic AI systems are
Wrote: Risks and limits
Wrote: Where they are used
Review 1: revise - Give one concrete example of an agent at work in "Where they are used", and define tool calling where it first appears.
Review 2: pass
Accepted after 2 review(s).

## What agentic AI systems are

An agentic AI system uses a language model to decide what to do next: which tool to call, which step to take, when the task is done. ...
```

The writers finished in their own order, and the report still follows the plan: LangGraph 1.2 adds the writers' sections in the order of the sends, though its documentation doesn't promise it ([lesson 13.4](lesson:13.4) sorts by position to be safe). This run made eight model calls: one plan, four sections, two reviews and one edit.

### Swap one piece

| Piece | In the script | Alternatives |
|---|---|---|
| Model | `ChatGoogleGenerativeAI(...)` for every step | The other providers of [lesson 13.1](lesson:13.1); a small model for the writers and a stronger one for the reviewer |
| Plan size | Asked for in the planner's prompt | Enforced in code: `state["sections"][:5]` in `assign_workers` |
| Writer | One model call per section | A chain per section ([13.1](lesson:13.1)), or an agent with a search tool ([lesson 11.4](lesson:11.4)) |
| Order | The order LangGraph applies the writers' updates | A position in each `Send`, sorted in the synthesizer ([13.4](lesson:13.4)) |
| Synthesizer | Joins the sections | A model call that adds an introduction and smooths the transitions |
| Reviewer | One model call with a short rubric | Code checks first ([13.5](lesson:13.5), practice 2), a panel of judges ([13.2](lesson:13.2)), or a person ([14.3](lesson:14.3)) |
| Loop bound | `MAX_REVIEWS` | Plus a `recursion_limit`; keep the best-scored version, not the last |
| Progress | Printed by the nodes | `graph.stream(...)` with a stream mode ([lesson 11.6](lesson:11.6)) |

## Interview questions

::: check
A company wants to automate replies to customer emails. Which patterns would you combine, and where?

Routing first: classify each email (refund, technical, account, other) and send it to a handler with its own prompt and tools, with "other" going to a person. Inside a handler, a short chain: look up the order or account, draft the reply, then gates in code (no personal data leaked, required links present). Before sending, an evaluator checks tone and policy, with a limit on rewrites; for refunds above a threshold, a person approves ([lesson 14.3](lesson:14.3)). Parallel steps where checks are independent, such as policy and fact checks on the same draft. Measure the router and the evaluator separately on labelled emails.
:::

::: check
How do you estimate and control the cost of a combined workflow?

Count model calls per run from the graph: one per chain step, one per parallel branch or worker, two per evaluator round, plus routers and merges, and multiply by tokens per call; the longest path and the loop limits give the worst case. Control it with caps (sections in the plan, rounds in loops, `recursion_limit`), cheaper models for routine steps, code instead of a model wherever code can decide, `max_concurrency` for rate limits, and traces that show where the tokens go ([lesson 12.1](lesson:12.1)).
:::

::: check
Why not build every one of these as a single agent with tools?

An agent decides its own steps at run time, which costs more calls, makes runs harder to predict and test, and lets the model skip steps that must happen, such as a policy check. When the steps are known, a workflow guarantees them, runs cheaper and fails in fewer ways. Agents are for open-ended tasks whose steps can't be planned; many systems use workflows for the fixed parts and an agent inside one node for the open part ([lesson 8.1](lesson:8.1)).
:::

## Practice

::: practice
**Wire the report writer without a model.** Build the script's graph with stand-in functions: the same node names, edges and review limit, a fixed plan of three sections, and a reviewer that asks for changes once and then passes. Stream the run and print each node's update.

```python title="Notebook cell"
import operator
from typing import Annotated, Literal

from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send


class State(TypedDict):
    topic: str
    sections: list[str]
    completed_sections: Annotated[list, operator.add]
    report: str
    grade: str
    reviews: int


verdicts = iter(["revise", "pass"])


def orchestrator(state: State):
    return {"sections": ["Intro", "Uses", "Risks"]}


def assign_workers(state: State):
    return [Send("write_section", {"section": s}) for s in state["sections"]]


def write_section(state: dict):
    return {"completed_sections": [f"## {state['section']}"]}


def synthesizer(state: State):
    return {"report": " | ".join(state["completed_sections"])}


def review(state: State):
    return {"grade": next(verdicts), "reviews": state["reviews"] + 1}


def after_review(state: State) -> Literal["edit", END]:
    return END if state["grade"] == "pass" or state["reviews"] >= 3 else "edit"


def edit(state: State):
    return {"report": state["report"] + " (edited)"}


builder = StateGraph(State)
for name, node in [("orchestrator", orchestrator), ("write_section", write_section),
                   ("synthesizer", synthesizer), ("review", review), ("edit", edit)]:
    builder.add_node(name, node)
builder.add_edge(START, "orchestrator")
builder.add_conditional_edges("orchestrator", assign_workers, ["write_section"])
builder.add_edge("write_section", "synthesizer")
builder.add_edge("synthesizer", "review")
builder.add_conditional_edges("review", after_review)
builder.add_edge("edit", "review")
wiring = builder.compile()

for update in wiring.stream({"topic": "agents", "reviews": 0}):
    for node, change in update.items():
        print(f"{node:<14}{change}")
```

```output real note="the three writers run in parallel and can finish in another order"
orchestrator  {'sections': ['Intro', 'Uses', 'Risks']}
write_section {'completed_sections': ['## Intro']}
write_section {'completed_sections': ['## Uses']}
write_section {'completed_sections': ['## Risks']}
synthesizer   {'report': '## Intro | ## Uses | ## Risks'}
review        {'grade': 'revise', 'reviews': 1}
edit          {'report': '## Intro | ## Uses | ## Risks (edited)'}
review        {'grade': 'pass', 'reviews': 2}
```

Eight updates for eight node runs: one plan, three writers, the join, and the loop of review, edit and review. Stand-ins test the wiring, the fan-in and the loop's exit without a key or a cent; swapping each function for its model version changes what the updates contain, not the order of the nodes.
:::

## Further reading

- LangChain, [Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents): the five patterns and the agent, each in LangGraph.
- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024): the patterns, combining them, and when to stop at a workflow.
