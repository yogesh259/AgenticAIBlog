+++
number = "18.2"
title = "One API for every model"
lede = "LiteLLM sends one OpenAI-style request to any provider and returns one OpenAI-style response. Install it, call four providers with the same function, read what comes back, test without a key, and let a failed call fall back to another model."
summary = "Install LiteLLM, quiet its logs, load the keys, completion() and its model strings, the OpenAI-style response, many providers in one loop, one family of errors for every provider, testing without a key with mock_response, fallbacks when a model fails and how they work, retries and timeouts, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "18 LLM Gateway: llm_gateway_tutorial.ipynb (cells 3-16; three setup cells merged, retired Groq, Anthropic and Gemini models replaced, a copied comment corrected, emojis removed, logs trimmed); model strings, the response, errors, mock responses and how fallbacks work added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

[Lesson 18.1](lesson:18.1) described what a gateway does. This module builds one with LiteLLM, an open-source gateway that comes as a Python library and as a server. Its core is one function, `completion()`: it takes a model string and a list of messages in OpenAI's format, calls the provider the string names, and returns the answer in OpenAI's format, whichever provider wrote it. This lesson calls it, then adds the first gateway feature: falling back to another model when one fails.

## Install the packages

Add two lines to `requirements.txt` and run your install command again ([lesson 0.1](lesson:0.1)); LangChain and `python-dotenv` are already there from lessons [6.1](lesson:6.1) and [0.3](lesson:0.3):

```text title="requirements.txt"
litellm
langchain-litellm
```

`langchain-litellm` connects LiteLLM to LangChain in [lesson 18.6](lesson:18.6).

```python title="Notebook cell"
from importlib.metadata import version

version("litellm")
```

```output real
'1.105.7'
```

LiteLLM releases often, and some behaviour in these lessons depends on the version: they describe 1.105.

## Quiet the logs

```python title="Notebook cell"
import warnings
import logging

warnings.filterwarnings("ignore")
logging.getLogger("LiteLLM").setLevel(logging.ERROR)

import litellm
from litellm import completion

litellm.suppress_debug_info = True
```

LiteLLM logs through Python's `logging` module under the logger name `LiteLLM` ([lesson 3.8](lesson:3.8)). Setting that logger to `ERROR` before the import hides its information and warning lines, including the ones it may write while it loads, and keeps its errors. `suppress_debug_info` removes the help links LiteLLM prints next to every error. `warnings.filterwarnings("ignore")` hides every warning in the notebook, deprecation notices included: fine for a demo, while a project is better served by filtering one category or module at a time.

## Load the keys

```python title="Notebook cell" norun
# Load API keys from a .env file in the same folder:
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GROQ_API_KEY=gsk_...

import os
from dotenv import load_dotenv
load_dotenv()

# Quick check
print("OpenAI key loaded:    ", "set" if os.getenv("OPENAI_API_KEY") else "missing")
print("Anthropic key loaded: ", "set" if os.getenv("ANTHROPIC_API_KEY") else "missing")
print("Groq key loaded:      ", "set" if os.getenv("GROQ_API_KEY") else "missing")
```

```output saved note="check marks printed as set and missing"
OpenAI key loaded:     set
Anthropic key loaded:  missing
Groq key loaded:       set
```

LiteLLM reads each provider's usual variable: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, and for Gemini `GOOGLE_API_KEY`, the name [lesson 6.1](lesson:6.1) uses, or `GEMINI_API_KEY`. You need only the keys of the providers you call. The check prints whether a key is set, never the key ([lesson 0.3](lesson:0.3)).

## One function for every provider

```python title="Notebook cell" norun
from litellm import completion

# Same code, different providers: just change the model string

# Call OpenAI
response_openai = completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Explain RAG in one sentence."}]
)
print("OpenAI:", response_openai.choices[0].message.content)

# Call Groq (fast inference)
response_groq = completion(
    model="groq/openai/gpt-oss-120b",
    messages=[{"role": "user", "content": "Explain RAG in one sentence."}]
)
print("Groq:  ", response_groq.choices[0].message.content)
```

```output illustrative note="the Groq answer came from Llama 3.3 70B, since retired; answers vary per run"
OpenAI: RAG stands for Retrieval-Augmented Generation, a model architecture that enhances generative capabilities by retrieving and incorporating relevant information from an external knowledge source to improve the quality and accuracy of generated responses.
Groq:   RAG (Retrieval-Augmented Generation) is a type of artificial intelligence model that combines the strengths of retrievers, which find relevant information, and generators, which create text, to produce more accurate and informative responses.
```

The two calls differ only in the model string. Groq shut Llama 3.3 70B (`groq/llama-3.3-70b-versatile`) down on 16 August 2026 and names `openai/gpt-oss-120b` as its replacement; OpenAI retires `gpt-4o-mini` on 14 January 2027, with `gpt-6-luna` as the replacement.

