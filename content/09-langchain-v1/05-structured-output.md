+++
number = "9.5"
title = "Structured output"
lede = "Code needs fields, not paragraphs. Ask a model, or a whole agent, to answer in a schema you define, and get a Pydantic object, a dict or a dataclass back."
summary = "with_structured_output with Pydantic models, what it builds and its three methods, keeping the raw reply, nested data, TypedDict and its traps, model profiles, structured output from an agent with Pydantic, TypedDict or a dataclass, provider and tool strategies, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "9 LangChain Updated: 5-structuredoutput.ipynb (retired Qwen 3 model replaced, the two Movie classes merged, a TypedDict mistake explained); methods, strategies and interview questions added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A model answers in prose, and prose is hard to use in code: the year of a film is somewhere in a paragraph, worded differently each time. Structured output asks the model to fill a schema instead, and LangChain turns the reply into an object with typed fields. It is how agents extract data from documents, classify requests, pick a route ([lesson 13.3](lesson:13.3)) and return results other code can store. [Lesson 4.3](lesson:4.3) showed how a Pydantic class becomes the JSON schema a model receives; this lesson sends it.

## Set up

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

```python title="Notebook cell"
from langchain.chat_models import init_chat_model

model = init_chat_model("groq:openai/gpt-oss-120b")
```

The model cells need `GROQ_API_KEY`, the agent cells at the end `OPENAI_API_KEY`. The Groq answers below come from Qwen 3 32B, which Groq has since retired.

## Ask for a Pydantic object

```python title="Notebook cell"
from pydantic import BaseModel, Field


class Movie(BaseModel):
    """A movie with details."""
    title: str = Field(..., description="The title of the movie")
    year: int = Field(..., description="The year the movie was released")
    director: str = Field(..., description="The director of the movie")
    rating: float = Field(..., description="The movie's rating out of 10")


model_with_structure = model.with_structured_output(Movie)
model_with_structure
```

```output real note="memory addresses differ per run"
_ChatModelBinding(bound=ChatGroq(metadata={'lc_versions': {'langchain-core': '1.7.3', 'langchain': '1.4.7'}}, profile={'name': 'GPT OSS 120B', 'release_date': '2025-08-05', 'last_updated': '2026-05-27', 'open_weights': True, 'max_input_tokens': 131072, 'max_output_tokens': 65536, 'text_inputs': True, 'image_inputs': False, 'audio_inputs': False, 'video_inputs': False, 'text_outputs': True, 'image_outputs': False, 'audio_outputs': False, 'video_outputs': False, 'reasoning_output': True, 'tool_calling': True, 'structured_output': True, 'attachment': False, 'temperature': True}, client=<groq.resources.chat.completions.Completions object at 0x00000199C5FB8740>, async_client=<groq.resources.chat.completions.AsyncCompletions object at 0x00000199C61017F0>, model_name='openai/gpt-oss-120b', model_kwargs={}, groq_api_key=SecretStr('**********')), kwargs={'tools': [{'type': 'function', 'function': {'name': 'Movie', 'description': 'A movie with details.', 'parameters': {'properties': {'title': {'description': 'The title of the movie', 'type': 'string'}, 'year': {'description': 'The year the movie was released', 'type': 'integer'}, 'director': {'description': 'The director of the movie', 'type': 'string'}, 'rating': {'description': "The movie's rating out of 10", 'type': 'number'}}, 'required': ['title', 'year', 'director', 'rating'], 'type': 'object'}}}], 'ls_structured_output_format': {'kwargs': {'method': 'function_calling'}, 'schema': {'type': 'function', 'function': {'name': 'Movie', 'description': 'A movie with details.', 'parameters': {'properties': {'title': {'description': 'The title of the movie', 'type': 'string'}, 'year': {'description': 'The year the movie was released', 'type': 'integer'}, 'director': {'description': 'The director of the movie', 'type': 'string'}, 'rating': {'description': "The movie's rating out of 10", 'type': 'number'}}, 'required': ['title', 'year', 'director', 'rating'], 'type': 'object'}}}}, 'tool_choice': {'type': 'function', 'function': {'name': 'Movie'}}}, config={}, config_factories=[])
| PydanticToolsParser(first_tool_only=True, tools=[<class '__main__.Movie'>])
```

