+++
number = "18.1"
title = "What an LLM gateway does"
lede = "An LLM gateway stands between your applications and the model providers: one API for every model, and one place for fallbacks, routing, caching, costs, logs and input checks. Learn what it does to each request, where it runs, and what it costs you."
summary = "Why calling providers directly stops scaling, what a gateway is, its jobs in the order a request meets them, a library or a server and the proxy's config file, how it relates to LangChain's own provider switching and fallbacks, trade-offs and failure modes, popular gateways, a production checklist, interview questions and two practice tasks in plain Python."
type = "concept"
status = "published"
source = "18 LLM Gateway: llm_gateway_tutorial.ipynb (cells 1-2, 55-58); the request path, library or proxy, the comparison with LangChain, failure modes, interview questions and practice added"
chips = [["i-layers", "Concept"]]
+++

Every lesson so far called a provider through its own class, such as `ChatOpenAI` or `ChatGroq` ([lesson 6.1](lesson:6.1)), or through `init_chat_model` with a provider in the model string ([lesson 9.1](lesson:9.1)). That works for one app and one provider. It strains when several apps call several providers: each app holds its own keys, handles each provider's errors and rate limits, and switches models by editing code, while nobody can say what last month cost or which prompts left the company. An LLM gateway puts one layer between the apps and the providers, so these problems are solved once.

## What a gateway is

An LLM gateway is a single entry point for model calls. Applications send every request to it in one format, usually OpenAI's chat completions format. The gateway decides which provider and model serve the request, calls that provider in the provider's own format, and returns the reply in the common format. Because every call passes through it, the gateway is also the place for rules that should hold for all of them: retry and fall back, cache, enforce limits and budgets, log, check the input.

It is the API gateway idea (Kong, Spring Cloud Gateway) applied to model calls, with two differences that shape everything else. Requests are billed per token, at a price that depends on the model. And the same request can go to very different backends, since any chat model can answer any chat request.

::: visual gateway-map | Figure | Without and with a gateway
Three applications and four providers, wired directly and through one gateway.
:::

| Without a gateway | With a gateway |
|---|---|
| A different SDK and error type for each provider | One API and one family of errors for every provider |
| An outage stops every app that hard-coded the model | Fallbacks move the call to another model |
| Costs scattered across provider dashboards | Every call priced and logged in one place |
| Switching models means editing every app | Apps ask for an alias; the model changes in one config |
| The same question paid for again and again | Repeated requests answered from a cache |
| Provider keys copied into every app | Keys held by the gateway; apps get their own revocable keys |

## What happens to one request

A gateway's features are steps on the path of each request. In the order a request meets them:

1. **Authenticate and limit.** Which app or team is calling, and is it within its rate limit and budget?
2. **Check the input.** Mask personal data, block prompt injections or forbidden topics: guardrails ([lesson 17.1](lesson:17.1)).
3. **Look in the cache.** Was the same request answered recently? Then return that answer: no provider call, no cost.
4. **Pick a model.** Turn the name the app asked for, an alias such as `fast` or `smart`, into one deployment: a model at a provider, with a key. With several deployments behind one alias, a strategy picks one: at random, the least busy, the fastest or the cheapest.
5. **Call, retry, fall back.** Call the provider with a time limit, retry temporary errors such as rate limits and server errors, and move to the next model in the fallback list when one keeps failing.
6. **Check the output, log and price.** Optionally check the answer, then record who asked, which model answered, the tokens, the latency and the cost.
7. **Return** the reply in the common format. The app never needs to know which provider answered.

Lessons [18.2](lesson:18.2) to [18.5](lesson:18.5) build steps 2 to 6 with LiteLLM, and [lesson 18.6](lesson:18.6) puts them together. Authentication, budgets and per-team keys belong to the server form below.

## A library or a server

LiteLLM, the gateway this module uses, comes in two forms, and most gateways offer one or both:

