+++
number = "4.1"
title = "Type hints and dataclasses"
lede = "Type hints state what type a variable, a parameter or a return value should have. Python stores them and never checks them; editors, dataclasses and Pydantic read them."
summary = "Annotate variables and functions, write hints for collections, None and fixed choices, and let @dataclass build a class from its fields."
type = "concept"
status = "published"
source = "3 Pydentic Overview: Pydentic_Intro.ipynb (cells 3-4); type hints added (used from section 7 on)"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Agent code is full of type hints: a tool declares `city: str`, a graph node takes `state: State`, a router returns `Literal["poem", "story"]`. Python stores hints and never checks them; editors, type checkers and libraries read them. This lesson covers the hints you will meet and dataclasses, which build a class from them. [Lesson 4.2](lesson:4.2) adds Pydantic, which does check them.

This module needs one package, Pydantic, from lesson 4.2 on. Add this line to `requirements.txt` and run your install command again ([lesson 0.1](lesson:0.1)):

```text title="requirements.txt"
pydantic
```

## Annotate variables and functions

```python title="Notebook cell"
name: str = "Alice"
age: int = 30


def add(a: int, b: int) -> int:
    return a + b


print(add(2, 3))
print(add.__annotations__)
```

```output real
5
{'a': <class 'int'>, 'b': <class 'int'>, 'return': <class 'int'>}
```

A hint follows a colon after a variable or parameter name, and `-> type` after the parameter list gives the return type. Python keeps a function's hints in `__annotations__`, where libraries can read them: LangChain builds a tool's description from its hints and docstring ([lesson 9.3](lesson:9.3)).

## Python never checks them

```python title="Notebook cell"
print(add("2", "3"))
print(add([1], [2]))

age = "thirty"
print(age)
```

```output real
23
[1, 2]
thirty
```

Both calls run, because `+` also works on strings and lists, and `age` takes a string although its hint says `int`. Hints are for people and tools. A type checker such as mypy, or Pylance in VS Code once you set **Python › Analysis: Type Checking Mode** to `basic` (the default is `off`), underlines `add("2", "3")` before anything runs.

## Hints for collections, None and fixed choices

```python title="Notebook cell"
from typing import Literal, Optional


def mean(scores: list[float]) -> float:
    return sum(scores) / len(scores)


def find_age(ages: dict[str, int], name: str) -> int | None:
    return ages.get(name)


def pick_route(topic: str) -> Literal["poem", "story"]:
    return "poem" if "rhyme" in topic else "story"


print(mean([7.5, 9.0]))
print(find_age({"alice": 30}, "bob"))
print(pick_route("a rhyme about cats"))
print(Optional[float] == (float | None))
```

```output real
8.25
None
poem
True
```

| Hint | Means | Older spelling |
|---|---|---|
| `list[str]` | a list of strings | `List[str]` |
| `dict[str, int]` | a dict from strings to ints | `Dict[str, int]` |
| `tuple[int, int]` | a pair of ints | `Tuple[int, int]` |
| `float \| None` | a float, or `None` | `Optional[float]` |
| `int \| str` | an int or a string | `Union[int, str]` |
| `Any` | any value at all | |
| `Literal["poem", "story"]` | exactly one of these values | |

The older spellings, and `Any` and `Literal`, are imported from the `typing` module; the `|` form needs Python 3.10. Both spellings mean the same, as the last line shows, and you will meet both. `Literal` lists the only values allowed: routing functions return one ([lesson 10.2](lesson:10.2)) and schemas use it for fixed choices ([lesson 4.3](lesson:4.3)).

Two more forms appear in agent code: `TypedDict`, a dict whose keys and value types are declared, and `Annotated[type, extra]`, a hint that carries extra information for a library to read. Both arrive with graph state in lessons [10.2](lesson:10.2) and [10.3](lesson:10.3).

## Dataclasses

A dataclass is a class Python writes for you from a list of fields:

