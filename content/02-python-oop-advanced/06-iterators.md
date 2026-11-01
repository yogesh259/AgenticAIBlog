+++
number = "2.6"
title = "Iterators"
lede = "A `for` loop works on lists, strings, files and generators alike because they all follow one small protocol: `iter()` hands out an iterator, and `next()` asks it for items until it raises `StopIteration`."
summary = "Iterables and iterators, `iter()` and `next()`, `StopIteration`, what a `for` loop does, and a class that is its own iterator."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/9-Advance Python Concepts: 9.1-Iterators.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

An **iterable** is anything you can loop over: a list, a string, a dictionary, a file. An **iterator** is the object that does the walking: it remembers its position and hands out one item per request. The split is the same as Java's `Iterable` and `Iterator`; only the method names differ.

## Get an iterator

```python title="Notebook cell"
my_list = [1, 2, 3, 4, 5, 6]
for i in my_list:
    print(i, end=" ")
print()

iterator = iter(my_list)
print(type(iterator))
print(next(iterator))
print(next(iterator))
```

```output real
1 2 3 4 5 6
<class 'list_iterator'>
1
2
```

`iter()` asks the list for a fresh iterator. Each `next()` returns the next item and moves the iterator on; the list itself doesn't change.

## The end of the items

```python title="Notebook cell"
iterator = iter([1, 2])
print(next(iterator))
print(next(iterator))
print(next(iterator, "no more items"))
next(iterator)
```

```output real note="last line of the error"
1
2
no more items
StopIteration
```

After the last item, `next()` raises `StopIteration`. Give it a second argument and it returns that instead. Catch the exception like any other ([lesson 1.19](lesson:1.19)):

```python title="Notebook cell"
iterator = iter(my_list)

for _ in range(7):
    try:
        print(next(iterator), end=" ")
    except StopIteration:
        print("There are no elements in the iterator")
```

```output real
1 2 3 4 5 6 There are no elements in the iterator
```

## What a for loop does

These lines are what `for item in my_list:` does for you:

```python title="Notebook cell"
iterator = iter(my_list)
while True:
    try:
        item = next(iterator)
    except StopIteration:
        break
    print(item, end=" ")
```

```output real
1 2 3 4 5 6
```

So `for` works on anything `iter()` accepts, and it treats `StopIteration` as "done", not as an error.

## One pass only

```python title="Notebook cell"
string_iterator = iter("Hello")
print(next(string_iterator), next(string_iterator))
print(list(string_iterator))
print(list(string_iterator))

print(iter(my_list) is iter(my_list))
print(iter(string_iterator) is string_iterator)
```

```output real
H e
['l', 'l', 'o']
[]
False
True
```

A string hands out its characters. The iterator is used up after one pass: the second `list()` gets nothing, just as with `map()` ([lesson 1.14](lesson:1.14)). A list returns a new iterator on every `iter()` call, so you can loop over it again and again; an iterator returns itself, so a second loop over it finds it empty.

## Your own iterator

An iterator is any object with two methods: `__iter__`, which returns the iterator, and `__next__`, which returns the next item or raises `StopIteration`.

```python title="Notebook cell"
class Countdown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):
        return self

    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        self.current -= 1
        return self.current + 1


for number in Countdown(3):
    print(number)
```

```output real
3
2
1
```

`iter(x)` calls `x.__iter__()` and `next(x)` calls `x.__next__()` ([lesson 2.5](lesson:2.5)). Writing the state handling by hand is tedious; [lesson 2.7](lesson:2.7) builds the same countdown as a three-line generator.

## Coming from Java

| Java | Python |
|---|---|
| `Iterable<T>` with `iterator()` | An iterable: `__iter__()`, called by `iter(x)` |
| `Iterator<T>` with `hasNext()` and `next()` | An iterator: `__next__()`, called by `next(it)`; there is no `hasNext()` |
| `NoSuchElementException` past the end | `StopIteration`, the normal end signal; `for` catches it |
| `for (int x : items)` | `for x in items:` |
