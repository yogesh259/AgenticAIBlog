+++
number = "12.1"
title = "Tracing with LangSmith"
lede = "An agent's answer hides the steps that produced it. A trace records each of them: every model call, tool call and routing decision, with its inputs, outputs, timing, tokens and errors. Turn tracing on, read a trace, and use the same records to evaluate the agent."
summary = "Why agents need traces, runs, traces, projects and threads, the trace of a tool-calling agent step by step, how tracing works inside, turning it on with environment variables (new and older names), naming, tagging and grouping runs, tracing your own functions, finding common failures in a trace, privacy, volume and cost, evaluations with datasets, evaluators and experiments, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "12 Debugging with LangSmith: openai_agent.py (the LangSmith key line); langgraph_tool_calling_tutorial.md (the execution timeline, drawn as a trace); how tracing works, the variables, run names, tags and metadata, failure patterns, privacy, evaluations, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Ask the tool-calling agent of [lesson 12.2](lesson:12.2) "What is 5 + 3?" and it answers "The answer is 8." Behind that line are two model calls, two routing decisions and a tool call. When an answer is wrong, slow or expensive, the final message doesn't say which step is to blame, and the next run may not repeat the problem: models are not deterministic, and real users ask what nobody tested. Print statements show one run on your screen and are gone; streaming ([lesson 11.6](lesson:11.6)) shows a run while it happens and keeps nothing.

Tracing keeps everything. Each step of each run is recorded with what it received, what it returned, how long it took and what it cost, so any run, from development or production, can be opened later and read step by step. LangSmith is LangChain's platform for this: it stores and displays traces, and runs evaluations and monitoring on top of them. LangChain and LangGraph send it traces without any change to your code.

## Runs, traces, projects and threads

| Term | What it is | In the agent |
|---|---|---|
| Run | One unit of work: a graph, a node, a routing function, a model call, a tool call, a retriever | `ChatOpenAI` answering once |
| Trace | The tree of runs for one request, under one root run | One `agent.invoke(...)` |
| Project | A named collection of traces; `default` unless you set one | Every run of the agent while you build it |
| Thread | The traces of one conversation, linked by a `thread_id` in their metadata | Every turn of one chat |

Each run has a type that decides how LangSmith shows it: `chain` for graphs, nodes, routing functions and chains; `llm` for model calls, shown with the messages sent, token counts and cost; `tool`; `retriever`, shown with the documents it returned; `prompt` and `parser`. If you know OpenTelemetry, a run is a span and a trace is a tree of spans.

Newer LangSmith workspaces organise traces by agent and environment (production, staging, development, local) instead of by project; older workspaces and self-hosted LangSmith use projects. Everything below works the same in both.

## A trace of the tool-calling agent

::: visual trace-tree | Figure | A trace of the tool-calling agent
The graph of lesson 12.2 and the trace of one run, with the five steps of the run marked.
:::

Read top-down, the trace retells the run. The model never runs a tool: its first `ChatOpenAI` run returns only a request, `add` with `a=5` and `b=3`. The routing function `should_continue` sees the request and sends the run to `tools`, where `ToolNode` runs `add(5, 3)`; the `add` run sits under `tools`, not under the model. The model then runs a second time, now with the question, its own request and the result `8.0`, and writes the answer, and `should_continue` ends the run. Graph nodes become `chain` runs, a routing function becomes a run inside the node it follows, and whatever a node calls nests inside that node.

Clicking a run shows its details: the exact inputs and outputs, start and end times, and any error with its traceback. An `llm` run also shows every message sent, the tool schemas bound to the model, the reply, token counts and cost. That is what makes a trace useful for debugging: you see what the model saw, not what you believe you sent.

## How tracing works

