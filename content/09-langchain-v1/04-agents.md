+++
number = "9.4"
title = "Agents with create_agent"
lede = "create_agent runs the tool loop for you: it calls the model, runs the tools the model asks for and repeats until the model answers. See what it builds and returns, then give it a memory and limits."
summary = "Creating an agent from a model, tools and a system prompt, the graph it builds, reading the messages it returns, string input, memory with a checkpointer and thread IDs, recursion limits, what happens when tools fail, what a run costs, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "9 LangChain Updated: 1-langchainintro.ipynb (cells 3-7); 6-middleware.ipynb (checkpointer and thread ID, cells 4-5); the agent graph, memory, limits, tool errors, costs and interview questions added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["OPENAI_API_KEY"]
+++

[Lesson 9.3](lesson:9.3) ran one round of tool calling by hand: model, tool, model. A real task may need many rounds, and the code that repeats them (call the model, run every tool it asks for, append the results, stop when it answers, give up after too many steps) is the same for every agent ([lesson 8.1](lesson:8.1)). `create_agent` is that code, packaged. It is LangChain 1's standard way to build an agent, replacing LangGraph's older `create_react_agent`, and it runs on LangGraph, which brings memory, streaming and pauses for human review with it.

## Create an agent

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

```python title="Notebook cell"
from langchain.agents import create_agent


def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"The weather in {city} is sunny."


agent = create_agent(
    model="gpt-5",
    tools=[get_weather],
    system_prompt="You are a helpful assistant.",
)
```

Three arguments make an agent:

- `model`: a model string, turned into a model by `init_chat_model` ([lesson 9.1](lesson:9.1)), or a model object when you need settings such as `temperature`.
- `tools`: functions or `@tool` objects. A plain function works, since `create_agent` makes the tool from its name, docstring and hints ([lesson 9.3](lesson:9.3)).
- `system_prompt`: instructions sent before the conversation on every model call.

OpenAI shuts `gpt-5` down on 11 December 2026 and names `gpt-5.6-sol` as its replacement: change the name then. In a notebook, a cell ending with `agent` draws what `create_agent` built: a small graph.

::: visual agent-graph | Figure | The graph inside create_agent
The model node and the tools node, the edge that decides between them, and the messages each step adds.
:::

```python title="Notebook cell"
print(type(agent).__name__)
print(list(agent.get_graph().nodes))
```

```output real
CompiledStateGraph
['__start__', 'model', 'tools', '__end__']
```

A `CompiledStateGraph` is a LangGraph program ([lesson 10.2](lesson:10.2) builds one by hand). Its state is a list of messages; the `model` node calls the model with them, the `tools` node runs the tool calls of the last reply, and the edge after the model goes to `tools` if the reply asks for tools and ends the run if it doesn't.

## Run it

```python title="Notebook cell" norun
### run the agent
response = agent.invoke({"messages": [{"role": "user", "content": "What is the weather like in New York?"}]})
```

```python title="Notebook cell" norun
response["messages"]
```

```output saved note="metadata trimmed; IDs and answers vary per run"
[HumanMessage(content='What is the weather like in New York?', id='2ca5b95c-a5cf-4177-a607-b348c24dd1c1'),
 AIMessage(content='', response_metadata={'model_name': 'gpt-5-2025-08-07', 'finish_reason': 'tool_calls', ...}, tool_calls=[{'name': 'get_weather', 'args': {'city': 'New York'}, 'id': 'call_GPQVtdFPyMwdu1dRHq6s7wqw', 'type': 'tool_call'}], usage_metadata={'input_tokens': 143, 'output_tokens': 88, 'total_tokens': 231, 'output_token_details': {'audio': 0, 'reasoning': 64}, ...}),
 ToolMessage(content='The weather in New York is sunny.', name='get_weather', id='a59218e0-217e-4248-9781-c8c17b8ced8b', tool_call_id='call_GPQVtdFPyMwdu1dRHq6s7wqw'),
 AIMessage(content='It’s sunny in New York right now.', response_metadata={'model_name': 'gpt-5-2025-08-07', 'finish_reason': 'stop', ...}, usage_metadata={'input_tokens': 180, 'output_tokens': 12, 'total_tokens': 192, ...})]
```

The input is a dict with a `messages` list, written as role and content dicts ([lesson 9.2](lesson:9.2)); the result is the state at the end of the run, so `response["messages"]` holds the whole run:

1. The question, as a `HumanMessage`.
2. The model's first reply: no text, one tool call, and 64 of its 88 output tokens spent on hidden reasoning ([lesson 9.1](lesson:9.1)).
3. The tool's result, with the call's ID.
4. The answer: the model saw a result and replied in text, so the run ended. Two model calls, one tool call.

