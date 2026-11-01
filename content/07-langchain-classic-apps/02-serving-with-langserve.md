+++
number = "7.2"
title = "Serving a chain with LangServe"
lede = "Put a chain behind a web API so any program can use it. LangServe turns a runnable into REST endpoints with one call; a few lines of FastAPI do the same by hand."
summary = "Serve the translation chain with FastAPI and LangServe, see the endpoints and schemas it creates, call it with requests and from a Streamlit page, write the same endpoint in plain FastAPI, and learn what a production API around a model needs."
type = "build"
status = "published"
source = "6 Building Basic LLM APP using LCEL: serve.py (model changed), client.py (fixed: JSON body, the user's text, the output only); plain FastAPI version, endpoint checks and production notes added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["GROQ_API_KEY"]
+++

A chain in a notebook helps one person. To use it from a web page, a mobile app or another service, put it behind an HTTP API. The server holds the provider's key, so no client ever sees it; every request passes through one place where you can log, limit, cache or switch the model; and any language that speaks HTTP can call it. LangServe, from the LangChain team, does this with one function: `add_routes` turns any runnable into a set of REST endpoints on a FastAPI app. It now receives bug fixes only, so each step also shows the same endpoint written with FastAPI alone.

## The server

Both versions serve the translation chain of [lesson 7.1](lesson:7.1) and need the packages that lesson adds.

:::: tabs
::: tab LangServe
```python title="serve.py"
from fastapi import FastAPI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq
import os
from langserve import add_routes
from dotenv import load_dotenv
load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")
model = ChatGroq(model="openai/gpt-oss-20b", groq_api_key=groq_api_key)

# 1. Create prompt template
system_template = "Translate the following into {language}:"
prompt_template = ChatPromptTemplate.from_messages([
    ("system", system_template),
    ("user", "{text}")
])

parser = StrOutputParser()

## create chain
chain = prompt_template | model | parser


## App definition
app = FastAPI(title="Langchain Server",
              version="1.0",
              description="A simple API server using Langchain runnable interfaces")

## Adding chain routes
add_routes(
    app,
    chain,
    path="/chain"
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

`FastAPI(...)` creates the web app; its title, version and description appear on the docs page it generates. `add_routes(app, chain, path="/chain")` adds the chain's endpoints under `/chain`. `uvicorn` is the server that runs the app. `host="127.0.0.1"` accepts connections from this computer only; `0.0.0.0` would open the API to the network, which then needs authentication.
:::
::: tab FastAPI only
```python title="serve.py" norun
from dotenv import load_dotenv
from fastapi import FastAPI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from pydantic import BaseModel

load_dotenv()

model = ChatGroq(model="openai/gpt-oss-20b")
prompt_template = ChatPromptTemplate.from_messages(
    [("system", "Translate the following into {language}:"), ("user", "{text}")]
)
chain = prompt_template | model | StrOutputParser()

app = FastAPI(title="Langchain Server", version="1.0")


class TranslateRequest(BaseModel):
    language: str
    text: str


@app.post("/translate")
async def translate(request: TranslateRequest) -> dict:
    return {"output": await chain.ainvoke(request.model_dump())}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

FastAPI reads the JSON body into `TranslateRequest` and answers anything else with a 422 error, the validation of [lesson 4.2](lesson:4.2). The endpoint is `async` and awaits `chain.ainvoke`, so the server keeps answering other requests while the model works ([5.2](lesson:5.2), section 12). This is LangServe's `/invoke` in miniature; batching or streaming would each be one more endpoint like it.
:::
::::

## Start it

```zsh title="Terminal" server port="8000"
python serve.py
```

```output illustrative note="the process ID differs; with FastAPI only, the LANGSERVE lines are missing"
INFO:     Started server process [41208]
INFO:     Waiting for application startup.

     __          ___      .__   __.   _______      _______. _______ .______     ____    ____  _______
    |  |        /   \     |  \ |  |  /  _____|    /       ||   ____||   _  \    \   \  /   / |   ____|
    |  |       /  ^  \    |   \|  | |  |  __     |   (----`|  |__   |  |_)  |    \   \/   /  |  |__
    |  |      /  /_\  \   |  . `  | |  | |_ |     \   \    |   __|  |      /      \      /   |   __|
    |  `----./  _____  \  |  |\   | |  |__| | .----)   |   |  |____ |  |\  \----.  \    /    |  |____
    |_______/__/     \__\ |__| \__|  \______| |_______/    |_______|| _| `._____|   \__/     |_______|

LANGSERVE: Playground for chain "/chain/" is live at:
LANGSERVE:  │
LANGSERVE:  └──> /chain/playground/
LANGSERVE:
LANGSERVE: See all available routes at /docs/
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

The server keeps running in this terminal until you press Ctrl+C. In a browser, http://127.0.0.1:8000/docs lists every endpoint and lets you try them, and http://127.0.0.1:8000/chain/playground/ is a page where you type a language and a text and watch the answer stream in. The address `/` itself returns 404: LangServe defines no home page.

## The endpoints

`add_routes` turns the Runnable interface ([lesson 7.1](lesson:7.1)) into endpoints:

| Endpoint | Runnable method | What it does |
|---|---|---|
| `POST /chain/invoke` | `invoke` | One input, one output |
| `POST /chain/batch` | `batch` | A list of inputs, a list of outputs |
| `POST /chain/stream` | `stream` | The output in pieces, as server-sent events |
| `POST /chain/stream_log`, `/chain/stream_events` | `astream_log`, `astream_events` | The intermediate steps too |
| `GET /chain/input_schema`, `/output_schema`, `/config_schema` | `input_schema`, ... | JSON schemas of what the chain takes and returns |
| `GET /chain/playground/` | - | A page to try the chain |
| `GET /docs` | - | FastAPI's interactive documentation |

The schemas come from the chain itself, so they work without calling the model:

```python title="Notebook cell"
import requests

