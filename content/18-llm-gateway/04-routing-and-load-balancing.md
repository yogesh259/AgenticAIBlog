+++
number = "18.4"
title = "Routing and load balancing"
lede = "A Router gives your models names of your own: the app asks for \"fast-cheap\" or \"smart-coding\", and the Router decides which deployment answers, spreads requests across several, and moves on when one fails."
summary = "Aliases with a model list, which deployment answered, several deployments behind one alias, the routing strategies (simple-shuffle, least-busy, latency-based, cost-based) and what each one needs, why cost-based routing failed, retries, fallbacks and cooldowns, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "18 LLM Gateway: llm_gateway_tutorial.ipynb (cells 23-34; retired Groq model replaced, emojis removed from labels and IDs, an outdated price comment corrected, why cost-based routing failed explained); the strategies inside, weights, retries, fallbacks and cooldowns added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

With `completion()`, every call names a model. An app that hard-codes `gpt-4o` in twenty places must change twenty places to switch, and a model that is down or rate-limited stops every one of them. LiteLLM's `Router` separates the two concerns: you describe your deployments once, in a model list, and give each a name of your own, an alias. The app asks for the alias; the Router picks a deployment, balances the load when several share one alias, and retries or falls back when one fails.

::: visual router-pick | Figure | How a Router picks a deployment
One alias with three deployments, the deployment each routing strategy would pick, and where fallbacks take over.
:::

## Set up

The setup of [lesson 18.2](lesson:18.2): quiet logs, LiteLLM, and the keys from `.env`.

```python title="Notebook cell"
import warnings
import logging

warnings.filterwarnings("ignore")
logging.getLogger("LiteLLM").setLevel(logging.ERROR)

import litellm
from dotenv import load_dotenv

load_dotenv()
litellm.suppress_debug_info = True
```

## Give models names of your own

The right model depends on the job: a strong model for code, a cheap one for summaries, the fastest one for short replies. A model list names each job:

```python title="Notebook cell"
import os
from litellm import Router

model_list = [
    {
        "model_name": "fast-cheap",
        "litellm_params": {
            "model": "groq/openai/gpt-oss-120b",
            "api_key": os.getenv("GROQ_API_KEY")
        }
    },
    {
        "model_name": "smart-coding",
        "litellm_params": {
            "model": "gpt-4o",
            "api_key": os.getenv("OPENAI_API_KEY")
        }
    },
    {
        "model_name": "balanced",
        "litellm_params": {
            "model": "gpt-4o-mini",
            "api_key": os.getenv("OPENAI_API_KEY")
        }
    }
]

router = Router(model_list=model_list)
router.get_model_names()
```

```output real
['fast-cheap', 'smart-coding', 'balanced']
```

Each entry is one *deployment*. `model_name` is the alias the app asks for. `litellm_params` holds everything `completion()` needs to reach that deployment: the model string, and optionally a key, an `api_base`, a `timeout`. Creating the Router calls nothing; it only learns the names. The app then calls the Router the way it called `completion()`:

```python title="Notebook cell" norun
fast_response = router.completion(
    model="fast-cheap",
    messages=[{"role": "user", "content": "Summarize: AI is changing software."}]
)

code_response = router.completion(
    model="smart-coding",
    messages=[{"role": "user", "content": "Write a Python function to reverse a string."}]
)

print("Fast/cheap (Groq):", fast_response.choices[0].message.content[:150])
print("\nSmart/coding (GPT-4o):\n", code_response.choices[0].message.content[:300])
```

````output illustrative note="the Groq answer came from Llama 3.3 70B, since retired; answers vary per run"
Fast/cheap (Groq): Artificial intelligence (AI) is revolutionizing the software industry in several ways:

1. **Automated Coding**: AI-powered tools can generate code, r

Smart/coding (GPT-4o):
 Certainly! Here's a simple Python function to reverse a string:

```python
def reverse_string(s):
    """
    Reverses the given string.

    Parameters:
    s (str): The string to reverse.

    Returns:
    str: The reversed string.
    """
    return s[::-1]

# Example usage:
input_string = "Hello
````

The app calls `"fast-cheap"` and `"smart-coding"`, names for jobs; which provider serves each is configuration. Moving `smart-coding` to Claude is one line, `"model": "claude-sonnet-5-5"` with `ANTHROPIC_API_KEY`, and no code that calls it changes. `router.completion` takes the same arguments as `completion()` and returns the same response. An alias the list doesn't have raises `BadRequestError: You passed in model=... There are no healthy deployments for this model`.

## Several deployments behind one alias

When one key's rate limit isn't enough, put several deployments under the same alias: the Router spreads the requests across them.

```python title="Notebook cell" norun
from litellm import Router
import os

