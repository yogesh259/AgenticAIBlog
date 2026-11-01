+++
number = "9.6"
title = "Middleware and summarisation"
lede = "Middleware runs your code at fixed points of the agent loop: before and after each model call, around each tool call. See where each hook runs, then keep a long conversation inside the context window by summarising it."
summary = "What middleware is for, the six hooks and their order, the built-in middleware, SummarizationMiddleware triggered by messages, tokens or a fraction of the context window, how it counts and what it keeps, summarising versus trimming, interview questions and a practice task."
type = "concept"
status = "published"
source = "9 LangChain Updated: 6-middleware.ipynb (cells 1-11; printouts shortened); the hooks, built-in middleware, the replay of when summaries fired and interview questions added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["OPENAI_API_KEY"]
+++

The agent of [lesson 9.4](lesson:9.4) runs a fixed loop: model, tools, model, until the model answers. Real agents need to change what happens inside that loop. A long conversation must be shortened before it outgrows the context window, a risky tool must wait for a person, failed calls should be retried, personal data kept out of the prompt, runaway runs stopped. Middleware does all of these. A middleware is an object passed to `create_agent(middleware=[...])` whose methods, called hooks, run at fixed points of every run. LangChain calls the main use context engineering: deciding what the model sees at each step. This lesson shows where the hooks run and uses the first built-in one, summarisation; [lesson 9.7](lesson:9.7) adds human approval.

## Where middleware runs

::: visual middleware-hooks | Interactive figure | Where middleware runs
The agent's graph with each hook in its place, and the nodes two built-in middleware add.
:::

| Hook | Runs | Kind | Typical use |
|---|---|---|---|
| `before_agent` | Once, when a run starts | Node | Check the input, load what the agent should know about the user |
| `before_model` | Before every model call | Node | Shorten or summarise the messages, add context |
| `wrap_model_call` | Around every model call | Wrapper | Retry, fall back to another model, change the model or tools per call |
| `after_model` | After every model reply, before any tool runs | Node | Check the reply, pause for a person's approval |
| `wrap_tool_call` | Around every tool call | Wrapper | Retry a tool, turn its errors into messages, log it |
| `after_agent` | Once, when a run ends | Node | Final checks on the answer, save results |

Node hooks become nodes of the agent's graph, so they show up in `get_graph()` and in traces, and each counts as a step against `recursion_limit` ([lesson 9.4](lesson:9.4)). Wrapper hooks receive the call and a `handler` that performs it: they can run code before and after, call it again to retry, or not call it at all. With several middleware, `before_*` hooks run in list order, `after_*` hooks in reverse, and wrappers nest, the first in the list outermost ([5.2](lesson:5.2), section 20, runs the same order in plain Python). Writing your own hooks is the subject of [lesson 17.3](lesson:17.3).

LangChain ships these ready-made:

| Middleware | What it does | On this site |
|---|---|---|
| `SummarizationMiddleware` | Replaces older messages with a summary when the history passes a threshold | This lesson |
| `HumanInTheLoopMiddleware` | Pauses before chosen tools until a person approves, edits or rejects the call | [Lesson 9.7](lesson:9.7) |
| `PIIMiddleware` | Finds emails, card numbers, IP addresses and other personal data; redacts, masks, hashes or blocks them | [Lesson 17.2](lesson:17.2) |
| `ModelCallLimitMiddleware`, `ToolCallLimitMiddleware` | Stop a run or a thread after a number of model calls, or of calls to one tool | |
| `ModelRetryMiddleware`, `ToolRetryMiddleware` | Retry failed calls with growing waits | [Lesson 9.4](lesson:9.4) |
| `ToolErrorMiddleware` | Returns chosen tool exceptions to the model as error messages instead of ending the run | [Lesson 9.4](lesson:9.4) |
| `ModelFallbackMiddleware` | Tries other models when the first one fails | |
| `LLMToolSelectorMiddleware` | Lets a small model pick the few relevant tools before the main call | |
| `ContextEditingMiddleware` | Clears old tool results once the context grows | |
| `TodoListMiddleware` | Gives the agent a `write_todos` tool to plan and track a long task | |

## Summarise a long conversation

