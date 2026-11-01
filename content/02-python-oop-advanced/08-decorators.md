+++
number = "2.8"
title = "Decorators"
lede = "A decorator takes a function and returns a new function that wraps it, adding work before or after each call. `@tool`, `@dataclass` and `@property` are all decorators."
summary = "Functions as objects, closures, decorators and the `@` syntax, decorators with arguments, and `functools.wraps`."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/9-Advance Python Concepts: 9.3-Decorators.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Decorators look like Java annotations, but they work differently: an annotation is a label that a compiler or framework reads, while a decorator is a function that runs when the `def` runs and replaces your function with whatever it returns. Three ideas build up to it: functions are objects, inner functions remember their surroundings, and functions can be passed around.

## Functions are objects

```python title="Notebook cell"
def welcome():
    return "Welcome to advanced Python"


wel = welcome
print(wel())

del welcome
print(wel())
print(wel.__name__)
```

```output real
Welcome to advanced Python
Welcome to advanced Python
welcome
```

`wel = welcome` copies nothing: it is a second name for the same function object, just as with dictionaries ([lesson 1.11](lesson:1.11)). `del welcome` removes one name; the function lives on, and still knows it was defined as `welcome`.

## Closures

```python title="Notebook cell"
def main_welcome(msg):
    def sub_welcome_method():
        print("Welcome to advanced Python")
        print(msg)
        print("Have a good day")
    return sub_welcome_method


greeter = main_welcome("Hello, Alice")
greeter()
```

```output real
Welcome to advanced Python
Hello, Alice
Have a good day
```

`main_welcome` has already returned, yet `greeter()` still prints `msg`: an inner function keeps the variables of the function it was defined in. That is a **closure**. Note the last line returns `sub_welcome_method` itself, without brackets; the next section calls the inner function instead.

## Functions as arguments

```python title="Notebook cell"
def main_welcome(func, lst):
    def sub_welcome_method():
        print("Welcome to advanced Python")
        print(func(lst))
        print("Have a good day")
    return sub_welcome_method()


main_welcome(len, [1, 2, 3, 4, 5])
```

```output real
Welcome to advanced Python
5
Have a good day
```

Any function can be passed in and called later, `len` here, as `map()` and `filter()` do ([lesson 1.14](lesson:1.14)). Here `return sub_welcome_method()` calls the inner function at once and returns its result. Combine the two ideas, a function passed in and an inner function wrapped around it, and you have a decorator.

## A first decorator, and its trap

```python title="Notebook cell"
def main_welcome(func):
    def sub_welcome_method():
        print("Welcome to advanced Python")
        func()
        print("Have a good day")
    return sub_welcome_method()


@main_welcome
def introduction():
    print("Decorators wrap functions")
```

```output real
Welcome to advanced Python
Decorators wrap functions
Have a good day
```

It printed while being defined, before any call. Now try to call it:

```python title="Notebook cell"
print(introduction)
introduction()
```

```output real note="last line of the error"
None
TypeError: 'NoneType' object is not callable
```

`@main_welcome` written above `def introduction` means `introduction = main_welcome(introduction)`. This `main_welcome` returns `sub_welcome_method()`, the *result* of calling the inner function, so the body ran once during decoration and the name `introduction` now holds `None`. A decorator must return the wrapper function itself, uncalled.

## The decorator pattern

```python title="Notebook cell"
def my_decorator(func):
    def wrapper():
        print("Something is happening before the function is called.")
        func()
        print("Something is happening after the function is called.")
    return wrapper


@my_decorator
def say_hello():
    print("Hello!")


say_hello()
```

```output real
Something is happening before the function is called.
Hello!
Something is happening after the function is called.
```

`my_decorator` returns `wrapper`, so after decoration the name `say_hello` points at the wrapper, and the wrapper keeps the original function in `func`. Every call now runs the wrapper, which calls the original in the middle.

::: visual decorator-wrap | Run player | What @my_decorator does
The cell above, step by step: which function each name points at, and the path a call takes.
:::

## Decorators with arguments

```python title="Notebook cell"
def repeat(n):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for _ in range(n):
                func(*args, **kwargs)
        return wrapper
    return decorator


@repeat(3)
def say_hello():
    print("Hello")


say_hello()
```

```output real
Hello
Hello
Hello
```

`@repeat(3)` first calls `repeat(3)`, which returns the actual decorator; that decorator wraps `say_hello`. So `@repeat(3)` means `say_hello = repeat(3)(say_hello)`: three functions, one inside the other. `*args, **kwargs` ([lesson 1.12](lesson:1.12)) let the wrapper accept any arguments and pass them on.

::: visual decorator-layers | Figure | Three layers of a decorator with arguments
The three nested functions of `repeat(n)` and when each one runs.
:::

## Keep the result and the name

```python title="Notebook cell"
@repeat(2)
def add(a, b):
    """Add two numbers."""
    return a + b


print(add(2, 3))
print(add.__name__, add.__doc__)
```

```output real
None
wrapper None
```

Two things went missing. The wrapper threw away `func`'s return value, and the decorated function now reports the wrapper's name and no docstring. Return the result, and copy the name and docstring over with `functools.wraps`:

```python title="Notebook cell"
import functools


def repeat(n):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(n):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator


@repeat(2)
def add(a, b):
    """Add two numbers."""
    return a + b


print(add(2, 3))
print(add.__name__, add.__doc__)
```

```output real
5
add Add two numbers.
```

Write every decorator this way. It matters in agent code: `@tool` turns a function into a tool the model can call, using the function's name and docstring as the tool's name and description ([lesson 9.3](lesson:9.3)).

## Coming from Java

| Java | Python |
|---|---|
| Annotation (`@Override`, `@Deprecated`): a label that tools read | Decorator: a function that runs at definition time and replaces the function |
| A proxy or aspect wrapping a method (Spring AOP) | A wrapper function around a function |
| Lambdas and method references, typed by functional interfaces | Every function is an object: assign it, pass it, return it |
| Lambdas capture effectively final variables | Closures capture variables; `nonlocal` lets them reassign one |