`with_structured_output` returns a new runnable of two steps. With Groq, the first is the model with `Movie` bound as a tool and `tool_choice` set to that tool, so the model has to call it; the second, a `PydanticToolsParser`, turns the call's arguments into a `Movie`. The class docstring and the field descriptions travel in the tool's schema, so they are instructions to the model ([lesson 4.3](lesson:4.3)). Asked normally, the model writes an essay:

```python title="Notebook cell" norun
model.invoke("Provide details about the movie Inception")
```

```output saved note="from a run with Qwen 3 32B, since retired; reasoning and metadata trimmed; answers vary per run"
AIMessage(content='<think>\n[...]\n</think>\n\n**Inception (2010)** is a groundbreaking science fiction action film directed by Christopher Nolan, known for his innovative storytelling and complex narratives. Here\'s a detailed breakdown of the film:\n\n### **Plot Overview**\nThe story centers on **Dom Cobb** (Leonardo DiCaprio), a skilled thief who infiltrates the subconscious of targets to steal secrets [...]', ...)
```

With the schema it fills four fields:

```python title="Notebook cell" norun
response = model_with_structure.invoke("Provide details about the movie Inception")
response
```

```output saved note="from a run with Qwen 3 32B, since retired; answers vary per run"
Movie(title='Inception', year=2010, director='Christopher Nolan', rating=8.8)
```

`response.year` is the integer `2010`, checked by Pydantic like any other `Movie` ([lesson 4.2](lesson:4.2)).

## Keep the raw reply

```python title="Notebook cell" norun
model_with_structure = model.with_structured_output(Movie, include_raw=True)

response = model_with_structure.invoke("Provide details about the movie Inception")
response
```

```output saved note="from a run with Qwen 3 32B, since retired; reasoning and metadata trimmed; tool call IDs vary per run"
{'raw': AIMessage(content='', additional_kwargs={'reasoning_content': "Okay, the user is asking for details about the movie Inception. Let me check the tools available. There's a Movie function that requires title, year, director, and rating. [...]", 'tool_calls': [...]}, response_metadata={'finish_reason': 'tool_calls', ...}, tool_calls=[{'name': 'Movie', 'args': {'director': 'Christopher Nolan', 'rating': 8.8, 'title': 'Inception', 'year': 2010}, 'id': 'r0n9zde78', 'type': 'tool_call'}], usage_metadata={'input_tokens': 231, 'output_tokens': 170, 'total_tokens': 401, 'output_token_details': {'reasoning': 122}}),
 'parsed': Movie(title='Inception', year=2010, director='Christopher Nolan', rating=8.8),
 'parsing_error': None}
```

`include_raw=True` returns the model's `AIMessage` beside the parsed object, so you can log token usage and see how the model got there. A reply that doesn't fit the schema no longer raises: `parsed` is then `None` and `parsing_error` holds the exception, ready for a retry or a fallback. The raw reply also shows the mechanism: an ordinary tool call named `Movie`.

## Nested data

```python title="Notebook cell" norun
from pydantic import BaseModel, Field


class Actor(BaseModel):
    name: str
    role: str


class MovieDetails(BaseModel):
    title: str
    year: int
    cast: list[Actor]
    genres: list[str]
    budget: float | None = Field(None, description="Budget in millions USD")


model_with_structure = model.with_structured_output(MovieDetails)

response = model_with_structure.invoke("Provide details about the movie Inception")
response
```

```output saved note="from a run with Qwen 3 32B, since retired; answers vary per run"
MovieDetails(title='Inception', year=2010, cast=[Actor(name='Leonardo DiCaprio', role='Dom Cobb'), Actor(name='Joseph Gordon-Levitt', role='Arthur'), Actor(name='Elliot Page', role='Ariadne'), Actor(name='Tom Hardy', role='Bane')], genres=['Science Fiction', 'Action', 'Heist'], budget=160.0)
```

Lists of objects nest as deep as the schema does, and `budget` may be `None` because it has a default. Look at the cast, though: Tom Hardy played Eames in Inception; Bane is his role in another Nolan film. The schema guarantees the shape of the answer, never its truth. Values that matter still need checking against a source, as in RAG ([lesson 6.3](lesson:6.3)).

## TypedDict instead of Pydantic