The system prompt is not in the list: the agent adds it to every model call without storing it. The answer is `response["messages"][-1].text`.

## Pass a string

```python title="Notebook cell" norun
agent.invoke({"messages": "What is the weather in New Yourk"})
```

```output saved note="metadata trimmed; IDs and answers vary per run"
{'messages': [HumanMessage(content='What is the weather in New Yourk', ...),
  AIMessage(content='', ..., tool_calls=[{'name': 'get_weather', 'args': {'city': 'New York'}, 'id': 'call_LYqCRNGlAnoxgfezQl01Vp2j', 'type': 'tool_call'}], usage_metadata={'input_tokens': 142, 'output_tokens': 344, 'total_tokens': 486, 'output_token_details': {'audio': 0, 'reasoning': 320}, ...}),
  ToolMessage(content='The weather in New York is sunny.', name='get_weather', ...),
  AIMessage(content='It’s sunny in New York. \nDid you mean New York City? If you want details like temperature or a forecast, let me know.', ..., usage_metadata={'input_tokens': 179, 'output_tokens': 294, 'total_tokens': 473, 'output_token_details': {'audio': 0, 'reasoning': 256}, ...})]}
```

A bare string becomes one `HumanMessage`. The model read past the typo and sent `"New York"` to the tool, then asked a follow-up question; that pondering cost 576 reasoning tokens over two calls, against 64 in the first run. The same question can cost very different amounts from run to run.

## Remember the conversation

Each `invoke` above started from nothing. To continue a conversation, give the agent a checkpointer, which saves the state after every step, and name the conversation with a thread ID:

```python title="Notebook cell"
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="gpt-5",
    tools=[get_weather],
    system_prompt="You are a helpful assistant.",
    checkpointer=InMemorySaver(),
)

### Run with thread id
config = {"configurable": {"thread_id": "1"}}
```

```python title="Notebook cell" norun
agent.invoke({"messages": "What is the weather in Paris?"}, config)
response = agent.invoke({"messages": "And in Rome?"}, config)
print(len(response["messages"]))
print(response["messages"][-1].text)
```

```output illustrative note="answers vary per run"
8
It's sunny in Rome as well.
```

The second call sends only "And in Rome?". The checkpointer loads thread `1`'s saved messages, the new message is appended, and the model sees the whole conversation: four messages from the first run, four from the second. A different `thread_id` starts an empty conversation, and a checkpointer without one refuses to run:

```python title="Notebook cell"
agent.invoke({"messages": "What is the weather in Paris?"})
```

```output real
ValueError: Checkpointer requires one or more of the following 'configurable' keys: thread_id, checkpoint_ns, checkpoint_id
```

| | Holds | Use |
|---|---|---|
| `InMemorySaver` | Every thread in this process's memory, lost when it stops | Notebooks, tests, demos |
| A database checkpointer (SQLite, Postgres) | Every thread in a database, shared by all server processes | Real applications ([lesson 11.5](lesson:11.5)) |

This replaces the classic history wrapper of [lesson 7.3](lesson:7.3): `thread_id` plays the part of `session_id`, and the checkpointer the part of the store. It saves more than messages: the state after every step, which is what lets a run pause for a person and resume later ([lesson 9.7](lesson:9.7)).

## Set limits

```python title="Notebook cell"
agent.config
```

```output real
{'recursion_limit': 9999,
 'metadata': {'ls_integration': 'langchain_create_agent'},
 'configurable': {}}
```

`create_agent` allows 9,999 steps per run. Every node that runs counts as one: a run with two rounds of tool calls takes five steps (model, tools, model, tools, model), and each middleware hook node adds more ([lesson 9.6](lesson:9.6)). Pass your own limit with each call, so a model that never stops can't run up a bill:

```python title="Notebook cell" norun
agent.invoke({"messages": "What is the weather in Paris?"}, {**config, "recursion_limit": 10})
```

A run that reaches the limit stops with `GraphRecursionError` ([lesson 8.1](lesson:8.1)). Middleware adds finer limits, such as a maximum number of model or tool calls ([lesson 9.6](lesson:9.6)).

## When tools fail

What the agent does with a bad tool call, checked with LangChain 1.4:

| The model asks for | The agent | The model then |
|---|---|---|
| A tool that doesn't exist | Sends back an error tool message: "Error: cancel_order is not a valid tool, try one of [get_weather]." | Can pick a real tool or answer without one |
| A real tool with wrong arguments | Sends back the validation error, ending "Please fix the error and try again." | Can correct its arguments and call again |
| A tool that raises an exception | Stops the run with that exception | Nothing: your code must catch it, or middleware such as `ToolRetryMiddleware` or `ToolErrorMiddleware` must handle it |
| Several tools in one reply | Runs them in parallel and adds the results in the order of the calls | Sees all the results at once |

