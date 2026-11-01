+++
number = "4.2"
title = "Pydantic models and validation"
lede = "A Pydantic model is a class whose type hints are enforced: creating an object checks the data, converts what it safely can and rejects the rest with an error that names every problem."
summary = "Define models with BaseModel, read validation errors, make fields optional, and build lists and nested models from plain dicts."
type = "concept"
status = "published"
source = "3 Pydentic Overview: Pydentic_Intro.ipynb (cells 2, 5-16)"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Data reaching an agent comes from outside: a user's input, JSON from an API, a language model's reply. Pydantic checks such data against the type hints of a class at the moment you create an object from it. LangChain uses Pydantic models for structured output and tool arguments, and LangGraph accepts them as graph state.

## From dataclass to BaseModel

```python title="Notebook cell"
from pydantic import BaseModel


class Person(BaseModel):
    name: str
    age: int
    city: str


person = Person(name="Alice", age=30, city="Paris")
print(person)
person
```

```output real
name='Alice' age=30 city='Paris'
Person(name='Alice', age=30, city='Paris')
```

The class reads like the dataclass of [lesson 4.1](lesson:4.1), with `BaseModel` as its parent instead of a decorator. `print` shows the fields; a notebook's display, which uses `__repr__`, adds the class name ([lesson 2.5](lesson:2.5)). The difference shows with a wrong type:

```python title="Notebook cell"
Person(name="Alice", age=30, city=12)
```

```output real note="the end of the error"
ValidationError: 1 validation error for Person
city
  Input should be a valid string [type=string_type, input_value=12, input_type=int]
    For further information visit https://errors.pydantic.dev/2.14/v/string_type
```

## Read a validation error

- `1 validation error for Person`: how many fields failed, in which model.
- `city`: the field that failed.
- `Input should be a valid string`: what the field needed.
- `[type=string_type, input_value=12, input_type=int]`: the error's code, the value received and its type.
- The link explains that code; its version number is the installed Pydantic's.

## What Pydantic converts

```python title="Notebook cell"
print(Person(name="Alice", age="30", city="Paris"))
```

```output real
name='Alice' age=30 city='Paris'
```

The string `"30"` became the number 30. Pydantic converts a value when nothing is lost, and refuses the rest:

| Field | Input | Result |
|---|---|---|
| `int` | `"30"` or `30.0` | `30` |
| `int` | `30.5` or `"thirty"` | error |
| `float` | `60000` | `60000.0` |
| `bool` | `"yes"`, `"no"`, `1`, `0` | `True`, `False`, `True`, `False` |
| `str` | `12` | error: numbers never become text |
| `list[str]` | `("a", "b")` | `['a', 'b']` |
| a model | a dict | that model |

`model_config = ConfigDict(strict=True)` in the class body turns conversion off; then `"30"` is an error too.

## Optional fields and defaults

```python title="Notebook cell"
from typing import Optional


class Employee(BaseModel):
    id: int
    name: str
    department: str
    salary: Optional[float] = None  # optional, None by default
    is_active: Optional[bool] = True  # optional, True by default


emp1 = Employee(id=1, name="John", department="IT")
print(emp1)
emp2 = Employee(id=2, name="Jane", department="HR", salary=60000, is_active=False)
print(emp2)
```

```output real
id=1 name='John' department='IT' salary=None is_active=True
id=2 name='Jane' department='HR' salary=60000.0 is_active=False
```

A field with a default may be left out; `id`, `name` and `department` have none, so they are required. `Optional[float]` says something else: the value may also be `None` ([lesson 4.1](lesson:4.1)). Without a default, such a field is still required:

```python title="Notebook cell"
class Payslip(BaseModel):
    salary: Optional[float]


print(Payslip(salary=None))
Payslip()
```

```output real note="the end of the error"
salary=None
ValidationError: 1 validation error for Payslip
salary
  Field required [type=missing, input_value={}, input_type=dict]
    For further information visit https://errors.pydantic.dev/2.14/v/missing
```

| | `None` not allowed | `None` allowed |
|---|---|---|
| **Required** | `salary: float` | `salary: float \| None` |
| **Optional** | `salary: float = 0.0` | `salary: float \| None = None` |

Whatever the row, a value you do pass must fit the hint: `salary="lots"` fails.

## Lists

```python title="Notebook cell"
from typing import List


class Classroom(BaseModel):
    room_number: str
    students: List[str]  # a list of strings
    capacity: int


classroom = Classroom(
    room_number="A101",
    students=("Alice", "Bob", "Charlie"),
    capacity=30,
)
print(classroom)
```

```output real
room_number='A101' students=['Alice', 'Bob', 'Charlie'] capacity=30
```

`List[str]` is the older spelling of `list[str]`, and the tuple was converted to a list. A wrong item is reported with its position:

```python title="Notebook cell"
try:
    invalid_val = Classroom(room_number="A1", students=["Alice", 123], capacity=30)
except ValueError as e:
    print(e)
```

```output real
1 validation error for Classroom
students.1
  Input should be a valid string [type=string_type, input_value=123, input_type=int]
    For further information visit https://errors.pydantic.dev/2.14/v/string_type
```