With a checkpointer the conversation grows with every turn ([lesson 9.4](lesson:9.4)), and every model call resends all of it: slower, costlier, and eventually longer than the context window. `SummarizationMiddleware` checks the history before every model call. Once it passes a threshold, `trigger`, a model writes a summary of the older messages, and the history becomes that summary followed by the newest messages, `keep`. Both are `(unit, number)` pairs:

| Unit | `trigger=` | `keep=` |
|---|---|---|
| `"messages"` | `("messages", 10)`: 10 or more messages | `("messages", 4)`: the newest 4 |
| `"tokens"` | `("tokens", 550)`: 550 or more tokens | `("tokens", 200)`: the newest messages that fit 200 tokens |
| `"fraction"` | `("fraction", 0.8)`: 80% of the model's context window | `("fraction", 0.3)`: 30% of it |

A list of triggers, such as `[("tokens", 4000), ("messages", 50)]`, fires on whichever is reached first. `trigger` defaults to none: without one, nothing is ever summarised. `keep` defaults to the newest 20 messages. The `model` writes the summaries: a second model call each time the trigger fires, so a small, cheap model is the usual choice. Load the keys first:

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

The three tabs run the same idea with each unit:

:::: tabs
::: tab Messages
```python title="Notebook cell"
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.messages import HumanMessage, SystemMessage

# Message-based summarization
agent = create_agent(
    model="gpt-4o-mini",
    checkpointer=InMemorySaver(),
    middleware=[
        SummarizationMiddleware(
            model="gpt-4o-mini",
            trigger=("messages", 10),
            keep=("messages", 4)
        )
    ]
)
```

```python title="Notebook cell"
### Run with thread id
config = {"configurable": {"thread_id": "test-1"}}
```

```python title="Notebook cell" norun
# Alternative test data
questions = [
    "What is 2+2?",
    "What is 10*5?",
    "What is 100/4?",
    "What is 15-7?",
    "What is 3*3?",
    "What is 4*4?",
]

for q in questions:
    response = agent.invoke({"messages": [HumanMessage(content=q)]}, config)
    print(f"{q:15} {len(response['messages'])} messages")
```

```output saved note="printout shortened to the message counts"
What is 2+2?    2 messages
What is 10*5?   4 messages
What is 100/4?  6 messages
What is 15-7?   8 messages
What is 3*3?    10 messages
What is 4*4?    6 messages
```

```python title="Notebook cell" norun
for message in response["messages"]:
    print(f"{type(message).__name__:13} {message.text[:60]!r}")
```

```output saved note="computed from the saved run"
HumanMessage  'Here is a summary of the conversation to date:\n\nHuman asked '
AIMessage     '15 - 7 equals 8.'
HumanMessage  'What is 3*3?'
AIMessage     '3 * 3 equals 9.'
HumanMessage  'What is 4*4?'
AIMessage     '4 * 4 equals 16.'
```

Each turn adds two messages. Before the sixth model call the history held 11 (ten plus the new question), at least the trigger's 10, so the oldest 7 were summarised and the newest 4 kept; the answer then made 6. The summary is a `HumanMessage` at the top.
:::
::: tab Tokens
```python title="Notebook cell"
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import InMemorySaver

@tool
def search_hotels(city: str) -> str:
    """Search hotels - returns long response to use more tokens."""
    return f"""Hotels in {city}:
    1. Grand Hotel - 5 star, $350/night, spa, pool, gym
    2. City Inn - 4 star, $180/night, business center
    3. Budget Stay - 3 star, $75/night, free wifi"""


agent = create_agent(
    model="gpt-4o-mini",
    tools=[search_hotels],
    checkpointer=InMemorySaver(),
    middleware=[
        SummarizationMiddleware(
            model="gpt-4o-mini",
            trigger=("tokens", 550),
            keep=("tokens", 200),
        ),
    ]
)

config = {"configurable": {"thread_id": "test-1"}}

# Token counter (approximate)
def count_tokens(messages):
    total_chars = sum(len(str(m.content)) for m in messages)
    return total_chars // 4  # 4 chars ≈ 1 token
```

```python title="Notebook cell" norun
# Run test
cities = ["Paris", "London", "Tokyo", "New York", "Dubai", "Singapore"]

for city in cities:
    response = agent.invoke(
        {"messages": [HumanMessage(content=f"Find hotels in {city}")]},
        config=config
    )

    tokens = count_tokens(response["messages"])
    print(f"{city}: ~{tokens} tokens, {len(response['messages'])} messages")
```