# Two deployments under the same alias:
# a pool of models that can all answer, from different providers
model_list = [
    {
        "model_name": "gpt-pool",
        "litellm_params": {
            "model": "gpt-4o",
            "api_key": os.getenv("OPENAI_API_KEY"),
        },
        "model_info": {"id": "openai-gpt4o"}
    },

    {
        "model_name": "gpt-pool",
        "litellm_params": {
            "model": "groq/openai/gpt-oss-120b",
            "api_key": os.getenv("GROQ_API_KEY"),
        },
        "model_info": {"id": "groq-gpt-oss-120b"}
    },
]

router = Router(
    model_list=model_list,
    routing_strategy="simple-shuffle"
)

print(f"{'Request':<10}{'Deployment Picked':<22}{'Latency':<12}{'Response':<40}")
print("-" * 84)

for i in range(6):
    r = router.completion(
        model="gpt-pool",
        messages=[{"role": "user", "content": f"Say hello, request {i+1}"}]
    )
    # Pull out which deployment served this request
    deployment_id = r._hidden_params.get("model_id", "unknown")
    latency = r._response_ms
    answer = r.choices[0].message.content[:35]
    print(f"#{i+1:<9}{deployment_id:<22}{latency:>6.0f} ms   {answer}")
```

```output illustrative note="the Groq rows came from Llama 3.3 70B, since retired; picks and times vary per run"
Request   Deployment Picked     Latency     Response
------------------------------------------------------------------------------------
#1        groq-gpt-oss-120b        406 ms   Hello. How can I assist you with yo
#2        openai-gpt4o            1749 ms   Hello! How can I assist you today?
#3        groq-gpt-oss-120b        411 ms   Hello. You've requested 3, could yo
#4        groq-gpt-oss-120b        782 ms   Hello. You've requested 4, but I'm 
#5        groq-gpt-oss-120b        624 ms   Hello, I'd be happy to help you wit
#6        openai-gpt4o            1006 ms   Hello! How can I assist you today?
```

The deployments that share a `model_name` form a *model group*. `model_info={"id": ...}` names each deployment; without it, LiteLLM makes up a long hash. Two values on the response tell you what happened: `_hidden_params["model_id"]` is the deployment that served the request, and `_response_ms` how long it took. Both are LiteLLM internals, as the underscore says.

This pool mixes two different models, so the same alias answers in two styles: Groq's model answers fast and loosely, GPT-4o slowly and politely. Pools usually hold equal deployments instead, such as the same model under two keys or in two regions, so that load balancing changes nothing but capacity.

## Routing strategies

`routing_strategy` decides which deployment of a group serves each request:

| Strategy | Picks | What it needs | The catch |
|---|---|---|---|
| `simple-shuffle`, the default | A deployment at random, in proportion to its `weight`, or to its `rpm`/`tpm` limits when set | Nothing | No notion of load or speed |
| `least-busy` | The deployment with the fewest requests in flight | Requests that overlap in time | Ties go to the first deployment listed |
| `latency-based-routing` | The one with the fastest recent responses | A few calls to measure | Tries each first, then follows its measurements |
| `cost-based-routing` | The cheapest by LiteLLM's price table | Async calls in LiteLLM 1.105 | Raises with `router.completion` (below) |

There is also `usage-based-routing-v2`, which sends each request to the deployment furthest from the `rpm` and `tpm` limits you set on it.

### least-busy

Like picking the shortest line at a supermarket: the Router counts the requests in flight on each deployment and sends the new one to the least busy.

```python title="Notebook cell" norun
import os
from litellm import Router
from collections import Counter

model_list = [
    {"model_name": "chat",
     "litellm_params": {"model": "gpt-4o-mini",
                        "api_key": os.getenv("OPENAI_API_KEY")},
     "model_info": {"id": "OpenAI"}},
    {"model_name": "chat",
     "litellm_params": {"model": "groq/openai/gpt-oss-120b",
                        "api_key": os.getenv("GROQ_API_KEY")},
     "model_info": {"id": "Groq"}},
]