| | Library (SDK) | Server (proxy) |
|---|---|---|
| What it is | A Python package the app imports: `litellm.completion()`, `litellm.Router` | A separate service with an OpenAI-compatible HTTP API |
| Who can use it | One Python app | Every app, in any language, through any OpenAI client |
| Provider keys | In each app's environment | In the gateway only; apps get virtual keys, per team, with budgets |
| Routing and cache state | Per process: each copy of the app keeps its own | Shared, with Redis and a database behind the proxy |
| What it costs | Nothing to run | A service to deploy, scale and secure, and one network hop per call |

The proxy reads its deployments from a `config.yaml` whose `model_list` has the same shape as the Router's in [lesson 18.4](lesson:18.4):

```yaml title="config.yaml"
model_list:
  - model_name: fast                     # the name apps ask for
    litellm_params:
      model: groq/openai/gpt-oss-120b
      api_key: os.environ/GROQ_API_KEY   # read from the environment
  - model_name: smart
    litellm_params:
      model: gpt-4o
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  num_retries: 2
  fallbacks: [{"smart": ["fast"]}]

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY   # every request must carry a key
```

`litellm --config config.yaml` starts it on port 4000; the command comes with the `litellm[proxy]` extra. Any OpenAI client can then call it by changing its base URL:

```python title="Notebook cell" norun
import os
from openai import OpenAI

client = OpenAI(base_url="http://localhost:4000", api_key=os.getenv("LITELLM_API_KEY"))
response = client.chat.completions.create(model="fast", messages=[{"role": "user", "content": "Hi"}])
```

`model="fast"` is the alias; the proxy picks the deployment, and the key is one the proxy issued, not a provider's. LangChain's `ChatOpenAI(base_url=..., model="fast")` calls it the same way. This module uses the library, which teaches the same features with nothing to deploy; production setups usually run the proxy, with `config.yaml` kept in Git.

## A gateway next to LangChain

LangChain already covers part of this inside one Python app:

| Need | In LangChain | In LiteLLM |
|---|---|---|
| One API for many providers | `init_chat_model("provider:model")` ([lesson 9.1](lesson:9.1)) | `completion(model="provider/model")` ([lesson 18.2](lesson:18.2)) |
| Another model when one fails | `with_fallbacks` ([lesson 7.1](lesson:7.1)), `ModelFallbackMiddleware` ([lesson 9.6](lesson:9.6)) | `fallbacks=`, Router fallbacks |
| Retries | `with_retry`, `ModelRetryMiddleware` | `num_retries` |
| Tokens and cost | `usage_metadata` ([lesson 9.4](lesson:9.4)), tracing in LangSmith ([lesson 12.1](lesson:12.1)) | A price for every call, per user and team ([lesson 18.3](lesson:18.3)) |
| Checks on the input | Middleware ([lesson 17.3](lesson:17.3)) | Checks before the call, proxy guardrails ([lesson 18.5](lesson:18.5)) |

For one LangChain app, LangChain's own tools are often enough. A gateway pays off with several apps, languages or teams: keys, budgets, logs, model choices and rules then live in one place instead of in every codebase. The two combine: LangChain builds the app, and its models call the gateway ([lesson 18.6](lesson:18.6)).

## What it costs you

A gateway sits on the path of every call, and each of its features has a failure mode of its own **VERIFY**:

- **A single point of failure.** When the proxy is down, every app is down: run several replicas behind health checks. The library has no service to fail, but each copy of the app routes and caches on its own numbers.
- **Fallbacks change behaviour quietly.** The backup model writes differently, may lack the tools, JSON mode or context length the app relies on, may reject parameters ([lesson 18.6](lesson:18.6)), and sends your data to another provider, which contracts may forbid. Log which model answered, and alert when fallbacks fire often.
- **Retries multiply load and cost.** Two retries on each of three models turn one request into up to nine calls, and during an outage, retries from many clients make it worse. Retry only temporary errors, with backoff, and cap the total wait.
- **Caches serve stale or wrong answers.** An exact-match cache misses every rephrased question; a semantic cache, which matches similar questions, can return the answer to a different one. Cached answers can also hold one user's personal data.
- **Costs are estimates.** The gateway prices tokens from its own price table, which can lag the providers' prices and doesn't know your discounts ([lesson 18.3](lesson:18.3)).
- **One API for all means the common part of all.** A unified API trails each provider's newest features and maps some of them imperfectly.
- **A valuable target.** It holds every provider key and sees every prompt: protect it like a secrets store, and keep prompts out of logs that don't need them.

