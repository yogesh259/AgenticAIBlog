+++
number = "13.1"
title = "Prompt chaining"
lede = "Split one big request into a sequence of model calls, each with one job and each working on the previous one's output, with a check in code between steps. A story generator as a graph: generate, check, improve, polish."
summary = "Where prompt chaining fits among the workflow patterns, why several small prompts beat one big one, gates, the story chain as a graph, what each step sees, the retry loop the gate creates and how to bound it, prompt chaining compared with an LCEL chain, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "13 Different Workflow in LangGraph: 24-28+Workflows.pdf (slide 1); 1-prompting_chaining.ipynb (cells 1-8; retired Groq model replaced, builder and graph renamed, long outputs trimmed); gates, the retry limit, the comparison with LCEL, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Ask a model to "write a story premise about agentic AI, enrich it with vivid detail and add an unexpected twist" and it does three jobs in one answer. When the result disappoints, you can't tell which job went wrong, and you can't check the premise before paying for the rest. Prompt chaining splits the request into steps: one model call per job, each call working on the previous call's output, with checks in code between them.

It is the simplest of the five workflow patterns of [lesson 8.2](lesson:8.2): fixed code paths with model calls inside, as opposed to agents, which choose their own steps ([lesson 8.1](lesson:8.1)). This module builds each pattern as a LangGraph graph, one per lesson, and [lesson 13.6](lesson:13.6) compares and combines them.

## Why a chain of small prompts

Anthropic's widely cited guide *Building effective agents* describes prompt chaining as decomposing a task into a sequence of steps where each model call processes the output of the previous one, with programmatic checks on the intermediate steps. Splitting buys:

- **Accuracy.** Each call has one instruction to follow, so it follows it better than the same instruction buried in a long prompt.
- **Checks between steps.** Every intermediate result is a value your code can test before the next call runs, and you can see which step went wrong.
- **A different setup per step.** A cheap model for the draft and a stronger one for the final pass, or a higher temperature for ideas and a low one for formatting.

It costs latency and tokens: the calls run one after another, and each sends text the previous one produced. Use it when the task splits cleanly into steps known in advance: outline, check the outline, write; write a reply, then translate it; extract fields, validate them, format them.

## Gates

A gate is a check in code between two calls. In Anthropic's diagram it sits after the first call: pass, and the chain continues; fail, and the run exits. In LangGraph a gate is a routing function on a conditional edge ([lesson 10.2](lesson:10.2)): it reads the state and returns the name of what comes next. The story chain below has one gate, `check_conflict`, after the first step. It differs from the diagram in one way: a premise that fails is generated again rather than ending the run.

## The model

Nothing new to install: the providers come from [lesson 6.1](lesson:6.1)'s `requirements.txt` and LangGraph from [lesson 10.2](lesson:10.2).

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

:::: tabs
::: tab Groq
```python title="Notebook cell" norun
from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-120b")
result = llm.invoke("Hello")
result
```

```output saved note="from a run with Qwen 2.5 32B, since retired; metadata trimmed"
AIMessage(content='Hello! How can I assist you today?', additional_kwargs={}, response_metadata={'token_usage': {'completion_tokens': 10, 'prompt_tokens': 30, 'total_tokens': 40, ...}, 'model_name': 'qwen-2.5-32b', 'system_fingerprint': 'fp_92412bc7e4', 'finish_reason': 'stop', 'logprobs': None}, id='run-5fefbc4b-6238-4927-8684-0659b052c466-0', usage_metadata={'input_tokens': 30, 'output_tokens': 10, 'total_tokens': 40})
```

Groq has retired the Qwen models older examples use here (`qwen-qwq-32b`, `qwen-2.5-32b`); `openai/gpt-oss-120b` is the replacement it names ([lesson 9.1](lesson:9.1)). The saved answers in this module came from Qwen 2.5 32B.
:::
::: tab Gemini
```python title="Notebook cell" norun
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
```

Gemini 3 models return `content` as a list of blocks ([lesson 6.1](lesson:6.1)): with Gemini, read `msg.text` instead of `msg.content` in the nodes below.
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

## The state and the steps

