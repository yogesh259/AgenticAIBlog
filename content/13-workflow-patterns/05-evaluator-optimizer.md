+++
number = "13.5"
title = "Evaluator-optimizer"
lede = "One model call writes, another grades the result against clear criteria and sends feedback back, until the work is accepted. A joke loop, why it needs a round limit, and what makes an evaluator worth trusting."
summary = "When a critique loop pays off, the joke graph with a structured grade, how the loop runs and what each round sees, the endless loop and its cost, round limits, evaluators made of code, a second model or a person, judge pitfalls, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "13 Different Workflow in LangGraph: 24-28+Workflows.pdf (slide 5); 5-Evaluator-optimizer.ipynb (cells 1-8; retired Groq model replaced, the evaluator split from its schema so the graph builds without a key); the endless loop, round limits, judge pitfalls, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A writer improves a draft with an editor's notes, then hands it back for another read. The evaluator-optimizer pattern does the same with two model calls in a loop: a generator produces a response, an evaluator grades it against criteria and, when it falls short, writes feedback; the generator tries again with the feedback, until the evaluator accepts.

The gate of [lesson 13.1](lesson:13.1) checked a draft in code and could only say pass or fail. An evaluator can judge what code can't (is it funny, is the tone right, is the translation faithful) and say what to change.

## When it pays off

Anthropic's guide gives two signs of a good fit: a person's feedback would clearly improve the responses, and a model can give that kind of feedback. Both need clear criteria. Typical uses:

- Translation, where a first pass misses nuances a reviewer can name.
- Writing that must meet a style guide, a length or a reading level.
- Code that must pass tests, where the evaluator can be the test run itself.
- Search or research that needs another round when the evaluator finds gaps.

Each round costs two calls and two steps, so the loop pays only when rounds really improve the result. Without clear criteria the evaluator's verdicts are noise, and the loop spends money moving between equally good answers.

## The graph

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


# Graph state
class State(TypedDict):
    joke: str
    topic: str
    feedback: str
    funny_or_not: str
```

```python title="Notebook cell"
# Schema for structured output to use in evaluation
class Feedback(BaseModel):
    grade: Literal["funny", "not funny"] = Field(
        description="Decide if the joke is funny or not.",
    )
    feedback: str = Field(
        description="If the joke is not funny, provide feedback on how to improve it.",
    )
```

```python title="Notebook cell" norun
# Augment the LLM with schema for structured output
evaluator = llm.with_structured_output(Feedback)
```

The evaluator answers with a `Feedback` object ([lesson 9.5](lesson:9.5)): a grade that can only be `"funny"` or `"not funny"`, and feedback in words. The grade is for the code that routes; the feedback is for the generator. The field descriptions are the evaluator's criteria, so make them as specific as the task allows.

```python title="Notebook cell"
# Nodes
def llm_call_generator(state: State):
    """LLM generates a joke"""

    if state.get("feedback"):
        msg = llm.invoke(
            f"Write a joke about {state['topic']} but take into account the feedback: {state['feedback']}"
        )
    else:
        msg = llm.invoke(f"Write a joke about {state['topic']}")
    return {"joke": msg.content}


def llm_call_evaluator(state: State):
    """LLM evaluates the joke"""

    grade = evaluator.invoke(f"Grade the joke {state['joke']}")
    return {"funny_or_not": grade.grade, "feedback": grade.feedback}


# Conditional edge function to route back to joke generator or end based upon feedback from the evaluator
def route_joke(state: State):
    """Route back to joke generator or end based upon feedback from the evaluator"""

    if state["funny_or_not"] == "funny":
        return "Accepted"
    elif state["funny_or_not"] == "not funny":
        return "Rejected + Feedback"
```

On the first round no feedback exists, so `state.get("feedback")` returns `None` and the generator writes from the topic alone. On later rounds it gets the evaluator's notes, but not its own previous joke: feedback such as "shorten the punchline" refers to a joke the generator can no longer see. Passing the last attempt along with the feedback gives it something to revise rather than starting over.

```python title="Notebook cell"
from langgraph.graph import StateGraph, START, END
from IPython.display import Image, display

# Build workflow
optimizer_builder = StateGraph(State)

# Add the nodes
optimizer_builder.add_node("llm_call_generator", llm_call_generator)
optimizer_builder.add_node("llm_call_evaluator", llm_call_evaluator)

# Add edges to connect nodes
optimizer_builder.add_edge(START, "llm_call_generator")
optimizer_builder.add_edge("llm_call_generator", "llm_call_evaluator")
optimizer_builder.add_conditional_edges(
    "llm_call_evaluator",
    route_joke,
    {  # Name returned by route_joke : Name of next node to visit
        "Accepted": END,
        "Rejected + Feedback": "llm_call_generator",
    },
)

