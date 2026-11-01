+++
number = "6.1"
title = "Chat models, prompts and chains"
lede = "LangChain is an open-source framework for building applications on language models. Start with the three pieces every app uses: a chat model, a prompt template and an output parser, joined into a chain."
summary = "Install the module's packages, pick a provider (Gemini, OpenAI, Groq or a local Ollama model), call its chat model, write prompt templates, and chain prompt, model and output parser."
type = "concept"
status = "published"
source = "4 Langchain: 1.1-openai/1.1.1-GettingStarted.ipynb; 5 OpenAI and Ollama: 1.1-openai/1.1.1-GettingStarted.ipynb (Gemini cell); 4-Embeddings/4.4-ollamaQwen.ipynb (ChatOllama); Groq added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Calling a language model is a single web request: send some text, get some text back. An application needs much more around that request. It builds prompts from user input and its own data, wants to switch between Gemini, OpenAI or a local model without rewriting code, turns replies into strings or structured data, searches documents, calls tools and remembers the conversation. Every provider ships its own SDK with its own conventions, so without help that glue code gets written again for each one.

LangChain is an open-source framework, in Python and JavaScript, that provides the glue as ready-made components with one shared interface. Every chat model, prompt template, output parser, retriever and tool has an `invoke` method, and any of them can be joined with `|` into a chain. Hundreds of integrations (model providers, databases, document sources, tools) follow the same interface, so swapping one for another is usually a one-line change.

## Where LangChain fits

LangChain is one of three projects from the same company, and this site covers all three:

| Project | What it does | Where |
|---|---|---|
| LangChain | Components (models, prompts, parsers, loaders, retrievers, tools), chains and agents | Modules [06](module:06), [07](module:07) and [09](module:09) |
| LangGraph | Agents and workflows as graphs of steps with shared state, loops and human review | Modules [10](module:10) to [15](module:15) |
| LangSmith | Traces of every call, evaluation and monitoring | Module [12](module:12) |

This lesson uses the three components every LLM app starts with. A **chat model** sends messages to a provider and returns the reply. A **prompt template** writes those messages from your values. An **output parser** turns the reply into the type your code needs, here a plain string. The sections below introduce them one at a time, then join them into a chain.

## Install the packages

Add these lines to `requirements.txt` and run your install command again ([lesson 0.1](lesson:0.1)). They cover the whole module:

```text title="requirements.txt"
langchain
langchain-classic
langchain-community
langchain-openai
langchain-google-genai
langchain-groq
langchain-ollama
langchain-text-splitters
langchain-chroma
langchain-huggingface
sentence-transformers<6
faiss-cpu
pypdf
pymupdf
arxiv<4
wikipedia
```

LangChain is split into packages, so an app installs only the integrations it uses:

| Package | What it holds |
|---|---|
| `langchain-core` | Messages, prompt templates, output parsers and the `\|` pipe; installed with any of the others |
| `langchain-google-genai`, `-openai`, `-groq`, `-ollama`, `-huggingface`, `-chroma` | One provider each: its chat models, embedding models or database |
| `langchain-text-splitters` | Text splitters ([lesson 6.5](lesson:6.5)) |
| `langchain-community` | Integrations without a package of their own, such as the document loaders and FAISS |
| `langchain-classic` | The chains from LangChain's versions before 1.0 ([lesson 6.8](lesson:6.8)) |
| `langchain` | Version 1: agents and middleware ([module 09](module:09)) |

The other lines are libraries those integrations call. Two are pinned: `ArxivLoader` still calls an `arxiv` function that version 4 removed, and `langchain-huggingface` supports `sentence-transformers` below 6.

## Load the keys

Each hosted provider reads its own key from `.env`: `GOOGLE_API_KEY` (from Google AI Studio, which has a free tier), `OPENAI_API_KEY` or `GROQ_API_KEY` (from the Groq console, also with a free tier) **VERIFY**. A local Ollama model needs none. You only need the key of the provider you pick below.

```python title="Notebook cell" norun
import os
from dotenv import load_dotenv
load_dotenv()

os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
## LangSmith tracking
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGCHAIN_PROJECT")
```

[Lesson 0.3](lesson:0.3) explains each line: `load_dotenv()` alone makes the keys in `.env` available, and the `os.environ[...]` lines fail when a key is missing. The last three lines send a trace of every call to LangSmith ([lesson 12.1](lesson:12.1)); leave them out until you have a LangSmith key. Later lessons start with `load_dotenv()` only.

## Messages and roles

A chat model reads a conversation: a list of messages, each with a role.

| Role | In LangChain | Holds |
|---|---|---|
| system | `SystemMessage`, or `("system", "...")` in a template | Instructions: who the model is and how to answer |
| user | `HumanMessage`, or `("user", "...")` | What the person asks |
| assistant | `AIMessage`, or `("assistant", "...")` | What the model answered; earlier replies give it the conversation so far |

