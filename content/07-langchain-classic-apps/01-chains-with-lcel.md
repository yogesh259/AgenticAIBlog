+++
number = "7.1"
title = "Chains with LCEL"
lede = "LCEL, the LangChain Expression Language, builds chains out of runnables: components that all share one interface. See what `|` creates, how dicts and functions join a chain, and what every chain can do besides `invoke`."
summary = "Build a translation chain one runnable at a time, then learn the Runnable interface (invoke, batch, stream, async, schemas, config), the three shapes of composition (sequence, parallel, assign), a RAG chain written in LCEL, and when a chain is not enough."
type = "concept"
status = "published"
source = "6 Building Basic LLM APP using LCEL: simplellmLCEL.ipynb (model changed); 4 Langchain: 1.1-openai/1.1.2-Simpleapp.ipynb (cell 18, the retrieval chain's structure); Runnable interface, composition examples and the LCEL RAG chain added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

[Lesson 6.1](lesson:6.1) joined a prompt, a model and a parser with `|` and called the result like a model. Real applications need more than three steps in a row: a RAG chain sends the question to a retriever and, unchanged, to the prompt; an app runs two prompts on the same input at once, streams the answer to a web page, or serves the chain as an API. LCEL, the LangChain Expression Language, is how LangChain's classic API builds all of these. Every component (prompt, model, parser, retriever, even a plain Python function) is a *runnable* with the same small interface, and `|`, dicts and functions combine runnables into bigger runnables with that same interface. Three shapes cover everything this module builds:

::: visual lcel-shapes | Figure | Three ways to join runnables
Sequence, parallel and assign, each with the value going in and coming out.
:::

## Install the packages

This module adds four lines to `requirements.txt` ([lesson 6.1](lesson:6.1) has the rest); run your install command again ([lesson 0.1](lesson:0.1)). They serve a chain as a web API in [lesson 7.2](lesson:7.2).

```text title="requirements.txt"
fastapi
uvicorn
langserve
sse-starlette
```

LangServe needs `sse-starlette` to start but installs it only through its `[server]` extra, which pins an old version that LangGraph's tools later conflict with; listing it on its own avoids the pin. Check the spelling of `uvicorn` too: pip stops at a misspelled name, or worse, installs a look-alike package someone published under it.

## Choose a model

Load the keys from `.env` ([lesson 0.3](lesson:0.3)), then create a chat model. The examples use Groq; any provider from [lesson 6.1](lesson:6.1) works the same.

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

:::: tabs
::: tab Groq
```python title="Notebook cell"
import os
from langchain_groq import ChatGroq

groq_api_key = os.getenv("GROQ_API_KEY")
model = ChatGroq(model="openai/gpt-oss-20b", groq_api_key=groq_api_key)
```

`openai/gpt-oss-20b` is a small, fast open model on Groq; older tutorials use `gemma2-9b-it` or `llama-3.1-8b-instant`, which Groq has retired. It reasons before it answers, and LangChain keeps that reasoning out of `content` ([lesson 9.1](lesson:9.1)). `ChatGroq` also finds `GROQ_API_KEY` by itself, so `groq_api_key=` is optional. Never end a cell with the key's variable: the notebook would display the key and save it in the file.
:::
::: tab Gemini
```python title="Notebook cell" norun
from langchain_google_genai import ChatGoogleGenerativeAI

model = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
```

Reads `GOOGLE_API_KEY`. Gemini 3 models return `content` as a list of blocks; `StrOutputParser` and `.text` turn it into a string.
:::
::: tab OpenAI
```python title="Notebook cell" norun
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o")
```

Reads `OPENAI_API_KEY`. OpenAI retires `gpt-4o` on 14 January 2027; its replacement is `gpt-6-luna`.
:::
::: tab Ollama
```python title="Notebook cell" norun
from langchain_ollama import ChatOllama

model = ChatOllama(model="qwen3.5")
```

Runs on your machine with no key ([lesson 6.2](lesson:6.2)).
:::
::::

## The translation chain, step by step

The first chain translates English into another language. Build it one runnable at a time and try each one on its own.

```python title="Notebook cell" norun
from langchain_core.messages import HumanMessage, SystemMessage

messages = [
    SystemMessage(content="Translate the following from English to French"),
    HumanMessage(content="Hello How are you?"),
]

result = model.invoke(messages)
result
```

