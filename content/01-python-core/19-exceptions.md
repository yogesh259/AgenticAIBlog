+++
number = "1.19"
title = "Handling exceptions"
lede = "Catch errors with try and except, run code only when nothing failed with else, always clean up with finally, and raise errors of your own."
summary = "Catch errors with try and except, clean up with finally, and raise your own."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/7-Exception Handling: 7.1-exception.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

An **exception** is an error raised while a program runs ([lesson 1.1](lesson:1.1)). Left alone, it stops the program. `try` and `except` let you catch it and decide what happens instead: show a message, use a default, try again. Model calls fail in exactly these ways (timeouts, bad replies, missing keys), so this is everyday code in agent projects.

## try and except

```python title="Notebook cell"
try:
    a = b
except:
    print("The variable has not been assigned")
```

```output real
The variable has not been assigned
```

The code in `try` runs; if it raises an error, Python jumps to `except` instead of stopping. A bare `except:` catches everything, even the interrupt you send to stop a cell, so name the errors you expect:

```python title="Notebook cell"
try:
    a = b
except NameError as ex:
    print(ex)
```

```output real
name 'b' is not defined
```

`as ex` gives you the exception object; printing it shows its message.

| Exception | Raised when | Example |
|---|---|---|
| `NameError` | a name was never assigned | `a = b` |
| `ZeroDivisionError` | dividing by zero | `1 / 0` |
| `ValueError` | the type is right but the value isn't | `int("abc")` |
| `TypeError` | an operation gets the wrong type | `"Hello" + 5` |
| `KeyError`, `IndexError` | a missing key, a position out of range | `{}["x"]`, `[][0]` |
| `FileNotFoundError` | opening a file that isn't there | `open("missing.txt")` |

## Several except clauses

```python title="Notebook cell"
try:
    result = 1 / 2
    a = b
except ZeroDivisionError as ex:
    print(ex)
    print("Please enter a denominator greater than 0")
except Exception as ex1:
    print(ex1)
    print("Main exception got caught here")
```

```output real
name 'b' is not defined
Main exception got caught here
```

Python checks the `except` clauses from the top and runs the first that matches. `Exception` matches almost every error, so it goes last, as a catch-all.

## else and finally

```python title="Notebook cell" input="0"
try:
    num = int(input("Enter a number: "))
    result = 10 / num
except ValueError:
    print("That's not a valid number!")
except ZeroDivisionError:
    print("You can't divide by zero!")
except Exception as ex:
    print(ex)
else:
    print(f"The result is {result}")
finally:
    print("Execution complete.")
```

```output real note="typed 0"
You can't divide by zero!
Execution complete.
```

`else` runs only when the `try` block raised nothing; `finally` runs every time, error or not. What the cell prints for three inputs:

| You type | Printed |
|---|---|
| `5` | `The result is 2.0`, then `Execution complete.` |
| `0` | `You can't divide by zero!`, then `Execution complete.` |
| `abc` | `That's not a valid number!`, then `Execution complete.` |

## Clean up with finally

`finally` is the place for cleanup that must happen whatever went wrong, such as closing a file. Create `example1.txt` next to your notebook with any text, then run:

```text title="example1.txt"
Some text.
```

```python title="Notebook cell"
try:
    file = open("example1.txt", "r")
    content = file.read()
    a = b
    print(content)
except FileNotFoundError:
    print("The file does not exist")
except Exception as ex:
    print(ex)
finally:
    if "file" in locals() and not file.closed:
        file.close()
        print("file closed")
```

```output real
name 'b' is not defined
file closed
```

The file opens, `a = b` fails, the error is printed, and `finally` still closes the file. `"file" in locals()` checks that the name was ever assigned: if `open()` itself failed, there is nothing to close.

::: warn
`closed` is an attribute, not a method: `file.closed()` raises `TypeError: 'bool' object is not callable`. And the test needs `and`: with `or`, a missing file makes Python read `file.closed` on a name that was never assigned, and `finally` itself fails with a `NameError`.
:::

A `with` block ([lesson 1.17](lesson:1.17)) does this cleanup for you:

```python title="Notebook cell"
try:
    with open("example1.txt", "r") as file:
        content = file.read()
        a = b
except FileNotFoundError:
    print("The file does not exist")
except Exception as ex:
    print(ex)

print(file.closed)
```

```output real
name 'b' is not defined
True
```

## Raise your own exceptions

```python title="Notebook cell"
def divide(a, b):
    if b == 0:
        raise ValueError("b must not be zero")
    return a / b

try:
    divide(10, 0)
except ValueError as ex:
    print("Caught:", ex)
```

```output real
Caught: b must not be zero
```

`raise` stops the function and sends the error to whoever called it, who can catch it like any other. Raise early, with a clear message, when a function gets input it can't work with. Inside an `except` block, a bare `raise` passes the current error on after you have, say, logged it. Your own exception types are classes ([module 02](module:02)).
