+++
number = "18.3"
title = "Costs and caching"
lede = "Providers bill per token, at a price per model. A gateway sees every call, so it can price each one and answer a repeated question without paying twice. Price a call, read the price table behind it, and cache answers in memory."
summary = "The cost of one call with completion_cost, checking it with cost_per_token, LiteLLM's price table and models missing from it, the cost on every response, caching with Cache, what makes two requests the same, cache types, what goes wrong with caching, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "18 LLM Gateway: llm_gateway_tutorial.ipynb (cells 17-22; a comment corrected, the state-reset cell dropped, emojis removed); the price table, cache keys, cache types and their risks added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A model call is billed by its tokens: the input tokens of the prompt and the output tokens of the answer, each at a price per million that depends on the model, with output usually several times dearer. An app that calls models directly finds out what it spent from each provider's bill, weeks later. A gateway sees every call, so it can price each one as it happens, and it can skip the provider altogether when the same request was answered a moment ago. This lesson does both with LiteLLM.

## Set up

The setup of [lesson 18.2](lesson:18.2): quiet logs, LiteLLM, and the keys from `.env`.

```python title="Notebook cell"
import warnings
import logging

warnings.filterwarnings("ignore")
logging.getLogger("LiteLLM").setLevel(logging.ERROR)

import litellm
from dotenv import load_dotenv
from litellm import completion

load_dotenv()
litellm.suppress_debug_info = True
```

## The cost of one call

```python title="Notebook cell" norun
from litellm import completion, completion_cost

response = completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Write a haiku about AI."}]
)

# The USD cost of this single call, from LiteLLM's price table
cost = completion_cost(completion_response=response)

print("Response:    ", response.choices[0].message.content)
print("\nInput tokens: ", response.usage.prompt_tokens)
print("Output tokens:", response.usage.completion_tokens)
print(f"Cost:         ${cost:.8f}")
```

```output saved note="answers vary per run"
Response:     Silent circuits hum,  
Wisdom woven in code lines,  
Dreams of thought awake.

Input tokens:  14
Output tokens: 19
Cost:         $0.00001350
```

`completion_cost` reads the token counts from the response and multiplies them by the model's prices: 14 tokens at $0.15 per million plus 19 tokens at $0.60 per million. `cost_per_token` does the multiplication on its own, so you can check it, or price a call before making it:

```python title="Notebook cell"
from litellm import cost_per_token

input_cost, output_cost = cost_per_token(model="gpt-4o-mini", prompt_tokens=14, completion_tokens=19)
print(f"${input_cost:.8f} + ${output_cost:.8f} = ${input_cost + output_cost:.8f}")
```

```output real
$0.00000210 + $0.00001140 = $0.00001350
```

A fraction of a thousandth of a cent per call; at a million calls a day, about $13.50 a day for this one haiku prompt, and more for longer prompts and dearer models.

## The price table

The prices come from a table that ships with LiteLLM:

```python title="Notebook cell"
info = litellm.model_cost["gpt-4o-mini"]
{key: info[key] for key in ["input_cost_per_token", "output_cost_per_token", "max_input_tokens", "max_output_tokens"]}
```

```output real
{'input_cost_per_token': 1.5e-07,
 'output_cost_per_token': 6e-07,
 'max_input_tokens': 128000,
 'max_output_tokens': 16384}
```

`litellm.model_cost` is a dict with an entry for each of several thousand models: prices per token, context window, provider and capabilities. At import, LiteLLM downloads the newest copy of this table from its GitHub repository and falls back to the copy bundled with the package when it can't; setting the environment variable `LITELLM_LOCAL_MODEL_COST_MAP=True` always uses the bundled one. A model the table doesn't know can't be priced:

```python title="Notebook cell"
for model in ["gpt-4o-mini", "groq/openai/gpt-oss-120b", "gemini/gemini-3.8-flash", "groq/llama-3.3-70b-versatile"]:
    try:
        input_cost, output_cost = cost_per_token(model=model, prompt_tokens=1000, completion_tokens=500)
        print(f"{model:30} ${input_cost + output_cost:.6f}")
    except Exception as e:
        print(f"{model:30} {type(e).__name__}")
```

```output real
gpt-4o-mini                    $0.000450
groq/openai/gpt-oss-120b       $0.000450
gemini/gemini-3.8-flash        $0.002625
groq/llama-3.3-70b-versatile   ModelNotMappedError
```

The retired Llama model has left the table, as will any new, fine-tuned or self-hosted model the table hasn't added: `completion_cost` then raises instead of returning a number. Wrap it in `try` when an unknown model is possible ([lesson 18.6](lesson:18.6) does), or give the prices yourself with `litellm.register_model`.