The first two follow the rule from [lesson 8.1](lesson:8.1)'s practice: errors the model can fix go back to it as observations.

## What a run costs

Every model call sends the system prompt, the tool schemas and the whole message list so far, so each step costs more input tokens than the one before; the first run above sent 143 input tokens, then 180. Tool results stay in the list for the rest of the run, reasoning tokens add to the output, and a memory makes the list longer still. Keep tool results short ([lesson 9.3](lesson:9.3)), cap the steps, and summarise long conversations ([lesson 9.6](lesson:9.6)).

## Interview questions

::: check
An agent costs ten times what you estimated from a single model call. Where does the money go?

Into repeated context. Each step resends the system prompt, every tool schema and all earlier messages and tool results, so the input grows with every step, and a run takes several model calls. Reasoning models add hidden output tokens on each call. Measure per run, not per call: count the steps and the tokens per step. Then shorten tool results, remove unused tools, summarise old turns, use a cheaper model for simple steps, and cap the steps.
:::

::: check
Your agent runs on several servers behind a load balancer, and users say it forgets the conversation. Why, and what do you change?

An `InMemorySaver` lives in one process, so a request that lands on another server finds no thread. Use a database checkpointer shared by all servers, keyed by a thread ID the client sends with every request, and give threads a retention policy, since they hold personal data.
:::

::: check
A tool that calls an external API sometimes times out, and the whole agent run crashes. What do you do?

An exception inside a tool stops the run. Handle it where you can recover: retry transient errors with backoff (`ToolRetryMiddleware`), turn the rest into an error result the model can read ("the orders service is unavailable, try again later") with `ToolErrorMiddleware` or a `try` in the tool, and make tools with side effects safe to repeat, since a retried call may run twice.
:::

::: check
When is `create_agent` not enough?

When the control flow is not "model, tools, repeat": fixed steps in a set order, branches chosen by code, several agents handing work to each other, or steps that must run in parallel. Then you build the graph yourself in LangGraph ([lesson 10.1](lesson:10.1)) and can still use agents as nodes inside it. Start with `create_agent` and drop down only when its loop doesn't fit.
:::

## Practice

::: practice
**Print a run.** Write `print_run(messages)` that prints an agent run one line per message: the user's question, each tool the model asked for with its arguments, each tool result, and the answer. Test it on a copy of the run above written by hand. No model needed.

```python title="Notebook cell"
from langchain.messages import AIMessage, HumanMessage, ToolMessage


def print_run(messages):
    for message in messages:
        if isinstance(message, HumanMessage):
            print(f"user:   {message.text}")
        elif isinstance(message, AIMessage) and message.tool_calls:
            for call in message.tool_calls:
                print(f"model:  asks for {call['name']}({call['args']})")
        elif isinstance(message, ToolMessage):
            print(f"tool:   {message.text}")
        elif isinstance(message, AIMessage):
            print(f"answer: {message.text}")


run = [
    HumanMessage("What is the weather like in New York?"),
    AIMessage(content="", tool_calls=[{"name": "get_weather", "args": {"city": "New York"}, "id": "call_1"}]),
    ToolMessage("The weather in New York is sunny.", tool_call_id="call_1"),
    AIMessage("It's sunny in New York right now."),
]
print_run(run)
```

```output real
user:   What is the weather like in New York?
model:  asks for get_weather({'city': 'New York'})
tool:   The weather in New York is sunny.
answer: It's sunny in New York right now.
```

The checks run from the most specific to the least: an `AIMessage` with tool calls first, then any other `AIMessage`. On a real run, `print_run(response["messages"])` shows at a glance which tools the agent used and in what order.
:::

::: practice
**Two threads, one agent.** With the checkpointer agent above, tell the agent your name on thread `"alice"`, then ask "What is my name?" on thread `"alice"` and on thread `"bob"`.

```python title="Notebook cell" norun
for thread, text in [("alice", "Hi, I'm Alice."), ("alice", "What is my name?"), ("bob", "What is my name?")]:
    response = agent.invoke({"messages": text}, {"configurable": {"thread_id": thread}})
    print(f"{thread}: {response['messages'][-1].text}")
```

```output illustrative note="answers vary per run"
alice: Nice to meet you, Alice! How can I help you today?
alice: Your name is Alice.
bob: I don't know your name yet. What should I call you?
```

The same agent object serves both threads; only the saved state differs, exactly as sessions did in [lesson 7.3](lesson:7.3).
:::

## Further reading

- LangChain, [Agents](https://docs.langchain.com/oss/python/langchain/agents): `create_agent`'s arguments, its loop and how to stream its steps.
- LangChain, [Short-term memory](https://docs.langchain.com/oss/python/langchain/short-term-memory): checkpointers, threads and managing long conversations.