The messages are in OpenAI's format: a list of dicts, each with a `role` (`system`, `user`, `assistant` or `tool`) and a `content`. LiteLLM translates them into each provider's own format, for example Anthropic's separate system prompt, and translates the reply back.

## Model strings

A model string is `provider/model`. `get_llm_provider` shows how LiteLLM reads one, without calling anything:

```python title="Notebook cell"
for name in ["gpt-4o-mini", "groq/openai/gpt-oss-120b", "claude-haiku-4-5-20251001",
             "gemini/gemini-3.8-flash", "ollama/qwen3.5"]:
    model, provider, _, _ = litellm.get_llm_provider(name)
    print(f"{name:28} -> {provider:10} {model}")
```

```output real
gpt-4o-mini                  -> openai     gpt-4o-mini
groq/openai/gpt-oss-120b     -> groq       openai/gpt-oss-120b
claude-haiku-4-5-20251001    -> anthropic  claude-haiku-4-5-20251001
gemini/gemini-3.8-flash      -> gemini     gemini-3.8-flash
ollama/qwen3.5               -> ollama     qwen3.5
```

- OpenAI's and Anthropic's model names are known to LiteLLM, so they need no prefix (`openai/gpt-4o-mini` works too).
- Groq's model is itself called `openai/gpt-oss-120b`, because Groq serves OpenAI's open-weight model; the `groq/` prefix comes first and LiteLLM removes only that.
- `gemini/` is Google's Gemini API, the one AI Studio keys open; `vertex_ai/` is Gemini on Google Cloud.
- `ollama/` is a local model ([lesson 6.2](lesson:6.2)).

LangChain's `init_chat_model` writes the same idea as `provider:model` with a colon ([lesson 9.1](lesson:9.1)). A name LiteLLM can't place raises `BadRequestError: LLM Provider NOT provided` before any request is sent ([lesson 18.6](lesson:18.6) uses that on purpose).

## Try it without a key

`mock_response` makes `completion()` skip the provider and return the given text as a normal response:

```python title="Notebook cell"
response = completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Explain RAG in one sentence."}],
    mock_response="RAG retrieves relevant documents and adds them to the prompt before the model answers.",
)
print(type(response).__name__)
print(response.model)
print(response.choices[0].message.content)
print(response.usage.prompt_tokens, response.usage.completion_tokens)
```

```output real
ModelResponse
gpt-4o-mini
RAG retrieves relevant documents and adds them to the prompt before the model answers.
10 20
```

No key, no network, no cost, and the same object a real call returns, with placeholder token counts of 10 and 20. Tests use it, and so do this module's practice tasks. It can fake failures too: `mock_response="litellm.RateLimitError"` raises that error.

The response is a `ModelResponse` shaped like OpenAI's chat completion, whichever provider answered:

| Field | Holds |
|---|---|
| `choices[0].message.content` | The answer's text |
| `choices[0].finish_reason` | Why the model stopped: `stop`, `length` (the token limit), `tool_calls` |
| `model` | The model the provider says answered, often with a date: `gpt-4o-mini-2024-07-18` |
| `usage.prompt_tokens`, `usage.completion_tokens` | The tokens billed for the call ([lesson 18.3](lesson:18.3)) |

Code that reads responses therefore never changes when the model does. LangChain's `AIMessage` plays the same role in LangChain ([lesson 6.1](lesson:6.1)).

## Many providers, one loop

```python title="Notebook cell" norun
from litellm import completion

prompt = "Explain RAG in one sentence."

# Just a list of model strings: that's the only configuration
providers = [
    ("OpenAI",    "gpt-4o-mini"),
    ("Groq",      "groq/openai/gpt-oss-120b"),
    ("Anthropic", "claude-haiku-4-5-20251001"),
    ("Gemini",    "gemini/gemini-3.8-flash"),
]

# One loop, one function call, several providers
for label, model in providers:
    try:
        r = completion(model=model, messages=[{"role": "user", "content": prompt}])
        print(f"{label:<10}: {r.choices[0].message.content[:80]}")
    except Exception as e:
        print(f"{label:<10}: failed, {type(e).__name__}")
```

```output illustrative note="from a run with Llama 3.3 70B on Groq, no Anthropic key and a suspended Gemini key; answers vary per run"
OpenAI    : RAG, or Retrieval-Augmented Generation, is a model architecture that combines in
Groq      : RAG (Retrieve, Augment, Generate) is a type of artificial intelligence model tha
Anthropic : failed, BadRequestError
Gemini    : failed, BadRequestError
```