requests.get("http://127.0.0.1:8000/chain/input_schema").json()
```

```output real
{'properties': {'language': {'title': 'Language', 'type': 'string'},
  'text': {'title': 'Text', 'type': 'string'}},
 'required': ['language', 'text'],
 'title': 'PromptInput',
 'type': 'object'}
```

```python title="Notebook cell"
requests.get("http://127.0.0.1:8000/chain/output_schema").json()
```

```output real
{'title': 'StrOutputParserOutput', 'type': 'string'}
```

## Call it from Python

:::: tabs
::: tab LangServe
```python title="Notebook cell" norun
response = requests.post(
    "http://127.0.0.1:8000/chain/invoke",
    json={"input": {"language": "French", "text": "Hi"}},
)
response.json()
```

```output illustrative note="the answer and the run ID vary"
{'output': 'Salut !',
 'metadata': {'run_id': '6f1c2a9e-4b7d-4e0a-9c35-2d8f1b7e5a40',
  'feedback_tokens': []}}
```

The body wraps the chain's input in `input`; an optional `config` carries settings such as `configurable` ([lesson 7.1](lesson:7.1)). The reply holds the chain's output and the run's ID, the one a LangSmith trace shows. `/chain/batch` takes `{"inputs": [...]}` and returns a list under `output`.

Input that doesn't match the schema never reaches the model:

```python title="Notebook cell"
response = requests.post(
    "http://127.0.0.1:8000/chain/invoke",
    json={"input": {"language": "French"}},
)
response.status_code, response.json()
```

```output real
(422,
 {'detail': [{'type': 'missing',
    'loc': ['text'],
    'msg': 'Field required',
    'input': {'language': 'French'},
    'url': 'https://errors.pydantic.dev/2.14/v/missing'}]})
```

`/chain/stream` sends the answer as server-sent events (SSE), a standard way for a server to push text through one open HTTP response:

```python title="Notebook cell" norun
with requests.post(
    "http://127.0.0.1:8000/chain/stream",
    json={"input": {"language": "French", "text": "Good morning, how was your weekend?"}},
    stream=True,
) as response:
    for line in response.iter_lines(decode_unicode=True):
        if line:
            print(line)
```

```output illustrative note="the pieces and the run ID vary"
event: metadata
data: {"run_id": "0b8e4f7a-1c2d-4e5f-8a9b-3c4d5e6f7a8b"}
event: data
data: "Bon"
event: data
data: "jour"
event: data
data: ", comment"
event: data
data: " s'est passé votre week-end ?"
event: end
```

First a `metadata` event, then one `data` event per piece of the answer, then `end`. Browsers read such a stream with `EventSource`; LangServe's `RemoteRunnable` class wraps all the endpoints as a runnable for Python clients.
:::
::: tab FastAPI only
```python title="Notebook cell" norun
response = requests.post(
    "http://127.0.0.1:8000/translate",
    json={"language": "French", "text": "Hi"},
)
response.json()
```

```output illustrative note="the answer varies"
{'output': 'Salut !'}
```

The body holds the request model's fields, and the reply is whatever the function returns. A missing field gets a 422 error, as with LangServe.
:::
::::

## A web page for it

The Streamlit page from [lesson 3.12](lesson:3.12) can call the API. The page needs no key and no LangChain: it only sends HTTP requests.

```python title="client.py"
import requests
import streamlit as st


def get_groq_response(input_text):
    json_body = {
        "input": {
            "language": "French",
            "text": input_text,
        },
        "config": {},
        "kwargs": {},
    }
    response = requests.post("http://127.0.0.1:8000/chain/invoke", json=json_body)
    return response.json()["output"]


## Streamlit app
st.title("LLM Application Using LCEL")
input_text = st.text_input("Enter the text you want to convert to french")