router = Router(
    model_list=model_list,
    routing_strategy="least-busy"
)

hits = Counter()
for i in range(8):
    r = router.completion(
        model="chat",
        messages=[{"role": "user", "content": f"Say 'OK' #{i}"}],
        max_tokens=5
    )
    hits[r._hidden_params.get("model_id", "?")] += 1
    print(f"Request {i+1} → {r._hidden_params.get('model_id', '?')}")

print("\nDistribution:")
for k, v in hits.most_common():
    print(f"   {k}: {'█' * v} ({v})")
```

```output saved note="emojis removed from the IDs and labels"
Request 1 → OpenAI
Request 2 → OpenAI
Request 3 → OpenAI
Request 4 → OpenAI
Request 5 → OpenAI
Request 6 → OpenAI
Request 7 → OpenAI
Request 8 → OpenAI

Distribution:
   OpenAI: ████████ (8)
```

Every request went to OpenAI, and that is the strategy working as written. The Router adds one to a deployment's count when a request goes out and subtracts one when the answer comes back, then picks the lowest count, the first deployment on a tie. A loop sends one request at a time, so both counts are always zero when it picks, and the first deployment wins every time. `least-busy` spreads load only when requests overlap: many users at once, or async calls in parallel.

### latency-based-routing

Always pick the fastest: the Router measures each deployment's response times and sends new requests to the one that has been quickest lately.

```python title="Notebook cell" norun
import os
from litellm import Router
import time

model_list = [
    {"model_name": "chat",
     "litellm_params": {"model": "gpt-4o-mini",
                        "api_key": os.getenv("OPENAI_API_KEY")},
     "model_info": {"id": "OpenAI GPT-4o-mini"}},
    {"model_name": "chat",
     "litellm_params": {"model": "groq/openai/gpt-oss-120b",
                        "api_key": os.getenv("GROQ_API_KEY")},
     "model_info": {"id": "Groq gpt-oss-120b"}},
]

router = Router(
    model_list=model_list,
    routing_strategy="latency-based-routing"   # picks the fastest
)

# Send 10 requests and watch which deployments get picked over time
print(f"{'Req':<6}{'Deployment':<32}{'Latency':<10}")
print("-" * 50)

for i in range(10):
    start = time.time()
    r = router.completion(
        model="chat",
        messages=[{"role": "user", "content": "Reply with exactly: OK"}],
        max_tokens=5
    )
    latency_ms = (time.time() - start) * 1000
    deployment = r._hidden_params.get("model_id", "?")
    print(f"#{i+1:<5}{deployment:<32}{latency_ms:>6.0f} ms")
```

```output illustrative note="the Groq rows came from Llama 3.3 70B, since retired; aiohttp warnings removed; times vary per run"
Req   Deployment                      Latency
--------------------------------------------------
#1    Groq gpt-oss-120b                  739 ms
#2    OpenAI GPT-4o-mini                1632 ms
#3    Groq gpt-oss-120b                  204 ms
#4    Groq gpt-oss-120b                  359 ms
#5    Groq gpt-oss-120b                  367 ms
#6    Groq gpt-oss-120b                  227 ms
#7    Groq gpt-oss-120b                  214 ms
#8    Groq gpt-oss-120b                  365 ms
#9    Groq gpt-oss-120b                  410 ms
#10   Groq gpt-oss-120b                  203 ms
```

The first requests explore, since the Router has no measurements yet; once it has, it stays with the deployment that answered fastest, usually Groq, which specialises in fast inference. It keeps measuring, so a deployment that slows down loses its traffic. A run with simulated delays of 0.5 and 0.1 seconds behaved the same way: one call to the slow deployment, then every call to the fast one.

### cost-based-routing

Always pick the cheapest: the deployment with the lowest price per token.

```python title="Notebook cell" norun
import os
from litellm import Router

# Different providers with very different price points
model_list = [
    {"model_name": "chat",
     "litellm_params": {"model": "gpt-4o",             # ~$2.50/M input tokens
                        "api_key": os.getenv("OPENAI_API_KEY")},
     "model_info": {"id": "GPT-4o (premium)"}},
    {"model_name": "chat",
     "litellm_params": {"model": "gpt-4o-mini",        # ~$0.15/M input tokens
                        "api_key": os.getenv("OPENAI_API_KEY")},
     "model_info": {"id": "GPT-4o-mini (cheap)"}},
    {"model_name": "chat",
     "litellm_params": {"model": "groq/openai/gpt-oss-120b",   # ~$0.15/M input tokens
                        "api_key": os.getenv("GROQ_API_KEY")},
     "model_info": {"id": "Groq gpt-oss-120b"}},
]