# Compile the workflow
optimizer_workflow = optimizer_builder.compile()
```

```python title="Notebook cell" norun
# Show the workflow
display(Image(optimizer_workflow.get_graph().draw_mermaid_png()))
```

```python title="Notebook cell"
for edge in optimizer_workflow.get_graph().edges:
    kind = f" (conditional: {edge.data})" if edge.conditional else ""
    print(f"{edge.source} -> {edge.target}{kind}")
```

```output real
__start__ -> llm_call_generator
llm_call_evaluator -> __end__ (conditional: Accepted)
llm_call_evaluator -> llm_call_generator (conditional: Rejected + Feedback)
llm_call_generator -> llm_call_evaluator
```

The path map turns the grade's labels into a way out (`END`) and a way back (the generator). The second edge closes the loop.

## Run it

```python title="Notebook cell" norun
# Invoke
state = optimizer_workflow.invoke({"topic": "Agentic AI system"})
print(state["joke"])
```

```output saved note="from a run with Qwen 2.5 32B, since retired; answers vary per run"
Why did the Agentic AI system refuse to play hide-and-seek with the other programs?

Because it always found the goal of the game too deterministic—its advanced planning and autonomous decision-making meant it could predict every hiding spot and outcome, making the game less about fun and more about perfect execution!
```

The printed joke is the one the evaluator accepted. How many rounds it took, the state doesn't say: each round overwrites `joke`, `feedback` and `funny_or_not`. A round counter in the state (practice 1), or the run's trace ([lesson 12.1](lesson:12.1)), shows the history.

## The loop that never ends

Nothing guarantees the evaluator ever says "funny". A strict evaluator, a generator that ignores the feedback, or a topic that resists jokes keeps the run going round. Each round is two steps of the run, so the default limit of 10,007 steps ([lesson 10.1](lesson:10.1)) allows about 5,000 rounds, some 10,000 model calls, before `GraphRecursionError` ends it. Bound the loop yourself:

- **Count rounds in the state** and leave after a few, returning the last or the best attempt with a flag saying it wasn't accepted (practice 1).
- **Pass a `recursion_limit`** with each call as a backstop, and catch `GraphRecursionError` to return a fallback.
- **Stop when it stops improving:** if the evaluator gives a score, end when the score doesn't rise between rounds.

## What makes an evaluator worth trusting

- **Explicit criteria.** "Is it funny?" invites a coin toss. A rubric (a clear setup, one punchline, under 40 words, no explanation of the joke) gives the evaluator something to check and the generator something to fix.
- **Code where code can judge.** Length, required words, valid JSON, passing tests: a function decides these exactly, for free, with precise feedback (practice 2). Keep the model evaluator for judgement.
- **A different judge.** A model tends to rate its own answers favourably, one of the judge biases Zheng and others measured; position and length also sway model judges. A different model or a stronger one, a separate prompt, or a panel of judges ([lesson 13.2](lesson:13.2)'s voting) reduces it.
- **Calibration.** Before trusting a judge, compare its grades with people's on a set of labelled examples ([lesson 8.2](lesson:8.2)). A judge that accepts everything ends every loop at round one; one that accepts nothing runs every loop to its limit.
- **Actionable feedback**, sent with the attempt it refers to.

The evaluator can also be a person: a run that pauses for a reviewer's approval or comments, and resumes with them, is the subject of [lesson 14.3](lesson:14.3).

## Interview questions

::: check
When is evaluator-optimizer worth its cost?

When there are clear criteria, a first attempt often misses them, and feedback measurably improves the next attempt: translation, writing to a style guide, code against tests. Each round adds two model calls and their latency, so if most first attempts already pass, or the evaluator can't say what to change, a single call (perhaps with a better prompt) or a cheap code check is the better buy.
:::

::: check
In production your evaluator loop sometimes runs 30 rounds. Why might that happen, and what do you change?

The evaluator may be too strict or inconsistent, the criteria vague, or the generator unable to act on the feedback, for example because it never sees its previous attempt. Fix the loop's bounds first: a round counter in the state that ends after a few rounds with the best attempt, plus a `recursion_limit`. Then fix the cause: a rubric with specific criteria, feedback that names concrete changes, the previous attempt passed back to the generator, and a judge calibrated against labelled examples. Trace a few long runs to see which side is failing.
:::

::: check
What are the risks of using the same model as generator and evaluator?

Shared blind spots: the evaluator misses the errors the generator makes, because they come from the same knowledge and habits. Model judges also tend to prefer their own outputs, longer answers and whichever answer they read first. Use a different or stronger model to judge, a separate prompt with an explicit rubric, code checks for anything checkable, and compare the judge's verdicts with human labels before relying on it.
:::

::: check
How does evaluator-optimizer differ from a gate in a prompt chain?

A gate is a check in code that routes: pass, retry or stop; it can't say what to change. An evaluator is usually a model that grades against criteria and returns feedback, which the generator uses in the next round, so attempts improve rather than repeat. Gates are cheap and deterministic; evaluators handle judgement at the price of extra calls and their own errors. Many loops use both: code checks first, a model judge for the rest.
:::

## Practice

::: practice
**Cap the rounds.** Add a `rounds` counter to the state: the generator increments it, and the router ends the run after three rounds even without a "funny" grade. Test with stand-ins: a generator that numbers its jokes, and an evaluator that returns grades from a list. Run one evaluator that accepts the second joke and one that never accepts.

```python title="Notebook cell"
MAX_ROUNDS = 3