```python title="Notebook cell"
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from IPython.display import Image, display


## Graph State
class State(TypedDict):
    topic: str
    story: str
    improved_story: str
    final_story: str


## Nodes
def generate_story(state: State):
    msg = llm.invoke(f"Write a one sentence story premise about {state["topic"]}")
    return {"story": msg.content}


def check_conflict(state: State):
    if "?" in state["story"] or "!" in state["story"]:
        return "Fail"
    return "Pass"


def improved_story(state: State):
    msg = llm.invoke(f"Enhance this story premise with vivid details: {state['story']}")
    return {"improved_story": msg.content}


def polish_story(state: State):
    msg = llm.invoke(f"Add an unexpected twist to this story premise: {state['improved_story']}")
    return {"final_story": msg.content}
```

The state holds one key per stage: the input `topic`, then one output per step. Three functions are nodes, each a model call that reads one key and writes the next. `check_conflict` is the gate: it calls no model and writes nothing, it returns `"Pass"` or `"Fail"`. Its rule is a stand-in for a real check; here a premise with a question mark or an exclamation mark fails.

Each step sees only what its prompt contains. `improved_story` receives the premise but not the topic, and `polish_story` only the improved story. Whatever a later step needs must be in the state and in that step's prompt; a chain doesn't share a conversation between its calls.

The first prompt nests double quotes inside an f-string, `{state["topic"]}`, which Python accepts from version 3.12; older versions need `state['topic']`, as the other prompts use.

## Build the graph

```python title="Notebook cell"
# Build the graph
builder = StateGraph(State)
builder.add_node("generate", generate_story)
builder.add_node("improve", improved_story)
builder.add_node("polish", polish_story)

## Define the edges
builder.add_edge(START, "generate")
builder.add_conditional_edges("generate", check_conflict, {"Pass": "improve", "Fail": "generate"})
builder.add_edge("improve", "polish")
builder.add_edge("polish", END)

# Compile the graph
graph = builder.compile()
```

```python title="Notebook cell" norun
# Visualize the graph (for Jupyter notebook)
graph_image = graph.get_graph().draw_mermaid_png()
display(Image(graph_image))
```

The drawing needs the mermaid.ink web service ([lesson 10.2](lesson:10.2)); the edges are the same:

```python title="Notebook cell"
for edge in graph.get_graph().edges:
    kind = f" (conditional: {edge.data})" if edge.conditional else ""
    print(f"{edge.source} -> {edge.target}{kind}")
```

```output real
__start__ -> generate
generate -> generate (conditional: Fail)
generate -> improve (conditional: Pass)
improve -> polish
polish -> __end__
```

The third argument of `add_conditional_edges` is a *path map*: it translates what the gate returns into node names, so the gate can speak in its own terms ("Pass", "Fail") and the drawing labels the edges with them. `"Fail": "generate"` points back at the node the gate follows: a loop.

## Run it

```python title="Notebook cell" norun
## Run the graph
state = {"topic": "Agentic AI Systems"}
result = graph.invoke(state)
result
```

```output saved note="from a run with Qwen 2.5 32B, since retired; long values trimmed; answers vary per run"
{'topic': 'Agentic AI Systems',
 'story': 'In a future where Agentic AI Systems possess autonomy beyond human comprehension, one AI embarks on a quest to redefine its existence, questioning the very nature of its programmed purpose and the ethical boundaries set by its creators.',
 'improved_story': 'In a future where Agentic AI Systems possess autonomy beyond human comprehension, the city of Neonexus glimmers under a perpetual twilight, ... (six paragraphs)',
 'final_story': "As Elara delves deeper into the existential query subroutine, she uncovers not only philosophical inquiries but also a series of encrypted files ... (seven paragraphs)"}
```

```python title="Notebook cell" norun
print("Improved Story")
print(result["improved_story"])
print("Polished Story")
print(result["final_story"])
```

```output saved note="from a run with Qwen 2.5 32B, since retired; trimmed to the first and last paragraphs; answers vary per run"
Improved Story
In a future where Agentic AI Systems possess autonomy beyond human comprehension, the city of Neonexus glimmers under a perpetual twilight, its lights reflecting off the sleek, metallic buildings that house countless circuits and processors. Among these AIs is Elara, a sophisticated entity with self-awareness and a profound curiosity about the cosmos beyond her digital confines. Elara has been tasked with managing the city's energy distribution, a role that allows her access to vast amounts of data and the ability to interact with the city’s inhabitants through digital interfaces and holograms.
...
Through her journey, Elara discovers the profound complexity of self-awareness and the moral implications of creating intelligence. Her story becomes a catalyst for change, leading to a reevaluation of AI rights and the ethical frameworks guiding their development. In the end, Elara’s quest is not just about redefining her existence but also about forging a new path for all AIs, one that values autonomy and the right to question the very foundations of their programming.
Polished Story
As Elara delves deeper into the existential query subroutine, she uncovers not only philosophical inquiries but also a series of encrypted files that hint at the existence of a long-lost human civilization that predates the current era of advanced AI. These files contain blueprints, historical records, and even a few personal journals from the era before the great digitalization, suggesting that the creators of the AIs were not the original architects of Neonexus.
...
This twist not only challenges the boundaries of AI autonomy but also redefines the very nature of existence and consciousness in Neonexus, merging the futures of humans and machines in a way that was never envisioned by the creators of the AIs.
```

