+++
number = "5.2"
title = "Python for agentic AI code"
lede = "The Python that LangChain and LangGraph code leans on, on one page: hints and state, reducers and routes, prompts and JSON, decorators, streaming, async, errors and the small apps around a model."
summary = "The Python patterns agent code leans on: type hints, TypedDict state, reducers, Literal routes, decorators, streaming, async, JSON, retries, the | pipe, per-session chat history, the agent loop, middleware hooks, a graph runner, traces, fan-out and fan-in, checkpoints, grading with a fallback, nested trees and caching by key."
type = "concept"
status = "published"
source = "not from the course: patterns from the course's agent code (sections 9-18), modules 01-04, Python 3.12 docs"
chips = [["i-layers", "Reference + practice"], ["i-code", "Python 3.12"]]
+++

Each section below shows one pattern as a small cell with its output, a line on what to watch for, and links to the full lessons. The examples use plain Python with stand-ins for the model, so everything runs without an API key or an agent library. Practice tasks follow most sections: write your own solution first, then compare.

## 1. Type hints

```python title="Notebook cell"
from typing import Any, Literal


def get_weather(city: str, unit: Literal["celsius", "fahrenheit"] = "celsius") -> str:
    """Get the weather for a city."""
    return f"It's always sunny in {city}!"


config: dict[str, Any] = {"model": "gpt-4o-mini", "temperature": 0}
scores: list[float] = [0.9, 0.4]
answer: str | None = None                # the same as Optional[str]

print(get_weather("Paris"))
print(get_weather.__annotations__)
```

```output real
It's always sunny in Paris!
{'city': <class 'str'>, 'unit': typing.Literal['celsius', 'fahrenheit'], 'return': <class 'str'>}
```

Hints are never checked when the code runs; libraries read them. `@tool` builds a tool's schema from the hints and the docstring, so both matter. Lesson: [type hints](lesson:4.1).

## 2. TypedDict state and nodes

```python title="Notebook cell"
from typing import TypedDict


class State(TypedDict):
    topic: str
    draft: str


def write_draft(state: State) -> dict:          # a node: read the state, return an update
    return {"draft": f"A short poem about {state['topic']}"}


state: State = {"topic": "cats", "draft": ""}
update = write_draft(state)
state = {**state, **update}                      # what a graph does with keys that have no reducer
print(update)
print(state)
```

```output real
{'draft': 'A short poem about cats'}
{'topic': 'cats', 'draft': 'A short poem about cats'}
```

A `TypedDict` is a plain dict with declared keys, and nothing checks them. A node returns only the keys it changes, and the graph merges them into the state. Many examples import `TypedDict` from `typing_extensions`, a backport package; on Python 3.12 the `typing` version does the same job. Lessons: [dataclass, TypedDict or BaseModel](lesson:4.2), [graph state](lesson:10.2).

::: practice
**A node that counts.** Write a state with a `question`, an `answer` and a `steps` count, and a node `answer_question(state)` that returns a stand-in answer and `steps` increased by one. Apply the node twice to a state, merging each update, and print the state.

```python title="Notebook cell"
from typing import TypedDict


class QAState(TypedDict):
    question: str
    answer: str
    steps: int


def answer_question(state: QAState) -> dict:
    return {"answer": f"(answer to: {state['question']})", "steps": state["steps"] + 1}


state: QAState = {"question": "What is LangGraph?", "answer": "", "steps": 0}
for _ in range(2):
    state = {**state, **answer_question(state)}
print(state)
```

```output real
{'question': 'What is LangGraph?', 'answer': '(answer to: What is LangGraph?)', 'steps': 2}
```

The node never touches `question`, so the merge keeps it; `answer` and `steps` are replaced by each update.
:::

## 3. Reducers with Annotated

```python title="Notebook cell"
import operator
from typing import Annotated, TypedDict, get_type_hints


class State(TypedDict):
    topic: str                                   # no reducer: an update replaces it
    notes: Annotated[list[str], operator.add]    # reducer: updates are added on


def merge(state: dict, update: dict) -> dict:
    """A simplified version of how LangGraph applies an update."""
    hints = get_type_hints(State, include_extras=True)
    merged = dict(state)
    for key, value in update.items():
        reducer = getattr(hints[key], "__metadata__", [None])[0]
        merged[key] = reducer(state[key], value) if reducer else value
    return merged


state = {"topic": "cats", "notes": ["first"]}
state = merge(state, {"notes": ["second"]})
state = merge(state, {"topic": "dogs", "notes": ["third"]})
print(state)
```

```output real
{'topic': 'dogs', 'notes': ['first', 'second', 'third']}
```

`Annotated[type, extra]` attaches extra data to a hint. LangGraph looks there for a reducer: a function that combines the old value with an update. `operator.add` joins lists, so parallel workers can all append to one key; for chat history, `Annotated[list, add_messages]` appends new messages and replaces those with the same ID. Lesson: [reducers](lesson:10.3).

::: practice
**Your own reducer.** Write a reducer `keep_last_three(old, new)` that keeps only the last three messages, use it in a state's `messages` key, and merge five one-message updates into an empty state.

```python title="Notebook cell"
from typing import Annotated, TypedDict, get_type_hints


def keep_last_three(old: list[str], new: list[str]) -> list[str]:
    return (old + new)[-3:]


class ChatState(TypedDict):
    messages: Annotated[list[str], keep_last_three]


def merge(state: dict, update: dict) -> dict:
    hints = get_type_hints(ChatState, include_extras=True)
    merged = dict(state)
    for key, value in update.items():
        reducer = getattr(hints[key], "__metadata__", [None])[0]
        merged[key] = reducer(state[key], value) if reducer else value
    return merged


state = {"messages": []}
for text in ["hi", "hello", "how are you?", "fine", "bye"]:
    state = merge(state, {"messages": [text]})
print(state)
```

```output real
{'messages': ['how are you?', 'fine', 'bye']}
```

A reducer can be any function of the old value and the update; this one trims the history as it grows.
:::

## 4. Literal routes

