+++
number = "11.4"
title = "The ReAct agent graph"
lede = "Route the tools node back to the model and the router becomes an agent: the model acts, observes the result and reasons about the next step, until it can answer. One edge, and the graph loops."
summary = "ReAct and where the name comes from, the one edge that turns a router into an agent, the tools and the graph, runs with one and several tool rounds, parallel tool calls and what goes wrong with them, steps and recursion limits, this graph compared with create_agent, interview questions and two practice tasks without a model."
type = "concept"
status = "published"
source = "11 LangGraph Components: 18-Agents.pdf (slides 1-2); 7-ReActAgents.ipynb (cells 1-21; retired Groq model replaced, cells repeated from 6-chatbotswithmultipletools replaced by a link, long outputs trimmed); the ReAct paper, parallel calls, limits, the comparison with create_agent, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

The router of [lessons 11.2](lesson:11.2) and [11.3](lesson:11.3) stops as soon as a tool has run, so the model never sees the result. It can't turn `4` into a sentence, check a search result, or take a second step that depends on the first, such as "add 5 plus 5 and then multiply by 3". An agent needs a loop: the model asks for a tool, reads what came back, and decides again. In LangGraph that loop is one edge.

## Act, observe, reason

The loop has a name, ReAct, short for reasoning and acting. It comes from a 2022 paper by Yao and others, which had a model write its reasoning ("Thought: I need the population first"), then an action ("Search[population of Paris]"), then read the action's result ("Observation: ..."), and repeat until it could answer. Interleaving the two beat reasoning alone, which invents facts, and acting alone, which loses track of the goal. Today's models do the same through tool calls instead of text patterns, and "ReAct agent" has come to mean any model-and-tools loop:

1. **Act:** the model calls one or more tools.
2. **Observe:** the tools' results go back to the model as messages.
3. **Reason:** from the results and the question, the model decides the next step: another tool call, or the answer.

For "Please add 5 plus 5 and then multiply by 3", that is two rounds: the model calls `add(5, 5)`, observes 10, calls `multiply(10, 3)`, observes 30, and answers 30. The loop is the agent loop of [lesson 8.1](lesson:8.1); this lesson builds it as a graph.

::: visual router-vs-agent | Figure | Router or agent
The two graphs side by side: the same nodes, and one edge that decides whether the model sees the tools' results.
:::

## The tools

The agent gets the three tools of [lesson 11.3](lesson:11.3), `arxiv`, `wiki` and `tavily`, created the same way, plus three functions for arithmetic:

```python title="Notebook cell"
### Custom Functions
def multiply(a: int, b: int) -> int:
    """Multiply a and b.

    Args:
        a: first int
        b: second int
    """
    return a * b


# This will be a tool
def add(a: int, b: int) -> int:
    """Adds a and b.

    Args:
        a: first int
        b: second int
    """
    return a + b


def divide(a: int, b: int) -> float:
    """Divide a and b.

    Args:
        a: first int
        b: second int
    """
    return a / b
```

```python title="Notebook cell" norun
### Combine all the tools in the list

tools = [arxiv, wiki, tavily, add, divide, multiply]
```

```python title="Notebook cell" norun
## Initialize my LLM model

from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-120b")

llm_with_tools = llm.bind_tools(tools)
```

Any provider of [lesson 11.2](lesson:11.2) works; the saved runs below came from one of Groq's retired Qwen models. If your environment has LangSmith variables in `.env`, every run is also recorded as a trace ([lesson 12.1](lesson:12.1)).

## One edge closes the loop

```python title="Notebook cell"
## State Schema
from typing_extensions import TypedDict
from langchain_core.messages import AnyMessage
from typing import Annotated
from langgraph.graph.message import add_messages


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
```

```python title="Notebook cell" norun
### Entire Chatbot With LangGraph
from IPython.display import Image, display
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langgraph.prebuilt import tools_condition


### Node definition
def tool_calling_llm(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


# Build graph
builder = StateGraph(State)
builder.add_node("tool_calling_llm", tool_calling_llm)
builder.add_node("tools", ToolNode(tools))

builder.add_edge(START, "tool_calling_llm")
builder.add_conditional_edges(
    "tool_calling_llm",
    # If the latest message (result) from assistant is a tool call -> tools_condition routes to tools
    # If the latest message (result) from assistant is a not a tool call -> tools_condition routes to END
    tools_condition,
)
builder.add_edge("tools", "tool_calling_llm")


graph = builder.compile()

# View
display(Image(graph.get_graph().draw_mermaid_png()))
```

