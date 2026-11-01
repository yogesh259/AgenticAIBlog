+++
number = "1.2"
title = "Variables and data types"
lede = "A variable is a name for a value. The value carries its type, and Python converts between types only when you ask it to."
summary = "Create variables, follow the naming rules, check types with type(), convert between int, float and str, and read input."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/1-Python Basics: 1.1-Variables.ipynb, 1.2-Datatypes.ipynb, 1.0-basic.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A variable is a name that refers to a value. You create one by assigning a value with `=`; there is no separate declaration step. The value's **data type** decides what you can do with it: add numbers, join text, test a condition.

## Create variables

```python title="Notebook cell"
age = 32
height = 6.1
name = "Alice"
is_student = True

print("age:", age)
print("height:", height)
print("name:", name)
```

```output real
age: 32
height: 6.1
name: Alice
```

`print()` takes several values and puts a space between them.

## Naming rules

A name starts with a letter or `_` and continues with letters, digits and `_`. By convention, variable names are lowercase words joined by underscores: `first_name`, `is_student`. Break a rule and the cell won't run:

| Code | Error |
|---|---|
| `2age = 30` | `SyntaxError: invalid decimal literal` |
| `first-name = "Alice"` | `SyntaxError: cannot assign to expression here. Maybe you meant '==' instead of '='?` |
| `@name = "Alice"` | `SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?` |

The second one fails because Python reads `first-name` as `first - name`, a subtraction.

## Data types

```python title="Notebook cell"
nothing = None

print(type(age))
print(type(height))
print(type(name))
print(type(is_student))
print(type(nothing))
```

```output real
<class 'int'>
<class 'float'>
<class 'str'>
<class 'bool'>
<class 'NoneType'>
```

| Type | Holds | Examples |
|---|---|---|
| `int` | whole numbers, of any size | `32`, `-7`, `10**20` |
| `float` | numbers with a decimal point | `6.1`, `2.0` |
| `str` | text, in single or double quotes | `"Alice"`, `'42'` |
| `bool` | `True` or `False`; comparisons produce them | `10 == 10` |
| `NoneType` | only `None`, meaning "no value" | what a function returns when it has no `return` |

A notebook also shows the value of a cell's last line without `print()`, in its own shorter format:

```python title="Notebook cell"
type(age)
```

```output real
int
```

## Dynamic typing

```python title="Notebook cell"
var = 10
print(var, type(var))

var = "Hello"
print(var, type(var))

var = 3.14
print(var, type(var))
```

```output real
10 <class 'int'>
Hello <class 'str'>
3.14 <class 'float'>
```

The type belongs to the value, not to the name. Assigning again points the name at a new value, of any type.

## Convert between types

```python title="Notebook cell"
age = 25
age_str = str(age)
print(age_str, type(age_str))

print(int("25") + 1)
print(float(int(5.11)))
```

```output real
25 <class 'str'>
26
5.0
```

`int()` drops the fraction (5.11 becomes 5) rather than rounding it; `round(5.11)` rounds. Text that isn't a number can't be converted:

```python title="Notebook cell"
int("Alice")
```

```output real note="last line of the error"
ValueError: invalid literal for int() with base 10: 'Alice'
```

Python never converts for you, even to join text and a number:

```python title="Notebook cell"
result = "Hello" + 5
```

```output real note="last line of the error"
TypeError: can only concatenate str (not "int") to str
```

```python title="Notebook cell"
result = "Hello" + str(5)
print(result)
```

```output real
Hello5
```

## Read input

`input()` shows a prompt, waits for the user to type, and returns the text they typed as a string, even when it looks like a number. Convert it before doing maths:

```python title="Notebook cell" input="23"
age = int(input("What is your age? "))
print(age, type(age))
```

```output real note="typed 23"
23 <class 'int'>
```

In a VS Code notebook the prompt appears in a box at the top of the window **VERIFY**.

## Practice

::: practice
**Simple calculator.** Read two numbers and print their sum, difference, product and quotient.

```python title="Notebook cell" input="56|10"
num1 = float(input("Enter first number: "))
num2 = float(input("Enter second number: "))

print("Sum:", num1 + num2)
print("Difference:", num1 - num2)
print("Product:", num1 * num2)
print("Quotient:", num1 / num2)
```

```output real note="typed 56 and 10"
Sum: 66.0
Difference: 46.0
Product: 560.0
Quotient: 5.6
```

`float()` accepts both `56` and `5.6`, so the calculator works with whole and decimal numbers.
:::
