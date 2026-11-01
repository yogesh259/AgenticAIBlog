+++
number = "1.14"
title = "Lambda, map and filter"
lede = "Write a one-line function with lambda, apply a function to every item with map(), and keep only the items that pass a test with filter()."
summary = "Pass small functions to map() and filter() to transform and select items."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/4-Functions: 4.3-Lambda.ipynb, 4.4-Mapsfunction.ipynb, 4.5-filterfunction.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

In Python a function is a value like any other: you can pass it to another function. `map()` and `filter()` take a function and a sequence, and `lambda` writes the small function on the spot.

## Lambda functions

```python title="Syntax" norun
lambda arguments: expression
```

```python title="Notebook cell"
def addition(a, b):
    return a + b

addition_lambda = lambda a, b: a + b
print(addition(5, 6), addition_lambda(5, 6))

even = lambda num: num % 2 == 0
print(even(12), even(7))

add_three = lambda x, y, z: x + y + z
print(add_three(12, 13, 14))
```

```output real
11 11
True False
39
```

A lambda takes any number of arguments but holds a single expression, whose value it returns. Naming one with `=` is only for the demonstration; for a named function, use `def`. Lambdas are meant to be passed straight into calls such as `map()`, `filter()` and `sorted(..., key=...)`.

## map(): transform every item

```python title="Notebook cell"
def square(x):
    return x * x

numbers = [1, 2, 3, 4, 5, 6, 7, 8]
print(list(map(square, numbers)))
print(list(map(lambda x: x * x, numbers)))
```

```output real
[1, 4, 9, 16, 25, 36, 49, 64]
[1, 4, 9, 16, 25, 36, 49, 64]
```

`map(function, sequence)` calls the function on each item. It doesn't build a list: it returns a `map` object that produces the results on demand, once:

```python title="Notebook cell"
squares = map(square, numbers)
print(type(squares))
print(list(squares))
print(list(squares))
```

```output real
<class 'map'>
[1, 4, 9, 16, 25, 36, 49, 64]
[]
```

The second `list()` is empty because the first one used up the results. Wrap `map()` in `list()` when you need the values more than once.

```python title="Notebook cell"
numbers1 = [1, 2, 3]
numbers2 = [4, 5, 6]
print(list(map(lambda x, y: x + y, numbers1, numbers2)))

print(list(map(int, ["1", "2", "3", "4", "5"])))
print(list(map(str.upper, ["apple", "banana", "cherry"])))
```

```output real
[5, 7, 9]
[1, 2, 3, 4, 5]
['APPLE', 'BANANA', 'CHERRY']
```

With two sequences, the function gets one item from each. Any function works, including types such as `int` and methods such as `str.upper`.

## filter(): keep the items that pass

```python title="Notebook cell"
def even(num):
    if num % 2 == 0:
        return True

lst = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
print(list(filter(even, lst)))
print(even(3))
```

```output real
[2, 4, 6, 8, 10, 12]
None
```

`filter(function, sequence)` keeps the items for which the function returns something true. This `even` returns `None` for odd numbers, which counts as false, so it works; `return num % 2 == 0` says the same more clearly.

```python title="Notebook cell"
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9]
print(list(filter(lambda x: x > 5, numbers)))
print(list(filter(lambda x: x > 5 and x % 2 == 0, numbers)))
```

```output real
[6, 7, 8, 9]
[6, 8]
```

## On a list of dictionaries

```python title="Notebook cell"
people = [
    {"name": "Alice", "age": 32},
    {"name": "Jack", "age": 33},
    {"name": "John", "age": 25},
]

def get_name(person):
    return person["name"]

def age_greater_than_25(person):
    return person["age"] > 25

print(list(map(get_name, people)))
print(list(filter(age_greater_than_25, people)))
```

```output real
['Alice', 'Jack', 'John']
[{'name': 'Alice', 'age': 32}, {'name': 'Jack', 'age': 33}]
```

## The same with comprehensions

```python title="Notebook cell"
print([x * x for x in numbers])
print([x for x in numbers if x > 5])
```

```output real
[1, 4, 9, 16, 25, 36, 49, 64, 81]
[6, 7, 8, 9]
```

A list comprehension ([lesson 1.8](lesson:1.8)) does both jobs and is often easier to read. `map()` and `filter()` are handy when the function already exists, like `int` or `get_name`.