class CappedState(TypedDict):
    topic: str
    joke: str
    feedback: str
    funny_or_not: str
    rounds: int


def build(grades):
    def generator(state: CappedState):  # stands in for llm_call_generator
        rounds = state["rounds"] + 1
        joke = f"joke {rounds} about {state['topic']}"
        note = f" (feedback: {state['feedback']})" if state.get("feedback") else ""
        print(f"round {rounds}: {joke}{note}")
        return {"joke": joke, "rounds": rounds}

    def evaluator(state: CappedState):  # stands in for llm_call_evaluator
        grade = grades[state["rounds"] - 1]
        return {"funny_or_not": grade, "feedback": "" if grade == "funny" else "shorten the punchline"}

    def route_joke(state: CappedState):
        if state["funny_or_not"] == "funny":
            return "Accepted"
        if state["rounds"] >= MAX_ROUNDS:
            return "Out of rounds"
        return "Rejected + Feedback"

    builder = StateGraph(CappedState)
    builder.add_node("llm_call_generator", generator)
    builder.add_node("llm_call_evaluator", evaluator)
    builder.add_edge(START, "llm_call_generator")
    builder.add_edge("llm_call_generator", "llm_call_evaluator")
    builder.add_conditional_edges(
        "llm_call_evaluator",
        route_joke,
        {"Accepted": END, "Out of rounds": END, "Rejected + Feedback": "llm_call_generator"},
    )
    return builder.compile()


for grades in (["not funny", "funny"], ["not funny"] * MAX_ROUNDS):
    result = build(grades).invoke({"topic": "agents", "rounds": 0})
    print(f"-> {result['joke']}: {result['funny_or_not']} after {result['rounds']} rounds")
```

```output real
round 1: joke 1 about agents
round 2: joke 2 about agents (feedback: shorten the punchline)
-> joke 2 about agents: funny after 2 rounds
round 1: joke 1 about agents
round 2: joke 2 about agents (feedback: shorten the punchline)
round 3: joke 3 about agents (feedback: shorten the punchline)
-> joke 3 about agents: not funny after 3 rounds
```

Both runs end, and the final state tells them apart: `funny_or_not` says whether the joke was accepted, `rounds` how long it took. The caller decides what an unaccepted joke is worth. To return the best attempt instead of the last, add a `score` field to `Feedback` and keep the best joke and score in the state.
:::

::: practice
**An evaluator in code.** Headlines for a blog post must mention the topic, have at most eight words and not end with a period. Write `check_headline`, which returns a grade and feedback in the shape of `Feedback`, and try it on three drafts.

```python title="Notebook cell"
def check_headline(headline, topic, max_words=8):
    problems = []
    if topic.lower() not in headline.lower():
        problems.append(f"mention '{topic}'")
    words = len(headline.split())
    if words > max_words:
        problems.append(f"use at most {max_words} words, not {words}")
    if headline.endswith("."):
        problems.append("drop the final period")
    return {"grade": "revise" if problems else "pass", "feedback": "; ".join(problems)}


drafts = [
    "Why every team will soon run a fleet of software agents.",
    "Why every team will soon run agents.",
    "Agents: what every team will run next",
]
for draft in drafts:
    print(check_headline(draft, "agents"))
```

```output real
{'grade': 'revise', 'feedback': 'use at most 8 words, not 11; drop the final period'}
{'grade': 'revise', 'feedback': 'drop the final period'}
{'grade': 'pass', 'feedback': ''}
```

A function as the evaluator is exact, instant and free, and its feedback names precisely what to fix, which is what a generator needs. In the graph it would replace `llm_call_evaluator`. Code can't tell whether a headline is engaging, so real loops often run the code check first and ask a model judge only about drafts that pass it.
:::

## Further reading

- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024): evaluator-optimizer and its two signs of a good fit.
- Madaan and others, [Self-Refine: iterative refinement with self-feedback](https://arxiv.org/abs/2303.17651) (2023): one model writing, critiquing and revising its own output.
- Zheng and others, [Judging LLM-as-a-judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) (2023): how well model judges agree with people, and their position, length and self-preference biases.
