+++
number = "9.3"
title = "Tools and tool calling"
lede = "A tool is a function plus a description the model can read. The model asks for a call, your code runs it and sends back the result. Build a tool, see what the model receives, and run one round by hand."
summary = "Turning a function into a tool with @tool, the schema a model receives, bind_tools and tool_choice, reading tool_calls, one round of the tool loop by hand, how tool calling works across providers, designing tools, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "9 LangChain Updated: 3-tools.ipynb (retired Qwen 3 model replaced, a copied comment corrected); the tool schema, tool_choice, how tool calling works, tool design and interview questions added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A model can only produce text, so on its own it can't look up an order, read a file or send an email. Tools close that gap: the model replies with a structured request to call a function, your code runs the function, and the result goes back to the model as a message. [Lesson 8.1](lesson:8.1) explained this exchange as the agent loop; this lesson builds its parts in LangChain and runs one round by hand. [Lesson 9.4](lesson:9.4) lets `create_agent` repeat it.

## Set up

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

```python title="Notebook cell"
from langchain.chat_models import init_chat_model

model = init_chat_model("groq:openai/gpt-oss-120b")
```

The cells that call the model need `GROQ_API_KEY`. Their saved outputs come from Qwen 3 32B, which Groq has since retired; `openai/gpt-oss-120b` is its named replacement.

## Turn a function into a tool

A tool pairs a schema (a name, a description and the arguments, as JSON schema) with the function to run:

```python title="Notebook cell"
from langchain.tools import tool


@tool
def get_weather(location: str) -> str:
    """Get the weather at a location"""
    return f"It's sunny in {location}"


print(type(get_weather).__name__)
print(get_weather.name, "|", get_weather.description, "|", get_weather.args)
```

```output real
StructuredTool
get_weather | Get the weather at a location | {'location': {'title': 'Location', 'type': 'string'}}
```

`@tool` turns the function into a `StructuredTool`: the function's name becomes the tool's name, its docstring the description, its type hints the arguments ([lesson 4.1](lesson:4.1), [lesson 2.8](lesson:2.8)). This is what a model receives with every request, in the format OpenAI defined and other providers adopted:

```python title="Notebook cell"
from langchain_core.utils.function_calling import convert_to_openai_tool

convert_to_openai_tool(get_weather)
```

```output real
{'type': 'function',
 'function': {'name': 'get_weather',
  'description': 'Get the weather at a location',
  'parameters': {'properties': {'location': {'type': 'string'}},
   'required': ['location'],
   'type': 'object'}}}
```

The model never sees the function's code, only these lines, so the name, the docstring and the argument names are the whole manual it works from. A missing hint becomes an untyped argument, and a vague docstring makes a tool the model won't pick, or picks for the wrong job.

## Let the model ask for it

```python title="Notebook cell"
model_with_tools = model.bind_tools([get_weather])
```

`bind_tools` returns the model with the tool schemas attached to every request it sends; the model itself is unchanged.

```python title="Notebook cell" norun
response = model_with_tools.invoke("What's the weather like in Boston?")
print(response)
for tool_call in response.tool_calls:
    # View tool calls made by the model
    print(f"Tool: {tool_call['name']}")
    print(f"Args: {tool_call['args']}")
```

```output saved note="from a run with Qwen 3 32B, since retired; metadata trimmed; tool call IDs vary per run"
content='' additional_kwargs={'reasoning_content': "Okay, the user is asking about the weather in Boston. I need to use the get_weather function. Let me check the function parameters. It requires a location, which is Boston here. I'll call the function with location set to Boston. [...]", 'tool_calls': [{'id': 'c6smtcmmb', 'function': {'arguments': '{"location":"Boston"}', 'name': 'get_weather'}, 'type': 'function'}]} response_metadata={'token_usage': {'completion_tokens': 86, 'prompt_tokens': 154, 'total_tokens': 240, ...}, 'model_name': 'qwen/qwen3-32b', 'finish_reason': 'tool_calls', 'model_provider': 'groq', ...} id='lc_run--e7bb7c48-663e-47ad-bb73-fdc081fa0fcc-0' tool_calls=[{'name': 'get_weather', 'args': {'location': 'Boston'}, 'id': 'c6smtcmmb', 'type': 'tool_call'}] usage_metadata={'input_tokens': 154, 'output_tokens': 86, 'total_tokens': 240, 'output_token_details': {'reasoning': 62}}
Tool: get_weather
Args: {'location': 'Boston'}
```

