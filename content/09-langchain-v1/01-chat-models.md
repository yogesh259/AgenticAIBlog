+++
number = "9.1"
title = "Chat models in LangChain v1"
lede = "LangChain 1.0 rebuilt the library around agents. Start with the part every agent needs: a chat model, created for any provider by one function, then streamed and batched."
summary = "What changed in LangChain v1 and the parts of an agent, init_chat_model and its model strings, OpenAI, Gemini and Groq models side by side, reasoning models and their hidden tokens, streaming, batching, and how to choose a model for an agent."
type = "concept"
status = "published"
source = "9 LangChain Updated: 1-langchainintro.ipynb (cell 2), 2-modelintegration.ipynb (retired Gemini 2.5 and Qwen 3 models replaced); the v1 overview, model strings, reasoning tokens, model choice and interview questions added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Modules [06](module:06) and [07](module:07) used LangChain's classic API, which joins prompts, models and parsers into chains. Most new LLM applications are agents instead: a model that calls tools in a loop until a task is done ([lesson 8.1](lesson:8.1)). LangChain 1.0 rebuilt its main package around that idea. An agent is created by one function, `create_agent`, runs on LangGraph, and is customised with middleware; the older chains moved to a separate package. This module builds an agent from its parts, one lesson each, then puts them together in one script. The first part is the model.

## What changed in version 1

| | Classic API (modules 06–07) | LangChain 1.x (this module) |
|---|---|---|
| Main building block | Chains: runnables joined with `\|` | Agents: `create_agent(model, tools, ...)` |
| What runs it | The chain itself, step after step | A LangGraph graph: model and tool steps in a loop |
| Customising it | Writing another chain | Middleware: your code before and after each step |
| A model's reply | `content`, shaped differently by each provider | The same, plus `content_blocks` in one shape for every provider |
| The `langchain` package | Chains, retrievers, agents, everything | Agents, messages, tools and models; the old chains live in `langchain-classic` |

Chat models, messages, prompt templates and tools come from `langchain-core` and the provider packages in both versions, so [lesson 6.1](lesson:6.1)'s models work unchanged. What is new is how they are put together. An agent has six parts, and each lesson of this module covers one or two:

::: visual agent-parts | Figure | An agent's parts
One `create_agent` call, each argument beside the part it adds and the lesson that teaches it.
:::

## Install the packages

Nothing to add: [lesson 6.1](lesson:6.1)'s `requirements.txt` already has `langchain` and the OpenAI, Gemini and Groq packages, and `langchain` brings LangGraph with it.

```python title="Notebook cell"
import langchain
langchain.__version__
```

```output real
'1.4.7'
```

Any 1.x version runs this module's code.

## Load the keys

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

`load_dotenv()` makes the keys in `.env` available ([lesson 0.3](lesson:0.3)): `OPENAI_API_KEY`, `GOOGLE_API_KEY` or `GROQ_API_KEY`. You need only the key of the provider you pick below.

## One function for every provider

`init_chat_model` creates a chat model from a string. Each tab shows it beside the provider's own class, which creates the same kind of object:

:::: tabs
::: tab OpenAI
```python title="Notebook cell"
from langchain.chat_models import init_chat_model

model = init_chat_model("gpt-4.1")
model
```