Everything matches [lesson 11.3](lesson:11.3)'s cell except the last edge: `builder.add_edge("tools", "tool_calling_llm")` instead of `builder.add_edge("tools", END)`. Now the only way out is `tools_condition`'s route to `END`, taken when the model replies without a tool call. The model decides when the run is over.

## Runs

A question that needs one tool:

```python title="Notebook cell" norun
from langchain_core.messages import AIMessage, HumanMessage

messages = graph.invoke({"messages": HumanMessage(content="What is 5 plus 8")})
for m in messages['messages']:
    m.pretty_print()
```

```output saved note="from a run with a Qwen model Groq has since retired; tool call IDs vary per run"
================================ Human Message =================================

What is 5 plus 8
================================== Ai Message ==================================
Tool Calls:
  add (call_qwk2)
 Call ID: call_qwk2
  Args:
    a: 5
    b: 8
================================= Tool Message =================================
Name: add

13
================================== Ai Message ==================================

The sum of 5 and 8 is 13.
```

Four messages instead of the router's three: after `tools`, the run went back to `tool_calling_llm`, the model read `13` and wrote the answer, and `tools_condition` ended the run. The same happens with a search:

```python title="Notebook cell" norun
messages = graph.invoke({"messages": HumanMessage(content="What is machine learning")})
for m in messages['messages']:
    m.pretty_print()
```

```output saved note="from a run with a Qwen model Groq has since retired; tool call IDs vary per run"
================================ Human Message =================================

What is machine learning
================================== Ai Message ==================================
Tool Calls:
  wikipedia (call_9v23)
 Call ID: call_9v23
  Args:
    query: machine learning
================================= Tool Message =================================
Name: wikipedia

Page: Machine learning
Summary: Machine learning (ML) is a field of study in artificial intelligence concerned with the development and study of statistical algorithms that can learn from data and generalize to unseen data, and thus perform tasks without explicit instructions. Within a subdiscipline in machine learning, advances in the field of deep learning have allowed neural networks, a class of statistical algorithms, to surpass many previous machine learning approaches in performance.
ML fi
================================== Ai Message ==================================

Machine learning (ML) is a field of study within artificial intelligence that focuses on developing and studying statistical algorithms which can learn from data and apply what they've learned to new, unseen data. This allows machines to perform tasks without being explicitly programmed to do so. A significant advancement in ML has been in the area of deep learning, which has allowed neural networks—a type of statistical algorithm—to outperform many traditional machine learning approaches in terms of performance.
```

The truncated Wikipedia text became a complete answer: the model observed the result and reasoned over it, which the router never could. Now a request with three parts:

```python title="Notebook cell" norun
messages = graph.invoke({"messages": HumanMessage(content="Provide me the top 10 recent AI news for MArch 3rd 2025,add 5 plus 5 and then multiply by 10")})
for m in messages['messages']:
    m.pretty_print()
```

```output saved note="from a run with a Qwen model Groq has since retired; search result and answer trimmed"
================================ Human Message =================================

Provide me the top 10 recent AI news for MArch 3rd 2025,add 5 plus 5 and then multiply by 10
================================== Ai Message ==================================
Tool Calls:
  tavily_search_results_json (call_zss4)
 Call ID: call_zss4
  Args:
    query: top 10 recent AI news for March 3rd 2025
  add (call_aa6m)
 Call ID: call_aa6m
  Args:
    a: 5
    b: 5
  multiply (call_96mc)
 Call ID: call_96mc
  Args:
    a: 10
    b: 10
================================= Tool Message =================================
Name: tavily_search_results_json

[{"url": "https://hipther.com/latest-news/2025/03/03/88344/ai-dispatch-daily-trends-and-innovations-march-3-2025-nvidia-flora-honor-ai-lenovo/", "content": "AI Dispatch: Daily Trends and Innovations – March 3, 2025 | Nvidia, Flora, Honor AI, Lenovo [...]"}, [...]]
================================= Tool Message =================================
Name: add

10
================================= Tool Message =================================
Name: multiply

100
================================== Ai Message ==================================

Here are the top 10 recent AI news articles for March 3rd, 2025:

1. [AI Dispatch: Daily Trends and Innovations – March 3, 2025 | Nvidia, Flora, Honor AI, Lenovo](https://hipther.com/latest-news/2025/03/03/88344/ai-dispatch-daily-trends-and-innovations-march-3-2025-nvidia-flora-honor-ai-lenovo/)
2. [AI Pulse News Roundup (March 2025 Edition)](https://community.openai.com/t/ai-pulse-news-roundup-march-2025-edition/1132414)
[...]
5. [Microsoft Developing AI Reasoning Models to Compete with OpenAI, The Information Reports](https://money.usnews.com/investing/news/articles/2025-03-07/microsoft-developing-ai-reasoning-models-to-compete-with-openai-the-information-reports)

And the result of adding 5 plus 5 and then multiplying by 10 is 100.
```