`students.1` is the field, then the item's position, counted from 0. `except ValueError` works because Pydantic's `ValidationError` is a subclass of `ValueError`; `except ValidationError` catches failed validation only. Every failing field is reported at once, and `errors()` returns them as data:

```python title="Notebook cell"
from pydantic import ValidationError

try:
    Classroom(room_number=101, students="Alice", capacity="thirty")
except ValidationError as e:
    print(e.error_count())
    for error in e.errors():
        print(error["loc"], error["msg"])
```

```output real
3
('room_number',) Input should be a valid string
('students',) Input should be a valid list
('capacity',) Input should be a valid integer, unable to parse string as an integer
```

Each error is a dict: `loc` is the location as a tuple, `msg` the message. A list like this is what you hand back to a model when its reply doesn't fit, so it can try again.

## Nested models

```python title="Notebook cell"
class Address(BaseModel):
    street: str
    city: str
    zip_code: int


class Customer(BaseModel):
    customer_id: int
    name: str
    address: Address  # a nested model


customer = Customer(
    customer_id=1,
    name="Emma",
    address={"street": "123 Main St", "city": "Boston", "zip_code": "02108"},
)
print(customer)
print(customer.address.city)
```

```output real
customer_id=1 name='Emma' address=Address(street='123 Main St', city='Boston', zip_code=2108)
Boston
```

The dict was checked as an `Address` and became one, so `customer.address.city` works. JSON from an API or a language model arrives as nested dicts and lists, and one call checks all of it; a failure deep inside reports its path, such as `address.zip_code`.

Look at `zip_code`, though: `"02108"` became the number 2108 and lost its leading zero. Postcodes, phone numbers and IDs are text: declare them `str`.

## What Pydantic doesn't catch

```python title="Notebook cell"
emp = Employee(id=3, name="Ana", department="IT", salery=50000)
print(emp)

emp.salary = "a lot"
print(emp)
```

```output real
id=3 name='Ana' department='IT' salary=None is_active=True
id=3 name='Ana' department='IT' salary='a lot' is_active=True
```

Unknown keys are dropped without a word, so the misspelt `salery` left `salary` at its default. And the checks run when an object is created, not when you change it later. Both can be switched on in the class body: `model_config = ConfigDict(extra="forbid", validate_assignment=True)`, with `ConfigDict` imported from `pydantic`.

## Dataclass, TypedDict or BaseModel?

| | `@dataclass` | `TypedDict` | `BaseModel` |
|---|---|---|---|
| Comes from | `dataclasses` | `typing` | `pydantic` |
| Gives you | an object: `p.name` | a plain dict: `p["name"]` | an object: `p.name` |
| Wrong types | kept | kept | converted or rejected |
| Typical use | simple records | graph state ([lesson 10.2](lesson:10.2)) | structured output and tool arguments ([lesson 9.5](lesson:9.5)) |

LangChain and LangGraph accept all three for structured output and for graph state. Pick `BaseModel` when the data comes from outside and must be checked.

## Practice

::: practice
**Check a model's reply.** A language model was asked for movie details and replied with `{"title": "Inception", "year": "2010", "director": "Christopher Nolan", "rating": 8.8}`. Write a `Movie` model with a string `title`, an int `year`, a string `director` and a float `rating`, and build a movie from the reply. Then try a second reply that has no `year` and gives `"high"` as the rating, and print the location and message of each error.

```python title="Notebook cell"
from pydantic import BaseModel, ValidationError


class Movie(BaseModel):
    title: str
    year: int
    director: str
    rating: float


reply = {"title": "Inception", "year": "2010", "director": "Christopher Nolan", "rating": 8.8}
print(Movie(**reply))

bad_reply = {"title": "Inception", "director": "Christopher Nolan", "rating": "high"}
try:
    Movie(**bad_reply)
except ValidationError as e:
    for error in e.errors():
        print(error["loc"], error["msg"])
```

```output real
title='Inception' year=2010 director='Christopher Nolan' rating=8.8
('year',) Field required
('rating',) Input should be a valid number, unable to parse string as a number
```

`Movie(**reply)` passes the dict's items as keyword arguments ([lesson 1.12](lesson:1.12)). The year arrived as text and was converted; the bad reply fails on both fields at once.
:::

::: practice
**Keep the zero.** Change `Address` so that a zip code keeps its leading zero and the street may be left out (default `None`). Build a customer whose address has a city and the zip code `"02108"`, but no street.

```python title="Notebook cell"
class Address(BaseModel):
    street: str | None = None
    city: str
    zip_code: str


class Customer(BaseModel):
    customer_id: int
    name: str
    address: Address


print(Customer(customer_id=2, name="Liam", address={"city": "Boston", "zip_code": "02108"}))
```

```output real
customer_id=2 name='Liam' address=Address(street=None, city='Boston', zip_code='02108')
```

A `str` field keeps the text as it came; `str | None = None` makes `street` optional. `Customer` is defined again because it must point to the new `Address`.
:::