router = Router(
    model_list=model_list,
    routing_strategy="simple-shuffle"   # valid strategy
)

for i in range(5):
    r = router.completion(
        model="chat",
        messages=[{"role": "user", "content": "Hi"}],
        max_tokens=10
    )
    print(f"Request {i+1} → {r._hidden_params.get('model_id', '?')}")
```

```output illustrative note="the Groq row came from Llama 3.3 70B, since retired; picks vary per run"
Request 1 → GPT-4o (premium)
Request 2 → GPT-4o (premium)
Request 3 → GPT-4o (premium)
Request 4 → Groq gpt-oss-120b
Request 5 → GPT-4o-mini (cheap)
```

The cell is set to `simple-shuffle`, so the picks are random, premium model included. With `routing_strategy="cost-based-routing"`, LiteLLM 1.105 raises `RouterRateLimitError: No deployments available for selected model` on the first `router.completion`: the cost strategy has only an asynchronous implementation, and the synchronous call finds no deployment. With `await router.acompletion(...)` in a notebook cell, or `asyncio.run(...)` in a script ([lesson 5.2](lesson:5.2), section 12), it works: every request goes to `gpt-4o-mini` (practice 2). Groq's `gpt-oss-120b` costs the same per token, and on a tie the deployment listed first wins.

## Retries, fallbacks and cooldowns

A Router takes the reliability settings of [lesson 18.2](lesson:18.2) once, for every call:

```python title="Notebook cell"
model_list = [
    {"model_name": "chat",
     "litellm_params": {"model": "gpt-4o-mini", "mock_response": "litellm.RateLimitError"}},
    {"model_name": "backup",
     "litellm_params": {"model": "groq/openai/gpt-oss-120b", "mock_response": "Hello from the backup."}},
]

router = Router(model_list=model_list, num_retries=1, fallbacks=[{"chat": ["backup"]}])

r = router.completion(model="chat", messages=[{"role": "user", "content": "Hi"}])
print(r.choices[0].message.content)
print(r._hidden_params["additional_headers"])
```

```output real
Hello from the backup.
{'x-litellm-model-group': 'backup', 'x-litellm-attempted-retries': 0, 'x-litellm-attempted-fallbacks': 1}
```

The `chat` deployment always raises a rate-limit error here, so the Router called it twice, the second time after a wait of about a second, then fell back to the `backup` alias, whose answer the app received (a failure callback, [lesson 18.5](lesson:18.5), counted the calls). The headers describe the call that answered: the `backup` group, with no retries of its own, reached after one fallback.

| Setting | Effect |
|---|---|
| `num_retries=2` | Retries a failed call, with growing waits, on errors worth retrying ([lesson 18.2](lesson:18.2)) |
| `timeout=30` | Seconds before an attempt counts as failed |
| `fallbacks=[{"chat": ["backup"]}]` | When `chat` still fails after its retries, try the `backup` alias |
| `context_window_fallbacks=[...]` | The same, only for prompts too long for the model: move to one with a larger context |
| `allowed_fails`, `cooldown_time` | A deployment that fails `allowed_fails` times is skipped for `cooldown_time` seconds, so later requests go straight to the others |
| `cache_responses=True` | Lets the Router's calls use `litellm.cache` ([lesson 18.3](lesson:18.3)); without it, a Router switches caching off for its calls |
| `redis_host`, `redis_port`, `redis_password` | Share in-flight counts, latencies, usage and cooldowns between several processes or servers |

Cooldowns are what keep an outage cheap: without them, every request first waits on the failing deployment before retrying elsewhere ([lesson 18.1](lesson:18.1)).

## Interview questions

::: check
You put two OpenAI keys and one Groq deployment behind one alias. Users complain that answers are inconsistent. Why, and what would you change?

The alias now spans two different models, so the same question gets answers in two styles, with different strengths, formats and tool support, depending on which deployment the shuffle picked. Pool equal deployments under one alias, the same model under two keys or in two regions, to add capacity without changing behaviour, and give the other model an alias of its own, used as a fallback when the pool fails.
:::

::: check
In a load test, `least-busy` sent every request to the first deployment. Is it broken?

No. The strategy picks the deployment with the fewest requests in flight, and ties go to the first one listed. A test that sends requests one after another never has two in flight, so every pick is a tie. Test with concurrent requests, as real traffic arrives, and with several servers share the counts through Redis, or each server balances only its own requests.
:::

::: check
How would you choose a routing strategy for a customer-facing chat app with two equal deployments in different regions?

Start with `simple-shuffle`, weighted by each deployment's rate limits, which spreads load with no state to keep. Under bursty concurrent traffic, `least-busy` reacts to queues building up; when one region is often slower, `latency-based-routing` follows the measurements. Whichever you choose, set retries, timeouts, cooldowns and a fallback alias, and with several gateway servers share the Router's state in Redis.
:::

## Practice

::: practice
**Weights.** Give two deployments of one alias the weights 9 and 1, send 100 requests with mock responses, and count which deployment served each.

```python title="Notebook cell"
from collections import Counter