Read the first reply closely. The model asked for three tools at once, and `ToolNode` ran them in parallel. But `multiply` depends on `add`'s result, and the model didn't wait for it: it worked out 5 plus 5 itself and passed `a: 10` to `multiply` in the same reply. The answer, 100, is right only because the model's mental arithmetic was. It also promised ten news items and listed five. Both are typical:

- **Parallel calls for dependent steps.** A model may batch calls whose inputs depend on each other and fill in the missing values itself. For steps that must happen in order, say so in the system prompt ("call one tool at a time when a step needs an earlier result"), or turn off parallel calls where the provider allows it (OpenAI's `bind_tools(tools, parallel_tool_calls=False)`).
- **Claims not backed by results.** The answer's count and wording come from the model, not the tools. Check answers that matter against the tool results, in code or with a second model ([lesson 15.4](lesson:15.4)).

## No memory yet

```python title="Notebook cell" norun
messages = [HumanMessage(content="Divide that by 5")]
messages = graph.invoke({"messages": messages})
for m in messages['messages']:
    m.pretty_print()
```

```output saved note="from a run with a Qwen model Groq has since retired"
================================ Human Message =================================

Divide that by 5
================================== Ai Message ==================================

It looks like you want to perform a division operation, but you haven't provided the number to be divided by 5. Could you please specify the number?
```

"That" was the 13 of an earlier run, but each `invoke` starts from an empty state ([lesson 10.3](lesson:10.3)). [Lesson 11.5](lesson:11.5) gives this agent a memory.

## Steps and limits

Each node that runs is one step of the run, so a question answered after one tool round takes three (model, tools, model), and every further round adds two. Nothing in the graph caps the rounds: a model that keeps asking for tools keeps the loop going until the run reaches its `recursion_limit` and stops with `GraphRecursionError` ([lesson 10.1](lesson:10.1)). The default allows thousands of steps, so pass your own with each call:

```python title="Notebook cell" norun
graph.invoke({"messages": HumanMessage(content="What is 5 plus 8")}, {"recursion_limit": 10})
```

With a limit of 10 the run must finish within nine steps, enough for four tool rounds. For a friendlier stop, count the rounds in the state and route to `END` (or to a node that answers with what it has) after a few; practice 2 shows the hard stop.

## This graph and create_agent

`create_agent` ([lesson 9.4](lesson:9.4)) builds this same graph: a `model` node, a `tools` node running a `ToolNode`, a conditional edge after the model and an edge back from the tools. It adds the system prompt, middleware, structured output and error handling around it. LangGraph's own prebuilt version, `create_react_agent` from `langgraph.prebuilt`, still runs but warns that it is deprecated since LangGraph 1.0 in favour of `create_agent`.

| You need | Use |
|---|---|
| The standard loop: model, tools, repeat | `create_agent`: less code, middleware for limits, summaries and approval |
| Steps before or after the loop, branches decided by code, extra state keys, several agents | Your own graph like this one; an agent from `create_agent` can also be one of its nodes |
| To learn what an agent does | This graph: every part is visible |

## Interview questions

::: check
An agent asked to "add 5 plus 5 and then multiply by 10" called `add(5, 5)` and `multiply(10, 10)` in the same reply. What happened, and why does it matter?

The model batched the two calls as parallel tool calls and filled in `add`'s result itself instead of waiting to observe it. Here the guess was right; with a harder intermediate step, such as a lookup or a rounding rule, it wouldn't be, and the final answer would rest on a number no tool produced. Ask for one tool at a time when steps depend on each other, disable parallel calls where the provider allows it, or design one tool that does the whole dependent computation.
:::

::: check
What is the difference between the router of lesson 11.2 and the ReAct agent, in graph terms and in behaviour?

One edge. The router's tools node leads to `END`, so the run makes one decision and stops on the raw tool result; the agent's tools node leads back to the model, so the model observes each result and decides again, any number of times. The router is cheaper and predictable (at most one model call and one tool round); the agent can chain dependent steps, recover from a bad result and write a real answer, at the cost of more calls and a loop that needs a limit.
:::

::: check
How many model calls and steps does "Please add 5 plus 5 and then multiply by 3" take in the ReAct graph, if the model calls one tool at a time?

Three model calls and two tool runs: model (asks for `add`), tools (10), model (asks for `multiply`), tools (30), model (answers). That is five steps, so a `recursion_limit` of 5 or less stops it before the answer. Each model call also resends the whole conversation, so the third call carries the question, two tool calls and two results.
:::

::: check
Why build this graph by hand when `create_agent` exists?

To control what the prebuilt loop doesn't expose as a setting: a step before the model (retrieve documents, check the user's permissions), a branch decided by code (route refunds to a stricter agent), state beyond messages (a count of tool rounds, a budget), or several agents in one graph. For the plain loop, `create_agent` is the better default, and an agent it builds can be a node inside your graph.
:::

