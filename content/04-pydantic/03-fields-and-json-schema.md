+++
number = "4.3"
title = "Fields, constraints and JSON schema"
lede = "`Field` adds rules, defaults and descriptions to a model's fields, and every model can describe itself as a JSON schema: the form in which a language model receives a request for structured output."
summary = "Constrain values with Field, set required fields and defaults, describe fields for a model, read the JSON schema, and check JSON replies."
type = "concept"
status = "published"
source = "3 Pydentic Overview: Pydentic_Intro.ipynb (cells 17-20); schemas from 9 LangChain Updated/5-structuredoutput, 13 Different Workflow in LangGraph/3-routing"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A type hint says what kind of value a field holds. `Field` says more: the range a number must fall in, a default, and a description in plain words. The description matters later: when you ask a language model for structured output, it receives the model's JSON schema, descriptions included, and fills it in.

## Constrain values

```python title="Notebook cell"
from pydantic import BaseModel, Field


class Item(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    price: float = Field(gt=0, le=1000)  # greater than 0, at most 1000
    quantity: int = Field(ge=0)


item = Item(name="Book", price=10, quantity=10)
print(item)
```

```output real
name='Book' price=10.0 quantity=10
```

```python title="Notebook cell"
Item(name="B", price=0, quantity=-1)
```

```output real note="the end of the error"
ValidationError: 3 validation errors for Item
name
  String should have at least 2 characters [type=string_too_short, input_value='B', input_type=str]
    For further information visit https://errors.pydantic.dev/2.14/v/string_too_short
price
  Input should be greater than 0 [type=greater_than, input_value=0, input_type=int]
    For further information visit https://errors.pydantic.dev/2.14/v/greater_than
quantity
  Input should be greater than or equal to 0 [type=greater_than_equal, input_value=-1, input_type=int]
    For further information visit https://errors.pydantic.dev/2.14/v/greater_than_equal
```

All three rules failed, and all three are reported.

| Argument | Rule | For |
|---|---|---|
| `gt`, `ge` | greater than; greater than or equal | numbers |
| `lt`, `le` | less than; less than or equal | numbers |
| `min_length`, `max_length` | at least, at most this many characters or items | strings, lists |

## Required fields and defaults

```python title="Notebook cell"
class User(BaseModel):
    username: str = Field(..., description="Unique username for the user")
    age: int = Field(default=18, description="User age, defaults to 18")
    email: str = Field(
        default_factory=lambda: "user@example.com",
        description="Default email address",
    )


user1 = User(username="alice")
print(user1)
user2 = User(username="bob", age=25, email="bob@domain.com")
print(user2)
```

```output real
username='alice' age=18 email='user@example.com'
username='bob' age=25 email='bob@domain.com'
```

- `...`, Python's Ellipsis, as the first argument means "no default": `username` is required. `Field(description="...")` with no default is required too; you will see both forms.
- `default=18` is used when the argument is missing.
- `default_factory` takes a function and calls it for each new object. A constant like this email only needs `default=`; the factory is for fresh values, such as an empty list (`default_factory=list`) or the current time (`default_factory=datetime.now`). Unlike a dataclass ([lesson 4.1](lesson:4.1)), a model also accepts `tags: list[str] = []`, because Pydantic copies the default for each object.

## The JSON schema

```python title="Notebook cell"
import json

print(json.dumps(User.model_json_schema(), indent=2))
```

```output real
{
  "properties": {
    "username": {
      "description": "Unique username for the user",
      "title": "Username",
      "type": "string"
    },
    "age": {
      "default": 18,
      "description": "User age, defaults to 18",
      "title": "Age",
      "type": "integer"
    },
    "email": {
      "description": "Default email address",
      "title": "Email",
      "type": "string"
    }
  },
  "required": [
    "username"
  ],
  "title": "User",
  "type": "object"
}
```

`model_json_schema()` describes the model in JSON Schema, a standard format for describing JSON data; `json.dumps(..., indent=2)` only lays it out for reading. Each field becomes a property with a `title` made from its name, a `type` from its hint, its `description` and its `default`. Fields without a default are listed in `required`. `email` has no default here: a function makes it, so there is no value to show.

::: visual class-to-schema | Figure | From class to JSON schema
Each field of `User` next to the part of the schema it produces: names become titles, hints become types, descriptions and defaults are copied, and a field without a default is listed as required.
:::

## Describe the data for a language model

```python title="Notebook cell"
class Movie(BaseModel):
    """A movie with details."""

    title: str = Field(..., description="The title of the movie")
    year: int = Field(..., description="The year the movie was released")
    director: str = Field(..., description="The director of the movie")
    rating: float = Field(..., description="The movie's rating out of 10")


print(json.dumps(Movie.model_json_schema(), indent=2))
```

```output real
{
  "description": "A movie with details.",
  "properties": {
    "title": {
      "description": "The title of the movie",
      "title": "Title",
      "type": "string"
    },
    "year": {
      "description": "The year the movie was released",
      "title": "Year",
      "type": "integer"
    },
    "director": {
      "description": "The director of the movie",
      "title": "Director",
      "type": "string"
    },
    "rating": {
      "description": "The movie's rating out of 10",
      "title": "Rating",
      "type": "number"
    }
  },
  "required": [
    "title",
    "year",
    "director",
    "rating"
  ],
  "title": "Movie",
  "type": "object"
}
```