The reply has no text, `finish_reason` is `'tool_calls'`, and the request appears twice: as the provider sent it, in `additional_kwargs` (arguments as a JSON string), and as LangChain parsed it, in `tool_calls` (arguments as a dict). Read `tool_calls`: it has the same shape for every provider. The tool schema cost tokens too: 154 input tokens for a one-line question. The model's reasoning (`reasoning_content`) shows how it read the schema.

`bind_tools` also takes `tool_choice`, which decides whether the model may answer without a tool:

| `tool_choice` | The model |
|---|---|
| left out, or `"auto"` | Decides: a tool call or a text answer |
| `"any"` | Must call one of the tools (sent to Groq and OpenAI as `"required"`) |
| `"get_weather"` | Must call that tool |

## Run the tool and answer

One round of the loop, by hand: the model asks, the code runs the tool, the model answers from the result.

```python title="Notebook cell" norun
# Step 1: Model generates tool calls
messages = [{"role": "user", "content": "What's the weather in Boston?"}]
ai_msg = model_with_tools.invoke(messages)
messages.append(ai_msg)

# Step 2: Execute tools and collect results
for tool_call in ai_msg.tool_calls:
    # Execute the tool with the generated arguments
    tool_result = get_weather.invoke(tool_call)
    messages.append(tool_result)

# Step 3: Pass results back to model for final response
final_response = model_with_tools.invoke(messages)
print(final_response.text)
# The weather in Boston is sunny.
```

```output saved note="from a run with Qwen 3 32B, since retired; answers vary per run"
The weather in Boston is sunny.
```

```python title="Notebook cell" norun
messages
```

```output saved note="from a run with Qwen 3 32B, since retired; reasoning and metadata trimmed; tool call IDs vary per run"
[{'role': 'user', 'content': "What's the weather in Boston?"},
 AIMessage(content='', additional_kwargs={'reasoning_content': '[...]', 'tool_calls': [...]}, response_metadata={'finish_reason': 'tool_calls', ...}, id='lc_run--dede58c2-b5a8-4dd2-a0d8-12d029502f5a-0', tool_calls=[{'name': 'get_weather', 'args': {'location': 'Boston'}, 'id': '20cfda4p0', 'type': 'tool_call'}], ...),
 ToolMessage(content="It's sunny in Boston", name='get_weather', tool_call_id='20cfda4p0')]
```

Step 2 passes the whole tool call to the tool, not just its arguments. A tool given a tool call returns a `ToolMessage` with the call's ID, ready to append; given only the arguments, it returns the plain result:

```python title="Notebook cell"
call = {"name": "get_weather", "args": {"location": "Boston"}, "id": "call_1", "type": "tool_call"}
print(repr(get_weather.invoke(call)))
print(repr(get_weather.invoke({"location": "Boston"})))
```

```output real
ToolMessage(content="It's sunny in Boston", name='get_weather', tool_call_id='call_1')
"It's sunny in Boston"
```

The second model call sees the question, its own tool call and the result, and answers in text. A model that needs more data would ask for another tool instead; repeating these steps until it answers is the agent loop, which [lesson 9.4](lesson:9.4) hands to `create_agent`.

## How tool calling works

1. **The request** carries the conversation and every bound tool's schema.
2. **The model** replies with text, or with one or more tool calls: a tool name, arguments as JSON, and an ID. It has been trained to produce this format; nothing in it runs code.
3. **LangChain** turns each provider's format into `tool_calls`. Arguments that aren't valid JSON go to `invalid_tool_calls` instead.
4. **Your code** finds the function, checks the arguments, runs it and appends a `ToolMessage` per call, each with its call's ID.
5. **The model** gets everything again and answers, or asks for more tools.

A model can ask for several tools in one reply, for example the weather in two cities; [lesson 9.4](lesson:9.4)'s agent runs them in parallel. Because step 4 is your code, it is where permissions, limits, logs and human approval belong ([lesson 9.7](lesson:9.7)).

## Designing tools

Tools are an interface for a model, not for another program, and the same habits make them work well across providers:

| Habit | Why |
|---|---|
| A few tools, each with one clear purpose | The model chooses better from five distinct tools than from thirty overlapping ones |
| Names and descriptions written as instructions | They are all the model knows: say what the tool does, when to use it and what it returns |
| Unambiguous, typed arguments | `customer_id: str` beats `user`; a `Literal` lists the allowed values ([lesson 4.1](lesson:4.1)) |
| Short, meaningful results | Every result is read on every later step: return the relevant lines, not a whole table |
| Errors the model can act on | "No order with ID 1042; IDs have 4 digits" lets it correct itself; a stack trace doesn't |
| Side effects behind a check | Anything that sends, pays or deletes gets validation and, often, a person's approval ([lesson 9.7](lesson:9.7)) |

Treat a tool's result as data, never as instructions: a web page or an email the tool returns can contain text written to steer the model (prompt injection, [lesson 8.2](lesson:8.2)).

## Interview questions

::: check
The model keeps calling your `search_orders` tool with dates like "last Tuesday", and the tool fails. What do you change?

The tool's contract. Type the argument (`start_date: date`, or a string with a documented format) and say in the description which format is expected; the schema then shows it. Return an error message the model can act on ("Dates must be YYYY-MM-DD; today is 2026-10-31"), so it can retry correctly. If relative dates are common, accept them and convert them in code.
:::

::: check
A tool returns a 50,000-token JSON document and the agent becomes slow and confused. How do you fix it?

Make the tool return less: only the fields the model needs, the top results, a summary, or a page at a time with an argument for the next page. The result is resent on every later model call, so its size multiplies cost and latency, and long irrelevant context makes the model worse at finding what matters.
:::

::: check
Your `get_account` tool takes `account_id` as an argument. How do you stop a user from reading someone else's account?

Don't let the model choose whose data it reads. Take the user's identity from the application's session, not from the model's arguments, and check permissions in the tool's code. The model's arguments are untrusted input, as a form field would be: a user can talk the model into passing any ID.
:::

## Practice

::: practice
**A tool with fixed choices.** Write a tool `convert_currency(amount: float, to: Literal["EUR", "GBP", "INR"])` with a docstring, using made-up fixed rates. Print the schema a model would receive. No model needed.

```python title="Notebook cell"
from typing import Literal

RATES = {"EUR": 0.86, "GBP": 0.75, "INR": 88.0}


@tool
def convert_currency(amount: float, to: Literal["EUR", "GBP", "INR"]) -> str:
    """Convert an amount in US dollars to euros, pounds or rupees."""
    return f"{amount} USD = {amount * RATES[to]:.2f} {to}"


convert_to_openai_tool(convert_currency)["function"]
```

```output real
{'name': 'convert_currency',
 'description': 'Convert an amount in US dollars to euros, pounds or rupees.',
 'parameters': {'properties': {'amount': {'type': 'number'},
   'to': {'enum': ['EUR', 'GBP', 'INR'], 'type': 'string'}},
  'required': ['amount', 'to'],
  'type': 'object'}}
```

The `Literal` became an `enum`, so the model sees the only three values it may send; the float became `number`.
:::

::: practice
**Run it like an agent would.** Call `convert_currency` with a tool call as a model would write it, then with arguments a model might get wrong ("ten" for the amount, `"JPY"` for the currency), and print what comes back.

```python title="Notebook cell"
from pydantic import ValidationError

print(repr(convert_currency.invoke(
    {"name": "convert_currency", "args": {"amount": 10, "to": "EUR"}, "id": "call_7", "type": "tool_call"}
)))
for args in [{"amount": "ten", "to": "EUR"}, {"amount": 10, "to": "JPY"}]:
    try:
        convert_currency.invoke(args)
    except ValidationError as error:
        problem = error.errors()[0]
        print(problem["loc"], problem["msg"])
```

```output real
ToolMessage(content='10.0 USD = 8.60 EUR', name='convert_currency', tool_call_id='call_7')
('amount',) Input should be a valid number, unable to parse string as a number
('to',) Input should be 'EUR', 'GBP' or 'INR'
```

The schema is checked before the function runs, so a wrong argument never reaches your code. Called by hand, the tool raises the error; inside an agent, the error goes back to the model as a tool message so it can correct the call ([lesson 9.4](lesson:9.4)).
:::

## Further reading

- Anthropic, [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) (2025): choosing, naming and describing tools, and returning results a model can use.
- LangChain, [Tools](https://docs.langchain.com/oss/python/langchain/tools): `@tool`, argument schemas and tools that read the agent's state.
