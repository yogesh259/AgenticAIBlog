+++
number = "1.4"
title = "Operators"
lede = "Arithmetic operators calculate, comparison operators answer yes-or-no questions, and logical operators combine the answers."
summary = "Calculate, compare and combine conditions: arithmetic, comparison and logical operators."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/1-Python Basics: 1.3-operators.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Operators take one or two values and produce a new one. The three families below cover almost every calculation and test you will write.

## Arithmetic

```python title="Notebook cell"
a = 10
b = 5

print(a + b)   # addition
print(a - b)   # subtraction
print(a * b)   # multiplication
print(a / b)   # division
print(a // b)  # floor division
print(a % b)   # modulus: the remainder
print(a ** b)  # exponentiation: a to the power of b
```

```output real
15
5
50
2.0
2
0
100000
```

Division needs a closer look:

```python title="Notebook cell"
print(10 / 5)
print(21 / 5)
print(21 // 5)
print(21 % 5)
```

```output real
2.0
4.2
4
1
```

`/` always returns a `float`, even when the division is exact. `//` divides and rounds down to a whole number, and `%` gives what is left over: 21 is 4 times 5, remainder 1. `n % 2 == 0` is the usual test for an even number.

## Comparisons

```python title="Notebook cell"
a = 10
b = 10
print(a == b)
print(a != b)

print("Alice" == "Alice")
print("Alice" == "alice")

num1 = 45
num2 = 55
print(num1 > num2, num1 < num2)
print(45 >= 45, 44 <= 45)
```

```output real
True
False
True
False
False True
True True
```

A comparison always produces `True` or `False`. `==` asks "equal?"; a single `=` assigns. Strings are compared character by character, so case matters.

## Logical operators

```python title="Notebook cell"
x = True
y = False
print(x and y)
print(x or y)
print(not x)
```

```output real
False
True
False
```

`and` is true only when both sides are, `or` when at least one is, and `not` flips a value. Python stops as soon as the answer is known: in `a and b`, if `a` is false, `b` is never evaluated. That makes this safe even for an empty list:

```python title="Notebook cell"
items = []
print(len(items) > 0 and items[0] == "apple")
```

```output real
False
```

The left side is `False`, so `items[0]`, which would fail on an empty list, never runs.

## Three more you will see often

```python title="Notebook cell"
count = 1
count += 1
print(count)

print("a" in "cat", 3 not in [1, 2, 3])

result = None
print(result is None)
```

```output real
2
True False
True
```

| Operator | Meaning |
|---|---|
| `+=`, `-=`, `*=`, `/=` | update a variable: `count += 1` is `count = count + 1` |
| `in`, `not in` | membership: is this item in the string, list, set or dict? |
| `is`, `is not` | the same object; use it to test for `None` |

## Practice

::: practice
**Calculator.** Read two numbers and print the result of every arithmetic operator on them.

```python title="Notebook cell" input="12|4"
num1 = float(input("Enter first number: "))
num2 = float(input("Enter second number: "))

addition = num1 + num2
subtraction = num1 - num2
multiplication = num1 * num2
division = num1 / num2
floor_division = num1 // num2
modulus = num1 % num2
exponentiation = num1 ** num2

print("Addition:", addition)
print("Subtraction:", subtraction)
print("Multiplication:", multiplication)
print("Division:", division)
print("Floor Division:", floor_division)
print("Modulus:", modulus)
print("Exponentiation:", exponentiation)
```

```output real note="typed 12 and 4"
Addition: 16.0
Subtraction: 8.0
Multiplication: 48.0
Division: 3.0
Floor Division: 3.0
Modulus: 0.0
Exponentiation: 20736.0
```

With `float` inputs every result is a `float`, even floor division and the remainder.
:::