A plain string, as in the next cell, is sent as one user message.

## Call a chat model

Pick a provider. The rest of the module works with any of them, and the site remembers your choice on later pages.

:::: tabs
::: tab Gemini
```python title="Notebook cell" norun
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
result = llm.invoke("What is unified memory?")
print(result.content)
```

```output saved note="answer and signature trimmed; answers vary per run"
[{'type': 'text', 'text': '**Unified Memory** is a computer memory architecture where the CPU (Central Processing Unit) and GPU (Graphics Processing Unit)—or other processing units—share a single, contiguous pool of memory. [...]', 'extras': {'signature': 'El4KXAERTTIP5+GKT9Gr7xRSeb1Iz8v7h0cckD...'}}]
```

Gemini 3 models return `content` as a list of blocks: here one text block, with a signature the model uses to continue its reasoning in a conversation. `result.text` joins the text blocks into one string. The model name is the one taught; Google retires older models regularly, so check its model list **VERIFY**.
:::
::: tab OpenAI
```python title="Notebook cell" norun
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")
result = llm.invoke("What is generative AI?")
print(result)
```

```output saved note="answer trimmed; answers vary per run"
content='Generative AI refers to a subset of artificial intelligence that focuses on creating new content, such as text, images, audio, or even code, that resembles human-generated data. [...]' response_metadata={'token_usage': {'completion_tokens': 351, 'prompt_tokens': 13, 'total_tokens': 364}, 'model_name': 'gpt-4o', 'system_fingerprint': 'fp_f4e629d0a5', 'finish_reason': 'stop', 'logprobs': None} id='run-797b6d80-6f17-4c55-90cd-26ee1824301c-0' usage_metadata={'input_tokens': 13, 'output_tokens': 351, 'total_tokens': 364}
```

`print(result)` shows every field of the `AIMessage` (table below). OpenAI retires `gpt-4o` on 14 January 2027 and names `gpt-6-luna` as its replacement: change the model name then.
:::
::: tab Groq
```python title="Notebook cell" norun
from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-120b")
result = llm.invoke("What is generative AI?")
print(result.content)
```

```output illustrative note="answers vary per run"
Generative AI is a type of artificial intelligence that creates new content, such as text, images, audio or code, by learning the patterns in the data it was trained on. [...]
```

Groq runs open models, such as OpenAI's gpt-oss and Alibaba's Qwen, on its own inference chips, which makes answers arrive very fast. It retires models often (its Llama models left the free and developer plans in August 2026): take a current name from Groq's model list.
:::
::: tab Ollama
```python title="Notebook cell" norun
from langchain_ollama import ChatOllama

llm = ChatOllama(model="qwen3.5", temperature=0)
result = llm.invoke("What is unified memory?")
print(result.content)
```

```output saved note="trimmed; from the same question, streamed; answers vary per run"
**Unified Memory** is a computer architecture design where the Central Processing Unit (CPU) and the Graphics Processing Unit (GPU) share a single, common pool of memory (RAM) rather than having separate memory pools. [...]
```

The model runs on your own machine, with no key and no cost per call. [Lesson 6.2](lesson:6.2) installs Ollama and downloads models.
:::
::::

Whichever provider answered, `invoke` sends one request and returns an `AIMessage`:

| Attribute | Holds |
|---|---|
| `content` | The answer: a string, or a list of blocks for some models |
| `text` | The answer as one string, for every provider |
| `response_metadata` | What the provider reported: model, token usage, why it stopped (`'stop'` = finished normally) |
| `usage_metadata` | Token counts in the same form for every provider |
| `id` | The run's ID, which LangSmith traces show |

## Write a prompt template

A prompt template is a list of messages with placeholders in braces:

```python title="Notebook cell"
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are an expert AI Engineer. Provide me answers based on the questions"),
        ("user", "{input}"),
    ]
)
prompt
```

```output real
ChatPromptTemplate(input_variables=['input'], input_types={}, partial_variables={}, messages=[SystemMessagePromptTemplate(prompt=PromptTemplate(input_variables=[], input_types={}, partial_variables={}, template='You are an expert AI Engineer. Provide me answers based on the questions'), additional_kwargs={}), HumanMessagePromptTemplate(prompt=PromptTemplate(input_variables=['input'], input_types={}, partial_variables={}, template='{input}'), additional_kwargs={})])
```

Each pair is a role and a template: `system` sets the model's behaviour, `user` is the person's message. `input_variables` lists the placeholders to fill. Filling them needs no model:

```python title="Notebook cell"
prompt.invoke({"input": "Can you tell me about Langsmith?"})
```

```output real
ChatPromptValue(messages=[SystemMessage(content='You are an expert AI Engineer. Provide me answers based on the questions', additional_kwargs={}, response_metadata={}), HumanMessage(content='Can you tell me about Langsmith?', additional_kwargs={}, response_metadata={})])
```