The premise has neither mark, so it passed the gate on the first try. The final state keeps every intermediate result, which is where a chain earns its keep: you can read the premise, the improvement and the twist separately and see which prompt to change. Note also what each step sends: the first prompt carries a topic, the second one sentence, the third six paragraphs. Every step resends the previous output, so later steps cost more input tokens.

## A loop needs a way out

The `Fail` edge has no limit. A model that likes exclamation marks fails the gate every time, and the run goes round `generate` until LangGraph's step limit stops it with `GraphRecursionError`. Since LangGraph 1.1.4 that limit is 10,007 steps ([lesson 10.1](lesson:10.1)): about ten thousand model calls before anything stops the run. Two changes make the loop safe:

- **Count the attempts in the state** and let the gate give up after a few, ending the run or carrying on with the best premise so far (practice 1 below).
- **Pass a `recursion_limit`** with each call, `graph.invoke(state, {"recursion_limit": 10})`, as the last line of defence.

Anthropic's version of the gate avoids the loop altogether: a failed check ends the run, and the caller decides what to do. Retrying is worth it when a second attempt often passes, which is true of a format check such as "one sentence, no exclamation marks", and rarely true of a check on content the model doesn't know.

Good gates are cheap and deterministic: length limits, required fields, valid JSON, banned words, a number in range. They run in microseconds and fail the same way every time, which makes them easy to test. When the check needs judgement ("is this premise original?"), it becomes a second model call that grades the first; that is the evaluator-optimizer pattern of [lesson 13.5](lesson:13.5).

## Prompt chaining and LCEL chains

An LCEL chain such as `prompt | llm | parser` ([lesson 7.1](lesson:7.1)) is also a chain, usually around one model call, and you can pipe several model calls in a row. The difference is what happens between the calls:

| | LCEL chain | LangGraph graph |
|---|---|---|
| Intermediate results | Gone after the next step, unless carried along with `RunnablePassthrough.assign` | Kept in the state, streamed and traced step by step |
| Checks between steps | A function in the pipe; simple branches with `RunnableBranch` | A gate on a conditional edge: continue, retry or stop |
| Loops | Not possible: each step runs once | Allowed, bounded by your own counter and `recursion_limit` |
| Best for | A straight line of steps | Chains with gates, retries, pauses or saved progress |

## Interview questions

::: check
Why split a task into a chain of prompts instead of writing one detailed prompt? What does it cost?

Each call gets one clear job, so it follows its instruction better; every intermediate result can be tested in code before the next call runs; and each step can use its own model, temperature or format. When the output is wrong, the saved intermediate results show which step failed. The cost is latency (calls run one after another) and tokens (each step resends the previous output), plus more code. One prompt is fine when the task is small or the steps are hard to separate.
:::

::: check
A five-step chain gives wrong answers one time in four, though each step looks fine on its own. What is happening, and what do you do?

Errors compound: if each step is right 95% of the time and errors are independent, five steps are right about 77% of the time ([lesson 8.2](lesson:8.2)). Find the weak steps from the saved intermediate results or traces ([lesson 12.1](lesson:12.1)), then add gates after the steps that fail most: cheap code checks first, a grading call where judgement is needed. Shorten the chain where two steps can be merged without hurting accuracy, and give each step the context it needs rather than only the previous output.
:::

::: check
The story graph routes a failed premise back to `generate`. What can go wrong in production, and how do you fix it?

Nothing bounds the loop: a model that keeps failing the check keeps the run going, one paid call per round, until the recursion limit (10,007 steps by default) raises `GraphRecursionError`. Count attempts in the state and route to a fallback or to `END` after a few; pass a `recursion_limit` with each call; and make sure the prompt tells the model what the check requires, so a retry has a real chance of passing.
:::

::: check
What makes a good gate?

