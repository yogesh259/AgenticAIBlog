+++
number = "12.2"
title = "LangGraph Studio"
lede = "Studio draws your graph, runs it from an input you type, shows the state after every step, pauses before any node, and lets you edit a step's output and run on from there. Serve the tool-calling agent with langgraph dev and debug it in the browser."
summary = "What Studio is and what runs where, the tool-calling agent file with a choice of providers, langgraph.json, the keys, installing the CLI, langgraph dev and what the local server does, making Studio draw every edge, running the agent, breakpoints, editing state and forking, threads, assistants and the Playground, common problems, the agent in one file with Gemini, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "12 Debugging with LangSmith: Notes.md (setup and the four Studio workflows); openai_agent.py (the retired default model replaced); langgraph.json; langgraph_tool_calling_tutorial.md (the graph's edges and timeline, linked to 11.2 and 12.1); what runs where, what the server does, drawing every edge, the fork, common problems, the one-file agent with Gemini, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A trace ([lesson 12.1](lesson:12.1)) tells you what happened after a run. While you build an agent you also want to work on a run: start it from an input you type, watch it move through the graph, stop it before a step, look at the state, change what a node returned and see what the agent does next. LangGraph Studio does that. It is an IDE for agents that runs in the browser, called LangSmith Studio in LangChain's current documentation, and it works with any graph served by an Agent Server: one on your machine, started with `langgraph dev`, or a deployed one.

This lesson serves a tool-calling agent, the model of [lesson 11.2](lesson:11.2) with an `add` tool, looping until it can answer as in [lesson 11.4](lesson:11.4). Two files and one command put it in Studio.

## What runs where

| Piece | Where it runs | What it does |
|---|---|---|
| The graph file and `langgraph.json` | Your project folder | The agent, and where the server finds it |
| Agent Server, started by `langgraph dev` | Your machine, at `http://127.0.0.1:2024` | Imports the graph, runs it, stores its threads and checkpoints, and serves an HTTP API, documented at `/docs` |
| Studio | Your browser: a page of `smith.langchain.com` | Draws the graph and sends runs to your local server; needs a LangSmith account |
| LangSmith | LangChain's cloud | Stores traces of the runs when a LangSmith key is set |

The Studio page comes from LangSmith, but the browser calls your local server directly: the graph runs on your machine, and its state stays there. Only traces leave it, and `LANGSMITH_TRACING=false` in `.env` stops those too.

## The agent file

```python title="openai_agent.py" norun
from typing import Annotated
from typing_extensions import TypedDict
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START
from langgraph.graph.state import StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool
from langchain_core.messages import BaseMessage
import os
from dotenv import load_dotenv

load_dotenv()

os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")

os.environ["LANGSMITH_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")


class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


model = ChatOpenAI(model="gpt-5.6-terra", temperature=0)


def make_default_graph():
    graph_workflow = StateGraph(State)

    def call_model(state):
        return {"messages": [model.invoke(state["messages"])]}

    graph_workflow.add_node("agent", call_model)
    graph_workflow.add_edge("agent", END)
    graph_workflow.add_edge(START, "agent")

    agent = graph_workflow.compile()
    return agent


def make_alternative_graph():
    """Make a tool-calling agent"""

    @tool
    def add(a: float, b: float):
        """Adds two numbers."""
        return a + b

    tool_node = ToolNode([add])
    model_with_tools = model.bind_tools([add])

    def call_model(state):
        return {"messages": [model_with_tools.invoke(state["messages"])]}

    def should_continue(state: State):
        if state["messages"][-1].tool_calls:
            return "tools"
        else:
            return END

    graph_workflow = StateGraph(State)

    graph_workflow.add_node("agent", call_model)
    graph_workflow.add_node("tools", tool_node)

    graph_workflow.add_edge("tools", "agent")
    graph_workflow.add_edge(START, "agent")

    graph_workflow.add_conditional_edges("agent", should_continue)

    agent = graph_workflow.compile()
    return agent


agent = make_alternative_graph()
```

Without a `model`, `ChatOpenAI` uses `gpt-3.5-turbo`, which OpenAI shut down on 23 October 2026; `gpt-5.6-terra` is the substitute it names. GPT-5 models accept only their default temperature, so LangChain drops `temperature=0` for them.

The file builds two graphs from earlier parts:

- `make_default_graph` is the chatbot of [lesson 10.3](lesson:10.3): `START`, one `agent` node that calls the model once, `END`.
- `make_alternative_graph` is the tool-calling agent. `add` becomes a tool ([lesson 9.3](lesson:9.3)), `ToolNode` runs it, and `should_continue` is a hand-written `tools_condition` ([lesson 11.2](lesson:11.2)): to `tools` when the model's last message holds tool calls, to `END` otherwise. There is no `add_edge("agent", "tools")` because that conditional edge decides on every pass, and the fixed edge from `tools` back to `agent` lets the model read the result and decide again. [Lesson 12.1](lesson:12.1) follows one run through it, step by step.
- The last line builds the agent into the variable `agent`, which is what the server loads.

The model doesn't have to be OpenAI's. Replace the import and the `model` line; with another provider, also delete the `OPENAI_API_KEY` line, which fails when that key is missing from `.env`:

:::: tabs
::: tab OpenAI
```python title="openai_agent.py (model lines)" norun
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-5.6-terra", temperature=0)
```
:::
::: tab Groq
```python title="openai_agent.py (model lines)" norun
from langchain_groq import ChatGroq

model = ChatGroq(model="openai/gpt-oss-120b", temperature=0)
```
:::
::: tab Gemini
```python title="openai_agent.py (model lines)" norun
from langchain_google_genai import ChatGoogleGenerativeAI

model = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
```
:::
::: tab Ollama
```python title="openai_agent.py (model lines)" norun
from langchain_ollama import ChatOllama

model = ChatOllama(model="qwen3.5", temperature=0)
```
:::
::::

## langgraph.json

The server finds the graph through a configuration file next to it:

```json title="langgraph.json" norun
{
  "dependencies": ["."],
  "graphs": {
    "openai_agent": "./openai_agent.py:agent"
  },
  "env": "../.env"
}
```

| Key | What it says |
|---|---|
| `dependencies` | What a deployment installs: `"."` is this folder, with its `requirements.txt` or `pyproject.toml`. `langgraph dev` installs nothing; it uses the packages of the environment you start it from |
| `graphs` | One entry per graph: the name Studio shows, then `path:variable`, the file and the compiled graph in it. The variable may also be a function that builds the graph (practice 1) |
| `env` | The `.env` file to load, relative to `langgraph.json`, or a dict of values. Here it is one folder up, a `.env` shared by several projects |

```text title="Folder layout" norun
project/
├── .env
└── studio/
    ├── langgraph.json
    └── openai_agent.py
```

`.env` holds `OPENAI_API_KEY`, or your provider's key, and `LANGCHAIN_API_KEY`, the older name the file copies ([lesson 12.1](lesson:12.1)). Each `os.environ[...] = os.getenv(...)` line fails when its name is missing ([lesson 0.3](lesson:0.3)): add the key, or delete the line.

## Install the CLI and start the server

Add one line to `requirements.txt` and run your install command again ([lesson 0.1](lesson:0.1)):

```text title="requirements.txt" norun
langgraph-cli[inmem]
```

`langgraph-cli` provides the `langgraph` command, and the `inmem` extra adds the in-memory Agent Server that `langgraph dev` runs; it needs Python 3.11 or later. Start the server from the folder that holds `langgraph.json`:

```zsh title="Terminal" norun
cd studio
langgraph dev
```

```output illustrative note="startup text trimmed, emojis removed"
Welcome to LangGraph

- API: http://127.0.0.1:2024
- Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- API Docs: http://127.0.0.1:2024/docs

This in-memory server is designed for development and testing.
For production use, please use LangSmith Deployment.
```

The server opens the Studio URL in your browser; log in to LangSmith and Studio shows the graph. Keep the terminal open: it logs every run, and Ctrl+C stops the server. Behind the URL, the server does more than run the graph:

| It | Details |
|---|---|
| Serves each entry of `graphs` | As an assistant: the graph plus a configuration. Studio's graph selector lists them |
| Keeps threads | Every run belongs to a thread. Threads and checkpoints live in memory and are saved to a `.langgraph_api` folder in the folder you started the server from, so they survive a restart; delete the folder to start clean, and keep it out of git |
| Provides persistence | It attaches its own checkpointer and store, so the graph must be compiled without one: a graph compiled with `MemorySaver()` ([lesson 11.5](lesson:11.5)) stops the server with `Heads up! Your graph ... includes a custom checkpointer` |
| Reloads | Saving a Python file restarts it with the new code; `--no-reload` turns that off |
| Traces | When it finds a LangSmith key it traces every run, unless `LANGSMITH_TRACING=false` |
| Catches blocking calls | It runs graphs on an event loop, so a blocking call such as `time.sleep` or `requests.get` inside an `async def` node fails with `BlockingError`. Plain `def` nodes, like these, run in a thread pool and may block |
| Listens on port 2024 | If 2024 is taken, it picks a free port and prints a warning: use the URLs it prints. `--port` chooses the port, `--no-browser` skips opening the browser |

## Make Studio draw every edge

Studio draws the graph from the same description as `graph.get_graph()`. For this file it shows `agent` with a single edge to `__end__`, and `tools` on its own. `should_continue` has no return type, so LangGraph can't tell where it may lead and draws only the end ([lesson 10.2](lesson:10.2)). The agent still runs correctly, but the picture misleads anyone debugging it. Declare the targets:

```python title="openai_agent.py (inside make_alternative_graph)" norun
from typing import Literal  # with the other imports


def should_continue(state: State) -> Literal["tools", "__end__"]:
    if state["messages"][-1].tool_calls:
        return "tools"
    else:
        return END
```

Save the file: the server reloads, and Studio draws dotted edges from `agent` to `tools` and to `__end__`, and the edge back from `tools`. `tools_condition` carries this hint already, so graphs that use it draw correctly.

## Run the agent

Studio has two modes, switched at the top of the page. Graph mode shows everything:

1. Pick `openai_agent` in the graph selector, if it isn't selected.
2. In the Input panel under the graph, add a human message, "What is 5 + 3?", and click **Submit**.
3. Nodes light up as they run, and the thread on the right gains one entry per step: `agent` with the tool call `add` (`a=5`, `b=3`), `tools` with the result `8.0`, `agent` with the answer. Open an entry to see the state that step wrote; the slider at the top shows more or less detail.

The Input panel also takes system and tool messages, so a run can start from any conversation, for example one that already holds a tool result. Chat mode shows the same agent as a chat window, with a switch to show or hide tool calls; it works for graphs whose state has a `messages` list, like this one.

## Pause, edit and fork

**Breakpoints.** Click **Interrupt**, choose `tools` and "before", and submit the question again. The run stops after `agent`: the state holds the tool call, and nothing has run yet. Read the arguments the model chose, then click **Continue** to let `tools` run. Interrupting before every node steps through a run one node at a time.

**Edit and fork.** Next to the `agent` step, click **Edit node state**, change `a` in the tool call from 5 to 50, and click **Fork**. Studio saves the edited state as a new checkpoint after `agent` and runs on from it: `tools` computes `add(50, 3)`, `53.0`, and the model answers with 53. The original run is kept, so the thread now has two branches, and Studio switches between them. This is how you try an edge case, an odd argument, a tool error or an empty search result, without writing a prompt that makes the model produce it. **Re-run from here** runs again from a checkpoint without editing it, for example after you change a prompt in the file: the server reloads, and the re-run uses the new code.

::: visual studio-fork | Figure | Edit a step and fork
The thread of the agent after an interrupt before tools: the run continued as it was, and a fork from an edited tool call.
:::

In code, the same moves are `interrupt_before`, `update_state` and resuming from a checkpoint (lessons [14.1](lesson:14.1), [14.2](lesson:14.2) and [14.4](lesson:14.4)); Studio makes those calls through the server's API.

## Threads, assistants and the Playground

| In Studio | Use it to |
|---|---|
| Threads | Keep each conversation: **+ New Thread** starts a fresh one, and old ones stay listed, even after a restart |
| Assistants | Save a configuration of the graph, such as a system prompt or a model name the graph reads from its config, and switch between versions |
| **View LLM Runs**, then Playground | Run one model call of a step again with an edited prompt, another model or other tools |
| **Add to Dataset** | Save a node's input and output as an evaluation example ([lesson 12.1](lesson:12.1)) |
| **Run experiment** | Run a dataset against the current assistant |

With tracing on, every run Studio starts also appears in LangSmith. From the other side, a trace in LangSmith has a **Run in Studio** button, and its menu can clone a production thread into your local server, to debug a real failure on your own machine.

## Common problems

| Problem | Cause | Fix |
|---|---|---|
| `langgraph: command not found` | The CLI isn't installed in the active environment | Activate the environment and install `langgraph-cli[inmem]` |
| `Required package 'langgraph-api' is not installed` | The CLI was installed without the `inmem` extra | Install `"langgraph-cli[inmem]"`, in quotes on the zsh command line |
| Studio can't connect to the server | Safari, some other browsers and some networks block a web page from calling `http://127.0.0.1` | Use Chrome or Firefox, or start with `langgraph dev --tunnel` and add the tunnel's URL under **Connect to a local server** in Studio |
| `Could not find graph 'agent' in './openai_agent.py'` | The name after the colon in `graphs` isn't a variable of the file | Fix the name; the message lists the graphs the file does have |
| `TypeError: str expected, not NoneType` while the graph loads | A key the file copies with `os.environ[...]` is missing, or `env` points to the wrong file | Fix the `env` path, which is relative to `langgraph.json`, or add the key |
| `Heads up! Your graph ... includes a custom checkpointer` | The graph is compiled with a checkpointer | Compile without it |
| `BlockingError: Blocking call to ...` | A blocking call inside an `async def` node | Make the node a plain `def`, or wrap the call in `await asyncio.to_thread(...)`; `--allow-blocking` silences the check during development only |
| `tools` drawn on its own | A routing function without declared targets | A `Literal` return type or a path map, as above |
| Old threads come back after a restart | They are saved in `.langgraph_api` | Delete the folder |

## The agent in one file

The module in one file: the tool-calling agent ready for Studio, with Gemini as the model, its routes declared and no checkpointer. Read it to revise, press **Explain** on it for every step. It needs `GOOGLE_API_KEY` in `.env` ([lesson 6.1](lesson:6.1)), plus the LangSmith lines of [lesson 12.1](lesson:12.1) if you want traces, and the packages of [lesson 6.1](lesson:6.1)'s `requirements.txt` with `langgraph` ([lesson 10.2](lesson:10.2)) and `langgraph-cli[inmem]` (above).

```python title="agent.py" explain
"""A tool-calling agent to run in LangGraph Studio: Gemini decides, a tool adds, the server keeps each thread."""
from typing import Annotated, Literal

from dotenv import load_dotenv
from langchain_core.messages import AnyMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict

load_dotenv()  # GOOGLE_API_KEY when the file runs alone; langgraph dev loads the env file of langgraph.json


# 1. State: the conversation
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


# 2. Tool
@tool
def add(a: float, b: float) -> float:
    """Adds two numbers."""
    return a + b


# 3. Model, with the tool's schema attached to every request
model = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
model_with_tools = model.bind_tools([add])


# 4. Node and router
def call_model(state: State) -> dict:
    return {"messages": [model_with_tools.invoke(state["messages"])]}


def should_continue(state: State) -> Literal["tools", "__end__"]:
    if state["messages"][-1].tool_calls:
        return "tools"
    return END


# 5. Graph, compiled without a checkpointer: the server brings its own
builder = StateGraph(State)
builder.add_node("agent", call_model)
builder.add_node("tools", ToolNode([add]))
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue)
builder.add_edge("tools", "agent")
graph = builder.compile()
```

::: walkthrough

The file only defines the graph; the server imports it, runs it and stores its threads. Steps 1 to 4 are the parts, step 5 the assembly.

```python title="Setup" norun
from typing import Annotated, Literal

from dotenv import load_dotenv
from langchain_core.messages import AnyMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict

load_dotenv()  # GOOGLE_API_KEY when the file runs alone; langgraph dev loads the env file of langgraph.json
```

**Setup.** Messages and the tool decorator come from `langchain_core`, the model from its provider's package, and the graph parts from `langgraph`. Under `langgraph dev` the keys arrive from the file named by `env` in `langgraph.json` before this module is imported; `load_dotenv()` covers the other case, importing the graph yourself, for example in a test.

```python title="Step 1 · State" norun
class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
```

**1. State.** One key, the conversation, merged with `add_messages` so each node's messages are appended ([lesson 10.3](lesson:10.3)). Because the state has a `messages` list, Studio's Chat mode works for this graph too.

```python title="Step 2 · Tool" norun
@tool
def add(a: float, b: float) -> float:
    """Adds two numbers."""
    return a + b
```

**2. Tool.** `@tool` turns the function into a tool whose name, docstring and type hints become the schema the model reads ([lesson 9.3](lesson:9.3)). `ToolNode` validates the model's arguments against those hints, so `5` and `3` arrive as floats and the result is `8.0`.

```python title="Step 3 · Model" norun
model = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
model_with_tools = model.bind_tools([add])
```

**3. Model.** `bind_tools` attaches the tool's schema to every request, so the model can reply with a tool call instead of text. The model name is Google's at the time of writing; check Google's model list **VERIFY**, since Google retires older models.

```python title="Step 4 · Node and router" norun
def call_model(state: State) -> dict:
    return {"messages": [model_with_tools.invoke(state["messages"])]}


def should_continue(state: State) -> Literal["tools", "__end__"]:
    if state["messages"][-1].tool_calls:
        return "tools"
    return END
```

**4. Node and router.** `call_model` sends the whole conversation, tool results included, and appends the model's reply. `should_continue` routes on that reply: tool calls go to `tools`, anything else ends the run. Its `Literal` return type is what lets Studio draw both dotted edges.

```python title="Step 5 · Graph" norun
builder = StateGraph(State)
builder.add_node("agent", call_model)
builder.add_node("tools", ToolNode([add]))
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue)
builder.add_edge("tools", "agent")
graph = builder.compile()
```

**5. Graph.** Two nodes and the loop between them: `agent` decides, `tools` acts, and the edge back lets the model read the result. `compile()` gets no checkpointer, because the server attaches its own and refuses a graph that brings one. The compiled graph is the module-level variable `graph`, the name `langgraph.json` points to.

In one sentence: the file declares the state, the tool, the model, the node and its routes, and leaves running, storing and showing the agent to the server and Studio.

:::

```json title="langgraph.json" norun
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./agent.py:graph"
  },
  "env": ".env"
}
```

### Run it

```zsh title="Terminal" norun
langgraph dev
```

```output illustrative note="startup text trimmed, emojis removed"
- API: http://127.0.0.1:2024
- Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- API Docs: http://127.0.0.1:2024/docs
```

Studio opens on the `agent` graph with all four edges drawn. Ask "What is 12.5 + 7.5?": the thread shows `agent` asking for `add`, `tools` returning `20.0` and `agent` answering. Then repeat the run with an interrupt before `tools` and fork it with other arguments, as above.

### Swap one piece

| Piece | In the file | Alternatives |
|---|---|---|
| Model | `ChatGoogleGenerativeAI(...)` | The OpenAI, Groq and Ollama tabs above |
| Tools | `add` | Search tools ([lesson 11.3](lesson:11.3)), your own `@tool` functions ([lesson 9.3](lesson:9.3)) |
| Router | `should_continue` with a `Literal` return type | `tools_condition` ([lesson 11.2](lesson:11.2)) |
| Persistence | The server's, saved in `.langgraph_api` | A deployment's database; `MemorySaver` only when you run the graph yourself ([lesson 11.5](lesson:11.5)) |
| Where it runs | `langgraph dev` on your machine | `langgraph up` in Docker, or LangSmith Deployment with `langgraph deploy` |
| How you watch it | Studio | Traces in LangSmith ([lesson 12.1](lesson:12.1)), `stream` in a terminal ([lesson 11.6](lesson:11.6)) |

## Interview questions

::: check
When do you debug in Studio, and when in traces?

Studio while you build: you start runs yourself, pause before nodes, edit state, fork and re-run in seconds, against a local server or a deployment. Traces for every run, including production runs you didn't start, read afterwards: they show what a real user's run did, which step failed and what it cost. The two connect: a failing trace opens in Studio, and can be cloned into your local server to reproduce and fix the failure there.
:::

::: check
A user reports that the agent called a refund tool with the wrong amount. How do you reproduce and fix it?

Find the run's trace (by user ID in the metadata or by time), read the model call that produced the tool call and the messages it was sent, and clone the thread into a local server. In Studio, interrupt before the tools node, confirm the wrong argument, then fork with edited state to test what the tool does with bad amounts. Fix both sides: the cause in the prompt, the tool description or the context, and a guard in the tool itself that validates the amount or asks a person above a limit ([lesson 17.2](lesson:17.2)). Add the case to a dataset so the next version is tested against it.
:::

::: check
What does `langgraph dev` give you that calling `graph.invoke` in a notebook doesn't, and what doesn't it give you?

A server with the same API as a deployment: threads and checkpoints kept for you, assistants, streaming endpoints, Studio, hot reload, and checks that catch problems early, such as blocking calls in async code or a custom checkpointer. What it doesn't give is production: storage is in memory with a local file, there is one process, and its own banner says it is for development and testing. For production, deploy the same graph to LangSmith Deployment with `langgraph deploy`, or build a Docker image with `langgraph build` and run it on your own servers, which needs a licence.
:::

## Practice

::: practice
**Both graphs in Studio.** The file also builds the chatbot, `make_default_graph`. Make Studio offer it next to the agent without changing the Python file.

```json title="langgraph.json" norun
{
  "dependencies": ["."],
  "graphs": {
    "openai_agent": "./openai_agent.py:agent",
    "default_agent": "./openai_agent.py:make_default_graph"
  },
  "env": "../.env"
}
```

A value in `graphs` may name a function that returns a graph instead of the graph itself; the server calls it when it needs the graph. Restart `langgraph dev` and the graph selector lists both. A factory can also take the run's config as its parameter and build a different graph for each run, for example with another model or another set of tools.
:::

::: practice
**What Studio will draw.** Write `unconnected(graph)`, which returns the nodes no drawn edge reaches, and use it to compare the file's routing function with the typed one, on a copy of the graph with stand-in nodes so no model is needed.

```python title="Notebook cell"
from typing import Literal

from langgraph.graph import END, START, MessagesState, StateGraph


def build(router):
    builder = StateGraph(MessagesState)
    builder.add_node("agent", lambda state: {"messages": []})  # stand-ins: drawing never runs a node
    builder.add_node("tools", lambda state: {"messages": []})
    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", router)
    builder.add_edge("tools", "agent")
    return builder.compile()


def should_continue(state):
    if state["messages"][-1].tool_calls:
        return "tools"
    else:
        return END


def should_continue_typed(state) -> Literal["tools", "__end__"]:
    return should_continue(state)


def unconnected(graph):
    drawing = graph.get_graph()
    reached = {edge.target for edge in drawing.edges}
    return [node for node in drawing.nodes if node != "__start__" and node not in reached]


for router in (should_continue, should_continue_typed):
    print(router.__name__, "->", unconnected(build(router)) or "every node is reached")
```

```output real
should_continue -> ['tools']
should_continue_typed -> every node is reached
```

LangGraph draws a graph by walking it from `__start__`. Without the hint it can't follow the route to `tools`, so it never reaches that node and never sees the fixed edge from `tools` back to `agent` either. A check like this in a test catches a misleading picture before anyone opens Studio.
:::

## Further reading

- LangChain, [LangSmith Studio](https://docs.langchain.com/langsmith/studio): what Studio does, Graph and Chat modes.
- LangChain, [How to use Studio](https://docs.langchain.com/langsmith/use-studio): running, assistants, threads, editing state and forking.
- LangChain, [LangGraph CLI](https://docs.langchain.com/langsmith/cli): every key of `langgraph.json` and every option of `langgraph dev`.