## Practice

::: practice
**Drive the loop without a model.** Replace the model node with a stand-in function that plays the model's part by fixed rules: with no tool results yet, ask for `add(5, 5)`; with one, ask for `multiply(result, 3)`; with two, answer. Build the ReAct graph around it with `ToolNode([add, multiply])` and stream the run for "Please add 5 plus 5 and then multiply by 3", printing what each node did.

```python title="Notebook cell"
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition


def stand_in_model(state: State):
    results = [m for m in state["messages"] if isinstance(m, ToolMessage)]
    if not results:
        call = {"name": "add", "args": {"a": 5, "b": 5}, "id": "call_1"}
    elif len(results) == 1:
        call = {"name": "multiply", "args": {"a": int(results[0].content), "b": 3}, "id": "call_2"}
    else:
        return {"messages": [AIMessage(content=f"5 plus 5 is 10, and 10 times 3 is {results[-1].content}.")]}
    return {"messages": [AIMessage(content="", tool_calls=[call])]}


builder = StateGraph(State)
builder.add_node("model", stand_in_model)
builder.add_node("tools", ToolNode([add, multiply]))
builder.add_edge(START, "model")
builder.add_conditional_edges("model", tools_condition)
builder.add_edge("tools", "model")
agent = builder.compile()

for update in agent.stream({"messages": "Please add 5 plus 5 and then multiply by 3"}):
    for node, change in update.items():
        for message in change["messages"]:
            if isinstance(message, AIMessage) and message.tool_calls:
                call = message.tool_calls[0]
                print(f"{node:<6} asks {call['name']}({call['args']})")
            elif isinstance(message, ToolMessage):
                print(f"{node:<6} {message.name} returned {message.content}")
            else:
                print(f"{node:<6} answers: {message.content}")
```

```output real
model  asks add({'a': 5, 'b': 5})
tools  add returned 10
model  asks multiply({'a': 10, 'b': 3})
tools  multiply returned 30
model  answers: 5 plus 5 is 10, and 10 times 3 is 30.
```

The second request uses the first result: that is the observe step, and only the edge from `tools` back to `model` makes it possible. A real model replaces the rules with judgement, but the graph, the messages and the routing stay exactly the same, which is how agent graphs are tested without paying for model calls.
:::

::: practice
**Stop a runaway loop.** Write a stand-in model that asks for `add` on every turn and never answers. Stream the ReAct graph with a `recursion_limit` of 6, print each step, and catch the error.

```python title="Notebook cell"
from langgraph.errors import GraphRecursionError


def stubborn(state: State):
    n = len(state["messages"])
    return {"messages": [AIMessage(content="", tool_calls=[{"name": "add", "args": {"a": n, "b": 1}, "id": f"call_{n}"}])]}


builder = StateGraph(State)
builder.add_node("model", stubborn)
builder.add_node("tools", ToolNode([add]))
builder.add_edge(START, "model")
builder.add_conditional_edges("model", tools_condition)
builder.add_edge("tools", "model")
loop = builder.compile()

try:
    for step, update in enumerate(loop.stream({"messages": "Count forever"}, {"recursion_limit": 6}), start=1):
        print(step, list(update))
except GraphRecursionError:
    print("GraphRecursionError: the run hit its recursion_limit of 6")
```

```output real
1 ['model']
2 ['tools']
3 ['model']
4 ['tools']
5 ['model']
6 ['tools']
GraphRecursionError: the run hit its recursion_limit of 6
```

Six steps ran, three model turns and three tool rounds, and the run stopped before a seventh. Nothing else would have ended it: `tools_condition` only routes to `END` when the model stops asking for tools. In production, catch the error and answer with what the agent has, and add a softer limit of your own, a round count in the state, so most runs never reach the hard one.
:::

## Further reading

- Yao and others, [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) (2022): the paper behind the name.
- LangChain, [Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents): the agent loop built with the Graph API.