Every LangChain runnable and every LangGraph node reports its start and end to callback handlers, the `callbacks` of a run's config ([lesson 7.1](lesson:7.1)). When tracing is on, LangChain adds one more handler, a tracer, to every run. The tracer gives each run an ID and its parent's ID, collects inputs, outputs, times and errors, and passes each finished trace to the LangSmith client, which uploads runs in batches from a background thread. Your code doesn't wait for the upload, and a failed upload is logged as a warning without failing the run. A script sends what is left when it exits; a serverless function, which may be frozen the moment it returns, should call `wait_for_all_tracers()` from `langchain_core.tracers.langchain` before returning.

Code that LangChain doesn't run, such as a plain function or another SDK's client, is invisible to the tracer until you mark it: with the `@traceable` decorator (below), or a wrapper such as `wrap_openai` for the OpenAI SDK. LangSmith also accepts traces in the OpenTelemetry format, so frameworks other than LangChain can send to it.

## Turn tracing on

Create an account at smith.langchain.com and an API key in its settings, then add three lines to `.env` ([lesson 0.3](lesson:0.3)):

```text title=".env" norun
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=agentic-ai
```

That is all: every chain, agent and graph that runs in a process with these variables is traced. Older code, including the first cell of [lesson 6.1](lesson:6.1), uses the earlier names, which still work:

| Variable | Older name | What it does |
|---|---|---|
| `LANGSMITH_TRACING` | `LANGCHAIN_TRACING_V2` | `true`, in lowercase, turns tracing on; any other value, `True` included, leaves it off |
| `LANGSMITH_API_KEY` | `LANGCHAIN_API_KEY` | Your API key |
| `LANGSMITH_PROJECT` | `LANGCHAIN_PROJECT` | The project traces go to; `default` when unset |
| `LANGSMITH_ENDPOINT` | `LANGCHAIN_ENDPOINT` | The API address, for accounts outside the US region or a self-hosted LangSmith |
| `LANGSMITH_WORKSPACE_ID` | | The workspace, when one key reaches several |
| `LANGSMITH_AGENT_ID`, `LANGSMITH_AGENT_ENVIRONMENT` | | The agent and environment, in workspaces organised by agent |

LangSmith's SDK reads the `LANGSMITH_` name first and falls back to the `LANGCHAIN_` one, with one exception that catches people out: `LANGCHAIN_TRACING_V2` is read before `LANGSMITH_TRACING`, so a leftover `LANGCHAIN_TRACING_V2=false` keeps tracing off. Keep one set of names. The project name is read once per process, so in a notebook a new `LANGSMITH_PROJECT` takes effect only after a kernel restart.

The agent file of [lesson 12.2](lesson:12.2) copies the older key name into the newer one:

```python title="openai_agent.py" norun
os.environ["LANGSMITH_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")
```

In a script, that line alone doesn't turn tracing on; `LANGSMITH_TRACING=true` is still needed. The local server of lesson 12.2 does it for you: when it finds a LangSmith key, under either name, it traces every run unless `LANGSMITH_TRACING` is `false`.

## Name, tag and group runs

A project fills up quickly. Three keys of a run's config ([lesson 7.1](lesson:7.1)) make runs easy to find:

```python title="Notebook cell" norun
config = {
    "run_name": "add-agent",
    "tags": ["studio-demo", "prompt-v2"],
    "metadata": {"user_id": "alice"},
    "configurable": {"thread_id": "1"},
}
agent.invoke({"messages": [("user", "What is 5 + 3?")]}, config)
```

- `run_name` names the root run, which a graph otherwise calls `LangGraph`.
- `tags` are labels attached to every run of the trace. Filter by them in LangSmith, for example to compare two prompt versions.
- `metadata` holds key-value pairs, such as the user, the app version or the model, to filter and group by.
- LangGraph copies `thread_id` from `configurable` into the metadata, so the traces of one LangGraph thread ([lesson 11.5](lesson:11.5)) form one LangSmith thread with no extra work.

## Trace your own functions

```python title="Notebook cell" norun
from langsmith import traceable


@traceable(run_type="retriever")
def search_orders(customer_id: str) -> list[dict]:
    ...  # a database query that LangChain knows nothing about
```

