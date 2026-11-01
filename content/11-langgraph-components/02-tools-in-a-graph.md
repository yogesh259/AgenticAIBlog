+++
number = "11.2"
title = "Tools in a graph"
lede = "Give the chatbot graph a tool: messages carry the conversation, a model with a bound tool decides, ToolNode runs what it asks for, and tools_condition picks the path. The result is a router: one decision, then the run ends."
summary = "The four ideas behind a graph with tools, messages with names, a chat model in a node, binding a tool, the messages state, a node that only asks for a tool, ToolNode and tools_condition, what each does inside, why the result is a router and not yet an agent, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "11 LangGraph Components: 13-Chains+Part+1.pdf, 13.1-Router+.pdf and 14-tool.pdf (slides); 5-ChainsLangGraph.ipynb (cells 1-28; retired Groq model replaced, the user's name replaced, a compiled graph renamed so later cells use it, reducer cells reduced to a link); ToolNode and tools_condition inside, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

The chatbot graph of [lesson 10.3](lesson:10.3) can only talk. Ask it for the current temperature in New York and it can only guess, because a model knows its training data and the messages it receives, nothing more. Tools close that gap: a weather API, a database, a calculator, any function your code can run ([lesson 9.3](lesson:9.3)). This lesson puts one inside a graph, in four steps:

1. **Chat messages as the graph's state.** The human's input and the model's output are messages, kept in one list.
2. **A chat model in a node.** The node sends the list to the model and appends the reply.
3. **Tools bound to the model.** Each request carries the tools' schemas, so the model can answer with a tool call instead of text.
4. **Tool calls executed in a node.** A second node runs whatever the model asked for and appends the results.

The example is a question a model shouldn't answer from memory, "What is 2 plus 2?", and a tool that adds two numbers.

## Messages with names

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

```python title="Notebook cell"
from langchain_core.messages import AIMessage, HumanMessage
from pprint import pprint

messages = [AIMessage(content=f"Please tell me how can I help", name="LLMModel")]
messages.append(HumanMessage(content=f"I want to learn coding", name="Alice"))
messages.append(AIMessage(content=f"Which programming language you want to learn", name="LLMModel"))
messages.append(HumanMessage(content=f"I want to learn python programming language", name="Alice"))

for message in messages:
    message.pretty_print()
```

```output real
================================== Ai Message ==================================
Name: LLMModel

Please tell me how can I help
================================ Human Message =================================
Name: Alice

I want to learn coding
================================== Ai Message ==================================
Name: LLMModel

Which programming language you want to learn
================================ Human Message =================================
Name: Alice

I want to learn python programming language
```

LangChain has a class per role: `HumanMessage` from the user, `AIMessage` from the model, `SystemMessage` with instructions for the model, `ToolMessage` with a tool's result ([lesson 9.2](lesson:9.2)). Each carries `content`, an optional `name` for its author, and, on replies, `response_metadata` from the provider. `pretty_print` shows a message the way the runs below do.

## A chat model

Pick a provider; every cell below works with any of them.

:::: tabs
::: tab Groq
```python title="Notebook cell" norun
from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-120b")
result = llm.invoke(messages)
```

```python title="Notebook cell" norun
result.response_metadata
```

```output saved note="from a run with Qwen 2.5 32B, since retired"
{'token_usage': {'completion_tokens': 446,
  'prompt_tokens': 75,
  'total_tokens': 521,
  'completion_time': 2.23,
  'prompt_time': 0.006678778,
  'queue_time': 0.242182835,
  'total_time': 2.236678778},
 'model_name': 'qwen-2.5-32b',
 'system_fingerprint': 'fp_35f92f8282',
 'finish_reason': 'stop',
 'logprobs': None}
```

Groq has retired the Qwen models older examples use here (`qwen-qwq-32b`, `qwen-2.5-32b`); `openai/gpt-oss-120b` is the replacement it names ([lesson 9.1](lesson:9.1)). The saved outputs in this lesson came from Qwen 2.5 32B.
:::
::: tab Gemini
```python title="Notebook cell" norun
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
result = llm.invoke(messages)
```
:::
::: tab OpenAI
```python title="Notebook cell" norun
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")
result = llm.invoke(messages)
```

OpenAI retires `gpt-4o` on 14 January 2027 and names `gpt-6-luna` as its replacement: change the name then.
:::
::: tab Ollama
```python title="Notebook cell" norun
from langchain_ollama import ChatOllama

llm = ChatOllama(model="qwen3.5")
result = llm.invoke(messages)
```
:::
::::

The model reads the whole list and replies to the last message. `response_metadata` holds the provider's report: tokens used, timings, the model that answered and why it stopped (`'stop'` for a finished answer, `'tool_calls'` when it asks for a tool).

## Bind a tool

```python title="Notebook cell"
def add(a: int, b: int) -> int:
    """ Add a and b
    Args:
        a (int): first int
        b (int): second int

    Returns:
        int
    """
    return a + b
```

```python title="Notebook cell" norun
### Binding tool with llm
llm_with_tools = llm.bind_tools([add])

tool_call = llm_with_tools.invoke([HumanMessage(content=f"What is 2 plus 2", name="Alice")])
```

```python title="Notebook cell" norun
tool_call.tool_calls
```

```output saved note="tool call IDs vary per run"
[{'name': 'add',
  'args': {'a': 2, 'b': 2},
  'id': 'call_bxje',
  'type': 'tool_call'}]
```

`bind_tools` turns the function into a tool, with its name, its docstring as the description and its type hints as the arguments, and sends that schema with every request ([lesson 9.3](lesson:9.3) shows the schema). The model replied with no text and one tool call: the tool's name, its arguments and an ID. Nothing has run yet; a tool call is only a request.

## Messages as the graph's state

```python title="Notebook cell"
from typing_extensions import TypedDict
from langchain_core.messages import AnyMessage


class State(TypedDict):
    message: list[AnyMessage]
```

`AnyMessage` means any of the message classes. Without a reducer, though, each node's reply would replace the list instead of joining it, so the conversation would shrink to the last message. The fix is the `add_messages` reducer of [lesson 10.3](lesson:10.3), which appends:

```python title="Notebook cell"
from langgraph.graph.message import add_messages
from typing import Annotated


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
```

## The model in a node

```python title="Notebook cell"
## chatbot node functionality
def llm_tool(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}
```

```python title="Notebook cell"
from IPython.display import Image, display
from langgraph.graph import StateGraph, START, END

builder = StateGraph(State)

builder.add_node("llm_tool", llm_tool)

builder.add_edge(START, "llm_tool")
builder.add_edge("llm_tool", END)

graph = builder.compile()
```

```python title="Notebook cell" norun
display(Image(graph.get_graph().draw_mermaid_png()))
```

The drawing shows `__start__`, `llm_tool` and `__end__` in a line ([lesson 10.2](lesson:10.2) explains the drawing).

```python title="Notebook cell" norun
## invocation

messages = graph.invoke({"messages": "What is 2 plus 2"})

for message in messages["messages"]:
    message.pretty_print()
```

```output saved note="from a run with Qwen 2.5 32B, since retired; tool call IDs vary per run"
================================ Human Message =================================

What is 2 plus 2
================================== Ai Message ==================================
Tool Calls:
  add (call_hky1)
 Call ID: call_hky1
  Args:
    a: 2
    b: 2
```

The string became a `HumanMessage`, the node appended the model's reply, and the run ended. The model asked for `add`, but no node runs tools, so the request just sits in the state. That is half of tool calling.

## Run the tool: ToolNode and tools_condition

LangGraph ships the other half: a node that runs tool calls, and a routing function that sends the run to it only when there is something to run.

```python title="Notebook cell"
tools = [add]
```

```python title="Notebook cell"
from langgraph.prebuilt import ToolNode
from langgraph.prebuilt import tools_condition


builder = StateGraph(State)

## Add nodes

builder.add_node("llm_tool", llm_tool)
builder.add_node("tools", ToolNode(tools))

## Add Edge
builder.add_edge(START, "llm_tool")
builder.add_conditional_edges(
    "llm_tool",
    # If the latest message (result) from assistant is a tool call -> tools_condition routes to tools
    # If the latest message (result) from assistant is a not a tool call -> tools_condition routes to END
    tools_condition
)
builder.add_edge("tools", END)


graph = builder.compile()
```

A common slip is to store the compiled graph under another name, such as `graph_builder`, and keep calling `graph`, which is still the graph without tools. The edges, printed instead of drawn:

```python title="Notebook cell"
for edge in graph.get_graph().edges:
    kind = " (conditional)" if edge.conditional else ""
    print(f"{edge.source} -> {edge.target}{kind}")
```

```output real
__start__ -> llm_tool
llm_tool -> __end__ (conditional)
llm_tool -> tools (conditional)
tools -> __end__
```

After `llm_tool`, `tools_condition` chooses: `tools` when the model's last reply holds tool calls, `__end__` when it doesn't. The node must be named `"tools"`, since that is the name `tools_condition` returns. After `tools`, the run always ends.

```python title="Notebook cell" norun
## invocation

messages = graph.invoke({"messages": "What is 2 plus 2"})

for message in messages["messages"]:
    message.pretty_print()
```

```output saved note="from a run with Qwen 2.5 32B, since retired; tool call IDs vary per run"
================================ Human Message =================================

What is 2 plus 2
================================== Ai Message ==================================
Tool Calls:
  add (call_txad)
 Call ID: call_txad
  Args:
    a: 2
    b: 2
================================= Tool Message =================================
Name: add

4
```

```python title="Notebook cell" norun
messages = graph.invoke({"messages": "What Machine Learning"})

for message in messages["messages"]:
    message.pretty_print()
```

```output saved note="from a run with Qwen 2.5 32B, since retired; answers vary per run"
================================ Human Message =================================

What Machine Learning
================================== Ai Message ==================================

Machine Learning is a subset of artificial intelligence that involves building systems that can learn from and make decisions based on data. It focuses on the development of programs and algorithms that can access data and use it to learn for themselves. The primary aim of machine learning is to allow computers to learn automatically without human intervention or assistance and adjust actions accordingly.

[...]

Machine learning is used in a wide range of applications, including but not limited to, image and speech recognition, recommendation systems, natural language processing, and autonomous driving.
```

Two questions, two paths. The arithmetic question took `llm_tool → tools → END`, and the run ended on the tool's result, `4`. The machine-learning question needs no tool, so the model answered in text and `tools_condition` went straight to `END`.

## Inside ToolNode and tools_condition

`tools_condition` is a short function: it looks at the last message of `state["messages"]` and returns `"tools"` if it has tool calls, `"__end__"` otherwise. `ToolNode` does more. Given the state, it takes the tool calls of the last `AIMessage`, runs each with its arguments and returns one `ToolMessage` per call, carrying the call's ID so the model can match result to request. A graph with only a tools node shows it without a model:

```python title="Notebook cell"
tools_only = StateGraph(State)
tools_only.add_node("tools", ToolNode([add]))
tools_only.add_edge(START, "tools")
tools_only.add_edge("tools", END)
run_tools = tools_only.compile()

request = AIMessage(content="", tool_calls=[
    {"name": "add", "args": {"a": 2, "b": 2}, "id": "call_1"},
    {"name": "add", "args": {"a": 5, "b": 5}, "id": "call_2"},
    {"name": "multiply", "args": {"a": 2, "b": 3}, "id": "call_3"},
])
for message in run_tools.invoke({"messages": [request]})["messages"][1:]:
    print(repr(message.content), message.tool_call_id, message.status)
```

```output real
'4' call_1 success
'10' call_2 success
'Error: multiply is not a valid tool, try one of [add].' call_3 error
```

Three calls, three results, in the order of the calls; `ToolNode` runs them in parallel threads. A call to a tool it doesn't have becomes an error result the model can read, not an exception. A tool that raises does stop the run, unless you build the node with `ToolNode(tools, handle_tool_errors=True)`, which turns the exception into an error result too (practice 2 below). In LangGraph 1.2 a `ToolNode` runs only inside a graph; calling its `invoke` directly raises `ValueError: Missing required config key 'N/A' for 'tools'`, hence the one-node graph.

## A router, not yet an agent

The graph makes one decision, the model's: answer directly, or call a tool. That makes it a *router*, and a simple agent in the sense of [lesson 8.1](lesson:8.1), since the model rather than your code chooses the path. But the decision happens once. After the tool runs, the run ends, and the user receives a `ToolMessage` holding `4` instead of an answer written for them. The model never sees the result, so it can't use it, check it, or ask for a second tool. [Lesson 11.4](lesson:11.4) fixes that with one edge, from `tools` back to the model; [lesson 11.3](lesson:11.3) first gives the router more tools to choose from.

## Interview questions

::: check
The router graph answers "What is 2 plus 2?" with a tool message containing `4`. Why not with a sentence, and what would you change?

Its only edge out of `tools` leads to `END`, so the run stops as soon as the tool has run, and the last message in the state is the tool's result. The model never sees that result, so nothing turns it into an answer. Route `tools` back to the model node instead: the model then reads the result and either answers or asks for another tool. That is the ReAct loop of [lesson 11.4](lesson:11.4).
:::

::: check
What exactly does `tools_condition` check, and what does that imply for your graph?

Only whether the last message in the state has tool calls: `"tools"` if so, `"__end__"` otherwise. So the tools node must be named `"tools"` (or the names mapped with a `path_map`), the model node must be the last to write to `messages` before the check, and a model that writes text and tool calls in one reply goes to the tools, its text included in the state. Anything subtler, such as a step limit or a check before an expensive tool, needs your own routing function.
:::

::: check
When would you write your own tool-running node instead of using `ToolNode`?

When the step between the model's request and the tool's execution needs logic of your own: checking the user's permissions or the arguments, asking a person to approve, logging or rate-limiting, or writing results to other state keys. `ToolNode` already runs calls in parallel, matches results to call IDs and turns unknown tools into error results, and its `wrap_tool_call` hook covers retries and simple checks, so start with it and replace it only when a requirement doesn't fit.
:::

## Practice

::: practice
**Write tools_condition yourself.** Write `route_tools(state)` that returns `"tools"` when the last message is an `AIMessage` with tool calls and `END` otherwise, and test it on three states: a question, a reply asking for a tool, and a reply in text.

```python title="Notebook cell"
def route_tools(state: State):
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return END


asking = AIMessage(content="", tool_calls=[{"name": "add", "args": {"a": 2, "b": 2}, "id": "call_1"}])
for messages in [[HumanMessage(content="What is 2 plus 2")],
                 [HumanMessage(content="What is 2 plus 2"), asking],
                 [HumanMessage(content="Hi"), AIMessage(content="Hello! How can I help?")]]:
    print(route_tools({"messages": messages}), tools_condition({"messages": messages}))
```

```output real
__end__ __end__
tools tools
__end__ __end__
```

Both functions agree, and `END` is just the string `"__end__"`. With your own function you could also stop after a number of tool rounds or send some tools to a different node; give its return hint a `Literal` listing the targets so the graph can be drawn ([lesson 10.2](lesson:10.2)).
:::

::: practice
**A tool that fails.** Write a tool `divide(a, b)`, send it a call that divides by zero through a tools-only graph, once with a plain `ToolNode` and once with `handle_tool_errors=True`, and print what comes back.

```python title="Notebook cell"
def divide(a: int, b: int) -> float:
    """Divide a by b."""
    return a / b


def tools_graph(node):
    builder = StateGraph(State)
    builder.add_node("tools", node)
    builder.add_edge(START, "tools")
    builder.add_edge("tools", END)
    return builder.compile()


request = AIMessage(content="", tool_calls=[{"name": "divide", "args": {"a": 1, "b": 0}, "id": "call_1"}])
for node in [ToolNode([divide]), ToolNode([divide], handle_tool_errors=True)]:
    try:
        result = tools_graph(node).invoke({"messages": [request]})
        print("result:", repr(result["messages"][-1].content))
    except ZeroDivisionError as error:
        print("raised:", repr(error))
```

```output real
raised: ZeroDivisionError('division by zero')
result: "Error: ZeroDivisionError('division by zero')\n Please fix your mistakes."
```

By default the exception ends the run, which is right for bugs and outages you want to notice. With `handle_tool_errors=True` the model receives the error as the tool's result and can try something else, which suits mistakes it can fix, such as bad arguments. You can also pass a string or a function to `handle_tool_errors` to control the message.
:::

## Further reading

- LangChain, [ToolNode](https://reference.langchain.com/python/langgraph/agents/#langgraph.prebuilt.tool_node.ToolNode): its inputs, outputs and error handling.
- LangChain, [Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents): routers and agents built from the same parts.