Three model names in that list have been replaced. Anthropic retired Claude 3.5 Haiku (`claude-3-5-haiku-20241022`) on 19 February 2026 and names `claude-haiku-4-5-20251001` as its replacement. Google has retired Gemini 1.5 Flash (`gemini/gemini-1.5-flash`) and every Flash model up to 2.5, and lists `gemini-3.8-flash` as the replacement for 2.5 Flash. The `try` matters: one failing provider prints a line instead of stopping the loop.

## One family of errors

LiteLLM turns each provider's errors into its own exception classes, which are subclasses of the OpenAI SDK's, so one `except` clause works for every provider:

| Exception | Usual cause | Worth retrying? |
|---|---|---|
| `AuthenticationError` | Missing or wrong key | No |
| `BadRequestError` | Bad parameters, or a model string LiteLLM can't place | No |
| `ContextWindowExceededError` | The prompt is longer than the model's context; a `BadRequestError` | Not on the same model |
| `NotFoundError` | No such model at that provider | No |
| `RateLimitError` | Too many requests or tokens per minute (HTTP 429) | Yes, after a pause |
| `Timeout`, `APIConnectionError` | The provider didn't answer in time, or couldn't be reached | Yes |
| `InternalServerError`, `ServiceUnavailableError` | The provider failed (HTTP 5xx) | Yes |

```python title="Notebook cell"
import openai

try:
    completion(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Hi"}],
        mock_response="litellm.RateLimitError",
    )
except litellm.RateLimitError as e:
    print(type(e).__name__, e.status_code, isinstance(e, openai.RateLimitError))
```

```output real
RateLimitError 429 True
```

The last column is the rule retries follow: errors that may pass on their own are worth another try, and errors in the request or the key fail the same way every time.

## Fall back to another model

```python title="Notebook cell" norun
from litellm import completion

# A fallback chain: try Gemini first, then GPT, then Groq
response = completion(
    model="gemini/gemini-3.8-flash",
    messages=[{"role": "user", "content": "What is an LLM Gateway?"}],
    fallbacks=[
        "gpt-4o-mini",
        "groq/openai/gpt-oss-120b"
    ]
)

print("Response:", response.choices[0].message.content[:200], "...")
print("\nWhich model actually answered?", response.model)
```

```output illustrative note="from a run in which the Gemini call failed with a 403 (the account's key was suspended); log trimmed"
LiteLLM:ERROR: fallback_utils.py:68 - Fallback attempt failed for model gemini/gemini-3.8-flash: litellm.BadRequestError: GeminiException BadRequestError - {"error": {"code": 403, "message": "Permission denied: Consumer has been suspended.", "status": "PERMISSION_DENIED", ...}}
Traceback (most recent call last):
  ...
Response: An LLM Gateway typically refers to a system or interface that facilitates interaction with a Large Language Model (LLM). These gateways serve as a bridge between users (or applications) and the LLM, a ...

Which model actually answered? gpt-4o-mini-2024-07-18
```

`fallbacks` lists the models to try after the first one, in order. The Gemini call failed, LiteLLM logged the failure and asked `gpt-4o-mini`, which answered; the program saw only the answer, and `response.model` tells you who wrote it.

Forcing a failure is the reliable way to test a fallback chain:

```python title="Notebook cell" norun
from litellm import completion

# Force the primary to fail by using a fake model name,
# then watch the fallback chain rescue the call
response = completion(
    model="openai/fake-nonexistent-model-9999",     # will fail on purpose
    messages=[{"role": "user", "content": "What is an LLM Gateway?"}],
    fallbacks=[
        "gpt-4o-mini",                              # 1st backup: a real OpenAI model
        "groq/openai/gpt-oss-120b"                  # 2nd backup: Groq
    ]
)

print("App still got a response, even though the primary failed!")
print(f"\nModel that actually answered: {response.model}")
print(f"\nResponse: {response.choices[0].message.content[:200]}...")
```

```output saved note="traceback trimmed; emojis removed; answers vary per run"
20:31:20 - LiteLLM:ERROR: fallback_utils.py:68 - Fallback attempt failed for model openai/fake-nonexistent-model-9999: litellm.NotFoundError: OpenAIException - The model `fake-nonexistent-model-9999` does not exist or you do not have access to it.
Traceback (most recent call last):
  ...
App still got a response, even though the primary failed!

Model that actually answered: gpt-4o-mini-2024-07-18

Response: An LLM (Large Language Model) Gateway typically refers to an interface or platform that facilitates access to large language models like GPT-3, GPT-4, or other advanced natural language processing mod...
```

The `openai/` prefix sends any name to OpenAI, which answered 404 (`NotFoundError`), so the first backup took over. How fallbacks work in LiteLLM 1.105:

- The model and its fallbacks are tried in order, and the first answer is returned. Each failure is logged at `ERROR` level with its traceback, which is why the setup's `ERROR` level still shows them; `logging.CRITICAL` hides them.
- A fallback can be a dict with settings of its own, such as another key or a shorter timeout: `{"model": "gpt-4o-mini", "timeout": 10}`.
- The chain runs on LiteLLM's async code even when you call `completion()`; that is where the `Unclosed connector` warnings some runs print come from.
- The response's `_hidden_params["additional_headers"]["x-litellm-attempted-fallbacks"]` counts the fallbacks it took (practice 1). The leading underscore marks LiteLLM's internals: handy, but they can change.
- When every model fails, the error raised is an `APIConnectionError` that carries the last failure's message and ends with "All fallback attempts failed" (practice 2).

Two settings belong with fallbacks. `num_retries=2` tries the same model again after errors worth retrying, before moving down the list. `timeout=30` caps each attempt in seconds, so a provider that hangs costs half a minute instead of minutes. [Lesson 18.4](lesson:18.4) sets both on a Router, together with fallbacks between aliases.

## Interview questions

::: check
Your app falls back from OpenAI to another provider during outages. What can go wrong even when every request gets an answer?

The backup model answers differently: style, length, and how well it follows the prompt, which was tuned on the first model. It may not support the tools, JSON mode or context length the app relies on, and it may reject parameters such as a non-default temperature. The request's data now goes to a second provider, which privacy contracts may not allow, and the price per token changes. Test the prompts on every model in the chain, log which model answered, and alert when the fallback rate rises.
:::

::: check
Which errors would you retry, and which should go straight to a fallback or to the user?

Retry the ones that may pass on their own: rate limits (429), timeouts, connection errors and server errors (5xx), with backoff. Don't retry authentication errors, bad requests or unknown models: they fail the same way every time. A fallback model can still help with some of them, for example a model with a larger context window after `ContextWindowExceededError`, while a wrong key needs a person.
:::

::: check
How do you know which model answered a request, and why does it matter?

`response.model` names it, as the provider reports it, and LiteLLM's response headers count the fallbacks taken. It matters for debugging (an odd answer may come from the backup), for cost (models differ in price), for quality tracking per model, and for noticing outages that fallbacks hide: if nobody logs the answering model, a provider can be down for days without anyone knowing.
:::

## Practice

::: practice
**Test a fallback chain without a key.** Make the first model raise a rate-limit error and the first fallback a server error, so that only the second fallback answers. Print who answered and how many fallbacks it took.

```python title="Notebook cell"
logging.getLogger("LiteLLM").setLevel(logging.CRITICAL)   # hide the fallback tracebacks

response = completion(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What is an LLM gateway?"}],
    mock_response="litellm.RateLimitError",
    fallbacks=[
        {"model": "claude-haiku-4-5-20251001", "mock_response": "litellm.InternalServerError"},
        {"model": "groq/openai/gpt-oss-120b", "mock_response": "One entry point in front of many model providers."},
    ],
)
print(response.model)
print(response.choices[0].message.content)
print(response._hidden_params["additional_headers"])
```

```output real
openai/gpt-oss-120b
One entry point in front of many model providers.
{'x-litellm-attempted-fallbacks': 2}
```

Each dict replaces the settings of the call for that attempt, here its `mock_response`, so one call tests the whole chain. `response.model` is the model's name at its provider, without LiteLLM's `groq/` prefix.
:::

::: practice
**When every model fails.** Make the model and its only fallback both fail, and catch what comes out. Is it a `RateLimitError`?

```python title="Notebook cell"
try:
    completion(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Hi"}],
        mock_response="litellm.RateLimitError",
        fallbacks=[{"model": "groq/openai/gpt-oss-120b", "mock_response": "litellm.InternalServerError"}],
    )
except litellm.RateLimitError:
    print("rate limited")
except Exception as e:
    print(type(e).__name__)
    print(str(e).splitlines()[0])   # the message's first line; the rest is a traceback
```

```output real
APIConnectionError
litellm.APIConnectionError: litellm.InternalServerError: this is a mock internal server error. All fallback attempts failed. Enable verbose logging with `litellm.set_verbose=True` for details.
```

It isn't: the chain wraps the last failure in an `APIConnectionError`, so the first model's rate limit is gone from the type and only the last message survives. After fallbacks, catch broadly, log the whole message and show the user a friendly error.
:::

## Further reading

- LiteLLM, [providers](https://docs.litellm.ai/docs/providers): every provider's model strings, keys and settings.
- LiteLLM, [mock requests](https://docs.litellm.ai/docs/completion/mock_requests): `mock_response` and the errors it can fake.
- LiteLLM, [input parameters](https://docs.litellm.ai/docs/completion/input): everything `completion()` accepts, `fallbacks`, `num_retries` and `timeout` included.