```python title="Notebook cell"
from dataclasses import dataclass


@dataclass
class Person:
    name: str
    age: int
    city: str


person = Person(name="Alice", age=30, city="Paris")
print(person)
print(person == Person("Alice", 30, "Paris"))
```

```output real
Person(name='Alice', age=30, city='Paris')
True
```

Each name with a hint in the class body is a field. From them, `@dataclass` writes `__init__` (the fields as parameters, in order), `__repr__` (the printout above) and `__eq__` (equal when every field is equal): the methods of [lesson 2.5](lesson:2.5), without the typing. The hints still aren't checked:

```python title="Notebook cell"
person = Person(name="Alice", age=30, city=35)
print(person)
```

```output real
Person(name='Alice', age=30, city=35)
```

The object holds the number 35 as its city. [Lesson 4.2](lesson:4.2) builds the same class with Pydantic, which refuses it.

## Defaults and list fields

```python title="Notebook cell"
from dataclasses import field


@dataclass
class Book:
    title: str
    pages: int = 100
    tags: list[str] = field(default_factory=list)


dune = Book("Dune")
emma = Book("Emma", 300)
dune.tags.append("sci-fi")
print(dune)
print(emma)
```

```output real
Book(title='Dune', pages=100, tags=['sci-fi'])
Book(title='Emma', pages=300, tags=[])
```

Fields with a default come after those without, as with function parameters. A list needs `field(default_factory=list)`, which calls `list()` for each new object, so every book gets its own list. Writing `tags: list[str] = []` instead raises `ValueError: mutable default <class 'list'> for field tags is not allowed: use default_factory`: one list would be shared by every book, the trap of mutable default arguments ([cheat sheet](lesson:5.1), section 12). `@dataclass(frozen=True)` makes the objects read-only; assigning to a field then raises `FrozenInstanceError`.

## Practice

::: practice
**Annotate a tool.** Add hints to `def get_weather(city, unit="celsius")`, which returns `f"It's sunny in {city}, 21 degrees {unit}"`: `city` is a string, `unit` is either `"celsius"` or `"fahrenheit"`, and the result is a string. Print the function's `__annotations__`, then call it with `unit="kelvin"`.

```python title="Notebook cell"
from typing import Literal


def get_weather(city: str, unit: Literal["celsius", "fahrenheit"] = "celsius") -> str:
    return f"It's sunny in {city}, 21 degrees {unit}"


print(get_weather.__annotations__)
print(get_weather("Paris", unit="kelvin"))
```

```output real
{'city': <class 'str'>, 'unit': typing.Literal['celsius', 'fahrenheit'], 'return': <class 'str'>}
It's sunny in Paris, 21 degrees kelvin
```

A hint and a default go together as `name: hint = default`. `"kelvin"` gets through: only a type checker, or Pydantic, would stop it. LangChain turns hints like these into the argument schema a model sees for a tool ([lesson 9.3](lesson:9.3)).
:::

::: practice
**A chat message.** Write a dataclass `Message` with a `role` (`"user"` or `"assistant"`), a `content` string and a `tokens` count that defaults to 0. Build a chat of two messages, print each one and the total number of tokens, then check whether two messages with the same fields are equal.

```python title="Notebook cell"
from dataclasses import dataclass
from typing import Literal


@dataclass
class Message:
    role: Literal["user", "assistant"]
    content: str
    tokens: int = 0


chat = [Message("user", "Hi", 2), Message("assistant", "Hello! How can I help?", 7)]
for message in chat:
    print(message)
print(sum(m.tokens for m in chat))
print(Message("user", "Hi") == Message("user", "Hi"))
```

```output real
Message(role='user', content='Hi', tokens=2)
Message(role='assistant', content='Hello! How can I help?', tokens=7)
9
True
```

`@dataclass` gave `Message` its `__init__`, its printout and `==`; `sum` over a generator expression totals one field of every message ([lesson 1.8](lesson:1.8)).
:::
