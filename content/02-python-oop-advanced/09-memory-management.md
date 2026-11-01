+++
number = "2.9"
title = "Memory management"
lede = "Python frees most objects the moment nothing refers to them any more. Objects that refer to each other need a separate garbage collector, and `tracemalloc` shows where memory goes."
summary = "Reference counting, `del`, reference cycles and the `gc` module, `__del__`, habits that keep memory low, and `tracemalloc`."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/15-Memory Management: memory_manage.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

CPython, the standard Python, manages memory in two layers. **Reference counting** frees an object as soon as the last reference to it disappears, so most memory comes back immediately. A **garbage collector** runs now and then to find groups of objects that only refer to each other. The JVM, by contrast, relies on its tracing collector alone.

## Reference counting

```python title="Notebook cell"
import sys

a = []
print(sys.getrefcount(a))

b = a
print(sys.getrefcount(b))

del b
print(sys.getrefcount(a))
```

```output real
2
3
2
```

Every name, list slot or attribute that points at an object counts as one reference. `getrefcount` reports one more than you might expect: passing the object to it adds a temporary reference. So the list has one reference (`a`), then two (`a` and `b`), then one again. `del b` removes the name `b`, not the list. When the count reaches zero, the object is freed on the spot.

```python title="Notebook cell"
print(sys.getrefcount(None))
```

```output real
4294967295
```

Since Python 3.12, `None`, `True`, `False` and small integers are **immortal**: they are never freed, and their count is a fixed huge number.

## Freed at once

```python title="Notebook cell"
class MyObject:
    def __init__(self, name):
        self.name = name
        print(f"Object {self.name} created")

    def __del__(self):
        print(f"Object {self.name} deleted")


obj = MyObject("solo")
del obj
print("after del")
```

```output real
Object solo created
Object solo deleted
after del
```

`__del__` runs when the object is freed, here at the `del`, because that removed the only reference. It's useful for watching the collector, not for cleanup: use `with` for that ([lesson 1.17](lesson:1.17)).

## Cycles need the garbage collector

```python title="Notebook cell"
import gc

obj1 = MyObject("obj1")
obj2 = MyObject("obj2")
obj1.ref = obj2
obj2.ref = obj1

del obj1
del obj2
print("names deleted")

gc.collect()
```

```output real note="the count that gc.collect() returns can differ"
Object obj1 created
Object obj2 created
names deleted
Object obj1 deleted
Object obj2 deleted
11
```

After the two `del`s, each object still holds a reference to the other, so neither count reaches zero. Your code can no longer reach them, but they are still alive. The **cyclic garbage collector** looks for such islands and frees them. `gc.collect()` runs it now and returns how many unreachable objects it found.

::: visual reference-counts | Figure | Who still points here?
Reference counts on a list with two names, and a two-object cycle that only the garbage collector can free.
:::

## The gc module

```python title="Notebook cell"
print(gc.isenabled(), gc.get_threshold())

gc.disable()
print(gc.isenabled())
gc.enable()

print(gc.get_stats())
print(gc.garbage)
```

```output real note="the statistics differ on each run"
True (700, 10, 10)
False
[{'collections': 87, 'collected': 260, 'uncollectable': 0}, {'collections': 7, 'collected': 39, 'uncollectable': 0}, {'collections': 1, 'collected': 11, 'uncollectable': 0}]
[]
```

The collector is on by default and runs by itself after enough new objects have been created (the thresholds). It sorts objects into three generations and checks young ones most often, since most objects die young; `get_stats()` counts the collections per generation. `gc.garbage` lists objects it found but couldn't free; it is normally empty.

Disabling the collector doesn't stop reference counting, but cycles then pile up until you call `gc.collect()` yourself, which frees all of them at once. Leave it on.

## Measure with tracemalloc

```python title="Notebook cell"
import tracemalloc


def create_list():
    return [i for i in range(10000)]


def main():
    tracemalloc.start()

    numbers = create_list()

    snapshot = tracemalloc.take_snapshot()
    top_stats = snapshot.statistics("lineno")

    print("[ Top 10 ]")
    for stat in top_stats[:10]:
        print(stat)


main()
```

```output illustrative note="trimmed to the first line; the path, the sizes and the other lines depend on your machine"
[ Top 10 ]
/var/folders/7x/k2m4/T/ipykernel_4242/1840541211.py:5: size=388 KiB, count=9744, average=41 B
...
```

`tracemalloc` records which line allocated each block. The top line is the list comprehension: 10,000 integers in a list take about 388 KiB in 9,744 allocations, since the integers from -5 to 256 are cached and cost nothing. Keep the result in a variable before taking the snapshot: a result you throw away is freed first, and the snapshot then shows only the notebook's own bookkeeping.

## Habits that keep memory low

| Habit | Why |
|---|---|
| Keep data in local variables | Locals are dropped when the function returns |
| Avoid reference cycles, or break them | Cycles wait for the collector instead of being freed at once |
| Stream large data with generators | One item in memory at a time ([lesson 2.7](lesson:2.7)) |
| `del` large objects you no longer need | Removes a reference; the object goes when the last one does |
| Measure before you optimise | `tracemalloc` shows where memory actually goes |

## Coming from Java

| Java (HotSpot) | Python (CPython) |
|---|---|
| A tracing collector frees objects when the JVM decides | Reference counting frees most objects at once; a cycle collector handles the rest |
| `System.gc()` is only a hint | `gc.collect()` runs a collection now |
| `finalize()` (deprecated) or `Cleaner` | `__del__`, for observing only |
| try-with-resources | `with` |
| `Integer` cache for -128 to 127 | Small integers -5 to 256 are cached, and immortal |
| VisualVM, Java Flight Recorder | `tracemalloc` |