The numbers are LiteLLM's copy of the providers' price lists, so treat them as estimates. A price change reaches the table later, and the table doesn't know your account's discounts or batch prices. Reconcile with the provider's invoice before you bill anyone with them.

## The cost on every response

You don't have to call `completion_cost` yourself: LiteLLM prices every call as it returns and stores the result on the response.

```python title="Notebook cell"
response = completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Write a haiku about AI."}],
    mock_response="Silent circuits hum",
)
print(response.usage.prompt_tokens, response.usage.completion_tokens, response._hidden_params["response_cost"])
```

```output real
10 20 1.35e-05
```

The mock's placeholder counts, 10 and 20 tokens, cost the same as the real call above by coincidence. Callbacks receive the same number as `kwargs["response_cost"]`, which is how a gateway totals the spend per user or team ([lesson 18.5](lesson:18.5)).

## Cache repeated questions

If a hundred users ask "What is RAG?", the model needn't answer a hundred times. A cache stores each answer under a key made from the request and returns it when the same request comes again:

```python title="Notebook cell" norun
import litellm
import time
from litellm import completion
from litellm.caching import Cache

# Enable in-memory caching (you can also use Redis in production)
litellm.cache = Cache(type="local")

prompt = "What does LLM stand for? Answer in one line."

# First call: actually hits OpenAI
start = time.time()
r1 = completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": prompt}],
    caching=True
)
t1 = time.time() - start
print(f"First call (API):   {t1:.2f}s — {r1.choices[0].message.content}")

# Second call: served from the cache, near-instant
start = time.time()
r2 = completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": prompt}],
    caching=True
)
t2 = time.time() - start
print(f"Second call (cache): {t2:.4f}s — {r2.choices[0].message.content}")

print(f"\nSpeedup: {t1/t2:.1f}x faster, and ZERO cost on the second call!")
```

```output saved note="emojis removed; times vary per run"
First call (API):   1.45s — LLM stands for "Large Language Model."
Second call (cache): 0.0021s — LLM stands for "Large Language Model."

Speedup: 700.3x faster, and ZERO cost on the second call!
```

If the second call fails with `ModuleNotFoundError: No module named 'soundfile'`, add `soundfile` to `requirements.txt` and install again: in LiteLLM 1.105 a cache hit loads code from LiteLLM's proxy server, which needs that package **VERIFY** (newer versions may not).

How the cache behaves, checked with LiteLLM 1.105:

- **It covers every call.** Once `litellm.cache` is set, every `completion()` in the process uses it; `caching=True` only says so explicitly, and `caching=False` skips the cache for one call.
- **The key is the whole request.** LiteLLM hashes the model, the messages and the call's settings, such as `temperature` and `max_tokens`. Another temperature, another model or a single extra space in the question is another key: a miss.
- **A hit returns the stored response**, the same text and the same ID, with `_hidden_params["cache_hit"]` set to `True`. No provider call is made, so nothing is billed: callbacks log the hit with a cost of 0, while `completion_cost(response)` still prices the stored tokens, since it only reads the response.
- **Entries live as long as the cache** unless you give them a lifetime: `Cache(type="local", ttl=600)` keeps each for ten minutes.

| `Cache(type=...)` | Where answers live | Use it for |
|---|---|---|
| `"local"` | This process's memory, lost on restart | Notebooks, tests, a single process |
| `"redis"` | A Redis server shared by every process and replica | Production: survives restarts, one cache for all copies of the app |
| `"disk"` | Files on this machine (needs the `litellm[caching]` extra) | One machine, kept across restarts |
| `"s3"`, `"gcs"`, `"azure-blob"` | A cloud storage bucket | Long-lived, shared, slower than Redis |
| `"redis-semantic"`, `"qdrant-semantic"` | A vector store, matched by embedding similarity | Rephrased questions, with the risks below |

## What goes wrong with caching

- **The same answer forever.** A cached reply ignores `temperature`: "Write me a new poem" returns the same poem until the entry expires. Cache questions with one right answer, not requests for variety.
- **Stale answers.** "Today's weather" or "the latest version" is wrong tomorrow: set a `ttl`, or skip the cache for those calls.
- **One user's data in another user's answer.** The key holds the whole message list, so a conversation with personal details gets its own key; but a shared question whose answer depends on who asks, such as "What's my balance?" answered from context the gateway doesn't see, can be served to the wrong person. Include the user in the request, or don't cache personal calls.
- **Similar isn't the same.** A semantic cache returns the answer to a question whose embedding is close enough: "Can I cancel my order?" and "Cancel my order" may match ([lesson 18.1](lesson:18.1)).
- **A cache holds prompts and answers.** Protect it like the logs: it can contain anything users typed.