## Chain the prompt and the model

```python title="Notebook cell" norun
chain = prompt | llm

response = chain.invoke({"input": "Can you tell me about Langsmith?"})
print(response.text)
```

```output saved note="trimmed after the first two paragraphs; answers vary per run"
Certainly! Langsmith is a tool designed to enhance the development and debugging of applications that utilize large language models (LLMs) and AI chains. It offers several key features to streamline the development process:

1. **Logging and Tracing**: Langsmith provides robust logging and tracing capabilities, allowing developers to gain insights into the behavior of their LLM applications. This helps in understanding how data flows through the system and identifying any issues or bottlenecks.
[...]
```

`|` joins steps into one chain: `invoke` passes the dictionary to the prompt, and the prompt's messages to the model. The chain is used like a model (`invoke`, `stream`, `batch`) and returns what its last step returns, here an `AIMessage`:

```python title="Notebook cell" norun
type(response)
```

```output saved
langchain_core.messages.ai.AIMessage
```

The `|` works because LangChain's objects define `__or__`, the method behind the operator ([lesson 2.5](lesson:2.5)). [Module 07](module:07) builds longer chains.

## Add an output parser

```python title="Notebook cell" norun
from langchain_core.output_parsers import StrOutputParser

output_parser = StrOutputParser()
chain = prompt | llm | output_parser

response = chain.invoke({"input": "Can you tell me about Langsmith?"})
print(response)
```

```output saved note="answers vary per run"
Certainly! As of my knowledge cutoff date in October 2023, "Langsmith" does not directly correlate to any widely recognized technology, framework, or concept in the field of AI or software engineering. It's possible that it might be a term used within a specific company, a proprietary tool, or a recent development that hasn't gained widespread recognition.

However, if "Langsmith" is a term related to a specific context or a new product or service that emerged after my last update, I wouldn't have information on it. If you could provide more context or details, I'd be happy to help you understand the concept or direct you to the right resources!
```

`StrOutputParser` takes the `AIMessage` and returns its text, so the chain now returns a plain string. Each step's output is the next step's input:

| Step | Takes | Returns |
|---|---|---|
| `prompt` | a dict of variables | the filled messages |
| `llm` | messages | an `AIMessage` |
| `output_parser` | an `AIMessage` | a `str` |

Step through one call of this chain and watch the value change type at each block:

::: visual chain-flow | Run player | One call through a chain
Press Play to send a question through the prompt, the model and the parser.
:::

The two answers disagree. A model knows only its training data: the first run described a "Langsmith" with confident detail, the second said it had never heard of it. Neither knew LangSmith, LangChain's tracing service. [Lesson 6.3](lesson:6.3) shows how to fix that: give the model the documentation to answer from.

## Tokens, context and temperature

Models read and write tokens, pieces of words; in English a token is about four characters, so 1,000 tokens are roughly 750 words **VERIFY**. Four terms follow from that:

| Term | What it means | Where you meet it |
|---|---|---|
| Tokens | The units a model reads and writes; hosted models bill per token, input and output priced separately | `usage_metadata`: `input_tokens`, `output_tokens` |
| Context window | The most tokens one call can hold, prompt and answer together | Long documents don't fit; RAG sends only the relevant parts ([lesson 6.3](lesson:6.3)) |
| Temperature | How freely the model picks each next token: 0 takes the likeliest, higher values vary more | `ChatOpenAI(model=..., temperature=0)` |
| Knowledge cutoff | The date the training data ends; later facts are unknown, and the model may guess | The "Langsmith" answers above |

Every call is also a network request: it takes from a fraction of a second to many seconds, can fail or hit a rate limit, and costs money on a hosted model. An agent makes many calls per task, so these numbers add up ([module 09](module:09)).

## Practice

::: practice
**A translation prompt.** Build a prompt with a system message "Translate the user's text into {language}." and a user message "{text}". Print the messages it produces for French and "Good morning" without calling a model, then run the prompt through a chain with `llm` and `StrOutputParser()`.

```python title="Notebook cell"
translate = ChatPromptTemplate.from_messages(
    [
        ("system", "Translate the user's text into {language}."),
        ("user", "{text}"),
    ]
)
translate.invoke({"language": "French", "text": "Good morning"}).to_messages()
```

```output real
[SystemMessage(content="Translate the user's text into French.", additional_kwargs={}, response_metadata={}),
 HumanMessage(content='Good morning', additional_kwargs={}, response_metadata={})]
```

```python title="Notebook cell" norun
chain = translate | llm | StrOutputParser()
chain.invoke({"language": "French", "text": "Good morning"})
```

```output illustrative
'Bonjour'
```

Both placeholders must be filled: leaving one out raises a `KeyError` that names the missing variable.
:::