```output real note="memory addresses differ per run"
ChatOpenAI(metadata={'lc_versions': {'langchain-core': '1.7.3', 'langchain': '1.4.7', 'langchain-openai': '1.7.3'}}, profile={'name': 'GPT-4.1', 'release_date': '2025-04-14', 'last_updated': '2025-04-14', 'open_weights': False, 'max_input_tokens': 1047576, 'max_output_tokens': 32768, 'text_inputs': True, 'image_inputs': True, 'audio_inputs': False, 'pdf_inputs': True, 'video_inputs': False, 'text_outputs': True, 'image_outputs': False, 'audio_outputs': False, 'video_outputs': False, 'reasoning_output': False, 'tool_calling': True, 'structured_output': True, 'attachment': True, 'temperature': True, 'image_url_inputs': True, 'pdf_tool_message': True, 'image_tool_message': True, 'tool_choice': True, 'tool_call_streaming': True, 'mid_conversation_system_messages': True, 'mid_conversation_tools': False}, client=<openai.resources.chat.completions.completions.Completions object at 0x000002460BD76B10>, async_client=<openai.resources.chat.completions.completions.AsyncCompletions object at 0x000002460BEB7F50>, root_client=<openai.OpenAI object at 0x000002460BCAA7B0>, root_async_client=<openai.AsyncOpenAI object at 0x000002460BC61850>, model_name='gpt-4.1', model_kwargs={}, openai_api_key=SecretStr('**********'), stream_usage=True, stream_chunk_timeout=120.0)
```

The model holds its settings, a `profile` of what it can do ([lesson 9.5](lesson:9.5)), the SDK's clients and the key, shown masked. Creating it sends nothing; a request goes out on `invoke`:

```python title="Notebook cell" norun
## invoke the model
response = model.invoke("Hello How are you?")
response
```

```output saved note="metadata trimmed; answers vary per run"
AIMessage(content="Hello! I'm just a program, but I'm here and ready to help you. How can I assist you today?", additional_kwargs={'refusal': None}, response_metadata={'token_usage': {'completion_tokens': 23, 'prompt_tokens': 12, 'total_tokens': 35, ...}, 'model_provider': 'openai', 'model_name': 'gpt-4.1-2025-04-14', 'finish_reason': 'stop', ...}, id='lc_run--63ef5e39-a9a4-46dd-9d3e-72f243d4f183-0', usage_metadata={'input_tokens': 12, 'output_tokens': 23, 'total_tokens': 35, ...})
```

```python title="Notebook cell" norun
### ChatOpenAI
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4.1")
response = model.invoke("Hello How are you?")
response.content
```

```output saved note="answers vary per run"
'Hello! I’m just a computer program, so I don’t have feelings, but I’m here and ready to help you. How can I assist you today?'
```

[Lesson 6.1](lesson:6.1) explains the `AIMessage` fields. OpenAI retires `gpt-4.1` on 14 January 2027 and names `gpt-6-luna` as its replacement: change the name then.
:::
::: tab Gemini
```python title="Notebook cell" norun
from langchain.chat_models import init_chat_model

model = init_chat_model("google_genai:gemini-3.8-flash")
response = model.invoke("Why do parrots talk?")
response.text
```

```output saved note="from a run with Gemini 2.5 Flash, since retired; trimmed; answers vary per run"
'Parrots are fascinating creatures, and their ability to mimic human speech is one of their most captivating traits. It\'s a combination of unique biology, high intelligence, and strong social instincts.\n\nHere\'s a breakdown of why parrots talk:\n\n1.  **Unique Vocal Anatomy (The "How"):** [...]'
```

```python title="Notebook cell" norun
from langchain_google_genai import ChatGoogleGenerativeAI

model = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
response = model.invoke("Why do parrots talk?")
response.text
```

```output saved note="from a run with Gemini 2.5 Flash-Lite, since retired; trimmed; answers vary per run"
"Parrots talk for a fascinating mix of reasons, stemming from their **evolutionary adaptations, social needs, and cognitive abilities.** It's not just about mimicking sounds; there's a lot more going on beneath the surface. [...]"
```

Google retired Gemini 2.5 Flash and Flash-Lite in October 2026; the names above are the replacements it lists **VERIFY**. Gemini 3 models return `content` as a list of blocks, so read the answer with `.text` ([lesson 6.1](lesson:6.1)).
:::
::: tab Groq
```python title="Notebook cell" norun
from langchain.chat_models import init_chat_model

model = init_chat_model("groq:openai/gpt-oss-120b")
response = model.invoke("Why do parrots talk?")
response
```

