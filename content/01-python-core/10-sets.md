+++
number = "1.10"
title = "Sets"
lede = "A set keeps each item once, answers \"is this in here?\" quickly, and compares collections with union, intersection and difference."
summary = "Keep unique items, test membership quickly and compare collections with set operations."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/3-Data Structures: 3.3-Sets.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A set is a collection of unique items with no order. Use one to remove duplicates, to test membership fast, and for the set maths you know from school.

## Create a set

```python title="Notebook cell"
my_set = {1, 2, 3, 4, 5}
print(my_set, type(my_set))

my_empty_set = set()
print(type(my_empty_set), type({}))

print(set([1, 2, 3, 6, 5, 4, 5, 6]))
```

```output real
{1, 2, 3, 4, 5} <class 'set'>
<class 'set'> <class 'dict'>
{1, 2, 3, 4, 5, 6}
```

Duplicates disappear. `{}` is an empty dictionary, so an empty set is written `set()`.

## Add and remove

```python title="Notebook cell"
my_set = {1, 2, 3, 4, 5, 6}
my_set.add(7)
my_set.add(7)
print(my_set)

my_set.remove(3)
print(my_set)
my_set.discard(11)
print(my_set)
```

```output real
{1, 2, 3, 4, 5, 6, 7}
{1, 2, 4, 5, 6, 7}
{1, 2, 4, 5, 6, 7}
```

Adding an item that is already there changes nothing. `remove()` fails on a missing item, `discard()` doesn't:

```python title="Notebook cell"
my_set.remove(10)
```

```output real note="last line of the error"
KeyError: 10
```

```python title="Notebook cell"
removed_element = my_set.pop()
print(removed_element, my_set)

my_set.clear()
print(my_set)
```

```output real
1 {2, 4, 5, 6, 7}
set()
```

A set has no order, so `pop()` removes an arbitrary item: don't rely on which one.

## Membership

```python title="Notebook cell"
my_set = {1, 2, 3, 4, 5}
print(3 in my_set)
print(10 in my_set)
```

```output real
True
False
```

`in` on a set takes about the same time however large the set is, while `in` on a list checks the items one by one.

## Set operations

```python title="Notebook cell"
set1 = {1, 2, 3, 4, 5, 6}
set2 = {4, 5, 6, 7, 8, 9}

print(set1.union(set2))
print(set1.intersection(set2))
print(set1.difference(set2))
print(set2.difference(set1))
print(set1.symmetric_difference(set2))
```

```output real
{1, 2, 3, 4, 5, 6, 7, 8, 9}
{4, 5, 6}
{1, 2, 3}
{8, 9, 7}
{1, 2, 3, 7, 8, 9}
```

| Method | Keeps |
|---|---|
| `union` | items in either set |
| `intersection` | items in both |
| `difference` | items in the first set but not the second |
| `symmetric_difference` | items in exactly one of the two |

::: visual set-operations | Interactive figure | Set operations
Two overlapping sets; each operation lights the region it keeps.
:::

These return a new set. The `_update` versions change the first set instead:

```python title="Notebook cell"
set1.intersection_update(set2)
print(set1)
```

```output real
{4, 5, 6}
```

```python title="Notebook cell"
set1 = {1, 2, 3, 4, 5}
set2 = {3, 4, 5}

print(set1.issubset(set2))
print(set1.issuperset(set2))
```

```output real
False
True
```

`set2` is a subset of `set1`: all of its items are in `set1`.

## Remove duplicates from a list

```python title="Notebook cell"
lst = [1, 2, 2, 3, 4, 4, 5]
print(set(lst))
```

```output real
{1, 2, 3, 4, 5}
```

## Practice

::: practice
**Unique words.** Split a sentence into words and print the unique words and how many there are.

```python title="Notebook cell"
text = "the cat and the dog and the bird"
words = text.split()

unique_words = set(words)
print(unique_words)
print(len(unique_words))
```

```output real note="the order of the words changes from run to run"
{'dog', 'the', 'cat', 'and', 'bird'}
5
```

Strings are placed in a set by a hash that changes each time Python starts, so the order differs between runs; the count doesn't.
:::