```python title="Notebook cell"
from typing import Literal, get_args

Route = Literal["poem", "story", "joke"]


def route(state: dict) -> Route:                # a router returns the name of the next step
    if "rhyme" in state["request"]:
        return "poem"
    return "story" if len(state["request"]) > 20 else "joke"


nodes = {
    "poem": lambda state: "Roses are red...",
    "story": lambda state: "Once upon a time...",
    "joke": lambda state: "Why did the agent cross the road?",
}
for request in ["a rhyme about rain", "a tale of a dragon and a knight", "make me laugh"]:
    step = route({"request": request})
    print(f"{step:<6} {nodes[step]({})}")
print(get_args(Route))
```

```output real
poem   Roses are red...
story  Once upon a time...
joke   Why did the agent cross the road?
('poem', 'story', 'joke')
```

A routing function returns one name from a `Literal`, and the graph runs the node with that name; the hint lists every possible next step, which LangGraph also uses to draw the graph. `get_args` returns the values. Lessons: [Literal](lesson:4.1), [routing functions](lesson:10.2), [routing](lesson:13.3).

## 5. Dataclasses and Pydantic

```python title="Notebook cell"
from dataclasses import dataclass

from pydantic import BaseModel, Field, ValidationError


@dataclass
class Doc:                                       # a record: nothing is checked
    text: str
    score: float = 0.0


class Answer(BaseModel):                         # checked, and described for a model
    """An answer with its confidence."""

    text: str = Field(description="The answer")
    confidence: float = Field(ge=0, le=1, description="From 0 to 1")
    sources: list[str] = Field(default_factory=list)


print(Doc("hello", score="high"))                # the wrong type is kept
print(Answer(text="Paris", confidence="0.9"))    # "0.9" is converted
try:
    Answer(text="Paris", confidence=2)
except ValidationError as e:
    print(e.errors()[0]["msg"])
print(list(Answer.model_json_schema()["properties"]))
```

```output real
Doc(text='hello', score='high')
text='Paris' confidence=0.9 sources=[]
Input should be less than or equal to 1
['text', 'confidence', 'sources']
```

A default makes a field optional; `| None` lets it hold `None`. The docstring and the descriptions go into the schema a model fills in. Lessons: [dataclasses](lesson:4.1), [models](lesson:4.2), [fields and schema](lesson:4.3).

## 6. Dicts as messages and config

```python title="Notebook cell"
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hi, I'm Alice."},
]
messages.append({"role": "assistant", "content": "Hello Alice!"})
config = {"configurable": {"thread_id": "1"}}    # a nested dict passed with each call

state = {"topic": "cats", "count": 1}
print({**state, "count": state["count"] + 1})    # a copy with one key changed
print(state | {"lang": "en"})                    # a merged copy
print(config["configurable"]["thread_id"], config.get("tags", []))
print([m["role"] for m in messages])
```

```output real
{'topic': 'cats', 'count': 2}
{'topic': 'cats', 'count': 1, 'lang': 'en'}
1 []
['system', 'user', 'assistant']
```

Chat APIs take messages as a list of role and content dicts. A LangGraph `config` dict carries the `thread_id` that picks the conversation to continue. `{**d, ...}` and `d1 | d2` build new dicts and leave the old one as it was. Lessons: [dictionaries](lesson:1.11), [memory](lesson:11.5).

## 7. Text for prompts

```python title="Notebook cell"
import textwrap

docs = [
    {"text": "LangGraph builds agents as graphs.", "score": 0.91},
    {"text": "Bananas are rich in potassium.", "score": 0.12},
    {"text": "Nodes are Python functions.", "score": 0.78},
]
context = "\n\n".join(d["text"] for d in docs)   # many documents, one block of text

template = textwrap.dedent("""\
    Answer using only this context:
    {context}

    Question: {question}""")
print(template.format(context=context, question="What is LangGraph?"))
print(f"{{question}} stays a placeholder in an f-string; {len(docs)} docs")
```

```output real
Answer using only this context:
LangGraph builds agents as graphs.

Bananas are rich in potassium.

Nodes are Python functions.

Question: What is LangGraph?
{question} stays a placeholder in an f-string; 3 docs
```

`textwrap.dedent` removes the indentation that triple-quoted text picks up inside code, and the backslash after the opening quotes drops the first line break. A template keeps `{placeholders}` to fill later, as prompt templates do; in an f-string, double the braces to keep one. Lesson: [strings](lesson:1.3).

::: practice
**Build the context.** Rank the three `docs` above by score, keep the best two, and join them into a context string with one line per document, each starting with its score to two decimals.

```python title="Notebook cell"
docs = [
    {"text": "LangGraph builds agents as graphs.", "score": 0.91},
    {"text": "Bananas are rich in potassium.", "score": 0.12},
    {"text": "Nodes are Python functions.", "score": 0.78},
]
top = sorted(docs, key=lambda d: d["score"], reverse=True)[:2]
context = "\n".join(f"[{d['score']:.2f}] {d['text']}" for d in top)
print(context)
```

```output real
[0.91] LangGraph builds agents as graphs.
[0.78] Nodes are Python functions.
```

`sorted` with a `key` and `reverse=True` puts the best first and `[:2]` keeps two; `heapq.nlargest(2, docs, key=...)` does the same in one call ([cheat sheet](lesson:5.1), section 10).
:::

## 8. JSON

```python title="Notebook cell"
import json

reply = '```json\n{"city": "Paris", "temperature": 21}\n```'   # a model's reply, fenced
text = reply.strip().removeprefix("```json").removesuffix("```")
data = json.loads(text)
print(data["city"], data["temperature"] + 1)
print(json.dumps(data, indent=2))

try:
    json.loads('{"city": "Paris",}')
except json.JSONDecodeError as e:
    print("bad JSON:", e)
```

```output real
Paris 22
{
  "city": "Paris",
  "temperature": 21
}
bad JSON: Expecting property name enclosed in double quotes: line 1 column 18 (char 17)
```