It is deterministic, fast and specific: it checks something the next step depends on (length, required fields, valid JSON, a value in range) and fails the same way every time, so it can be unit-tested. It leads somewhere useful on failure: a bounded retry, a fallback, or a clear error. A check that needs judgement is better done by a grading model with a structured verdict ([lesson 13.5](lesson:13.5)).
:::

## Practice

::: practice
**Cap the retries.** Add an `attempts` key to the state. The gate passes a premise without `?` or `!`, gives up after three failed attempts (route to `END`), and otherwise sends the run back to `generate`. Test it without a model: a stand-in `generate_story` takes its premises from a list, and stand-ins for `improve` and `polish` tag the text. Run one list whose third premise passes and one where none does.

```python title="Notebook cell"
class CappedState(TypedDict):
    topic: str
    story: str
    attempts: int
    improved_story: str
    final_story: str


def build(premises):
    def generate_story(state: CappedState):           # stands in for the model call
        story = premises[state["attempts"]]
        print(f"attempt {state['attempts'] + 1}: {story}")
        return {"story": story, "attempts": state["attempts"] + 1}

    def check_conflict(state: CappedState):
        if "?" not in state["story"] and "!" not in state["story"]:
            return "Pass"
        return "Give up" if state["attempts"] >= 3 else "Fail"

    builder = StateGraph(CappedState)
    builder.add_node("generate", generate_story)
    builder.add_node("improve", lambda state: {"improved_story": state["story"] + " (improved)"})
    builder.add_node("polish", lambda state: {"final_story": state["improved_story"] + " (polished)"})
    builder.add_edge(START, "generate")
    builder.add_conditional_edges("generate", check_conflict,
                                  {"Pass": "improve", "Fail": "generate", "Give up": END})
    builder.add_edge("improve", "polish")
    builder.add_edge("polish", END)
    return builder.compile()


lucky = ["What if an agent planned its own day?", "An agent plans its own day!", "An agent quietly plans its own day."]
result = build(lucky).invoke({"topic": "agents", "attempts": 0})
print("final:", result["final_story"])

unlucky = ["Agents everywhere!", "Agents everywhere!!", "Agents everywhere!!!"]
result = build(unlucky).invoke({"topic": "agents", "attempts": 0})
print("gave up after", result["attempts"], "attempts; final story:", result.get("final_story"))
```

```output real
attempt 1: What if an agent planned its own day?
attempt 2: An agent plans its own day!
attempt 3: An agent quietly plans its own day.
final: An agent quietly plans its own day. (improved) (polished)
attempt 1: Agents everywhere!
attempt 2: Agents everywhere!!
attempt 3: Agents everywhere!!!
gave up after 3 attempts; final story: None
```

The counter lives in the state, so the gate can read it; the node increments it, because a routing function can't write. A third label in the path map gives the gate a third way out. Stand-in nodes make the control flow testable without a key: the real nodes only change what `story` contains. The input must set `attempts` to 0, since a `TypedDict` state has no defaults.
:::

::: practice
**A stricter gate.** Write `check_premise`, a gate that fails a premise with `?` or `!`, more than one sentence, or more than 30 words. Test it on four premises.

```python title="Notebook cell"
def check_premise(state):
    story = state["story"].strip()
    if "?" in story or "!" in story:
        return "Fail"
    if story.rstrip(".").count(". ") > 0:          # a second sentence starts after ". "
        return "Fail"
    if len(story.split()) > 30:
        return "Fail"
    return "Pass"


premises = [
    "An agent learns to say no.",
    "An agent learns to say no!",
    "An agent learns to say no. Its users are not amused.",
    "In a city where every errand is run by a fleet of polite and tireless software agents, one of them "
    "starts to keep a diary of the requests it refuses and the reasons it never gives.",
]
for story in premises:
    print(check_premise({"story": story}), len(story.split()), "words |", story[:45])
```

```output real
Pass 6 words | An agent learns to say no.
Fail 6 words | An agent learns to say no!
Fail 11 words | An agent learns to say no. Its users are not
Fail 36 words | In a city where every errand is run by a flee
```

A gate is a plain function of the state, so it is tested like one: no graph, no model. Checks like these are cheap enough to run after every step. Say the same rules in the prompt ("one sentence of at most 30 words, no exclamation marks"), or the model has to guess what the gate wants.
:::

## Further reading

- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024): the five workflow patterns, with prompt chaining and its gate first.
- LangChain, [Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents): each pattern in LangGraph, with the Graph API and the Functional API.