```output saved note="from a run with Groq's retired Gemma 2 model; answers vary per run"
AIMessage(content='Bonjour, comment allez-vous ? \n', response_metadata={'token_usage': {'completion_tokens': 11, 'prompt_tokens': 26, 'total_tokens': 37, 'completion_time': 0.022, 'prompt_time': 0.003249601, 'queue_time': None, 'total_time': 0.025249601}, 'model_name': 'Gemma2-9b-It', 'system_fingerprint': 'fp_e238d2cf52', 'finish_reason': 'stop', 'logprobs': None}, id='run-88f30adf-3746-488d-ad12-13bf16f1d259-0', usage_metadata={'input_tokens': 26, 'output_tokens': 11, 'total_tokens': 37})
```

The model takes a list of messages and returns an `AIMessage` ([lesson 6.1](lesson:6.1) explains its fields).

```python title="Notebook cell" norun
from langchain_core.output_parsers import StrOutputParser

parser = StrOutputParser()
parser.invoke(result)
```

```output saved
'Bonjour, comment allez-vous ? \n'
```

The parser is a runnable too, so it can run on its own, fed with the model's output. That is how chains are debugged: run the steps one by one and look at each value.

```python title="Notebook cell" norun
### Using LCEL - chain the components
chain = model | parser
chain.invoke(messages)
```

```output saved
'Bonjour, comment allez-vous ? \n'
```

A chain takes what its first step takes: here a list of messages. A prompt template in front lets it take the language and the text instead:

```python title="Notebook cell"
### Prompt Templates
from langchain_core.prompts import ChatPromptTemplate

generic_template = "Translate the following into {language}:"

prompt = ChatPromptTemplate.from_messages(
    [("system", generic_template), ("user", "{text}")]
)
```

```python title="Notebook cell"
result = prompt.invoke({"language": "French", "text": "Hello"})
result.to_messages()
```

```output real
[SystemMessage(content='Translate the following into French:', additional_kwargs={}, response_metadata={}),
 HumanMessage(content='Hello', additional_kwargs={}, response_metadata={})]
```

`prompt.invoke` returns a `ChatPromptValue`; `to_messages()` shows the messages inside it, `to_string()` the same as plain text.

```python title="Notebook cell" norun
## Chaining together components with LCEL
chain = prompt | model | parser
chain.invoke({"language": "French", "text": "Hello"})
```

```output saved note="from a run with Groq's retired Gemma 2 model"
'Bonjour \n'
```

This is the chain [lesson 7.2](lesson:7.2) serves as a web API.

## What every runnable can do

Prompts, models, parsers, retrievers and whole chains share one interface, `Runnable`. Each method takes the input the runnable takes:

| Method | What it does |
|---|---|
| `invoke(input)` | One input, one output |
| `batch([input, ...])` | Several inputs at once on a thread pool, outputs in the same order; `config={"max_concurrency": 2}` caps how many run together |
| `stream(input)` | Yields the output in pieces while it is produced |
| `ainvoke`, `abatch`, `astream` | The same for `async` code ([5.2](lesson:5.2), section 12), such as a web server |
| `input_schema`, `output_schema` | Pydantic models of what goes in and what comes out |
| `with_retry()`, `with_fallbacks([...])` | A copy that retries on errors, or tries other runnables when it fails ([lesson 18.6](lesson:18.6)) |

The prompt alone shows two of them without a model call:

```python title="Notebook cell"
for value in prompt.batch(
    [{"language": "French", "text": "Hello"}, {"language": "Hindi", "text": "Hello"}]
):
    print(value.to_messages()[0].content)
```

```output real
Translate the following into French:
Translate the following into Hindi:
```

```python title="Notebook cell"
prompt.input_schema.model_json_schema()
```

```output real
{'properties': {'language': {'title': 'Language', 'type': 'string'},
  'text': {'title': 'Text', 'type': 'string'}},
 'required': ['language', 'text'],
 'title': 'PromptInput',
 'type': 'object'}
```

A chain's input schema is its first step's and its output schema its last step's: the translation chain takes a dict with `language` and `text` and returns a string. A web API built from the chain checks every request against them ([lesson 7.2](lesson:7.2)). With the model, the same methods work on the whole chain:

```python title="Notebook cell" norun
chain.batch(
    [{"language": "French", "text": "Good morning"}, {"language": "Hindi", "text": "Good morning"}]
)
```

```output illustrative note="answers vary per run"
['Bonjour', 'सुप्रभात']
```

```python title="Notebook cell" norun
for chunk in chain.stream({"language": "French", "text": "Good morning, how was your weekend?"}):
    print(chunk, end="|", flush=True)
```

```output illustrative note="the pieces and the answer vary per run"
Bon|jour|,| comment| s'est| passé| votre| week|-end| ?|
```

The model sends its answer in pieces as it writes, and `StrOutputParser` passes each piece on as it arrives, so the whole chain streams.

## What `|` builds

`a | b` calls `a.__or__(b)` ([lesson 2.5](lesson:2.5)) and returns a `RunnableSequence` that runs `a`, then `b` on `a`'s output. Two other things can stand in a chain, and LCEL converts them for you: a function becomes a `RunnableLambda`, and a dict becomes a `RunnableParallel`, which gives every value the same input and returns their results as a dict. The cell below builds the three shapes of the figure above from two plain functions:

```python title="Notebook cell"
from operator import itemgetter

from langchain_core.runnables import RunnableLambda, RunnableParallel, RunnablePassthrough


def upper(text: str) -> str:
    return text.upper()


def count(text: str) -> int:
    return len(text.split())


sequence = RunnableLambda(upper) | count
parallel = RunnableParallel(upper=upper, words=count)
assign = RunnablePassthrough.assign(words=itemgetter("text") | RunnableLambda(count))

print(sequence.invoke("hi there"))
print(parallel.invoke("hi there"))
print(assign.invoke({"text": "hi there"}))
```

```output real
2
{'upper': 'HI THERE', 'words': 2}
{'text': 'hi there', 'words': 2}
```

- `RunnableLambda(upper) | count`: once one side is a runnable, `|` wraps the plain function on the other side. Two plain functions can't be joined: Python functions have no `|`.
- `RunnableParallel(upper=..., words=...)` is the explicit form of `{"upper": upper, "words": count}`. Its branches run at the same time.
- `RunnablePassthrough.assign(key=runnable)` takes a dict, runs the runnable on it and returns the same dict with the new key; given an existing key, it replaces that key's value. `itemgetter("text")` picks one key out of the dict first ([lesson 5.1](lesson:5.1), section 11), the pattern [lesson 7.4](lesson:7.4) uses to shorten a chat history inside a chain.

A dict with `RunnablePassthrough()` turns a plain string into the dict a prompt needs. `RunnablePassthrough()` returns its input unchanged:

```python title="Notebook cell"
to_french = {"text": RunnablePassthrough(), "language": lambda _: "French"} | prompt
to_french.invoke("Good morning").to_messages()
```

```output real
[SystemMessage(content='Translate the following into French:', additional_kwargs={}, response_metadata={}),
 HumanMessage(content='Good morning', additional_kwargs={}, response_metadata={})]
```

```python title="Notebook cell"
print(type(to_french).__name__, [type(step).__name__ for step in to_french.steps])
```

```output real
RunnableSequence ['RunnableParallel', 'ChatPromptTemplate']
```

The dict became a `RunnableParallel`, and inside it the `lambda` became a `RunnableLambda`. With the model, the same shape runs two chains at once, so two model calls take about as long as the slower one:

```python title="Notebook cell" norun
two_languages = RunnableParallel(
    french=(lambda text: {"language": "French", "text": text}) | prompt | model | parser,
    hindi=(lambda text: {"language": "Hindi", "text": text}) | prompt | model | parser,
)
two_languages.invoke("Good morning")
```

```output illustrative note="answers vary per run"
{'french': 'Bonjour', 'hindi': 'सुप्रभात'}
```

`lambda ... | prompt` works because the prompt, on the right, wraps the function on the left: when the left side has no `|` for it, Python asks the right side's `__ror__` ([5.2](lesson:5.2), section 17).

### Settings for the whole chain

`invoke`, `batch` and `stream` take a second argument, `config`: a dict that reaches every step of the chain. LangChain reads `tags`, `metadata` and `callbacks` for tracing ([lesson 12.1](lesson:12.1)) and `max_concurrency` for batches; `configurable` holds your own settings. A function receives it when it has a parameter named `config`:

```python title="Notebook cell"
def show_session(value, config):
    return f"{value} (session {config['configurable']['session_id']})"


tagged = RunnablePassthrough() | show_session
tagged.invoke("Hello", config={"configurable": {"session_id": "chat1"}, "tags": ["demo"]})
```

```output real
'Hello (session chat1)'
```

[Lesson 7.3](lesson:7.3)'s chat history finds its conversation this way, and so does LangGraph's memory ([lesson 11.5](lesson:11.5)).

## A RAG chain in LCEL

[Lesson 6.8](lesson:6.8) built its RAG app from two ready-made chains. Written in LCEL, the same pipeline shows every step. It reuses that lesson's `retriever` (FAISS over `attention.pdf`) and the model above:

```python title="Notebook cell" norun
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

rag_prompt = ChatPromptTemplate.from_template(
    """Answer the question using only the context below.
If the context does not contain the answer, say you don't know.

<context>
{context}
</context>

Question: {input}"""
)


def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)


rag_chain = (
    {"context": retriever | format_docs, "input": RunnablePassthrough()}
    | rag_prompt
    | model
    | StrOutputParser()
)
rag_chain.invoke("What is multi-head attention?")
```

```output illustrative note="answers vary per run"
'Multi-head attention runs several attention functions in parallel, each on its own learned projection of the queries, keys and values, and concatenates their outputs, so the model can attend to information from different representation subspaces at different positions. The Transformer uses 8 heads.'
```

::: visual lcel-rag-flow | Run player | One question through an LCEL chain
Follow the question down both branches of the dict and into the prompt.
:::

`create_retrieval_chain` builds the same pipeline from two `assign` steps, so its result keeps the question and the documents next to the answer. Printing the chain from [lesson 6.8](lesson:6.8) shows it:

```python title="Notebook cell" norun
retrieval_chain = create_retrieval_chain(retriever, document_chain)
retrieval_chain
```

```output saved note="from a run with OpenAI models; the prompt and model details are shortened"
RunnableBinding(bound=RunnableAssign(mapper={
  context: RunnableBinding(bound=RunnableLambda(lambda x: x['input'])
           | VectorStoreRetriever(tags=['FAISS', 'OpenAIEmbeddings'], vectorstore=<langchain_community.vectorstores.faiss.FAISS object at 0x0000023EF4D513F0>), config={'run_name': 'retrieve_documents'})
})
| RunnableAssign(mapper={
    answer: RunnableBinding(bound=RunnableBinding(bound=RunnableAssign(mapper={
              context: RunnableLambda(format_docs)
            }), config={'run_name': 'format_inputs'})
            | ChatPromptTemplate(input_variables=['context'], [...])
            | ChatOpenAI([...], model_name='gpt-4o')
            | StrOutputParser(), config={'run_name': 'stuff_documents_chain'})
  }), config={'run_name': 'retrieval_chain'})
```

Read it from the inside out. The first `RunnableAssign` adds `context`: it takes `input` out of the dict and sends it to the retriever. The second adds `answer`, from the stuff chain, which starts with an `assign` of its own that replaces the documents with their joined text (`format_docs`). `RunnableBinding(..., config={'run_name': ...})` only names a step for traces.

## When a chain is not enough

A chain runs its steps in one direction, once. Anything that loops or decides is beyond it:

| Need | LCEL chain | LangGraph |
|---|---|---|
| Fixed steps, with parallel branches | Yes | Yes |
| Choosing the next step from a model's output | Only simple branches (`RunnableBranch`) | Conditional edges ([lesson 10.2](lesson:10.2)) |
| Loops: retry until a check passes, call tools until done | No | Yes |
| State that many steps read and update | A dict passed along | A typed state ([lesson 10.2](lesson:10.2)) |
| Pausing for a person and resuming later | No | Interrupts and checkpoints ([lesson 14.3](lesson:14.3)) |

Classic LangChain built its agents on LCEL; LangChain 1.0 builds them on LangGraph ([lesson 9.4](lesson:9.4)). Chains remain the way to write the straight-line parts, such as a RAG chain inside a graph's node ([lesson 15.3](lesson:15.3)).

## Interview questions

::: check
What does `prompt | model | parser` create, and what does it give you that three function calls in a row don't?