```python title="Notebook cell"
from typing_extensions import TypedDict, Annotated


class MovieDict(TypedDict):
    """A movie with details."""
    title: Annotated[str, ..., "The title of the movie"]
    year: Annotated[int, ..., "The year the movie was released"]
    director: Annotated[str, ..., "The director of the movie"]
    rating: Annotated[float, ..., "The movie's rating out of 10"]
```

```python title="Notebook cell" norun
model_withtypedict = model.with_structured_output(MovieDict)
response = model_withtypedict.invoke("Please provide the details of the movie avengers")
response
```

```output saved note="from a run with Qwen 3 32B, since retired; answers vary per run"
{'director': 'Joss Whedon', 'rating': 8, 'title': 'The Avengers', 'year': 2012}
```

A `TypedDict` is lighter: no class to import, and the result is a plain dict. Each field is `Annotated[type, default, "description"]`, where `...` as the default means required. Nothing is validated, though: `rating` came back as the integer `8` although the hint says `float`, and a Pydantic model would have converted it, or rejected a wrong value.

The next cell mixes the two styles, and that fails silently:

```python title="Notebook cell"
class Actor(TypedDict):
    name: str
    role: str


class MovieDetails(TypedDict):
    title: str
    year: int
    cast: list[Actor]
    genres: list[str]
    budget: float | None = Field(None, description="Budget in millions USD")
```

```python title="Notebook cell" norun
model_with_structure = model.with_structured_output(MovieDetails)

response = model_with_structure.invoke("Provide details about the movie Avengers")
response
```

```output saved note="from a run with Qwen 3 32B, since retired; answers vary per run"
{'budget': 220000000,
 'cast': [{'name': 'Robert Downey Jr.', 'role': 'Iron Man'},
  {'name': 'Chris Evans', 'role': 'Captain America'},
  {'name': 'Mark Ruffalo', 'role': 'Hulk'},
  {'name': 'Chris Hemsworth', 'role': 'Thor'},
  {'name': 'Scarlett Johansson', 'role': 'Black Widow'},
  {'name': 'Jeremy Renner', 'role': 'Hawkeye'}],
 'genres': ['Action', 'Science Fiction', 'Adventure'],
 'title': 'The Avengers',
 'year': 2012}
```

The budget came back in dollars, not millions. Python accepts a `Field(...)` in a `TypedDict`, but LangChain reads only the type hints of a `TypedDict`, so the description never reached the model and `budget` became a required number:

```python title="Notebook cell"
from langchain_core.utils.function_calling import convert_to_openai_tool

parameters = convert_to_openai_tool(MovieDetails)["function"]["parameters"]
print(parameters["properties"]["budget"], parameters["required"])
```

```output real
{'type': 'number'} ['title', 'year', 'cast', 'genres', 'budget']
```

In a `TypedDict`, the description and the default go inside `Annotated`:

```python title="Notebook cell"
class MovieDetails(TypedDict):
    title: str
    year: int
    cast: list[Actor]
    genres: list[str]
    budget: Annotated[float | None, None, "Budget in millions USD"]


parameters = convert_to_openai_tool(MovieDetails)["function"]["parameters"]
print(parameters["properties"]["budget"], parameters["required"])
```

```output real
{'description': 'Budget in millions USD', 'type': 'number'} ['title', 'year', 'cast', 'genres']
```

Printing the schema before sending it catches mistakes like this one in a second.

## What the model can do

```python title="Notebook cell"
model.profile
```

```output real
{'name': 'GPT OSS 120B',
 'release_date': '2025-08-05',
 'last_updated': '2026-05-27',
 'open_weights': True,
 'max_input_tokens': 131072,
 'max_output_tokens': 65536,
 'text_inputs': True,
 'image_inputs': False,
 'audio_inputs': False,
 'video_inputs': False,
 'text_outputs': True,
 'image_outputs': False,
 'audio_outputs': False,
 'video_outputs': False,
 'reasoning_output': True,
 'tool_calling': True,
 'structured_output': True,
 'attachment': False,
 'temperature': True}
```

A profile lists a model's limits and abilities: context window, maximum output, accepted inputs, reasoning, tool calling, structured output. The data ships inside the provider package, derived from the open models.dev catalogue, so reading it costs no request; a newer package knows newer models. `create_agent` reads it to choose how to get structured output (below), and [lesson 9.6](lesson:9.6)'s summarisation reads its context window.

## Three ways to get structure