Called from inside a node, `search_orders` appears as a run nested in that node, with its arguments as inputs and its return value as output. Called outside any traced run, it starts a trace of its own. `run_type` picks how LangSmith shows the run, and `name=` overrides the function's name.

## Find the problem in a trace

| Symptom | Where to look | Usual cause |
|---|---|---|
| Wrong tool, or wrong arguments | The `llm` run before the tool call: the tool schemas it was sent and the call it returned | Vague tool names or descriptions ([lesson 11.3](lesson:11.3)), context missing from the prompt |
| The run never ends (`GraphRecursionError`) | How many times `agent` ran, and what the last model calls returned | A model that keeps calling tools, a router that never routes out ([lesson 10.1](lesson:10.1)) |
| The tool returned the right value, the answer is wrong | The last `llm` run: did the result reach the model, and what did it answer? | The prompt or the model; with RAG, check the retrieved documents first ([lesson 6.3](lesson:6.3)) |
| Slow | The duration of each run | One slow tool or a long reply: run independent calls in parallel, use a faster model, cache |
| Expensive | Tokens and cost of each `llm` run, and how many there are | The whole conversation resent on every call ([lesson 7.4](lesson:7.4), [lesson 9.6](lesson:9.6)), long tool results |
| An error | The run marked with the error, and its inputs | A tool that raised ([lesson 11.2](lesson:11.2)), a provider limit, a state that failed validation ([lesson 11.1](lesson:11.1)) |

A trace is also where a fix starts. An `llm` run opens in LangSmith's Playground, where you can edit the prompt or switch the model and run that one call again; and any run can be added to a dataset, which turns today's failure into a test for every later version (see the evaluations below).

## Privacy, volume and cost

A trace stores whatever passed through the agent: user messages, retrieved documents, tool results, and any card number or key a user pasted. Treat LangSmith as a place where production data lives.

| Need | Setting |
|---|---|
| Keep personal data out of traces | `LANGSMITH_HIDE_INPUTS=true` and `LANGSMITH_HIDE_OUTPUTS=true` drop inputs and outputs from every run; LangSmith's `Client` also takes a function that masks only the sensitive parts |
| Trace a share of production traffic | `LANGSMITH_TRACING_SAMPLING_RATE=0.1` keeps one trace in ten |
| Send nothing, for example in tests | `LANGSMITH_TRACING=false` |
| Separate development from production | One project per environment, or the agent environments of newer workspaces |
| Keep a run beyond the retention period | Add it to a dataset: traces are deleted after a while, datasets are kept |

Masking inside the agent, as `PIIMiddleware` does ([lesson 17.2](lesson:17.2)), protects the model provider, but the root run of the trace still records the raw input; hide or mask it in the tracer too. LangSmith's free plan includes a monthly allowance of traces, and traces beyond it are billed **VERIFY**. LangSmith can also be self-hosted, and open-source tools such as Langfuse and Arize Phoenix record the same kind of traces on your own servers; LiteLLM can send its calls to either kind ([lesson 18.5](lesson:18.5)).

## Evaluate with the same records

Traces answer "what happened in this run?". Evaluations answer "how good is this version, and is the next one better?". [Lesson 8.2](lesson:8.2) explains what to check in an agent, its final output and the path to it, offline before a release and online in production, and [lesson 6.3](lesson:6.3) what to check in RAG. LangSmith runs such checks with four pieces:

| Piece | What it is |
|---|---|
| Dataset | Examples: inputs, and optionally reference outputs, the answers you expect |
| Target | The function under test: one model call, a chain, or the whole graph |
| Evaluator | A function that scores one output: code (exact match, valid JSON, the right tool), a judge model with a rubric, or a person |
| Experiment | One run of the target over the dataset, with every output, score and trace, comparable side by side with other experiments |