A `RunnableSequence`, itself a runnable. The whole chain gets `invoke`, `batch` (inputs run concurrently), `stream` (pieces flow through the parser) and the async versions, input and output schemas that tools such as LangServe use to serve and validate it, and a `config` that reaches every step, so a tracer records one run with a child run per step. With plain function calls you would write each of those yourself.
:::

::: check
You need a summary and a list of keywords for the same document, each from its own prompt. How do you get both with one call, and how long does it take?

Put both chains in a dict or a `RunnableParallel`: `{"summary": summary_prompt | model | parser, "keywords": keywords_prompt | model | parser}`. Both branches receive the document and run concurrently (threads for `invoke`, the event loop for `ainvoke`), so the call takes about as long as the slower branch, not the sum. The result is a dict with both keys.
:::

::: check
What is the difference between `RunnablePassthrough()` and `RunnablePassthrough.assign(...)`?

`RunnablePassthrough()` returns its input unchanged, whatever it is; it forwards the original input next to other branches, as the question in a RAG chain. `assign` needs a dict and returns the same dict plus keys computed from it, replacing a key that already exists. Chains use it to collect values step by step: `create_retrieval_chain` adds `context`, then `answer`.
:::

::: check
A chain streams token by token until you add a Python function after the model; then the whole answer arrives at once. Why, and how do you fix it?

A plain function becomes a `RunnableLambda`, which needs its complete input, so LCEL collects the streamed pieces into the finished output before calling it, and nothing after it can stream. Write the step as a generator that takes the stream and yields transformed pieces (`def step(chunks): for chunk in chunks: yield ...`), which LCEL wraps in a `RunnableGenerator` that streams; or do the work in an output parser, or before the model.
:::

::: check
When would you replace an LCEL chain with a LangGraph graph?

When the flow needs loops (an agent calling tools until it is done, retrying until a grader passes), routing between several steps based on intermediate results, state shared by many steps, persistence, or a human approval in the middle of a run. A chain describes a fixed pipeline that runs once from start to end; keep such pipelines as chains, possibly inside a graph's nodes.
:::

## Practice

::: practice
**Three views of one text.** Build one `RunnableParallel` that returns a text's word count, the text in upper case, and its words in reverse order, and run it on "LCEL joins runnables". No model needed.

```python title="Notebook cell"
views = RunnableParallel(
    words=lambda text: len(text.split()),
    upper=str.upper,
    reversed=lambda text: " ".join(reversed(text.split())),
)
views.invoke("LCEL joins runnables")
```

```output real
{'words': 3,
 'upper': 'LCEL JOINS RUNNABLES',
 'reversed': 'runnables joins LCEL'}
```

Each keyword argument is one branch; functions, `lambda`s and built-in methods such as `str.upper` all become runnables.
:::

::: practice
**Tell the model the length.** Write a prompt whose system message reads "Translate the following {words}-word text into {language}:", put a `RunnablePassthrough.assign` in front that computes `words` from `text`, and print the messages for "See you tomorrow" in French. No model needed.

```python title="Notebook cell"
counted_prompt = ChatPromptTemplate.from_messages(
    [("system", "Translate the following {words}-word text into {language}:"), ("user", "{text}")]
)
counted = RunnablePassthrough.assign(words=lambda d: len(d["text"].split())) | counted_prompt
counted.invoke({"language": "French", "text": "See you tomorrow"}).to_messages()
```

```output real
[SystemMessage(content='Translate the following 3-word text into French:', additional_kwargs={}, response_metadata={}),
 HumanMessage(content='See you tomorrow', additional_kwargs={}, response_metadata={})]
```

The caller still passes only `language` and `text`; `assign` adds the third value the prompt needs.
:::

::: practice
**Translate a list, two at a time.** Translate "Thank you" into French, German and Hindi with one `batch` call on the translation chain, at most two requests at a time.

```python title="Notebook cell" norun
chain.batch(
    [{"language": language, "text": "Thank you"} for language in ["French", "German", "Hindi"]],
    config={"max_concurrency": 2},
)
```

```output illustrative note="answers vary per run"
['Merci', 'Danke', 'धन्यवाद']
```

`max_concurrency` keeps a batch under a provider's rate limit; the outputs come back in the order of the inputs.
:::