```output saved note="the printout of every message dropped"
Paris: ~149 tokens, 4 messages
London: ~302 tokens, 8 messages
Tokyo: ~456 tokens, 12 messages
New York: ~396 tokens, 8 messages
Dubai: ~232 tokens, 5 messages
Singapore: ~361 tokens, 9 messages
```

Each turn adds four messages: the question, the tool call, the hotels, the answer. The summaries came before the New York and Dubai turns, although the helper's estimates stayed under 550: the middleware counts differently, as the next section shows.
:::
::: tab Fraction
```python title="Notebook cell"
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import InMemorySaver

@tool
def search_hotels(city: str) -> str:
    """Search hotels."""
    return f"Hotels in {city}: Grand Hotel $350, City Inn $180, Budget Stay $75"

# LOW fraction for testing!
agent = create_agent(
    model="gpt-4o-mini",
    tools=[search_hotels],
    checkpointer=InMemorySaver(),
    middleware=[
        SummarizationMiddleware(
            model="gpt-4o-mini",
            trigger=("fraction", 0.005),  # 0.5% = ~640 tokens
            keep=("fraction", 0.002),     # 0.2% = ~256 tokens
        ),
    ],
)

config = {"configurable": {"thread_id": "test-1"}}

# Token counter
def count_tokens(messages):
    return sum(len(str(m.content)) for m in messages) // 4
```

```python title="Notebook cell" norun
# Test
cities = ["Paris", "London", "Tokyo", "New York", "Dubai", "Singapore"]

for city in cities:
    response = agent.invoke(
        {"messages": [HumanMessage(content=f"Hotels in {city}")]},
        config=config
    )
    tokens = count_tokens(response["messages"])
    fraction = tokens / 128000  # gpt-4o-mini context
    print(f"{city}: ~{tokens} tokens ({fraction:.4%}), {len(response['messages'])} msgs")
```

```output saved note="the printout of every message dropped"
Paris: ~64 tokens (0.0500%), 4 msgs
London: ~133 tokens (0.1039%), 8 msgs
Tokyo: ~203 tokens (0.1586%), 12 msgs
New York: ~276 tokens (0.2156%), 16 msgs
Dubai: ~349 tokens (0.2727%), 20 msgs
Singapore: ~365 tokens (0.2852%), 12 msgs
```

A fraction is of the model's context window, read from its profile ([lesson 9.5](lesson:9.5)): 0.5% of `gpt-4o-mini`'s 128,000 tokens is 640, and 0.2% is 256. A model without a profile can't use fractions: creating the middleware raises a `ValueError`. Real settings are closer to `("fraction", 0.8)`, summarising when the window is 80% full.
:::
::::

OpenAI retires `gpt-4o-mini` on 14 January 2027 and names `gpt-6-luna` as its replacement. Whichever tab ran last, the middleware is now part of the agent's graph:

```python title="Notebook cell"
list(agent.get_graph().nodes)
```

```output real
['__start__',
 'model',
 'tools',
 'SummarizationMiddleware.before_model',
 '__end__']
```

`SummarizationMiddleware.before_model` sits before the model node, and the edge from the tools node leads back to it, so the check runs before every model call, not once per turn.

## How it decides

The token run, replayed: each conversation rebuilt from the saved messages and counted the way the middleware counts, before the first model call of each turn.

| Turn | Messages before the call | Middleware's count | Helper's count | Summarised before the call? | Messages after the turn |
|---|---|---|---|---|---|
| Paris | 1 | 9 | 5 | no | 4 |
| London | 5 | 269 | 154 | no | 8 |
| Tokyo | 9 | 485 | 307 | no | 12 |
| New York | 13 | 704 | 462 | yes, 704 ≥ 550 | 8 |
| Dubai | 9 | 556 | 401 | yes, 556 ≥ 550 | 5 |
| Singapore | 6 | 372 | 238 | no | 9 |