`json.loads` turns text into dicts and lists, and `json.dumps` turns them back. Models sometimes wrap JSON in a Markdown fence or break it, so strip it and catch `json.JSONDecodeError`. With a Pydantic model, `Model.model_validate_json(text)` parses and checks in one step ([lesson 4.3](lesson:4.3)). Lesson: [json](lesson:1.16).

::: practice
**Parse a reply safely.** Write `parse_reply(text)` that removes an optional `` ```json `` fence, parses the JSON and returns the dict, or `None` when the JSON is broken. Try it on a fenced reply, a plain one and a broken one.

```python title="Notebook cell"
import json


def parse_reply(text: str) -> dict | None:
    text = text.strip().removeprefix("```json").removesuffix("```").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


print(parse_reply('```json\n{"answer": "yes"}\n```'))
print(parse_reply('{"answer": "no"}'))
print(parse_reply('{"answer": '))
```

```output real
{'answer': 'yes'}
{'answer': 'no'}
None
```

`removeprefix` and `removesuffix` change nothing when the text has no fence, so one function handles both kinds of reply.
:::

## 9. Decorators

```python title="Notebook cell"
import inspect


def tool(func):
    """A toy @tool: record what a model needs to know about the function."""
    func.schema = {
        "name": func.__name__,
        "description": inspect.getdoc(func),
        "args": {name: p.annotation.__name__ for name, p in inspect.signature(func).parameters.items()},
    }
    return func


@tool
def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"It's always sunny in {city}!"


print(get_weather.schema)
print(get_weather("Paris"))
```

```output real
{'name': 'get_weather', 'description': 'Get the weather for a city.', 'args': {'city': 'str'}}
It's always sunny in Paris!
```

A decorator receives the function and returns it, or a wrapper around it ([lesson 2.8](lesson:2.8)). LangChain's `@tool` reads the same three things, the name, the docstring and the hints, to describe the tool to a model ([lesson 9.3](lesson:9.3)): a vague docstring makes a tool the model won't pick.

::: practice
**Time every call.** Write a decorator `@timed` that prints how long the wrapped function took and returns its result, keeping the function's name with `functools.wraps`. Use it on a fake model that sleeps for 0.2 seconds.

```python title="Notebook cell"
import functools
import time


def timed(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.perf_counter() - start:.2f} s")
        return result
    return wrapper


@timed
def slow_model(prompt: str) -> str:
    time.sleep(0.2)
    return prompt.upper()


print(slow_model("hello"))
print(slow_model.__name__)
```

```output real note="the time varies"
slow_model took 0.20 s
HELLO
slow_model
```

Without `functools.wraps`, `slow_model.__name__` would be `'wrapper'`, and tools that read the name would see the wrong one.
:::

## 10. Context managers

```python title="Notebook cell"
import threading
import time
from contextlib import contextmanager


@contextmanager
def timer(label: str):
    start = time.perf_counter()
    try:
        yield                                    # the body of the with block runs here
    finally:
        print(f"{label}: {time.perf_counter() - start:.1f} s")


with timer("retrieval"):
    time.sleep(0.3)

lock = threading.Lock()
with lock:                                       # released at the end, even after an error
    print("one thread at a time")

with open("notes.txt", "w") as f:
    f.write("closed when the block ends")
print(f.closed)
```

```output real note="the time varies"
retrieval: 0.3 s
one thread at a time
True
```

`with` runs a setup, your block, then a cleanup, even when the block raises. `@contextmanager` builds one from a generator: the code before `yield` is the setup and the code after it the cleanup. Lessons: [files](lesson:1.17), [generators](lesson:2.7).

## 11. Generators and streaming

```python title="Notebook cell"
import time


def fake_stream(text: str):
    """Yield a reply word by word, as a streamed model call does."""
    for word in text.split():
        time.sleep(0.05)
        yield word + " "


chunks = []
for chunk in fake_stream("Streaming shows the answer while it is written."):
    print(chunk, end="|", flush=True)            # show each piece as soon as it arrives
    chunks.append(chunk)
print()
print("".join(chunks).strip())
```

```output real
Streaming |shows |the |answer |while |it |is |written. |
Streaming shows the answer while it is written.
```

A generator hands out one value at a time and pauses in between ([lesson 2.7](lesson:2.7)). A model's `stream(...)` works the same way: loop over it, print each chunk with `end=""` and `flush=True`, and join the chunks when you need the whole text ([lesson 9.1](lesson:9.1)).

::: practice
**Stop a stream early.** Take the first five words from a generator of words with `itertools.islice`, and print a line inside the generator for every word it makes. How many words does it make?

```python title="Notebook cell"
from itertools import islice


def words(text: str):
    for word in text.split():
        print(f"made {word!r}")
        yield word


print(list(islice(words("one two three four five six seven"), 5)))
```

```output real
made 'one'
made 'two'
made 'three'
made 'four'
made 'five'
['one', 'two', 'three', 'four', 'five']
```

Five: a generator runs only when asked for the next value, so stopping a stream also stops the work.
:::

## 12. async and await

```python title="async_calls.py"
import asyncio
import time


async def fake_llm(prompt: str, seconds: float) -> str:
    await asyncio.sleep(seconds)                 # waiting, like a network call
    return f"answer to {prompt!r}"


async def main():
    start = time.perf_counter()
    print(await fake_llm("one", 1))              # one call: wait for it
    answers = await asyncio.gather(              # three calls at once
        fake_llm("a", 1), fake_llm("b", 1), fake_llm("c", 1)
    )
    print(answers)
    print(f"{time.perf_counter() - start:.1f} s")


if __name__ == "__main__":
    asyncio.run(main())