```output saved note="from a run with Qwen 3 32B, since retired; trimmed; answers vary per run"
AIMessage(content="<think>\nOkay, so why do parrots talk? Let me think about this. I know parrots are known for mimicking human speech, but why? [...]\n</think>\n\nParrots talk for a combination of biological, social, and environmental reasons, reflecting their complex cognitive abilities and social nature. [...]", additional_kwargs={}, response_metadata={'model_name': 'qwen/qwen3-32b', 'finish_reason': 'stop', 'model_provider': 'groq', ...}, ...)
```

```python title="Notebook cell" norun
from langchain_groq import ChatGroq

model = ChatGroq(model="openai/gpt-oss-120b")
response = model.invoke("Why do parrots talk?")
response.text
```

Groq shut Qwen 3 32B down in July 2026 and names `openai/gpt-oss-120b` as its replacement. Both reason before they answer (below). Qwen wrote its reasoning into the answer between `<think>` tags; gpt-oss returns it separately, in `response.additional_kwargs["reasoning_content"]`, so `content` holds only the answer.
:::
::::

## Model strings

A model string is `"provider:model"`. For some names the provider can be left out, because `init_chat_model` infers it from the name:

```python title="Notebook cell"
for name in ["gpt-4.1", "google_genai:gemini-3.8-flash", "groq:openai/gpt-oss-120b"]:
    model = init_chat_model(name)
    print(f"{name:30} -> {type(model).__name__}")
```

```output real
gpt-4.1                        -> ChatOpenAI
google_genai:gemini-3.8-flash  -> ChatGoogleGenerativeAI
groq:openai/gpt-oss-120b       -> ChatGroq
```

```python title="Notebook cell"
for name in ["gemini-3.8-flash", "openai/gpt-oss-120b"]:
    try:
        init_chat_model(name)
    except (ImportError, ValueError) as error:
        print(f"{name}: {type(error).__name__}: {str(error).splitlines()[0]}")
```

```output real
DeprecationWarning: Inferred `model_provider='google_vertexai'` from 'gemini-3.8-flash'. This default will change to 'google_genai' in the next major release.To keep current behavior, pass `model_provider='google_vertexai'` (or use the prefix form, e.g. 'google_vertexai:gemini-3.8-flash'); for AI Studio / Gemini API, use 'google_genai' instead.
gemini-3.8-flash: ImportError: Initializing ChatVertexAI requires the langchain-google-vertexai package. Please install it with `pip install langchain-google-vertexai`
openai/gpt-oss-120b: ValueError: Unable to infer model provider for model='openai/gpt-oss-120b'. Please specify 'model_provider' directly.
```

| String | Provider | Class |
|---|---|---|
| `"gpt-4.1"`, `"gpt-5"` | OpenAI, inferred from `gpt-` | `ChatOpenAI` |
| `"google_genai:gemini-3.8-flash"` | Google's Gemini API, the one Google AI Studio keys open | `ChatGoogleGenerativeAI` |
| `"gemini-3.8-flash"` | Google Cloud's Vertex AI, until LangChain 2.0 makes it the Gemini API | `ChatVertexAI`, from another package |
| `"groq:openai/gpt-oss-120b"` | Groq; its model names need the prefix | `ChatGroq` |
| `"ollama:qwen3.5"` | A local Ollama model ([lesson 6.2](lesson:6.2)) | `ChatOllama` |

Settings follow the name as keywords, as in `init_chat_model("gpt-4.1", temperature=0)`. Because the model is just a string, it can come from a setting or an environment variable: switching providers changes no code (practice below).

## Reasoning models

Some models think before they answer: they write a hidden chain of reasoning, then the answer. `gpt-5`, gpt-oss and the Gemini 3 models do; `gpt-4.1` doesn't. The reasoning improves multi-step answers and tool choices, and it costs:

- **Tokens.** Reasoning is billed as output tokens even when you never see it. The agent in [lesson 9.4](lesson:9.4) used 88 output tokens for one tool call, 64 of them reasoning; `usage_metadata["output_token_details"]["reasoning"]` shows the split.
- **Time.** The first word of the answer arrives only after the reasoning is done.
- **Where it shows up.** Each provider returns it differently: hidden entirely, in `additional_kwargs["reasoning_content"]`, as `reasoning` blocks in `content_blocks` ([lesson 9.2](lesson:9.2)), or mixed into the text, as Qwen's `<think>` tags were.

## Stream the answer

`stream` returns the answer in pieces while the model writes it, so a reader sees the first words at once instead of waiting for the whole text:

```python title="Notebook cell" norun
model.invoke("Write me a 200 words paragraph on Artificial Intelligence")
```

```output saved note="from a run with Gemini 2.5 Flash, since retired; trimmed; answers vary per run"
AIMessage(content="Artificial Intelligence (AI) stands as a groundbreaking field dedicated to enabling machines to simulate human intelligence and cognitive functions. [...]", additional_kwargs={}, response_metadata={'finish_reason': 'STOP', 'model_name': 'gemini-2.5-flash', 'model_provider': 'google_genai', ...}, ...)
```

```python title="Notebook cell" norun
for chunk in model.stream("Write me a 200 words paragraph on Artificial Intelligence"):
    print(chunk.text, end="|", flush=True)
```

```output saved note="from a run with Gemini 2.5 Flash, since retired; trimmed; the chunks vary per run"
Artificial Intelligence (AI) represents the simulation of human intelligence processes by machines, especially computer systems. At its core, AI empowers systems to perceive their environment, learn from data, reason, solve problems, and even make decisions with minimal human intervention. This| sophisticated technology encompasses various subfields, including machine learning, deep learning, natural language processing, and computer vision, each contributing to its remarkable capabilities.

Today, AI is no longer a futuristic concept but an integral part of our daily lives and| industries. [...]
```

Each `chunk` is an `AIMessageChunk` holding the next piece of text; `end="|"` marks where one chunk ends and the next begins, and `flush=True` prints each piece as it arrives. Gemini sent a few long pieces; other providers send a word or two at a time. Chunks add up with `+` into one message ([lesson 7.1](lesson:7.1) shows `stream` on a whole chain; [lesson 2.7](lesson:2.7) explains generators).

## Send several prompts at once

```python title="Notebook cell" norun
responses = model.batch(
    [
        "Why do parrots have colorful feathers?",
        "How do airplanes fly?",
        "What is quantum computing?",
    ],
    config={"max_concurrency": 5},  # at most 5 calls at a time
)
for response in responses:
    print(response.text.split("\n")[0])
```

```output saved note="from a run with Gemini 2.5 Flash, since retired; first line of each answer; answers vary per run"
Parrots are renowned for their dazzling array of colors, and there isn't just one reason for this vibrant plumage. It's a combination of evolutionary pressures and biological mechanisms:
Airplanes fly by expertly manipulating four fundamental forces: **Lift, Weight, Thrust, and Drag.** For a plane to fly, it needs to generate enough lift to overcome its weight, and enough thrust to overcome drag.
**Quantum computing** is a new type of computing that harnesses the principles of quantum mechanics (the physics that governs matter at the atomic and subatomic levels) to perform calculations. Unlike traditional computers, which store information as bits that can be either a 0 or a 1, quantum computers use **qubits**, which can exist in multiple states simultaneously.
```

`batch` sends each prompt as its own request, several at a time on a pool of threads, and returns the answers in the same order; `max_concurrency` caps how many run together, which keeps you under a provider's rate limit. It saves time, not money: every prompt is billed as a separate call. Providers that offer cheaper bulk processing do it through their own batch APIs, which `batch` doesn't use.

## Choosing a model for an agent

An agent calls its model many times per task, so the choice matters more than for a single answer:

| Question | Why it matters for an agent |
|---|---|
| Does it call tools reliably? | Every step of the loop is a tool decision; weak tool use means wrong calls and wasted steps |
| Does it support structured output? | Typed answers and some agent features depend on it ([lesson 9.5](lesson:9.5)) |
| How large is its context window? | The conversation, tool results and instructions all have to fit, and they grow with each step |
| How fast and how expensive is it? | Cost and latency multiply by the number of steps; reasoning tokens add to both |
| Hosted or open? | A hosted model is simplest; open models (on Groq, or local with Ollama) keep data in-house or cut cost |

A common pattern is a strong model for the main loop and a small, cheap one for side jobs such as summarising the conversation ([lesson 9.6](lesson:9.6)).

## Interview questions

::: check
Your team wants to move from OpenAI to Gemini without changing code. How do you prepare for it?

Read the model string from configuration and create the model with `init_chat_model`, so a deployment setting picks the provider. Code that reads replies through `.text` and `content_blocks` instead of provider-specific fields keeps working. Then re-run your evaluation set on the new model: prompts, tool calling and structured output behave differently between providers, so the switch is a test, not just a config change.
:::

::: check
After moving from `gpt-4.1` to `gpt-5`, the answers are shorter but the bill went up. Why?

`gpt-5` is a reasoning model: it writes hidden reasoning before each answer, and those tokens are billed as output. Check `usage_metadata["output_token_details"]["reasoning"]`. Use a lower reasoning effort, or a non-reasoning model for simple steps such as summaries and routing.
:::

::: check
When do you stream, and when do you batch?

Stream when a person is waiting: the first words appear at once, though the total time is the same. Batch when many independent inputs are processed without anyone watching, such as tagging a thousand tickets: requests run in parallel, capped by `max_concurrency` to stay under rate limits. Neither reduces the tokens you pay for.
:::

## Practice

::: practice
**Pick the model from a setting.** Write `get_model()` that reads a model string from the `MODEL` environment variable, with `"google_genai:gemini-3.5-flash-lite"` as the default, and creates it with `temperature=0`. Print the class and model name for the default and for `MODEL="groq:openai/gpt-oss-120b"`. No request is sent, so no answer is needed, only the keys in your `.env`.

```python title="Notebook cell"
import os

from langchain.chat_models import init_chat_model


def get_model():
    return init_chat_model(os.getenv("MODEL", "google_genai:gemini-3.5-flash-lite"), temperature=0)


for setting in [None, "groq:openai/gpt-oss-120b"]:
    if setting:
        os.environ["MODEL"] = setting
    model = get_model()
    print(type(model).__name__, getattr(model, "model_name", None) or model.model)
```

```output real
ChatGoogleGenerativeAI gemini-3.5-flash-lite
ChatGroq openai/gpt-oss-120b
```

The providers' classes name the model differently (`model_name`, `model`), which is why the line asks for either. In an application the setting comes from `.env` or the deployment, and nothing else changes.
:::

::: practice
**Count the chunks.** Stream an answer to "Explain what an AI agent is in two sentences.", keep every chunk in a list, then print how many chunks arrived and the full text, joined with `+`.

```python title="Notebook cell" norun
chunks = list(model.stream("Explain what an AI agent is in two sentences."))
full = chunks[0]
for chunk in chunks[1:]:
    full = full + chunk
print(len(chunks), "chunks")
print(full.text)
```

```output illustrative note="the number of chunks and the answer vary per run and provider"
14 chunks
An AI agent is a program that uses a language model to decide which actions to take, such as calling tools or searching data, to reach a goal. It repeats this loop of deciding and acting until the task is done.
```

Adding two `AIMessageChunk`s joins their text and merges their metadata, so the sum is one message, like the one `invoke` would have returned.
:::

## Further reading

- LangChain, [What's new in LangChain v1](https://docs.langchain.com/oss/python/releases/langchain-v1): `create_agent`, standard content blocks and the slimmer `langchain` package.
- LangChain, [Models](https://docs.langchain.com/oss/python/langchain/models): `init_chat_model`, its parameters, streaming and batching.
- Groq, [Reasoning](https://console.groq.com/docs/reasoning): how reasoning models return their reasoning, model by model.
