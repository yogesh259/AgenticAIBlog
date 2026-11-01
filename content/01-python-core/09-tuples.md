+++
number = "1.9"
title = "Tuples"
lede = "A tuple is a list that can't change: use it for fixed records, for returning several values, and as a dictionary key."
summary = "Fixed sequences: create them, unpack them into variables and use them as records."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/3-Data Structures: 3.2-Tuples.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Tuples are ordered like lists but **immutable**: once created, their items can't be replaced, added or removed. That makes them safe to pass around and usable as dictionary keys ([lesson 1.11](lesson:1.11)).

## Create a tuple

```python title="Notebook cell"
empty_tuple = ()
print(empty_tuple, type(empty_tuple))

numbers = tuple([1, 2, 3, 4, 5, 6])
print(numbers)
print(list((1, 2, 3)))

mixed_tuple = (1, "Hello World", 3.14, True)
print(mixed_tuple)

print(type((5,)), type((5)))
```

```output real
() <class 'tuple'>
(1, 2, 3, 4, 5, 6)
[1, 2, 3]
(1, 'Hello World', 3.14, True)
<class 'tuple'> <class 'int'>
```

`tuple()` and `list()` convert between the two. The comma makes a tuple, not the brackets: `(5,)` is a tuple, `(5)` is just the number 5.

## Read and combine

```python title="Notebook cell"
print(numbers[2], numbers[-1])
print(numbers[0:4])
print(numbers[::-1])

print(numbers + mixed_tuple)
print(mixed_tuple * 2)
```

```output real
3 6
(1, 2, 3, 4)
(6, 5, 4, 3, 2, 1)
(1, 2, 3, 4, 5, 6, 1, 'Hello World', 3.14, True)
(1, 'Hello World', 3.14, True, 1, 'Hello World', 3.14, True)
```

Indexing and slicing work as for lists ([lesson 1.7](lesson:1.7)). `+` joins two tuples into a new one and `*` repeats one.

## Tuples can't change

```python title="Notebook cell"
lst = [1, 2, 3, 4, 5]
lst[1] = "Alice"
print(lst)

numbers[1] = "Alice"
```

```output real note="last line of the error"
[1, 'Alice', 3, 4, 5]
TypeError: 'tuple' object does not support item assignment
```

The list accepts the change; the tuple refuses it. Its only two methods read it:

```python title="Notebook cell"
print(numbers.count(1))
print(numbers.index(3))
```

```output real
1
2
```

## Packing and unpacking

```python title="Notebook cell"
packed_tuple = 1, "Hello", 3.14
print(packed_tuple)

a, b, c = packed_tuple
print(a, b, c)

first, *middle, last = (1, 2, 3, 4, 5, 6)
print(first, middle, last)
```

```output real
(1, 'Hello', 3.14)
1 Hello 3.14
1 [2, 3, 4, 5] 6
```

Commas alone pack values into a tuple. Unpacking assigns each item to a name, in order. A starred name such as `*middle` collects whatever is left over into a list. Unpacking is what happens in `for key, value in d.items()` and when a function returns several values ([lesson 1.12](lesson:1.12)).

## Nested tuples

```python title="Notebook cell"
nested_tuple = ((1, 2, 3), ("a", "b", "c"), (True, False))

print(nested_tuple[0])
print(nested_tuple[1][2])

for sub_tuple in nested_tuple:
    for item in sub_tuple:
        print(item, end=" ")
    print()
```

```output real
(1, 2, 3)
c
1 2 3
a b c
True False
```

`print()` with nothing inside just ends the line.