## Interview questions

::: check
The gateway's cost dashboard shows $1,200 for the month, the provider's invoice $1,450. Where can the difference come from?

The gateway prices tokens from its own table, so a price change it hasn't picked up, or a model missing from the table and logged without a price, shows up as a gap. Calls that bypassed the gateway, such as a script with its own key, are billed but never logged. Some usage may be priced differently from plain tokens: images, audio, cached input tokens, batch jobs. Failed attempts that the provider still billed, for example timeouts after the model had started writing, can add more **VERIFY**. Reconcile per model and per day, and alert when the two drift apart.
:::

::: check
When would you turn caching off for a call?

When the answer should vary (creative writing, brainstorming), when it depends on time or live data (prices, news, "today"), when it depends on who is asking in a way the request doesn't show, and when it contains personal data you shouldn't keep. Tool-calling turns inside an agent are also poor candidates: the same messages can need a fresh tool call because the world changed. Caching suits stable questions with one right answer: definitions, documentation look-ups, classification of the same text.
:::

::: check
A cache made the app faster in testing but saved almost nothing in production. Why might that be?

Exact-match keys hit only on identical requests, and real traffic rarely repeats exactly: users phrase questions differently, conversations carry different histories, and prompts often include a timestamp, a request ID or retrieved documents that change from call to call. Each copy of the app also had its own in-memory cache, so repeats spread across replicas missed. Measure the hit rate, move anything that varies but doesn't matter out of the prompt, share one Redis cache, and cache the parts that do repeat, such as embeddings or classification of the question.
:::

## Practice

::: practice
**Price one request on five models.** A request has 1,200 input tokens and 300 output tokens. Print its cost per 1,000 requests on `gpt-4o`, `gpt-4o-mini`, `groq/openai/gpt-oss-120b`, `gemini/gemini-3.8-flash` and `claude-haiku-4-5-20251001`, cheapest first.

```python title="Notebook cell"
models = ["gpt-4o", "gpt-4o-mini", "groq/openai/gpt-oss-120b", "gemini/gemini-3.8-flash", "claude-haiku-4-5-20251001"]

costs = {}
for model in models:
    input_cost, output_cost = cost_per_token(model=model, prompt_tokens=1200, completion_tokens=300)
    costs[model] = (input_cost + output_cost) * 1000

for model, cost in sorted(costs.items(), key=lambda item: item[1]):
    print(f"{model:28} ${cost:7.3f} per 1,000 requests")
```

```output real
gpt-4o-mini                  $  0.360 per 1,000 requests
groq/openai/gpt-oss-120b     $  0.360 per 1,000 requests
gemini/gemini-3.8-flash      $  2.025 per 1,000 requests
claude-haiku-4-5-20251001    $  2.700 per 1,000 requests
gpt-4o                       $  6.000 per 1,000 requests
```

The dearest model, `gpt-4o`, costs about seventeen times as much as the cheapest for the same request, which is why routing each request to the cheapest model that does the job well pays off ([lesson 18.6](lesson:18.6)). Prices are the table's at the time of writing.
:::

::: practice
**Stay under a budget.** A support bot handles 20,000 requests a day of about 800 input and 250 output tokens each. Which of the five models above keep the monthly bill (30 days) under $200?

```python title="Notebook cell"
BUDGET = 200.0
requests_per_month = 20_000 * 30

for model in models:
    input_cost, output_cost = cost_per_token(model=model, prompt_tokens=800, completion_tokens=250)
    monthly = (input_cost + output_cost) * requests_per_month
    print(f"{model:28} ${monthly:9.2f}  {'within budget' if monthly <= BUDGET else 'over budget'}")
```

```output real
gpt-4o                       $  2700.00  over budget
gpt-4o-mini                  $   162.00  within budget
groq/openai/gpt-oss-120b     $   162.00  within budget
gemini/gemini-3.8-flash      $   922.50  over budget
claude-haiku-4-5-20251001    $  1230.00  over budget
```

Only the two small models fit. A rough estimate like this, made before choosing a model, avoids a surprise at the end of the month; a cache that answers a fifth of the requests cuts each figure by about a fifth.
:::

## Further reading

- LiteLLM, [input parameters](https://docs.litellm.ai/docs/completion/input): `caching`, `ttl` and the other settings `completion()` accepts.
- LiteLLM, [proxy config.yaml](https://docs.litellm.ai/docs/proxy/configs): the cache and the cost tracking settings on the proxy.