```python title="eval_agent.py" norun
from langsmith import Client

client = Client()
dataset = client.create_dataset(dataset_name="add-agent")
client.create_examples(dataset_id=dataset.id, examples=[
    {"inputs": {"question": "What is 5 + 3?"}, "outputs": {"answer": 8}},
    {"inputs": {"question": "What is 2.5 + 4?"}, "outputs": {"answer": 6.5}},
])


def target(inputs: dict) -> dict:
    result = agent.invoke({"messages": [("user", inputs["question"])]})
    return {"answer": result["messages"][-1].text,
            "tools": [m.name for m in result["messages"] if m.type == "tool"]}


def correct(outputs: dict, reference_outputs: dict) -> bool:
    return str(reference_outputs["answer"]) in outputs["answer"]


def one_add(outputs: dict) -> bool:
    return outputs["tools"] == ["add"]


client.evaluate(target, data="add-agent", evaluators=[correct, one_add], experiment_prefix="gpt-5.6-terra")
```

`evaluate` runs the target on every example, passes each output to the evaluators, records an experiment and prints a link to it. An evaluator names the arguments it needs, among `inputs`, `outputs` and `reference_outputs`, and returns a boolean, a number, or a dict with a score and a comment; its function name becomes the metric's name. `correct` checks the final answer and `one_add` the trajectory, so an answer guessed without the tool, or reached with extra calls, still fails a metric. For judgements code can't make, such as helpfulness or whether an answer sticks to its sources, an evaluator calls a judge model; LangChain's `openevals` and `agentevals` packages provide ready-made judges and trajectory checks. Run the same dataset after every change of prompt, model or tools, and compare the experiments.