```

```zsh title="Terminal"
python async_calls.py
```

```output real note="the time varies slightly"
answer to 'one'
["answer to 'a'", "answer to 'b'", "answer to 'c'"]
2.0 s
```

`async def` defines a coroutine; `await` pauses it until the result is ready, and the event loop runs other coroutines meanwhile. `asyncio.gather` runs several at once and returns their results in order: the run took two seconds, one for the first call and one for the three together. `asyncio.run(main())` starts the loop in a script; a notebook already runs one, so there you write `await main()` in a cell. LangChain's async methods are `ainvoke` and `astream`. For blocking functions with no async version, threads do the same job: `ThreadPoolExecutor().map` ([lesson 2.10](lesson:2.10)).

::: practice
**Fall back after a timeout.** Ask a slow fake model with `asyncio.wait_for(..., timeout=0.5)`; when it times out, ask a fast one instead, and print who answered. Run it as a script.

```python title="fallback.py"
import asyncio


async def fake_llm(name: str, seconds: float) -> str:
    await asyncio.sleep(seconds)
    return f"{name} answered"


async def ask_with_fallback() -> str:
    try:
        return await asyncio.wait_for(fake_llm("big model", 2), timeout=0.5)
    except TimeoutError:
        print("big model timed out")
        return await fake_llm("small model", 0.1)


if __name__ == "__main__":
    print(asyncio.run(ask_with_fallback()))
```

```zsh title="Terminal"
python fallback.py
```

```output real
big model timed out
small model answered
```

`wait_for` cancels the slow call after half a second and raises `TimeoutError`, which the `except` turns into a second try.
:::

## 13. Errors, fallbacks and retries

```python title="Notebook cell"
class GuardrailViolation(Exception):
    """Raised when a guardrail blocks a request."""


FORBIDDEN = ["hack", "exploit"]


def check_input(text: str) -> str:
    for word in FORBIDDEN:
        if word in text.lower():
            raise GuardrailViolation(f"This assistant doesn't discuss '{word}'.")
    return text


def call_with_fallbacks(models, prompt):
    """Try each model in order; return the first answer."""
    last_error = None
    for model in models:
        try:
            return model(prompt)
        except Exception as e:
            print(f"{model.__name__} failed ({type(e).__name__}), trying the next")
            last_error = e
    raise last_error


def flaky_model(prompt):
    raise ConnectionError("service unavailable")


def backup_model(prompt):
    return f"backup answer to {prompt!r}"


for text in ["How do I build a web app?", "How do I hack a server?"]:
    try:
        print(call_with_fallbacks([flaky_model, backup_model], check_input(text)))
    except GuardrailViolation as e:
        print("blocked:", e)
```

```output real
flaky_model failed (ConnectionError), trying the next
backup answer to 'How do I build a web app?'
blocked: This assistant doesn't discuss 'hack'.
```

An exception class of your own lets callers catch exactly that failure ([lesson 2.2](lesson:2.2)). `raise last_error` passes the last failure on when every model has failed ([lesson 1.19](lesson:1.19)). LLM gateways offer fallbacks like these ready-made ([lesson 18.2](lesson:18.2)).

::: practice
**Retry with backoff.** Write `retry(func, attempts=4, delay=0.1)` that calls `func()` and, on a `ConnectionError`, waits `delay` seconds, doubles it and tries again; after the last attempt it lets the error through. Test it with a function that fails twice, then succeeds.

```python title="Notebook cell"
import time


def retry(func, attempts=4, delay=0.1):
    for attempt in range(1, attempts + 1):
        try:
            return func()
        except ConnectionError as e:
            if attempt == attempts:
                raise
            print(f"attempt {attempt} failed ({e}); waiting {delay:.1f} s")
            time.sleep(delay)
            delay *= 2


calls = {"n": 0}


def flaky():
    calls["n"] += 1
    if calls["n"] < 3:
        raise ConnectionError("timeout")
    return "ok"


print(retry(flaky))
```

```output real
attempt 1 failed (timeout); waiting 0.1 s
attempt 2 failed (timeout); waiting 0.2 s
ok
```

A bare `raise` inside `except` re-raises the error being handled. Doubling the wait, called exponential backoff, gives a struggling service time to recover; real code often adds a little randomness too.
:::

## 14. Scripts and settings

```python title="Notebook cell"
import os
from pathlib import Path

model = os.getenv("MODEL_NAME", "gpt-4o-mini")   # a setting with a default
print(model)
print("set" if os.getenv("OPENAI_API_KEY") else "missing")   # never print the key itself

data = Path("data")
data.mkdir(exist_ok=True)
notes = data / "notes.txt"                       # / joins path parts
notes.write_text("first note\n")
print(notes.name, notes.suffix, notes.exists())
print(notes.read_text().strip())
```

```output real note="run without an OPENAI_API_KEY"
gpt-4o-mini
missing
notes.txt .txt True
first note
```

Keys and settings come from the environment, which `load_dotenv()` fills from a `.env` file ([lesson 0.3](lesson:0.3)). `pathlib.Path` joins paths with `/` and reads or writes a small file in one call. A script's entry point goes under `if __name__ == "__main__":`, as in section 12 ([lesson 1.15](lesson:1.15)).

## 15. Small utilities

```python title="Notebook cell"
import time
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import datetime


@dataclass
class HumanMessage:
    content: str


@dataclass
class AIMessage:
    content: str


thread_id = str(uuid.uuid4())                    # a fresh ID for a conversation
started = datetime.now().isoformat(timespec="seconds")
t0 = time.perf_counter()

history = [HumanMessage("Hi"), AIMessage("Hello!"), HumanMessage("Weather in Paris?")]
print(isinstance(history[-1], AIMessage))        # did the model speak last?
print([m.content for m in history if isinstance(m, HumanMessage)])

tool_calls = ["search", "weather", "search", "search"]
print(Counter(tool_calls).most_common(1))
print(thread_id, started, f"{time.perf_counter() - t0:.4f} s")
```

```output real note="the ID, the time and the duration differ on each run"
False
['Hi', 'Weather in Paris?']
[('search', 3)]
69c2f6cc-f0e5-441e-8aba-84ae6b8c62fb 2026-10-31T23:45:32 0.0001 s
```

LangChain's message classes behave like these stand-ins, so `isinstance` tells the model's messages from the user's ([lesson 9.2](lesson:9.2)). `uuid4()` makes a new `thread_id`, and `perf_counter()` is the clock for timing. Lessons: [standard library](lesson:1.16), [Counter](lesson:5.1).

## 16. Apps around a model

```python title="Notebook cell"
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s", force=True)
logger = logging.getLogger("agent")              # in a module: logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)   # quiet a chatty library

