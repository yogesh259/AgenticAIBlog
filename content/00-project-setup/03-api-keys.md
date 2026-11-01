+++
number = "0.3"
title = "API keys in a .env file"
lede = "Keep API keys out of your code: store them in a .env file and load them with python-dotenv."
summary = "Keep keys out of your code: store them once in `.env` and load them safely in every script and notebook."
type = "build"
status = "published"
source = "1 Setup"
chips = [["i-layers", "Concept + code"], ["i-key", "python-dotenv 1.2"]]
+++

Providers such as OpenAI and Groq identify you, and bill you, by an API key. Anyone who has your key can spend your money, so keep it out of code, notebooks and git: put it in a `.env` file and load it with python-dotenv.

## Put the keys in .env

Create `.env` in the project folder, one `NAME=value` per line, no quotes needed:

```bash title="my-agent/.env"
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```

Keep it out of git:

```text title="my-agent/.gitignore"
.venv
.env
```

To show others which keys the project needs, commit a copy named `.env.example` with the values left empty.

## Load them

```python title="Notebook cell"
from dotenv import load_dotenv
load_dotenv()
```

```output real
True
```

`load_dotenv()` looks for `.env` in the current folder, then in each parent folder, and copies its lines into the environment variables (`os.environ`). It returns `True` when it found a file with entries, `False` when it found nothing.

It never overwrites a variable that is already set: after editing `.env`, restart the kernel, or call `load_dotenv(override=True)`. To load another file: `load_dotenv("../environment.env")`.

## Use them

Libraries read their key from the environment by name, so it never appears in your code:

```python title="Notebook cell"
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")  # (1)
```

::: annots
1. Reads `OPENAI_API_KEY`. Without it: `OpenAIError: Missing credentials`. To pass a key yourself: `ChatOpenAI(model="gpt-4o", api_key=...)`.
:::

| Variable | Used by |
|---|---|
| `OPENAI_API_KEY` | OpenAI models and embeddings |
| `GROQ_API_KEY` | Groq models |
| `GOOGLE_API_KEY` | Google Gemini models |
| `ANTHROPIC_API_KEY` | Anthropic Claude models |
| `HF_TOKEN` | Hugging Face models and embeddings |
| `TAVILY_API_KEY` | Tavily web search |
| `PAGEINDEX_API_KEY` | PageIndex document search |
| `LANGSMITH_API_KEY` (older name: `LANGCHAIN_API_KEY`) | LangSmith tracing |

## Check a key without showing it

```python title="Notebook cell"
import os

for name in ["OPENAI_API_KEY", "GROQ_API_KEY"]:
    print(name, "set" if os.getenv(name) else "missing")
```

```output real
OPENAI_API_KEY set
GROQ_API_KEY missing
```

`os.getenv` returns `None` for a missing name. Never print a key itself, and don't end a cell with a variable that holds one: the notebook displays it and saves it in the file.

## The common first cell

Many LangChain notebooks start like this:

```python title="Notebook cell"
import os
from dotenv import load_dotenv
load_dotenv()

os.environ['OPENAI_API_KEY']=os.getenv("OPENAI_API_KEY")
## Langsmith Tracking
os.environ["LANGCHAIN_API_KEY"]=os.getenv("LANGCHAIN_API_KEY")
os.environ["LANGCHAIN_TRACING_V2"]="true"
os.environ["LANGCHAIN_PROJECT"]=os.getenv("LANGCHAIN_PROJECT")
```

```output real note="trimmed; raised at the first name missing from .env"
TypeError: str expected, not NoneType
```

The `os.environ[...] = os.getenv(...)` lines copy values that `load_dotenv()` has already set, and fail as above when a name is missing from `.env`: add the key, or delete the line. `LANGCHAIN_TRACING_V2` turns on LangSmith tracing ([lesson 12.1](lesson:12.1)).

If you ever commit a key, revoke it in the provider's dashboard and create a new one: git history keeps the deleted file.