Online evaluators work on live traffic instead: attached to a project, they score a sample of incoming traces without reference answers (safety, format, a judge's rating), and the failures they find become new dataset examples.

## Interview questions

::: check
Your agent passes every test, but users report wrong answers to some questions. How do you find out why?

Trace production, sampled if traffic is high, with the user and the app version in the metadata, and collect the failing runs: from user feedback, an online evaluator, or filters on errors and unusual length. Open each trace and find the first step that went wrong: the tool chosen, its arguments, a retrieved document, the final model call. Add those runs to a dataset, fix the weakest step, and run an experiment comparing the old and new versions on the dataset before shipping.
:::

::: check
Tracing records user data and adds an external service. How do you set it up for production?

The upload happens in a background thread, so a slow or failed upload costs the app little; the risk is the data. Hide or mask sensitive inputs and outputs before they are recorded, mask personal data before it reaches the model too, sample traces when volume is high, keep production in its own project or environment with restricted access, and know the retention period. Where data may not leave your network, self-host LangSmith or use an open-source tracer such as Langfuse.
:::

::: check
How would you evaluate a tool-calling agent before a release?

Build a dataset of real questions with expected answers and, for each, the tools the agent should call. Score the final answer (code where it can be checked, a judge model with a rubric where it can't, calibrated against people's grades), the trajectory (the right tools, sensible arguments, no extra calls) and single steps where they matter, such as the tool chosen from a given state. Track cost and latency per run as well. Run it as an experiment on every change and compare with the last release; after the release, online evaluators watch live traces.
:::

## Practice

::: practice
**A tracer of your own.** Write a tracer that prints the run tree of each run, with the output of every tool and routing function. Attach it through `callbacks` to the tool-calling graph, with a stand-in for the model: a node that asks for `add(5, 3)` and answers once it sees the result.

```python title="Notebook cell"
from typing import Annotated

from langchain_core.messages import AIMessage, AnyMessage
from langchain_core.tools import tool
from langchain_core.tracers.base import BaseTracer
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


@tool
def add(a: float, b: float):
    """Adds two numbers."""
    return a + b


def call_model(state: State):  # stand-in for the model: asks for add once, then answers
    last = state["messages"][-1]
    if last.type == "tool":
        return {"messages": [AIMessage(f"The answer is {last.content}.")]}
    return {"messages": [AIMessage("", tool_calls=[{"name": "add", "args": {"a": 5, "b": 3}, "id": "call_1"}])]}


def should_continue(state: State):
    if state["messages"][-1].tool_calls:
        return "tools"
    else:
        return END


builder = StateGraph(State)
builder.add_node("agent", call_model)
builder.add_node("tools", ToolNode([add]))
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue)
builder.add_edge("tools", "agent")
agent = builder.compile()


class PrintTracer(BaseTracer):
    def _persist_run(self, run):  # called once per trace, with the finished root run
        self.show(run, 0)

    def show(self, run, depth):
        line = "  " * depth + f"{run.name} [{run.run_type}]"
        if run.run_type == "tool":
            line += f" {run.inputs} -> {run.outputs['output'].content}"
        elif run.outputs and set(run.outputs) == {"output"}:
            line += f" -> {run.outputs['output']}"
        print(line)
        for child in sorted(run.child_runs, key=lambda r: r.dotted_order):
            self.show(child, depth + 1)


result = agent.invoke({"messages": [("user", "What is 5 + 3?")]}, config={"callbacks": [PrintTracer()]})
print(result["messages"][-1].content)
```

```output real
LangGraph [chain]
  agent [chain]
    should_continue [chain] -> tools
  tools [chain]
    add [tool] {'a': 5, 'b': 3} -> 8.0
  agent [chain]
    should_continue [chain] -> __end__
The answer is 8.0.
```

`BaseTracer` does the bookkeeping that LangSmith's tracer does: it receives every start and end, links each run to its parent and hands over the finished tree, here to `_persist_run`, which LangSmith's tracer uses to upload. The tree has the shape of the figure above, without the `llm` runs, since the stand-in is a plain node. `dotted_order` sorts runs in the order they started.
:::

::: practice
**Evaluators in plain Python.** Score three recorded runs of the agent with two evaluators written as LangSmith expects them: `correct`, true when the last number in the answer equals the reference, and `one_add`, true when the agent called `add` exactly once. Print each run's scores and each metric's average.

```python title="Notebook cell"
import re

runs = [
    {"inputs": {"question": "What is 5 + 3?"}, "outputs": {"answer": "The answer is 8.0.", "tools": ["add"]}},
    {"inputs": {"question": "What is 2.5 + 4?"}, "outputs": {"answer": "2.5 + 4 = 6.5", "tools": []}},
    {"inputs": {"question": "What is 10 + 7?"}, "outputs": {"answer": "The sum is 18.", "tools": ["add", "add"]}},
]
references = [{"answer": 8}, {"answer": 6.5}, {"answer": 17}]


def correct(outputs: dict, reference_outputs: dict) -> bool:
    numbers = re.findall(r"-?\d+(?:\.\d+)?", outputs["answer"])
    return bool(numbers) and float(numbers[-1]) == reference_outputs["answer"]


def one_add(outputs: dict) -> bool:
    return outputs["tools"] == ["add"]


scores = {"correct": [], "one_add": []}
for run, reference in zip(runs, references):
    scores["correct"].append(correct(run["outputs"], reference))
    scores["one_add"].append(one_add(run["outputs"]))
    print(run["inputs"]["question"], "| correct:", scores["correct"][-1], "| one_add:", scores["one_add"][-1])

for name, values in scores.items():
    print(f"{name}: {sum(values) / len(values):.2f}")
```

```output real
What is 5 + 3? | correct: True | one_add: True
What is 2.5 + 4? | correct: True | one_add: False
What is 10 + 7? | correct: False | one_add: False
correct: 0.67
one_add: 0.33
```

The second run has the right answer reached the wrong way: the model did the sum itself, which a final-answer check passes and the trajectory check catches ([lesson 8.2](lesson:8.2)). The third added twice and still got it wrong. Passed to `client.evaluate(..., evaluators=[correct, one_add])`, the same two functions score every example of a dataset.
:::

## Further reading

- LangChain, [Observability concepts](https://docs.langchain.com/langsmith/observability-concepts): runs, traces, threads, tags, metadata and how traces are sent.
- LangChain, [Trace LangGraph agents](https://docs.langchain.com/langsmith/trace-with-langgraph): the variables, and tracing graphs with or without LangChain.
- LangChain, [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts): datasets, evaluators, experiments, offline and online evaluation.
