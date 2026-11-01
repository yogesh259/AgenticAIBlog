+++
number = "1.8"
title = "List comprehensions"
lede = "Build a new list from an existing sequence in one line: the value to keep, the loop, and an optional filter."
summary = "Build a new list from another in one readable line, with or without a filter."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/3-Data Structures: 3.1-Lists.ipynb, 3.1.1-ListExamples.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Building a list in a loop takes three lines: an empty list, a `for`, an `append`. A list comprehension says the same in one line, and you will meet it constantly in Python code.

## From a loop to one line

```python title="Notebook cell"
lst = []
for x in range(10):
    lst.append(x ** 2)
print(lst)
```

```output real
[0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
```

```python title="Notebook cell"
squares = [x ** 2 for x in range(10)]
print(squares)
```

```output real
[0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
```

Read the comprehension as "`x ** 2` for each `x` in `range(10)`": the value you would `append` comes first, then the loop.

## Keep only some items

```python title="Notebook cell"
lst = []
for i in range(10):
    if i % 2 == 0:
        lst.append(i)
print(lst)

even_numbers = [num for num in range(10) if num % 2 == 0]
print(even_numbers)
```

```output real
[0, 2, 4, 6, 8]
[0, 2, 4, 6, 8]
```

An `if` at the end filters: only the items that pass reach the new list.

::: visual loop-to-comprehension | Figure | From loop to comprehension
The loop and the comprehension side by side, with matching parts linked.
:::

## Two loops

```python title="Notebook cell"
lst1 = [1, 2, 3, 4]
lst2 = ["a", "b", "c", "d"]

pairs = [[i, j] for i in lst1 for j in lst2]
print(pairs)
```

```output real
[[1, 'a'], [1, 'b'], [1, 'c'], [1, 'd'], [2, 'a'], [2, 'b'], [2, 'c'], [2, 'd'], [3, 'a'], [3, 'b'], [3, 'c'], [3, 'd'], [4, 'a'], [4, 'b'], [4, 'c'], [4, 'd']]
```

Several `for` clauses read left to right, like nested loops: the first is the outer loop.

## Call functions inside

```python title="Notebook cell"
words = ["hello", "world", "python", "list", "comprehension"]
lengths = [len(word) for word in words]
print(lengths)
```

```output real
[5, 5, 6, 4, 13]
```

| Form | Shape |
|---|---|
| Basic | `[expression for item in iterable]` |
| With a filter | `[expression for item in iterable if condition]` |
| Nested | `[expression for item1 in iterable1 for item2 in iterable2]` |

## Without the brackets

Inside a function call you can drop the brackets. The values are then produced one at a time and handed to the function, without building a list first. This is a **generator expression** ([module 02](module:02) shows how generators work):

```python title="Notebook cell"
print(sum(x ** 2 for x in range(10)))
print(any(len(word) > 10 for word in words))
print(all(len(word) > 4 for word in words))
```

```output real
285
True
False
```

`any()` is true when at least one value is true, `all()` when every value is.

## Practice

::: practice
**Positive feedback.** Add a comment to a list of customer comments, count the ones that mention "great" or "excellent" in any case, and print all comments.

```python title="Notebook cell"
feedback = ["Great service!", "Very satisfied", "Could be better", "Excellent experience"]
feedback.append("Not happy with the service")

positive_feedback_count = sum(
    1 for comment in feedback
    if "great" in comment.lower() or "excellent" in comment.lower()
)
print(f"Positive Feedback Count: {positive_feedback_count}")

print("User Feedback:")
for comment in feedback:
    print(f"- {comment}")
```

```output real
Positive Feedback Count: 2
User Feedback:
- Great service!
- Very satisfied
- Could be better
- Excellent experience
- Not happy with the service
```

`sum(1 for ... if ...)` counts the items that pass the filter: it adds 1 for each.
:::