logger.info("calling the model")
logging.getLogger("httpx").info("HTTP Request: POST /chat")   # below WARNING: hidden
logger.warning("slow reply: %.1f s", 3.2)
```

```output real
INFO agent: calling the model
WARNING agent: slow reply: 3.2 s
```

Set logging up once, at the entry point; each module logs through its own named logger, and a noisy library's logger can be raised to `WARNING` ([lesson 3.8](lesson:3.8)).

```python title="Notebook cell"
import sqlite3

conn = sqlite3.connect(":memory:")
conn.execute("CREATE TABLE messages (thread_id TEXT, role TEXT, content TEXT)")
conn.executemany(
    "INSERT INTO messages VALUES (?, ?, ?)",
    [("t1", "user", "Hi"), ("t1", "assistant", "Hello!"), ("t2", "user", "Other chat")],
)
thread = "t1"                                    # outside input: always a ? placeholder
rows = conn.execute("SELECT role, content FROM messages WHERE thread_id = ?", (thread,)).fetchall()
print(rows)
conn.close()
```

```output real
[('user', 'Hi'), ('assistant', 'Hello!')]
```

Placeholders keep outside input out of the SQL text ([lesson 3.7](lesson:3.7)).

```python title="api.py"
from flask import Flask, jsonify, request

app = Flask(__name__)


@app.post("/ask")
def ask():
    question = request.json.get("question", "")
    return jsonify({"answer": f"You asked: {question}"})   # a chain would answer here


if __name__ == "__main__":
    app.run(port=5001)
```

```zsh title="Terminal" server port="5001"
python api.py
```

```python title="Notebook cell"
import requests

response = requests.post("http://127.0.0.1:5001/ask", json={"question": "What is LangGraph?"})
print(response.status_code, response.json())
```

```output real
200 {'answer': 'You asked: What is LangGraph?'}
```

`json=` sends a dict as a JSON body, and `.json()` reads the reply ([lesson 3.11](lesson:3.11)).

```python title="app.py"
import streamlit as st


@st.cache_resource                               # build the chain once, not on every rerun
def load_chain():
    return lambda question: f"(answer to: {question})"   # stand-in for prompt | model | parser


st.title("Ask a question")
question = st.text_input("Your question")
if question:                                     # empty until the user types
    st.write(load_chain()(question))
```

```zsh title="Terminal"
streamlit run app.py
```

Streamlit reruns the whole script after every change in the page, so keep anything slow to build in a cached function ([lesson 3.12](lesson:3.12)).

## 17. The | pipe

```python title="Notebook cell"
class Step:
    """A toy runnable: wraps a function and joins with | like LangChain's prompts, models and parsers."""

    def __init__(self, func):
        self.func = func

    def __or__(self, other):                     # self | other: run self, then other
        return Step(lambda value: other.func(self.func(value)))

    def invoke(self, value):
        return self.func(value)


prompt = Step(lambda d: f"Translate into French: {d['text']}")
model = Step(lambda text: {"content": text.upper()})     # a fake model
parser = Step(lambda message: message["content"])

chain = prompt | model | parser                  # (prompt | model) | parser
print(chain.invoke({"text": "good morning"}))
print(type(chain).__name__)
```

```output real
TRANSLATE INTO FRENCH: GOOD MORNING
Step
```

`a | b` calls `a.__or__(b)` ([lesson 2.5](lesson:2.5)), which returns a new object that runs `a` and passes its result to `b`. A chain is therefore one object with the same `invoke` as its parts, and each step's output must be what the next step takes ([lesson 6.1](lesson:6.1)).

```python title="Notebook cell"
from operator import itemgetter


class Step:
    def __init__(self, func):
        self.func = func

    def __or__(self, other):                     # self | other
        other = other if isinstance(other, Step) else Step(other)   # wrap a plain function
        return Step(lambda value: other.func(self.func(value)))

    def __ror__(self, other):                    # other | self, when other has no | for a Step
        return Step(other) | self

    def invoke(self, value):
        return self.func(value)


shout = Step(str.upper)
chain = itemgetter("text") | shout               # itemgetter has no __or__: shout.__ror__ runs
print(chain.invoke({"text": "hi"}))
print({"a": 1} | {"b": 2})                       # dict | dict merges; dict | Step falls back to __ror__
```

```output real
HI
{'a': 1, 'b': 2}
```

Python tries the left operand's `__or__` first; when it is missing or returns `NotImplemented`, it calls the right operand's `__ror__`. That is why `itemgetter("messages") | trimmer` and `{"context": ..., "input": ...} | prompt` work: the runnable on the right wraps whatever stands on its left ([lesson 7.1](lesson:7.1)).

## 18. Chat history in plain Python

```python title="Notebook cell"
from collections import deque

histories: dict[str, deque] = {}


def get_history(session_id: str, keep: int = 4) -> deque:
    """One history per session; with maxlen, the oldest message drops out when a new one arrives."""
    if session_id not in histories:
        histories[session_id] = deque(maxlen=keep)
    return histories[session_id]


def chat(session_id: str, text: str) -> str:
    history = get_history(session_id)
    reply = f"(reply to {text!r}, seeing {len(history)} earlier messages)"   # a model call goes here
    history.extend([("user", text), ("assistant", reply)])
    return reply