model_list = [
    {"model_name": "chat",
     "litellm_params": {"model": "gpt-4o-mini", "weight": 9, "mock_response": "Hi"},
     "model_info": {"id": "OpenAI"}},
    {"model_name": "chat",
     "litellm_params": {"model": "groq/openai/gpt-oss-120b", "weight": 1, "mock_response": "Hi"},
     "model_info": {"id": "Groq"}},
]
router = Router(model_list=model_list)   # simple-shuffle, the default

hits = Counter(
    router.completion(model="chat", messages=[{"role": "user", "content": f"Hi {i}"}])._hidden_params["model_id"]
    for i in range(100)
)
print(hits)
```

```output real note="counts vary per run"
Counter({'OpenAI': 89, 'Groq': 11})
```

About nine requests in ten go to the first deployment. Weights suit deployments of unequal capacity, such as a key with a higher rate limit, or a gradual move to a new model: start it at a weight of 1, watch its answers, then raise it.
:::

::: practice
**Cost-based routing, the async way.** Save the cost-based Router as a script with mock responses, send three requests with `acompletion`, then try one with the synchronous `completion`.

```python title="cost_routing.py"
import asyncio
import logging

logging.getLogger("LiteLLM").setLevel(logging.CRITICAL)
logging.getLogger("LiteLLM Router").setLevel(logging.CRITICAL)

from litellm import Router

model_list = [
    {"model_name": "chat", "litellm_params": {"model": "gpt-4o", "mock_response": "Hi"},
     "model_info": {"id": "GPT-4o (premium)"}},
    {"model_name": "chat", "litellm_params": {"model": "gpt-4o-mini", "mock_response": "Hi"},
     "model_info": {"id": "GPT-4o-mini (cheap)"}},
    {"model_name": "chat", "litellm_params": {"model": "groq/openai/gpt-oss-120b", "mock_response": "Hi"},
     "model_info": {"id": "Groq gpt-oss-120b"}},
]
router = Router(model_list=model_list, routing_strategy="cost-based-routing")


async def main():
    for i in range(3):
        r = await router.acompletion(model="chat", messages=[{"role": "user", "content": "Hi"}], max_tokens=10)
        print(f"Request {i+1} -> {r._hidden_params['model_id']}")


if __name__ == "__main__":
    asyncio.run(main())
    try:
        router.completion(model="chat", messages=[{"role": "user", "content": "Hi"}])
    except Exception as e:
        print(f"sync call: {type(e).__name__}")
```

```zsh title="Terminal"
python cost_routing.py
```

```output real
Request 1 -> GPT-4o-mini (cheap)
Request 2 -> GPT-4o-mini (cheap)
Request 3 -> GPT-4o-mini (cheap)
sync call: RouterRateLimitError
```

The async calls all go to the cheapest deployment; `gpt-4o-mini` and Groq's `gpt-oss-120b` tie on price, and the first listed wins. The synchronous call finds no deployment. The second logger, `LiteLLM Router`, is the Router's own; setting it to `CRITICAL` keeps its error report about the failed call out of the output.
:::

## Further reading

- LiteLLM, [proxy config.yaml](https://docs.litellm.ai/docs/proxy/configs): `router_settings` (strategy, retries, cooldowns, Redis) and fallbacks, in the proxy's syntax.
- LiteLLM, [routing](https://docs.litellm.ai/docs/routing): the Router, its strategies and its reliability settings.