if input_text:
    st.write(get_groq_response(input_text))
```

```zsh title="Terminal" norun
streamlit run client.py
```

Run it in a second terminal while the server runs; the page opens in the browser and shows the translation of what you type. Two details in `get_groq_response` matter. `json=json_body` sends the dict as JSON, while passing it as the second argument, `requests.post(url, json_body)`, sends it as form fields, which the server rejects:

```python title="Notebook cell"
json_body = {"input": {"language": "French", "text": "Hi"}, "config": {}, "kwargs": {}}
response = requests.post("http://127.0.0.1:8000/chain/invoke", json_body)
response.status_code, response.json()
```

```output real
(422, {'detail': ['Invalid JSON body']})
```

And the function returns `response.json()["output"]`, the translation alone, instead of the whole reply with its metadata. `config` and `kwargs` may be left out of the body.

## LangServe today

LangServe works with current LangChain releases, but its maintainers accept only bug fixes and point new projects to LangChain's deployment platform for LangGraph applications, now called LangSmith Deployment (LangGraph Platform in LangServe's README; [lesson 12.2](lesson:12.2)). It still suits a simple chain or a quick demo; the FastAPI version above does the same job with one dependency less.

## What a production API adds

| Concern | What to do |
|---|---|
| Authentication | Require a key or a login token on every route (FastAPI dependencies); never expose an open endpoint that spends your model budget |
| Browsers | A page on another domain needs CORS headers (`CORSMiddleware`) to call the API |
| Slow or failing providers | Time limits on model calls; retries for temporary errors (`with_retry`, [lesson 7.1](lesson:7.1)); a fallback model ([lesson 18.2](lesson:18.2)) |
| Cost | Per-user rate limits, a cap on output tokens, a cache for repeated requests |
| Waiting | Stream the answer (`/stream`) so the first words appear at once |
| Many users | Async endpoints and several worker processes |
| State | Keep the server stateless: chat histories go to a database, keyed by user and conversation ([lesson 7.3](lesson:7.3)) |
| Debugging | Trace every run ([lesson 12.1](lesson:12.1)) and log errors with the run ID |

## Interview questions

::: check
Why put the model behind your own API instead of calling the provider straight from the browser or the mobile app?

The provider key would ship inside the client, where anyone can extract it and spend your budget. Your own API keeps the key on the server and gives you one place to check who is calling, enforce rate limits, log and trace requests, cache answers, validate input, and change the model or the prompt without updating every client.
:::

::: check
Users wait eight seconds before anything appears on the page. What do you change?

Stream the answer: the endpoint returns tokens as server-sent events as the model produces them (LangServe's `/stream`, or a FastAPI `StreamingResponse` over `chain.astream`), and the page appends them as they arrive. The total time stays the same, but the first words appear in under a second. Then shorten the prompt and the expected answer, and pick a faster model if the time to the first token is still too long.
:::

::: check
Your API answers one request at a time under load. What do you check first?

Whether the endpoints block. A synchronous model call inside an `async def` endpoint holds up the event loop, so use `await chain.ainvoke(...)` (LangServe does) or plain `def` endpoints, which FastAPI runs on a thread pool. Then the number of worker processes, the provider's rate limits, and any shared state that forces requests to wait for each other.
:::

## Practice

::: practice
**Translate two texts in one request.** Call `/chain/batch` with `requests` to translate "Hello" into French and "Thank you" into German, and print the list of outputs.

```python title="Notebook cell" norun
response = requests.post(
    "http://127.0.0.1:8000/chain/batch",
    json={"inputs": [
        {"language": "French", "text": "Hello"},
        {"language": "German", "text": "Thank you"},
    ]},
)
response.json()["output"]
```

```output illustrative note="answers vary per run"
['Bonjour', 'Danke']
```

`/batch` runs the chain's `batch`, so the two translations run at the same time on the server.
:::

::: practice
**Serve a second chain.** Add a route `/summary` to the LangServe server with a chain that summarises a text in one sentence, restart the server, and call `/summary/invoke`.

```python title="serve.py (added before the if block)" norun
summary_prompt = ChatPromptTemplate.from_messages([
    ("system", "Summarise the user's text in one sentence."),
    ("user", "{text}"),
])
add_routes(app, summary_prompt | model | parser, path="/summary")
```

```python title="Notebook cell" norun
requests.post(
    "http://127.0.0.1:8000/summary/invoke",
    json={"input": {"text": "LangServe turns any runnable into REST endpoints on a FastAPI app: invoke, batch, stream, schemas and a playground."}},
).json()["output"]
```

```output illustrative note="answers vary per run"
'LangServe exposes any LangChain runnable as a set of REST endpoints on a FastAPI app.'
```

Each `add_routes` call adds one set of endpoints under its own path; the server prints a playground address for each.
:::