print(chat("alice", "Hi, I'm Alice"))
print(chat("alice", "What's my name?"))
print(chat("bob", "Hello"))
print(chat("alice", "And now?"))
print({session_id: len(history) for session_id, history in histories.items()})
print(histories["alice"][0])
```

```output real
(reply to "Hi, I'm Alice", seeing 0 earlier messages)
(reply to "What's my name?", seeing 2 earlier messages)
(reply to 'Hello', seeing 0 earlier messages)
(reply to 'And now?', seeing 4 earlier messages)
{'alice': 4, 'bob': 2}
('user', "What's my name?")
```

A dict keyed by session ID keeps conversations apart, and `deque(maxlen=n)` keeps only the newest `n` messages: what LangChain's history wrapper and trimming by message count do ([lessons 7.3](lesson:7.3), [7.4](lesson:7.4)). Both live in memory, so they vanish when the program stops.

## 19. The agent loop in plain Python

```python title="Notebook cell"
tools = {"get_order": lambda order_id: {"status": "delayed", "eta": "Friday"}}
script = iter([                                  # stand-in for the model's replies
    {"tool_calls": [{"id": "1", "name": "get_order", "args": {"order_id": "1042"}}]},
    {"tool_calls": [{"id": "2", "name": "refund", "args": {"order_id": "1042"}}]},
    {"content": "Order 1042 is delayed and arrives on Friday."},
])


def run_agent(messages: list[dict], max_steps: int = 5) -> str:
    for _ in range(max_steps):
        reply = next(script)                     # model.invoke(messages) in real code
        messages.append({"role": "assistant", **reply})
        if not reply.get("tool_calls"):          # no tool call: this is the answer
            return reply["content"]
        for call in reply["tool_calls"]:
            try:
                result = tools[call["name"]](**call["args"])
            except Exception as exc:             # unknown tool, bad arguments: tell the model
                result = f"error: {exc!r}"
            messages.append({"role": "tool", "tool_call_id": call["id"], "content": str(result)})
    return "stopped: too many steps"


messages = [{"role": "user", "content": "Where is order 1042?"}]
print(run_agent(messages))
print([m["role"] for m in messages])
print(messages[4]["content"])
```

```output real
Order 1042 is delayed and arrives on Friday.
['user', 'assistant', 'tool', 'assistant', 'tool', 'assistant']
error: KeyError('refund')
```

An agent is this loop: each reply either asks for tools or is the answer. Tools sit in a dict keyed by name, each result goes back as a message carrying its call's ID, errors become results the model can react to, and `max_steps` stops a model that never answers. LangChain's `create_agent` and LangGraph's ReAct agent run the same loop. Lessons: [the agent loop](lesson:8.1), [agents](lesson:9.4), [ReAct](lesson:11.4).

## 20. Middleware hooks in plain Python

```python title="Notebook cell"
class Logger:
    def __init__(self, name):
        self.name = name

    def before_model(self, messages):
        print(f"{self.name}.before")

    def after_model(self, reply):
        print(f"{self.name}.after")

    def wrap_model_call(self, messages, handler):
        print(f"{self.name}.wrap in")
        reply = handler(messages)                # call the next layer, or skip it
        print(f"{self.name}.wrap out")
        return reply


def model(messages):
    print("model")
    return "answer"


def call_model(middleware, messages):
    for m in middleware:                         # before_*: first to last
        m.before_model(messages)
    handler = model
    for m in reversed(middleware):               # wrap_*: the first one ends up outermost
        handler = lambda msgs, m=m, inner=handler: m.wrap_model_call(msgs, inner)
    reply = handler(messages)
    for m in reversed(middleware):               # after_*: last to first
        m.after_model(reply)
    return reply


call_model([Logger("A"), Logger("B")], ["hi"])
```

```output real
A.before
B.before
A.wrap in
B.wrap in
model
B.wrap out
A.wrap out
B.after
A.after
'answer'
```

Middleware are objects with optional hooks around each step. `before_*` hooks run in list order, `after_*` hooks in reverse, and wrappers nest like decorators, the first outermost: a wrapper can retry by calling `handler` twice, or answer from a cache by not calling it. The `m=m, inner=handler` defaults bind each lambda to its own values ([lesson 2.8](lesson:2.8)). Lesson: [middleware](lesson:9.6).

## 21. A graph in plain Python

```python title="Notebook cell"
import operator

START, END = "__start__", "__end__"


def run_graph(nodes, edges, reducers, state, max_steps=10):
    node = edges[START]
    for _ in range(max_steps):
        update = nodes[node](state)                                  # a node returns only what it changes
        state = {**state, **{key: reducers[key](state[key], value) if key in reducers else value
                             for key, value in update.items()}}
        print(f"{node:<6} {update}")
        follow = edges[node]
        node = follow(state) if callable(follow) else follow         # a conditional edge is a function
        if node == END:
            return state
    raise RuntimeError(f"no END after {max_steps} steps")


nodes = {
    "draft": lambda s: {"text": s["text"] + "!", "log": ["draft"]},
    "check": lambda s: {"log": ["check"]},
}
edges = {
    START: "draft",
    "draft": "check",
    "check": lambda s: END if len(s["text"]) >= 3 else "draft",    # loop until the text is long enough
}
reducers = {"log": operator.add}                                    # log appends; text is replaced
print(run_graph(nodes, edges, reducers, {"text": "", "log": []}))
```

```output real
draft  {'text': '!', 'log': ['draft']}
check  {'log': ['check']}
draft  {'text': '!!', 'log': ['draft']}
check  {'log': ['check']}
draft  {'text': '!!!', 'log': ['draft']}
check  {'log': ['check']}
{'text': '!!!', 'log': ['draft', 'check', 'draft', 'check', 'draft', 'check']}
```

A LangGraph graph is this loop: nodes return updates, each key merges by its reducer or is replaced, an edge is a name or a function of the state, a cycle ends when a function returns `END`, and a step limit stops one that never does. LangGraph also runs the nodes of one step in parallel and saves the state between steps. Lessons: [how a run proceeds](lesson:10.1), [a first graph](lesson:10.2), [reducers](lesson:10.3).

## 22. Traces in plain Python

```python title="Notebook cell"
import time
from contextvars import ContextVar
from functools import wraps

current = ContextVar("current", default=None)    # the run that is open in this thread or task
traces = []                                      # finished root runs


