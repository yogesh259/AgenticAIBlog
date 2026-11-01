+++
number = "1.7"
title = "Lists"
lede = "A list keeps items in order: read them by position, take slices, change them, and grow or shrink the list with its methods."
summary = "Keep items in order, read them by position, slice them and change them with list methods."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/3-Data Structures: 3.1-Lists.ipynb, 3.1.1-ListExamples.ipynb, 3.2-Tuples.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A list is an ordered collection: every item has a position, and you can change, add and remove items after the list is created. Lists hold the documents, messages and results you will pass around in agent code.

## Create a list

```python title="Notebook cell"
lst = []
print(type(lst))

names = ["Alice", "Jack", "Jacob", 1, 2, 3, 4, 5]
print(names)

mixed_list = [1, "Hello", 3.14, True]
print(mixed_list)
```

```output real
<class 'list'>
['Alice', 'Jack', 'Jacob', 1, 2, 3, 4, 5]
[1, 'Hello', 3.14, True]
```

Square brackets make a list. One list can mix types.

## Read items by position

```python title="Notebook cell"
fruits = ["apple", "banana", "cherry", "kiwi", "guava"]

print(fruits[0])
print(fruits[2])
print(fruits[-1])
print(fruits[1:])
print(fruits[1:3])
```

```output real
apple
cherry
guava
['banana', 'cherry', 'kiwi', 'guava']
['banana', 'cherry']
```

Positions (indexes) start at 0; negative ones count from the end. A position past the end is an error:

```python title="Notebook cell"
fruits[10]
```

```output real note="last line of the error"
IndexError: list index out of range
```

## Slicing

```python title="Notebook cell"
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

print(numbers[2:5])
print(numbers[:5])
print(numbers[5:])
print(numbers[::2])
print(numbers[::-1])
print(numbers[::3])
print(numbers[::-2])
```

```output real
[3, 4, 5]
[1, 2, 3, 4, 5]
[6, 7, 8, 9, 10]
[1, 3, 5, 7, 9]
[10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
[1, 4, 7, 10]
[10, 8, 6, 4, 2]
```

`numbers[start:stop:step]` starts at `start`, moves by `step`, and stops **before** `stop`, so `numbers[2:5]` has 5 − 2 = 3 items. A missing start or stop means "from the beginning" or "to the end", and a negative step walks backwards: `[::-1]` reverses. Strings and tuples slice the same way.

::: visual slice-explorer | Interactive figure | Slice explorer
Pick a slice of `numbers` and see which cells it takes.
:::

## Change items

```python title="Notebook cell"
fruits[1] = "watermelon"
print(fruits)

fruits[1:] = "melon"
print(fruits)
```

```output real
['apple', 'watermelon', 'cherry', 'kiwi', 'guava']
['apple', 'm', 'e', 'l', 'o', 'n']
```

Assigning to a position replaces one item. Assigning to a slice replaces it with the items of whatever you give it, and the items of a string are its letters. To put in one item, give a list: `fruits[1:] = ["melon"]`.

## List methods

```python title="Notebook cell"
fruits = ["apple", "banana", "cherry", "kiwi", "guava"]

fruits.append("orange")
fruits.insert(1, "watermelon")
print(fruits)

fruits.remove("banana")
print(fruits)

last = fruits.pop()
print(last, fruits)

print(fruits.index("cherry"))
fruits.insert(2, "banana")
print(fruits.count("banana"))
```

```output real
['apple', 'watermelon', 'banana', 'cherry', 'kiwi', 'guava', 'orange']
['apple', 'watermelon', 'cherry', 'kiwi', 'guava', 'orange']
orange ['apple', 'watermelon', 'cherry', 'kiwi', 'guava']
2
1
```

```python title="Notebook cell"
fruits.sort()
print(fruits)
fruits.reverse()
print(fruits)
fruits.clear()
print(fruits)
```

```output real
['apple', 'banana', 'cherry', 'guava', 'kiwi', 'watermelon']
['watermelon', 'kiwi', 'guava', 'cherry', 'banana', 'apple']
[]
```

| Method | What it does |
|---|---|
| `append(x)` | add `x` at the end |
| `insert(i, x)` | add `x` at position `i` |
| `remove(x)` | remove the first `x` |
| `pop()`, `pop(i)` | remove and return the last item, or the one at `i` |
| `index(x)`, `count(x)` | position of the first `x`; how many `x` |
| `sort()`, `reverse()` | reorder the list itself |
| `clear()` | remove everything |

`sort()` changes the list and returns `None`; `sorted()` leaves the list alone and returns a new, sorted one:

```python title="Notebook cell"
scores = [3, 1, 2]
print(sorted(scores), scores)
print(scores.sort(), scores)
```

```output real
[1, 2, 3] [3, 1, 2]
None [1, 2, 3]
```

## Loop over a list

```python title="Notebook cell"
for number in numbers:
    print(number, end=" ")
```

```output real
1 2 3 4 5 6 7 8 9 10
```

```python title="Notebook cell"
for index, fruit in enumerate(["apple", "banana", "cherry"]):
    print(index, fruit)
```

```output real
0 apple
1 banana
2 cherry
```

`enumerate()` hands you the position and the item together.

## Lists inside lists

```python title="Notebook cell"
lst = [[1, 2, 3, 4], [6, 7, 8, 9], [1, "Hello", 3.14, "c"]]

print(lst[0])
print(lst[0][0:3])
print(lst[2][1])
```

```output real
[1, 2, 3, 4]
[1, 2, 3]
Hello
```

The first index picks the inner list, the second picks inside it.

## Practice

::: practice
**To-do list.** Start with three tasks, add two, remove one you finished, remind yourself about a task if it is still there, and print what is left.

```python title="Notebook cell"
to_do_list = ["Buy groceries", "Clean the house", "Pay bills"]

to_do_list.append("Schedule meeting")
to_do_list.append("Go for a run")
to_do_list.remove("Clean the house")

if "Pay bills" in to_do_list:
    print("Don't forget to pay the utility bills")

print("To-do list remaining:")
for task in to_do_list:
    print(f"- {task}")
```

```output real
Don't forget to pay the utility bills
To-do list remaining:
- Buy groceries
- Pay bills
- Schedule meeting
- Go for a run
```
:::

::: practice
**Student grades.** Add a grade to a list of grades, then print the average with two decimals, the highest and the lowest.

```python title="Notebook cell"
grades = [85, 92, 78, 90, 88]
grades.append(95)

average_grade = sum(grades) / len(grades)
print(f"Average Grade: {average_grade:.2f}")
print(f"Highest Grade: {max(grades)}")
print(f"Lowest Grade: {min(grades)}")
```

```output real
Average Grade: 88.00
Highest Grade: 95
Lowest Grade: 78
```

`sum()`, `len()`, `max()` and `min()` work on any list of numbers.
:::

::: practice
**Store inventory.** Add an item, remove one that is out of stock, check whether oranges are in stock, and print the inventory.

```python title="Notebook cell"
inventory = ["apples", "bananas", "oranges", "grapes"]
inventory.append("strawberries")
inventory.remove("bananas")

item = "oranges"
if item in inventory:
    print(f"{item} are in stock.")
else:
    print(f"{item} are out of stock.")

print("Inventory List:")
for item in inventory:
    print(f"- {item}")
```

```output real
oranges are in stock.
Inventory List:
- apples
- oranges
- grapes
- strawberries
```
:::
