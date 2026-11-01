+++
number = "1.1"
title = "Python syntax: comments, indentation and errors"
lede = "The rules Python checks before it runs anything: names are case-sensitive, `#` starts a comment, and indentation decides which lines belong together."
summary = "Case sensitivity, comments, indentation, long lines, and the difference between a syntax error and a runtime error."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/1-Python Basics: 1.0-basic.ipynb, test.py"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

**Syntax** is the set of rules for writing code that Python can read. **Semantics** is what that code means when it runs. Python reads a whole cell first and refuses to run any of it if one line breaks a syntax rule. Run the cells below in order, in a notebook in your project ([lesson 0.2](lesson:0.2)).

This module needs only Python's standard library, plus NumPy for one import in [lesson 1.15](lesson:1.15). Add this line to `requirements.txt` and run your install command again ([lesson 0.1](lesson:0.1)):

```text title="requirements.txt"
numpy
```

## Python is case-sensitive

```python title="Notebook cell"
name = "Alice"
Name = "Smith"

print(name)
print(Name)
```

```output real
Alice
Smith
```

`name` and `Name` are two different variables. The same goes for everything else: `print` works, `Print` is an unknown name.

## Comments

```python title="Notebook cell"
# A comment: Python ignores everything after the #
print("Hello World")  # a comment can also follow code
```

```output real
Hello World
```

Python has no block-comment syntax. Text in triple quotes is often used as one, but it is a string: Python creates it and throws it away. A notebook gives it away by showing the string as the cell's value:

```python title="Notebook cell"
"""
This is not a comment.
It is a string nobody uses.
"""
```

```output real
'\nThis is not a comment.\nIt is a string nobody uses.\n'
```

At the start of a file, function or class, a triple-quoted string is a **docstring**: the description that `help()` shows ([lesson 1.12](lesson:1.12)).

## Indentation marks the blocks

Python groups lines by indentation, where many languages use braces `{ }`. A line ending in `:` opens a block, and every line of that block is indented by the same amount: 4 spaces by convention. VS Code inserts them when you press Tab.

```python title="Notebook cell"
if True:
    print("Correct indentation")
    if False:
        print("This won't print")
    print("This will print")
print("Outside the if block")
```

```output real
Correct indentation
This will print
Outside the if block
```

The block under `if False:` is skipped, and the last line belongs to neither block, so it always runs. Leave out the indentation and nothing in the cell runs:

```python title="Notebook cell"
age = 32
if age > 30:
print(age)
```

```output real note="last line of the error"
IndentationError: expected an indented block after 'if' statement on line 2
```

## Long lines and several statements

A backslash at the end of a line continues the statement on the next one:

```python title="Notebook cell"
total = 1 + 2 + 3 + 4 + 5 + 6 + 7 + \
    4 + 5 + 6
print(total)
```

```output real
43
```

Inside brackets a line can break without the backslash, which most style guides prefer:

```python title="Notebook cell"
total = (1 + 2 + 3 + 4 + 5 + 6 + 7
         + 4 + 5 + 6)
print(total)
```

```output real
43
```

A semicolon puts several statements on one line:

```python title="Notebook cell"
x = 5; y = 10; z = x + y
print(z)
```

```output real
15
```

It works, but one statement per line is easier to read.

## Syntax errors and runtime errors

When a line breaks a syntax rule, Python reports a `SyntaxError` and runs nothing, not even the lines before it:

```python title="Notebook cell"
print("start")
2age = 30
```

```output real note="last line of the error"
SyntaxError: invalid decimal literal
```

When the syntax is fine, Python runs the lines in order and can still fail on one of them. Here `b` was never given a value:

```python title="Notebook cell"
print("start")
a = b
```

```output real note="last line of the error"
start
NameError: name 'b' is not defined
```

The first error is about how the code is written, the second about what it means when it runs. [Lesson 1.19](lesson:1.19) shows how to catch errors like the second one.