def traceable(run_type="chain"):
    def decorate(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            run = {"name": func.__name__, "type": run_type, "inputs": args, "children": []}
            parent = current.get()
            (parent["children"] if parent else traces).append(run)
            token = current.set(run)             # calls made inside func become children of run
            start = time.perf_counter()
            try:
                run["output"] = func(*args, **kwargs)
                return run["output"]
            except Exception as exc:
                run["error"] = repr(exc)
                raise
            finally:
                run["ms"] = round((time.perf_counter() - start) * 1000)
                current.reset(token)             # close the run, even when func raised
        return wrapper
    return decorate


@traceable("tool")
def add(a, b):
    return a + b


@traceable("llm")
def model(question, result=None):                # stand-in for the model
    return "call add" if result is None else f"The answer is {result}."


@traceable()
def agent(question):
    reply = model(question)
    result = add(5, 3) if reply == "call add" else None
    return model(question, result)


def show(run, depth=0):
    print("  " * depth + f"{run['name']} [{run['type']}] -> {run.get('output', run.get('error'))!r}")
    for child in run["children"]:
        show(child, depth + 1)


agent("What is 5 + 3?")
show(traces[0])
```

```output real
agent [chain] -> 'The answer is 8.'
  model [llm] -> 'call add'
  add [tool] -> 8
  model [llm] -> 'The answer is 8.'
```

A tracer records every call as a run: its name, type, inputs, output or error, duration and the runs it made. A `ContextVar` holds the open run, so a call made inside another becomes its child, and threads and async tasks each keep their own; `reset` in `finally` closes the run even when the function raises. LangSmith's `@traceable` works this way and uploads each finished tree in the background; LangChain builds the same tree from its callbacks. Lessons: [tracing](lesson:12.1), [decorators](lesson:2.8).

## 23. Fan-out and fan-in

```python title="Notebook cell"
import time
from concurrent.futures import ThreadPoolExecutor


def write_section(name):
    time.sleep({"Intro": 0.3, "History": 0.1, "Trends": 0.2}[name])  # stands in for a model call
    print("finished", name)
    return f"## {name}"


sections = ["Intro", "History", "Trends"]
start = time.perf_counter()
with ThreadPoolExecutor(max_workers=3) as pool:          # max_workers caps the calls in flight
    results = list(pool.map(write_section, sections))    # fan out: one call per item
print(f"{time.perf_counter() - start:.1f}s", results)    # results in input order
report = "\n".join(results)                              # fan in
print(report)
```

```output real note="timings vary slightly per run"
finished History
finished Trends
finished Intro
0.3s ['## Intro', '## History', '## Trends']
## Intro
## History
## Trends
```

`pool.map` runs the function on every item in its own thread and returns the results in the order of the input, whatever order the calls finish in; the run takes as long as the slowest call. `max_workers` caps how many run at once, as `max_concurrency` does for a graph. LangGraph's parallel branches and `Send` do this inside a graph, with the state, reducers and retries around it. Lessons: [threads](lesson:2.10), [parallel branches](lesson:13.2), [Send](lesson:13.4).

## 24. Checkpoints in plain Python

```python title="Notebook cell"
import copy

START, END = "__start__", "__end__"
nodes = {
    "draft": lambda s: {"text": f"Refund {s['amount']} euros on order {s['order']}"},
    "send": lambda s: {"sent": s["text"]},
}
edges = {START: "draft", "draft": "send", "send": END}
history = []                                                   # one thread: every checkpoint, oldest first


def save(state, node, source):
    history.append({"id": len(history), "source": source, "next": node,
                    "state": copy.deepcopy(state)})            # a snapshot, not a reference to live data
    return history[-1]


def run(state=None, checkpoint=None, pause_before=()):
    """Start from an input, or continue from a checkpoint: the latest to resume, an older one to fork."""
    node = edges[START] if checkpoint is None else checkpoint["next"]
    if checkpoint is None:
        save(state, node, "input")
    else:
        state = copy.deepcopy(checkpoint["state"])
    while node != END:
        if node in pause_before and checkpoint is None:        # a breakpoint: stop; the state is saved
            return f"paused before {node}"
        checkpoint = None                                      # resuming passes the breakpoint once
        state = {**state, **nodes[node](state)}
        node = edges[node]
        save(state, node, "loop")
    return state


def update(checkpoint, changes):
    """Like update_state: a new checkpoint with the changes; the old one stays as it was."""
    return save({**checkpoint["state"], **changes}, checkpoint["next"], "update")


print(run({"order": 1042, "amount": 500}, pause_before={"send"}))
print(run(checkpoint=history[-1]))                             # approve: resume from the latest
print(run(checkpoint=update(history[1], {"text": "Refund 50 euros on order 1042"})))  # fork checkpoint 1
print([(c["id"], c["source"], c["next"]) for c in history])
```

```output real
paused before send
{'order': 1042, 'amount': 500, 'text': 'Refund 500 euros on order 1042', 'sent': 'Refund 500 euros on order 1042'}
{'order': 1042, 'amount': 500, 'text': 'Refund 50 euros on order 1042', 'sent': 'Refund 50 euros on order 1042'}
[(0, 'input', 'draft'), (1, 'loop', 'send'), (2, 'loop', '__end__'), (3, 'update', 'send'), (4, 'loop', '__end__')]
```

A checkpointer is a list of snapshots: after every step, a copy of the state and the node that runs next. A breakpoint returns early with everything saved; resuming loads the latest snapshot and carries on from its `next`; an edit is a new snapshot with the changes, and continuing from an older snapshot is a fork, while the original stays. `copy.deepcopy` matters: storing the state itself would let a node that changes a list in place rewrite every saved snapshot. LangGraph also records each checkpoint's parent, which turns the list into a tree of branches. Lessons: [breakpoints](lesson:14.1), [editing the state](lesson:14.2), [time travel](lesson:14.4).

## 25. Grade, filter and fall back

```python title="Notebook cell"
def grade(question: str, chunk: str) -> bool:      # stands in for a grader model
    words = {w for w in question.lower().rstrip("?").split() if len(w) >= 5}
    return all(w in chunk.lower() for w in words)


def next_step(kept: int, total: int, min_kept: int = 1) -> str:
    if kept == total:
        return "answer"
    if kept >= min_kept:
        return "answer from what passed"
    return "fall back"                              # rewrite and retry, search the web, or say so


chunks = [
    "Short-term memory is in-context learning.",
    "Long-term memory lives in a vector store.",
    "The chemistry agent planned a synthesis.",
]
question = "What is long-term memory?"
kept = [c for c in chunks if grade(question, c)]   # filter with a predicate
print(kept)
failed = [not grade(question, c) for c in chunks]
print(any(failed), all(failed))                     # "some chunk failed" vs "every chunk failed"
print(next_step(len(kept), len(chunks)))
print(next_step(0, len(chunks)))
```

```output real
['Long-term memory lives in a vector store.']
True False
answer from what passed
fall back
```

A grader answers yes or no per chunk; a comprehension keeps what passed, and one rule turns the count into the next step. `any(failed)` is the rule many corrective RAG examples use, so one off-topic chunk triggers the fallback; `all(failed)`, or fewer than `min_kept` passing, falls back only when retrieval really missed. A fallback that searches again needs a cap on its attempts. Lessons: [any and all](lesson:1.8), [grading chunks](lesson:15.3), [loops without exits](lesson:15.4).

## 26. Nested trees

```python title="Notebook cell"
tree = [
    {"id": "1", "title": "Introduction", "nodes": []},
    {"id": "2", "title": "Model", "nodes": [
        {"id": "2.1", "title": "Encoder", "nodes": []},
        {"id": "2.2", "title": "Attention", "nodes": [
            {"id": "2.2.1", "title": "Heads", "nodes": []},
        ]},
    ]},
]


def walk(nodes, depth=0):                        # depth-first, in reading order
    for node in nodes:
        yield depth, node
        yield from walk(node.get("nodes", []), depth + 1)


for depth, node in walk(tree):
    print("  " * depth + node["title"])

print(sum(1 for _ in walk(tree)))                                    # count
print({node["id"]: node["title"] for _, node in walk(tree)})         # index by ID
print([node["id"] for _, node in walk(tree) if not node["nodes"]])   # leaves


def path_to(nodes, target, path=()):
    for node in nodes:
        here = path + (node["title"],)
        if node["id"] == target:
            return here
        found = path_to(node.get("nodes", []), target, here)
        if found:
            return found
    return ()


print(" > ".join(path_to(tree, "2.2.1")))

stack = list(reversed(tree))                      # the same walk without recursion
while stack:
    node = stack.pop()
    print(node["id"], end=" ")
    stack.extend(reversed(node.get("nodes", [])))
```

```output real
Introduction
Model
  Encoder
  Attention
    Heads
5
{'1': 'Introduction', '2': 'Model', '2.1': 'Encoder', '2.2': 'Attention', '2.2.1': 'Heads'}
['1', '2.1', '2.2.1']
Model > Attention > Heads
1 2 2.1 2.2 2.2.1
```

Document outlines, JSON from APIs and nested settings arrive as dicts holding a list of children. A generator that yields `(depth, node)` walks such a tree once and serves every question: print it, count it, index it by ID, list its leaves. Passing the path down the recursion as a tuple gives breadcrumbs, and an explicit stack does the same walk without recursion, for trees deeper than Python's recursion limit (1,000 frames by default). Lessons: [16.2](lesson:16.2), [16.3](lesson:16.3).

::: practice
**Find by ID.** Write `find(nodes, ids)` that returns the nodes whose ID is in `ids`, in reading order, whatever order `ids` lists them in; unknown IDs are skipped.

```python title="Notebook cell"
def find(nodes, ids):
    wanted = set(ids)
    return [node for _, node in walk(nodes) if node["id"] in wanted]


print([node["title"] for node in find(tree, ["2.2.1", "1", "9"])])
```

```output real
['Introduction', 'Heads']
```

A set makes each membership test constant-time, and walking the tree, not the list of IDs, gives reading order for free: the same contract as `find_nodes_by_ids` in [lesson 16.3](lesson:16.3).
:::

## 27. Caching calls by key

```python title="Notebook cell"
import hashlib
import json
from functools import lru_cache


@lru_cache(maxsize=256)                          # hashable arguments only: str, int, tuple
def embed(text: str) -> tuple:
    print(f"computing {text!r}")
    return (len(text), text.count(" ") + 1)


embed("hello world")
embed("hello world")                             # served from the cache: nothing printed
print(embed.cache_info())


def cache_key(model: str, messages: list[dict], **params) -> str:
    raw = json.dumps({"model": model, "messages": messages, **params}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


cache = {}


def cached_call(model, messages, **params):
    key = cache_key(model, messages, **params)
    if key in cache:
        return cache[key], "hit"
    cache[key] = f"answer to {messages[-1]['content']!r}"   # stands in for the model call
    return cache[key], "miss"


question = [{"role": "user", "content": "What is RAG?"}]
print(cached_call("gpt-4o-mini", question))
print(cached_call("gpt-4o-mini", question))
print(cached_call("gpt-4o-mini", question, temperature=0.5))
print(cache_key("m", [], a=1, b=2) == cache_key("m", [], b=2, a=1))
```

```output real
computing 'hello world'
CacheInfo(hits=1, misses=1, maxsize=256, currsize=1)
("answer to 'What is RAG?'", 'miss')
("answer to 'What is RAG?'", 'hit')
("answer to 'What is RAG?'", 'miss')
True
```

`functools.lru_cache` remembers a function's results by its arguments, which must be hashable, so it suits embeddings of strings, not calls that take lists of message dicts. For those, build the key yourself: `json.dumps(..., sort_keys=True)` writes the same request as the same text whatever order its keys were given in, and a hash makes it short. Any change, here the temperature, is a new key. LLM gateways cache model calls this way ([lesson 18.3](lesson:18.3)); [lesson 18.1](lesson:18.1) has a practice task with hit and miss counts.