## Popular gateways

| Gateway | Type | Best for |
|---|---|---|
| LiteLLM | Open source | A Swiss army knife: 100+ providers, a library and a proxy, easy to self-host |
| Portkey | SaaS and open source | An observability dashboard and prompt management |
| Helicone | SaaS and open source | A drop-in OpenAI proxy with a logging UI |
| Cloudflare AI Gateway | SaaS | Apps already on Cloudflare: one-click setup and caching at the edge |
| Kong AI Gateway | Enterprise | Teams that already run Kong's API gateway |
| OpenRouter | SaaS | Many models behind one account and one bill |

LiteLLM is a common starting point: it is open source and self-hosted, so keys and prompts stay on your own infrastructure. Hosted gateways trade that control for less to operate.

## Before production

| Practice | Why |
|---|---|
| A shared cache such as Redis, not memory | It survives restarts and serves every replica |
| Rate limits per user | One user or one bug can't burn the whole budget |
| Logs sent to an observability backend | LangSmith, Langfuse, Helicone or your own database |
| A master key, and a virtual key per team | An audit trail, and costs charged to the team that spent them |
| Pinned model versions | `gpt-4o-mini-2024-07-18` doesn't change under you; `gpt-4o-mini` can |
| A timeout and `num_retries` on every call | A hung provider doesn't hang your users |
| Personal data redacted before logging | Logs don't become a store of emails and ID numbers |
| Health checks for each deployment | Failing deployments leave the rotation on their own |
| Several replicas, scaled with traffic | For example on Kubernetes with an autoscaler |
| `config.yaml` in Git | Gateway changes are reviewed and versioned like code |

## Interview questions

::: check
Five services call OpenAI directly, each with its own key. You're asked for costs per team, one place to switch models, and survival when OpenAI is down. What do you propose, and what new risks come with it?

A gateway in front of the providers: the LiteLLM proxy or a similar product, with aliases in its config and a virtual key per team. Each service keeps its OpenAI SDK and changes only the base URL and key. Costs per team come from the gateway's log, a model switch is a config change, and fallbacks to a second provider cover outages. The new risks: the gateway is on every call's path (run replicas with health checks), it holds every provider key (lock it down), fallbacks send data to a second provider (check the contracts) and answer with a different model (test the prompts on both), and its costs are estimates to reconcile with the invoices.
:::

::: check
When is LangChain's own tooling enough, and when do you add a gateway?

For one Python app, `init_chat_model`, `with_fallbacks` and the retry and fallback middleware cover switching and reliability, and LangSmith covers tracing. A gateway pays off when several apps, languages or teams share providers: keys and budgets held centrally, one log of every call, aliases changed without redeploying apps, and a cache shared across services. The two combine, with LangChain's models calling the gateway instead of the providers.
:::

::: check
A teammate wants a semantic cache, so that rephrased questions hit the cache too. What could go wrong?

A semantic cache returns a stored answer when a new question's embedding is close enough to an old one, and close isn't the same. "Can I cancel my order?" and "Cancel my order" look alike but need different handling, and a changed number or name can change the right answer. The similarity threshold trades hit rate against wrong answers, and wrong answers are hard to notice. Answers personal to one user must never reach another, and time-sensitive answers go stale. Start with exact matches, cache only questions where a reused answer is safe, and measure wrong hits on real traffic before widening it.
:::

::: check
During a provider outage, latency and cost both rose even though every request was answered by a fallback. Why?