The class docstring became the schema's `description`. Asked for structured output with this class, LangChain sends the schema to the language model, which answers with JSON that fits it, and you get a `Movie` object back ([lesson 9.5](lesson:9.5)). The names, descriptions and the `required` list are all the model learns about what you want, so write them as instructions.

## Fixed choices with Literal

```python title="Notebook cell"
from typing import Literal


class Route(BaseModel):
    step: Literal["poem", "story", "joke"] = Field(
        description="The next step in the routing process"
    )


print(Route(step="joke"))
print(Route.model_json_schema()["properties"]["step"])
Route(step="song")
```

```output real note="the end of the error"
step='joke'
{'description': 'The next step in the routing process', 'enum': ['poem', 'story', 'joke'], 'title': 'Step', 'type': 'string'}
ValidationError: 1 validation error for Route
step
  Input should be 'poem', 'story' or 'joke' [type=literal_error, input_value='song', input_type=str]
    For further information visit https://errors.pydantic.dev/2.14/v/literal_error
```

The schema lists the allowed values under `enum`, so the language model sees its choices, and anything else is rejected. Routers in [lesson 13.3](lesson:13.3) and graders in [lesson 15.3](lesson:15.3) are built this way.

## Check a JSON reply

When you receive JSON text yourself, one call parses and checks it; two more turn a model back into data:

```python title="Notebook cell"
reply = '{"title": "Inception", "year": 2010, "director": "Christopher Nolan", "rating": 8.8}'
movie = Movie.model_validate_json(reply)
print(movie.title, movie.year)
print(movie.model_dump())
print(movie.model_dump_json())
```

```output real
Inception 2010
{'title': 'Inception', 'year': 2010, 'director': 'Christopher Nolan', 'rating': 8.8}
{"title":"Inception","year":2010,"director":"Christopher Nolan","rating":8.8}
```

```python title="Notebook cell"
Movie.model_validate_json('{"title": "Inception", "year": 2010')
```

```output real note="the end of the error"
ValidationError: 1 validation error for Movie
  Invalid JSON: EOF while parsing an object at line 1 column 35 [type=json_invalid, input_value='{"title": "Inception", "year": 2010', input_type=str]
    For further information visit https://errors.pydantic.dev/2.14/v/json_invalid
```

- `model_validate_json(text)` parses JSON and validates it; broken JSON is a `ValidationError` too. `model_validate(data)` does the same for a dict.
- `model_dump()` returns a dict, `model_dump_json()` compact JSON text: ready for an API response ([lesson 3.11](lesson:3.11)) or a file.
- Older code uses the names from Pydantic 1: `.dict()`, `.json()`, `parse_obj()` and `@validator` are now `model_dump()`, `model_dump_json()`, `model_validate()` and `@field_validator`.

## Practice

::: practice
**Grade a document.** A retrieval step asks a language model whether a document is relevant. Write `GradeDocuments` with the docstring "Binary score for relevance check on retrieved documents." and one field, `binary_score`, that only allows `"yes"` or `"no"`, described as "Documents are relevant to the question, 'yes' or 'no'". Print the schema's description and the allowed values, build a grade of `"yes"`, then try `"maybe"` and print the error message.

```python title="Notebook cell"
from typing import Literal

from pydantic import BaseModel, Field, ValidationError


class GradeDocuments(BaseModel):
    """Binary score for relevance check on retrieved documents."""

    binary_score: Literal["yes", "no"] = Field(
        description="Documents are relevant to the question, 'yes' or 'no'"
    )


schema = GradeDocuments.model_json_schema()
print(schema["description"])
print(schema["properties"]["binary_score"]["enum"])
print(GradeDocuments(binary_score="yes"))
try:
    GradeDocuments(binary_score="maybe")
except ValidationError as e:
    print(e.errors()[0]["msg"])
```

```output real
Binary score for relevance check on retrieved documents.
['yes', 'no']
binary_score='yes'
Input should be 'yes' or 'no'
```

With `str` instead of `Literal`, a reply of `"Yes."` or `"maybe"` would pass and break the check that compares it with `"yes"`; the `Literal` both tells the model its choices and enforces them.
:::

::: practice
**Plan a report.** A planner model must return report sections. Write `Section` with a `name` and a `description` (each with a `Field` description), and `Sections` with a field `sections` that holds a list of `Section`. Check the reply `{"sections": [{"name": "Introduction", "description": "What agents are"}, {"name": "Tools", "description": "How agents act"}]}`, print each section's name, and print the keys under the schema's `$defs`.

```python title="Notebook cell"
from pydantic import BaseModel, Field


class Section(BaseModel):
    name: str = Field(description="Name for this section of the report")
    description: str = Field(
        description="Brief overview of the main topics and concepts of the section"
    )


class Sections(BaseModel):
    sections: list[Section] = Field(description="Sections of the report")


reply = '{"sections": [{"name": "Introduction", "description": "What agents are"}, {"name": "Tools", "description": "How agents act"}]}'
plan = Sections.model_validate_json(reply)
for section in plan.sections:
    print(section.name)
print(list(Sections.model_json_schema()["$defs"]))
```

```output real
Introduction
Tools
['Section']
```

Each dict in the list became a `Section`. In the schema, nested models are defined once under `$defs`, and the list field points to them.
:::