`with_structured_output` takes a `method`:

| `method` | How it works | Guarantee |
|---|---|---|
| `"function_calling"` | The schema is sent as a tool the model must call; the arguments are parsed (Groq's default) | The model is trained to follow tool schemas; mistakes are rare, not impossible |
| `"json_schema"` | The provider's native structured output: the schema is enforced while the model writes (OpenAI's default) | With strict mode, the reply always matches the schema |
| `"json_mode"` | The model only promises valid JSON; the schema must be described in the prompt | Valid JSON, any shape |

Whatever the method, `with_structured_output` validates a Pydantic result once more after parsing, while a `TypedDict` or a raw JSON schema comes back as the model wrote it.

## Structured output from an agent

An agent can end its run with structured data too. Pass the schema as `response_format`; the agent can still call tools first, and the result arrives under `structured_response`:

:::: tabs
::: tab Pydantic
```python title="Notebook cell" norun
from pydantic import BaseModel, Field
from langchain.agents import create_agent


class ContactInfo(BaseModel):
    """Contact information for a person."""
    name: str = Field(description="The name of the person")
    email: str = Field(description="The email address of the person")
    phone: str = Field(description="The phone number of the person")

agent = create_agent(
    model="gpt-5",
    response_format=ContactInfo  # Auto-selects ProviderStrategy
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "Extract contact info from: John Doe, john@example.com, (555) 123-4567"}]
})

result
```

```output saved note="metadata trimmed; IDs vary per run"
{'messages': [HumanMessage(content='Extract contact info from: John Doe, john@example.com, (555) 123-4567', ...),
  AIMessage(content='{"name":"John Doe","email":"john@example.com","phone":"(555) 123-4567"}', response_metadata={'model_name': 'gpt-5-2025-08-07', 'finish_reason': 'stop', ...}, usage_metadata={'input_tokens': 204, 'output_tokens': 100, 'total_tokens': 304, 'output_token_details': {'audio': 0, 'reasoning': 64}, ...})],
 'structured_response': ContactInfo(name='John Doe', email='john@example.com', phone='(555) 123-4567')}
```

```python title="Notebook cell" norun
result["structured_response"]
```

```output saved
ContactInfo(name='John Doe', email='john@example.com', phone='(555) 123-4567')
```
:::
::: tab TypedDict
```python title="Notebook cell" norun
## Typedict
from typing_extensions import TypedDict
from langchain.agents import create_agent


class ContactInfo(TypedDict):
    """Contact information for a person."""
    name: str  # The name of the person
    email: str  # The email address of the person
    phone: str  # The phone number of the person

agent = create_agent(
    model="gpt-5",
    response_format=ContactInfo  # Auto-selects ProviderStrategy
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "Extract contact info from: John Doe, john@example.com, (555) 123-4567"}]
})

result["structured_response"]
```

```output saved
{'name': 'John Doe', 'email': 'john@example.com', 'phone': '(555) 123-4567'}
```

The comments are for people only: a model sees the field names and the class docstring, not comments. `Annotated` descriptions would reach it.
:::
::: tab Dataclass
```python title="Notebook cell" norun
## Dataclass
from dataclasses import dataclass
from langchain.agents import create_agent


@dataclass
class ContactInfo:
    """Contact information for a person."""
    name: str  # The name of the person
    email: str  # The email address of the person
    phone: str  # The phone number of the person


agent = create_agent(
    model="gpt-5",
    response_format=ContactInfo  # Auto-selects ProviderStrategy
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "Extract contact info from: John Doe, john@example.com, (555) 123-4567"}]
})

result["structured_response"]
```

```output saved
ContactInfo(name='John Doe', email='john@example.com', phone='(555) 123-4567')
```

A dataclass result is an instance of your class. In an agent, LangChain checks `TypedDict` and dataclass results against their hints as well, converting `"42"` to `42` and sending a failed check back to the model to try again (checked with LangChain 1.4); only a raw JSON schema comes back unchecked.
:::
::::

OpenAI shuts `gpt-5` down on 11 December 2026; its named replacement is `gpt-5.6-sol`.

`create_agent` gets the structure in one of two ways, chosen from the model's profile:

| Strategy | Used when | What the run looks like |
|---|---|---|
| `ProviderStrategy` | The model supports native structured output (`gpt-5`, gpt-oss, Gemini; Gemini 2.x only for agents without tools) | The final `AIMessage` holds the JSON, as above: two messages |
| `ToolStrategy` | Any other model that can call tools | The schema becomes a tool; the model calls it, and the agent adds a `ToolMessage` reading "Returning structured response: ..." before stopping: three messages |

Both were checked with LangChain 1.4, Qwen 3 32B being one that gets `ToolStrategy`. To choose yourself, pass `response_format=ToolStrategy(ContactInfo)` or `ProviderStrategy(ContactInfo)`, from `langchain.agents.structured_output`. `ToolStrategy` also handles failures: when the arguments don't fit the schema, it sends the error back to the model and lets it try again.

## Interview questions

::: check
An extraction pipeline returns valid objects, but some values are wrong. What do you do?

Valid output says nothing about correctness: the schema fixes the shape, the model still guesses the values. Give the model the source text and tell it to extract only what is there, allow `None` for missing values instead of forcing a guess, add validators for checkable rules (formats, ranges, dates), compare a sample against a labelled test set, and send low-confidence or high-stakes records to a person.
:::

::: check
A classifier asks the model for a category as free text, and you get "billing", "Billing issue" and "payments". How do you fix it?

Make the category a `Literal["billing", "technical", "account"]` in the schema. It becomes an `enum`, so the model sees the only allowed values, native structured output enforces them, and Pydantic rejects anything else. Describe each value in the field's description so the model knows where the edge cases go.
:::

::: check
When would you choose `ToolStrategy` over native structured output?

When the model has no native structured output, when the schema uses features the provider's strict mode doesn't support, or when you want the agent's built-in retry: `ToolStrategy` returns validation errors to the model for another attempt. Native output is the better default where available: the provider enforces the schema while the model writes, and no extra message is needed.
:::

## Practice

::: practice
**A ticket schema.** Write a Pydantic model `Ticket` for support requests: `category` as one of "billing", "technical" or "account", `priority` from 1 to 5, and a one-sentence `summary`, each with a description. Print the schema a model would receive. No model needed.

```python title="Notebook cell"
from typing import Literal

from pydantic import BaseModel, Field


class Ticket(BaseModel):
    """A support ticket triaged from a customer's message."""
    category: Literal["billing", "technical", "account"] = Field(description="The team that should handle it")
    priority: int = Field(ge=1, le=5, description="1 = whenever, 5 = service is down")
    summary: str = Field(description="One sentence describing the problem")


convert_to_openai_tool(Ticket)["function"]["parameters"]
```

```output real
{'properties': {'category': {'description': 'The team that should handle it',
   'enum': ['billing', 'technical', 'account'],
   'type': 'string'},
  'priority': {'description': '1 = whenever, 5 = service is down',
   'maximum': 5,
   'minimum': 1,
   'type': 'integer'},
  'summary': {'description': 'One sentence describing the problem',
   'type': 'string'}},
 'required': ['category', 'priority', 'summary'],
 'type': 'object'}
```

`ge` and `le` became `minimum` and `maximum`, and the `Literal` an `enum`: the limits are written into the schema the model reads, and checked again by Pydantic on the way back.
:::

::: practice
**Validate replies.** A model in JSON mode returned these three replies. Parse each with `Ticket.model_validate_json` and print the ticket, or the first validation error.

```python title="Notebook cell"
from pydantic import ValidationError

replies = [
    '{"category": "billing", "priority": 2, "summary": "Charged twice for one order."}',
    '{"category": "payments", "priority": 2, "summary": "Charged twice."}',
    '{"category": "technical", "priority": 9, "summary": "Login page is down."}',
]
for reply in replies:
    try:
        print(Ticket.model_validate_json(reply))
    except ValidationError as error:
        problem = error.errors()[0]
        print("rejected:", problem["loc"][0], "-", problem["msg"])
```

```output real
category='billing' priority=2 summary='Charged twice for one order.'
rejected: category - Input should be 'billing', 'technical' or 'account'
rejected: priority - Input should be less than or equal to 5
```

This is the safety net behind every structured output method: whatever produced the JSON, the model class decides what your code accepts ([lesson 4.2](lesson:4.2)).
:::

## Further reading

- LangChain, [Structured output](https://docs.langchain.com/oss/python/langchain/structured-output): `response_format`, the provider and tool strategies, and error handling.