Each request first waited on the failing provider: until its timeout, then through retries with backoff, before moving on, so every request paid that delay. Retries also multiplied the calls, and the fallback model may cost more per token. Short timeouts, retries only for errors worth retrying, and cooldowns that take a failing deployment out of rotation after a few failures send later requests straight to the backup ([lesson 18.4](lesson:18.4)).
:::

## Practice

::: practice
**A gateway in plain Python.** Write `gateway(alias, prompt)`: look the alias up in a table of model chains, call each fake model in turn until one answers, and log the alias, the model and the cost, priced per word of answer. One model is always down. Call three aliases, then print the log.

```python title="Notebook cell"
PRICES = {"big": 0.010, "small": 0.001, "local": 0.0}     # dollars per word of answer
ROUTES = {
    "smart": ["big", "small"],
    "fast": ["small", "local"],
    "private": ["local"],
}
log = []


def call_model(model, prompt):
    if model == "big":
        raise ConnectionError("big is down")
    return f"{model} says: {prompt.lower()}"


def gateway(alias, prompt):
    last_error = None
    for model in ROUTES[alias]:
        try:
            answer = call_model(model, prompt)
        except ConnectionError as e:
            last_error = e
            continue
        log.append((alias, model, round(len(answer.split()) * PRICES[model], 4)))
        return answer
    raise last_error


for alias in ["smart", "fast", "private"]:
    print(gateway(alias, "Explain RAG"))
print(log)
```

```output real
small says: explain rag
small says: explain rag
local says: explain rag
[('smart', 'small', 0.004), ('fast', 'small', 0.004), ('private', 'local', 0.0)]
```

The app names jobs (`smart`, `fast`, `private`) and the table names models, so moving `smart` to another model changes one line. The log is what a gateway keeps for every call. LiteLLM's `Router` is this table with real providers ([lesson 18.4](lesson:18.4)), and its fallbacks are the loop ([lesson 18.2](lesson:18.2)); [lesson 5.2](lesson:5.2), section 13, has the loop on its own.
:::

::: practice
**An exact-match cache.** Write `cached_call(model, messages, **params)`: build a key from the model, the messages and the settings, return the stored answer on a hit, and count hits and misses. Ask the same question twice, then with a trailing space, then with another temperature.

```python title="Notebook cell"
import hashlib
import json

cache, stats = {}, {"hit": 0, "miss": 0}


def fake_model(messages):
    return f"answer to {messages[-1]['content']!r}"


def cached_call(model, messages, **params):
    raw = json.dumps({"model": model, "messages": messages, **params}, sort_keys=True)
    key = hashlib.sha256(raw.encode()).hexdigest()
    if key in cache:
        stats["hit"] += 1
        return cache[key]
    stats["miss"] += 1
    cache[key] = fake_model(messages)
    return cache[key]


question = [{"role": "user", "content": "What is RAG?"}]
cached_call("gpt-4o-mini", question)
cached_call("gpt-4o-mini", question)
cached_call("gpt-4o-mini", [{"role": "user", "content": "What is RAG? "}])
cached_call("gpt-4o-mini", question, temperature=0.5)
print(stats, len(cache))
```

```output real
{'hit': 1, 'miss': 3} 3
```

`json.dumps(..., sort_keys=True)` writes the same request as the same text every time, whatever order its keys were given in, and the hash turns it into a short key of fixed length. A trailing space or another temperature makes a different request, so exact-match caches hit only on identical requests. LiteLLM's cache works the same way ([lesson 18.3](lesson:18.3)).
:::

## Further reading

- LiteLLM, [documentation](https://docs.litellm.ai/docs/): the library and the proxy, with every provider and setting.
- LiteLLM, [proxy config.yaml](https://docs.litellm.ai/docs/proxy/configs): the model list, the router settings and the proxy settings.
- LiteLLM, [guardrails on the proxy](https://docs.litellm.ai/docs/proxy/guardrails/quick_start): input and output checks that run before and after each call.
