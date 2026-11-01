+++
number = "11.1"
title = "State schemas: TypedDict, dataclass and Pydantic"
lede = "The class you pass to StateGraph names the keys every node shares. It can be a TypedDict, a dataclass or a Pydantic model, and the choice decides what gets checked, when, and how nodes read the state."
summary = "The same graph over a TypedDict, a dataclass and a Pydantic state: how nodes read each one, what happens with a missing key or a wrong type, Pydantic's validation and conversion and what the state keeps, a comparison table, how to choose, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "11 LangGraph Components: 3-DataclassStateSchema.ipynb (cells 1-16; the user's name replaced, a repeated cell dropped); 4-pydantic.ipynb (cells 1-6); missing keys, conversion, when validation runs, the comparison, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Every node of a graph receives the state and returns an update to it, so the state class is the contract the nodes share: which keys exist, and what each holds. LangGraph calls it the state schema, and it accepts three kinds of class. The graphs of [module 10](module:10) used a `TypedDict`, which only declares the keys; [lesson 10.2](lesson:10.2) showed that a value of the wrong type goes through unnoticed. A dataclass adds defaults and required fields, and a Pydantic model checks types while the graph runs. This lesson builds one small graph three times, once over each, to see what each one catches.

## A TypedDict state

The graph finishes a sentence about the game a person wants to play, the shape of [lesson 10.2](lesson:10.2)'s graph with a second key:

```python title="Notebook cell"
from typing_extensions import TypedDict
from typing import Literal


class TypedDictState(TypedDict):
    name: str
    game: Literal["cricket", "badminton"]
```

`Literal` lists the only values `game` should take ([lesson 4.1](lesson:4.1)). The nodes read keys with square brackets, since the state is a dict:

```python title="Notebook cell"
def play_game(state: TypedDictState):
    print("---Play Game node has been called--")
    return {"name": state["name"] + " want to play "}


def cricket(state: TypedDictState):
    print("-- Cricket node has been called--")
    return {"name": state["name"] + " cricket", "game": "cricket"}


def badminton(state: TypedDictState):
    print("-- badminton node has been called--")
    return {"name": state["name"] + " badminton", "game": "badminton"}
```

```python title="Notebook cell"
import random


def decide_play(state: TypedDictState) -> Literal["cricket", "badminton"]:
    # Here, let's just do a 50 / 50 split between nodes 2, 3
    if random.random() < 0.5:
        return "cricket"
    else:
        return "badminton"
```

```python title="Notebook cell"
from IPython.display import Image, display
from langgraph.graph import StateGraph, START, END

builder = StateGraph(TypedDictState)
builder.add_node("playgame", play_game)
builder.add_node("cricket", cricket)
builder.add_node("badminton", badminton)

## Flow of the graph
builder.add_edge(START, "playgame")
builder.add_conditional_edges("playgame", decide_play)
builder.add_edge("cricket", END)
builder.add_edge("badminton", END)

graph = builder.compile()
```

```python title="Notebook cell" norun
# View
display(Image(graph.get_graph().draw_mermaid_png()))
```

The drawing shows `playgame` with dotted edges to `cricket` and `badminton`, both leading to `END` ([lesson 10.2](lesson:10.2) explains the drawing and the web service it needs).

```python title="Notebook cell"
graph.invoke({"name": "Alice"})
```

```output real note="the router picks the game at random, so the output varies per run"
---Play Game node has been called--
-- Cricket node has been called--
{'name': 'Alice want to play  cricket', 'game': 'cricket'}
```

The input set only `name`. A `TypedDict` doesn't require its keys, so the run started without `game`, and the chosen node added it. Now pass a number as the name:

```python title="Notebook cell"
graph.invoke({"name": 123})
```

```output real
---Play Game node has been called--
TypeError: unsupported operand type(s) for +: 'int' and 'str'
```

Nothing checked the input. `123` entered the state, `play_game` ran, and the run failed inside it, where `123 + " want to play "` can't be computed. The hints are for your editor and type checker ([lesson 4.1](lesson:4.1)); at run time a `TypedDict` is a plain dict, and a wrong `game` such as `"tennis"` would pass too.

## A dataclass state

A dataclass declares the same fields as a class whose instances hold data ([lesson 4.1](lesson:4.1)):

```python title="Notebook cell"
from dataclasses import dataclass


@dataclass
class DataClassState:
    name: str
    game: Literal["badminton", "cricket"]
```

The nodes change in one way: they read attributes, `state.name`, because LangGraph now hands each node a `DataClassState` instance. They still return a dict with the keys they change.

```python title="Notebook cell"
def play_game(state: DataClassState):
    print("---Play Game node has been called--")
    return {"name": state.name + " want to play "}


def cricket(state: DataClassState):
    print("-- Cricket node has been called--")
    return {"name": state.name + " cricket", "game": "cricket"}


def badminton(state: DataClassState):
    print("-- badminton node has been called--")
    return {"name": state.name + " badminton", "game": "badminton"}


def decide_play(state: DataClassState) -> Literal["cricket", "badminton"]:
    # Here, let's just do a 50 / 50 split between nodes 2, 3
    if random.random() < 0.5:
        return "cricket"
    else:
        return "badminton"
```

```python title="Notebook cell"
builder = StateGraph(DataClassState)
builder.add_node("playgame", play_game)
builder.add_node("cricket", cricket)
builder.add_node("badminton", badminton)

## Flow of the graph
builder.add_edge(START, "playgame")
builder.add_conditional_edges("playgame", decide_play)
builder.add_edge("cricket", END)
builder.add_edge("badminton", END)

graph = builder.compile()
```

The input can be an instance of the class:

```python title="Notebook cell"
graph.invoke(DataClassState(name="Alice", game="cricket"))
```

```output real note="the router picks the game at random, so the output varies per run"
---Play Game node has been called--
-- Cricket node has been called--
{'name': 'Alice want to play  cricket', 'game': 'cricket'}
```

The result is a dict, not a `DataClassState`: `invoke` returns the state's values whatever the schema. A dataclass has no default here, so every field is required, and a dict input without `game` fails before any node runs:

```python title="Notebook cell"
graph.invoke({"name": "Alice"})
```

```output real
TypeError: DataClassState.__init__() missing 1 required positional argument: 'game'
```

LangGraph builds a `DataClassState` from the state before each node, and the class's own `__init__` refuses the missing field. Types are still not checked: a dataclass runs no validation, so `{"name": 123, "game": "cricket"}` fails inside `play_game` exactly as before. Give a field a default, `game: Literal["badminton", "cricket"] = "cricket"`, and it becomes optional.

## A Pydantic state

A Pydantic model validates its fields whenever an instance is created ([lesson 4.2](lesson:4.2)):

```python title="Notebook cell"
from langgraph.graph import StateGraph, START, END
from pydantic import BaseModel


class State(BaseModel):
    name: str
```

```python title="Notebook cell"
## node function
def example_node(state: State):
    return {"name": "Hello"}
```

```python title="Notebook cell"
## stateGraph
builder = StateGraph(State)
builder.add_node("example_node", example_node)

builder.add_edge(START, "example_node")
builder.add_edge("example_node", END)

graph = builder.compile()
```

```python title="Notebook cell"
graph.invoke({"name": 123})
```

```output real
ValidationError: 1 validation error for State
name
  Input should be a valid string [type=string_type, input_value=123, input_type=int]
    For further information visit https://errors.pydantic.dev/2.14/v/string_type
```

The run stops before `example_node` with Pydantic's own message: which field, what was expected, and what arrived. The same error appears for a missing field without a default.

## What Pydantic checks, and when

LangGraph keeps the state as plain values and builds the Pydantic object each time a node needs one. That has three consequences that are easy to miss. Pydantic converts what it can, such as the string `"42"` for an `int` field, but only the node's copy changes:

```python title="Notebook cell"
class Profile(BaseModel):
    name: str
    age: int = 0


def greet(state: Profile):
    print(f"greet sees {state!r}")
    return {"name": state.name.title()}


builder = StateGraph(Profile)
builder.add_node("greet", greet)
builder.add_edge(START, "greet")
builder.add_edge("greet", END)
profile_graph = builder.compile()

profile_graph.invoke({"name": "alice smith", "age": "42"})
```

```output real
greet sees Profile(name='alice smith', age=42)
{'name': 'Alice Smith', 'age': '42'}
```

The node saw `age=42`, an integer, but the result still holds the string `'42'`: no node wrote `age`, so the state kept what the input put there. A validator that cleans a value behaves the same way. To store the cleaned value, return it from a node, as `greet` does for the name.

Validation runs every time a node receives the state, so a bad value written by one node fails in the next:

```python title="Notebook cell"
def broken(state: Profile):
    return {"age": "unknown"}


builder = StateGraph(Profile)
builder.add_node("broken", broken)
builder.add_node("greet", greet)
builder.add_edge(START, "broken")
builder.add_edge("broken", "greet")
builder.add_edge("greet", END)
builder.compile().invoke({"name": "alice"})
```

```output real
ValidationError: 1 validation error for Profile
age
  Input should be a valid integer, unable to parse string as an integer [type=int_parsing, input_value='unknown', input_type=str]
    For further information visit https://errors.pydantic.dev/2.14/v/int_parsing
```

`greet` never ran. The message names the field but not the node that wrote it, so finding the culprit means reading the nodes, or a trace ([lesson 12.1](lesson:12.1)). And when the bad value comes from the last node, nothing validates it at all: the output of a graph is never checked. LangGraph's documentation still says only the first node's input is validated; in LangGraph 1.2 every node's is, as the run above shows.

## Compared

| | `TypedDict` | dataclass | Pydantic `BaseModel` |
|---|---|---|---|
| A node reads | `state["name"]` | `state.name` | `state.name` |
| A key missing from the input | Accepted; reading it raises `KeyError` | `TypeError`, unless the field has a default | `ValidationError`, unless the field has a default |
| A value of the wrong type | Accepted | Accepted | `ValidationError`, or converted (`"42"` to `42`) for the node only |
| Checked | Never | Missing fields, when a node receives the state | Every field, when a node receives the state |
| Defaults, constraints | None | Defaults | Defaults, `Field` constraints, validators |
| `invoke` returns | A dict | A dict | A dict |
| Cost | None | An object per node call | Validation per node call, slow for large states |

Reducers work the same in all three: `messages: Annotated[list, add_messages]` is a field like any other ([lesson 10.3](lesson:10.3)).

## Which to choose

- **`TypedDict`** for most graphs: no runtime cost, and the form most examples and LangGraph's prebuilt states use. The nodes are your own code, so tests catch wrong types better than run-time checks.
- **A dataclass** when keys need defaults, so callers can start a run with only the keys they know.
- **Pydantic** where data enters from outside: a public API, a form, another team's service. Even there, validating the request before `invoke` is often clearer than validating the state at every node, and it keeps the error next to its cause.

Whichever you pick, `StateGraph(State, input_schema=..., output_schema=...)` can narrow what callers pass in and get back, while the nodes share the full state.

## Interview questions

::: check
A graph's state moved from `TypedDict` to Pydantic, and a test now fails with a `ValidationError` raised before a node that nobody changed. Why?

Pydantic validates the state each time a node receives it, so the error shows up at the first node that runs after a bad value was written, not at the node that wrote it, and the message names the field, not the node. An earlier node, or the input, put a value of the wrong type into that field; under `TypedDict` it went through silently. Find the writer from the field name or a trace, and fix the value at its source.
:::

::: check
Your Pydantic state title-cases names in a validator, yet the graph's output still holds the raw name. What happened?

Validators and conversions apply to the object each node receives, not to the stored state. The state keeps whatever the input or a node wrote, and the output is that state, unvalidated. If the cleaned value should be stored, return it from a node, typically the first one; or clean the request before calling `invoke`.
:::

::: check
An agent behind a public API receives requests as JSON. Where do you validate them?

At the boundary: parse the request into a Pydantic model before calling the graph, and return a clear error to the caller when it fails. The graph's state can then stay a `TypedDict` with no per-node cost, since everything inside it comes from validated input or from your own nodes. A Pydantic state is the alternative when the graph itself is the boundary, as when another service invokes it directly.
:::

## Practice

::: practice
**Validate a sign-up.** Write a Pydantic state with `email: str` (a validator requires an `@`), `age: int` of at least 13 (`Field(ge=13)`, [lesson 4.3](lesson:4.3)) and `plan: Literal["free", "pro"] = "free"`, and a one-node graph that welcomes the user. Invoke it with one good input and two bad ones, printing the welcome or each error's field and message.

```python title="Notebook cell"
from pydantic import Field, ValidationError, field_validator


class SignUp(BaseModel):
    email: str
    age: int = Field(ge=13)
    plan: Literal["free", "pro"] = "free"

    @field_validator("email")
    @classmethod
    def has_at(cls, value: str) -> str:
        if "@" not in value:
            raise ValueError("not an email address")
        return value


def welcome(state: SignUp):
    return {"email": state.email.lower()}


builder = StateGraph(SignUp)
builder.add_node("welcome", welcome)
builder.add_edge(START, "welcome")
builder.add_edge("welcome", END)
signup = builder.compile()

for request in [{"email": "Alice@Example.com", "age": 30},
                {"email": "alice", "age": 30},
                {"email": "bob@example.com", "age": 9, "plan": "gold"}]:
    try:
        print("ok:", signup.invoke(request))
    except ValidationError as error:
        print("rejected:", [(e["loc"][0], e["msg"]) for e in error.errors()])
```

```output real
ok: {'email': 'alice@example.com', 'age': 30}
rejected: [('email', 'Value error, not an email address')]
rejected: [('age', 'Input should be greater than or equal to 13'), ('plan', "Input should be 'free' or 'pro'")]
```

All errors arrive at once, one per field, which is what makes Pydantic good at boundaries. The good request shows the state's habit again: `plan` doesn't appear in the result, because its default lived only in the node's copy and no node wrote it.
:::

::: practice
**Defaults with a dataclass.** Write a dataclass state for a job with `name`, `attempts: int = 0` and `status: str = "new"`, and a node that counts an attempt and marks the job done. Start the run with only the name, and predict which keys the result holds before you run it.

```python title="Notebook cell"
@dataclass
class Job:
    name: str
    attempts: int = 0
    status: str = "new"


def run_job(state: Job):
    print(f"run_job sees {state}")
    return {"attempts": state.attempts + 1, "status": "done"}


builder = StateGraph(Job)
builder.add_node("run_job", run_job)
builder.add_edge(START, "run_job")
builder.add_edge("run_job", END)
jobs = builder.compile()

print(jobs.invoke({"name": "nightly report"}))
```

```output real
run_job sees Job(name='nightly report', attempts=0, status='new')
{'name': 'nightly report', 'attempts': 1, 'status': 'done'}
```

The defaults filled the node's view of the state, so `run_job` could read `state.attempts`. The result holds all three keys only because the node wrote two of them; a default that no node writes stays out of the result, as `plan` did in the task above.
:::

## Further reading

- LangChain, [Use the graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api): state schemas, Pydantic state and its known limitations, input and output schemas.
- Pydantic, [Conversion table](https://docs.pydantic.dev/latest/concepts/conversion_table/): which values each type accepts and converts in lax mode.