- **What it counts.** The course-style helper divides the characters of `content` by four. LangChain's counter also counts tool calls and their arguments, roles, tool-call IDs and 3 tokens per message, then scales the estimate by the token usage the provider reported for the last reply, by up to a quarter. A reported usage at or above the trigger fires it too. In the fraction run the same counting reached 652 before the Singapore turn, past 640, while the helper said 353.
- **When it counts.** Before every model call. In the Dubai turn it fired a second time, before the call after the tool: the provider's reported usage shows the input falling from 557 to 261 tokens between the two calls.
- **What it keeps.** The newest messages within `keep`, moved back if needed so that a tool call is never separated from its result: before the New York turn it kept Tokyo's tool call, hotels and answer, then the new question. A cut by message count can still split a question from its answer: in the messages run, "What is 15-7?" went into the summary while its answer stayed, so the summary ends "4. What is 15 - 7? - Awaiting AI's response."
- **What the model sees.** One `HumanMessage` starting "Here is a summary of the conversation to date:", then the kept messages. The summary replaces the old messages in the checkpointer too: they are gone from the thread, not only from the prompt.

## Summarise or trim?

| | `trim_messages` ([lesson 7.4](lesson:7.4)) | `SummarizationMiddleware` |
|---|---|---|
| What survives | The newest messages only | A summary of the older ones, then the newest |
| Extra cost | None | One model call each time it fires |
| What can go wrong | Older facts are forgotten | The summary may drop or distort a detail, and summaries of summaries lose more each time |
| What is stored | Everything; only the request is trimmed | The summary replaces the old messages |

Facts that must never be lost, such as a user's account number or a decision already taken, don't belong in either: keep them in the agent's state or a database the agent reads, and add them to the context on each call.

## Interview questions

::: check
A support agent forgets the order number the customer gave at the start of a long conversation. What do you do?

The number fell out with summarisation or trimming. Keep facts the conversation depends on outside the message history, in the agent's state or a store, and add them to every call; ask the summary prompt to keep identifiers, amounts and decisions verbatim; raise `keep` or the trigger if the window allows. Then test with long scripted conversations that check the fact is still used at the end.
:::

::: check
Why did summarisation fire earlier than your own token estimate predicted?

Your estimate probably counted only message text. The middleware also counts tool calls, roles and per-message overhead, scales by the provider's reported usage, and fires on the provider's own count when that is over the trigger, which includes the system prompt and tool schemas. Use the same counter as the middleware (`count_tokens_approximately`) or the provider's usage numbers when you size thresholds.
:::

::: check
What does summarisation cost, and how do you keep it cheap?

Each time it fires, one more model call reads up to several thousand tokens of history (4,000 by default) and writes a summary, adding latency to that turn. Use a small model for the summaries, set the trigger high enough that it fires rarely (a fraction such as 0.7 of the window), keep enough recent messages that the summary covers only old turns, and watch traces for turns where it fires repeatedly.
:::

## Practice

::: practice
**When will it summarise?** A conversation grows by one question ("What is the capital of France?", "And of Germany?", ...) and a 60-character answer per turn. With LangChain's `count_tokens_approximately`, find the first turn at which the history before the model call reaches a trigger of 150 tokens. No model needed.

```python title="Notebook cell"
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.messages.utils import count_tokens_approximately

countries = ["France", "Germany", "Italy", "Spain", "Portugal", "Greece", "Poland", "Austria"]
history = []
for turn, country in enumerate(countries, start=1):
    history.append(HumanMessage(f"What is the capital of {country}?"))
    tokens = count_tokens_approximately(history)
    print(f"turn {turn}: {len(history):2} messages, {tokens:3} tokens")
    if tokens >= 150:
        print("summarise before this call")
        break
    history.append(AIMessage("x" * 60))
```

```output real
turn 1:  1 messages,  12 tokens
turn 2:  3 messages,  45 tokens
turn 3:  5 messages,  78 tokens
turn 4:  7 messages, 111 tokens
turn 5:  9 messages, 144 tokens
turn 6: 11 messages, 177 tokens
summarise before this call
```

Each exchange adds 33 tokens: per message, the text plus the role name (`user`, `assistant`) at four characters per token, rounded up, plus 3. The middleware would also scale the estimate by the provider's reported usage, so with real replies it fires a little earlier.
:::

## Further reading

- LangChain, [Middleware](https://docs.langchain.com/oss/python/langchain/middleware): the hooks, the built-in middleware and how to write your own.
- LangChain, [Short-term memory](https://docs.langchain.com/oss/python/langchain/short-term-memory): trimming, deleting and summarising messages in agents.
