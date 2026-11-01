+++
number = "1.12"
title = "Functions"
lede = "Give a block of code a name, feed it arguments and get a result back: defaults, keyword arguments, *args, **kwargs and several return values."
summary = "Wrap code in reusable functions with parameters, defaults, *args, **kwargs and return values."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/4-Functions: 4.1-functions.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A function is a named block of code that does one task. Write it once, call it wherever you need it, and give it different inputs each time. Agent tools are plain Python functions, so everything here carries straight over.

## Define and call a function

```python title="Syntax" norun
def function_name(parameters):
    """Docstring: what the function does."""
    # body
    return value
```

```python title="Notebook cell"
def even_or_odd(num):
    """Print whether num is even or odd."""
    if num % 2 == 0:
        print("the number is even")
    else:
        print("the number is odd")

even_or_odd(24)
even_or_odd(7)
```

```output real
the number is even
the number is odd
```

`def` names the function and its **parameters**; the values you pass when calling it are the **arguments**. The triple-quoted line under `def` is the **docstring**, the description `help()` shows:

```python title="Notebook cell"
help(even_or_odd)
```

```output real
Help on function even_or_odd in module __main__:

even_or_odd(num)
    Print whether num is even or odd.
```

When a function becomes an agent tool, its docstring is what the model reads to decide when to call it ([lesson 9.3](lesson:9.3)).

## Return a value

```python title="Notebook cell"
def add(a, b):
    return a + b

result = add(2, 4)
print(result)

print(even_or_odd(3))
```

```output real
6
the number is odd
None
```

`return` sends a value back to the caller, who can store it or use it. `even_or_odd` only prints and has no `return`, so it gives back `None`: the last line prints the message, then `None`.

## Defaults and keyword arguments

```python title="Notebook cell"
def greet(name="Guest"):
    print(f"Hello {name}, welcome to the paradise")

greet("Alice")
greet()
greet(name="Bob")
```

```output real
Hello Alice, welcome to the paradise
Hello Guest, welcome to the paradise
Hello Bob, welcome to the paradise
```

`name="Guest"` is a default, used when the call leaves the argument out. A call can also name its arguments, `greet(name="Bob")`; then their order no longer matters, but they must come after any positional ones. Libraries are mostly called this way, for example `ChatOpenAI(model="gpt-4o", temperature=0)`.

## Any number of arguments

```python title="Notebook cell"
def print_numbers(*args):
    for number in args:
        print(number, end=" ")

print_numbers(1, 2, 3, 4, 5, 6, 7, 8, "Alice")
```

```output real
1 2 3 4 5 6 7 8 Alice
```

A starred parameter collects all extra positional arguments into a tuple. `args` is only a convention; any name works after the `*`.

```python title="Notebook cell"
def print_details(**kwargs):
    for key, value in kwargs.items():
        print(f"{key}: {value}")

print_details(name="Alice", age="32", country="India")
```

```output real
name: Alice
age: 32
country: India
```

A double-starred parameter collects the extra keyword arguments into a dictionary. Both together accept anything:

```python title="Notebook cell"
def print_details(*args, **kwargs):
    for val in args:
        print(f"Positional argument: {val}")
    for key, value in kwargs.items():
        print(f"{key}: {value}")

print_details(1, 2, 3, 4, "Alice", name="Alice", age="32", country="India")
```

```output real
Positional argument: 1
Positional argument: 2
Positional argument: 3
Positional argument: 4
Positional argument: Alice
name: Alice
age: 32
country: India
```

## Return several values

```python title="Notebook cell"
def multiply(a, b):
    return a * b, a

print(multiply(2, 3))

product, first = multiply(2, 3)
print(product, first)
```

```output real
(6, 2)
6 2
```

`return a * b, a` returns one tuple, which the caller can unpack into names ([lesson 1.9](lesson:1.9)).

You will also meet functions with **type hints**, such as `def add(a: int, b: int) -> int:`. They state the expected types without changing what the function does ([lesson 4.1](lesson:4.1)); Pydantic puts them to work ([lesson 4.2](lesson:4.2)).
