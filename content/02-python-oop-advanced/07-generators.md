+++
number = "2.7"
title = "Generators"
lede = "A generator function hands out values one at a time with `yield`, pausing between them. It is the short way to write an iterator, and the pattern behind streamed model replies."
summary = "`yield`, generator objects, pausing and resuming, generator expressions, and reading large files lazily."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/9-Advance Python Concepts: 9.2-Generators.ipynb, large_file.txt"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A function with `yield` in its body is a **generator function**. Calling it doesn't run the body: it returns a generator, an iterator ([lesson 2.6](lesson:2.6)) that runs the body bit by bit, each time you ask for the next value. Nothing like it exists in Java; the closest are a hand-written `Iterator` class or a lazy `Stream`.

## yield

```python title="Notebook cell"
def square(n):
    for i in range(n):
        yield i ** 2


square(3)
```

```output real note="the address differs on each run"
<generator object square at 0x0000015F14D8D080>
```

```python title="Notebook cell"
for i in square(3):
    print(i)
```

```output real
0
1
4
```

## Pause and resume

```python title="Notebook cell"
gen = square(3)
print(next(gen))
print(next(gen))
print(next(gen))
next(gen)
```

```output real note="last line of the error"
0
1
4
StopIteration
```

Calling `square(3)` ran none of its body. Each `next()` runs the body until the next `yield`, hands out that value and pauses right there, keeping `n` and `i`. The next call resumes after the `yield`. When the body ends, `next()` raises `StopIteration`, like any iterator at its end.

::: visual generator-pause | Run player | A generator pauses at yield
The cell above, one `next()` at a time: where the generator stops, what it remembers, and what it hands out.
:::

## It continues where it stopped

```python title="Notebook cell"
def my_generator():
    yield 1
    yield 2
    yield 3


gen = my_generator()
print("next:", next(gen))
for val in gen:
    print("loop:", val)
```

```output real
next: 1
loop: 2
loop: 3
```

The loop picks up after the value `next()` already took. A generator makes one pass; once it has finished, it stays empty.

## The countdown, as a generator

```python title="Notebook cell"
def countdown(start):
    while start > 0:
        yield start
        start -= 1


print(list(countdown(3)))
```

```output real
[3, 2, 1]
```

Compare the `Countdown` class in [lesson 2.6](lesson:2.6): Python writes `__iter__` and `__next__` for you, and the state lives in ordinary local variables.

## Generator expressions

```python title="Notebook cell"
squares = (x * x for x in range(5))
print(squares)
print(sum(squares))
```

```output real note="the address differs on each run"
<generator object <genexpr> at 0x0000015F14D8C520>
30
```

Round brackets instead of square ones make a generator instead of a list ([lesson 1.8](lesson:1.8)): `sum()` pulls the squares one at a time and no list is ever built. That is the point of generators: one item in memory at a time, however long the sequence.

A chat model's `stream()` method works the same way from the outside: `for chunk in model.stream(...)` hands you the reply piece by piece as it arrives ([lesson 9.1](lesson:9.1)).

## Practice

The task reads this file; create it next to your notebook:

```text title="large_file.txt"
2026-01-05 09:00 INFO  Service started
2026-01-05 09:01 INFO  Loaded 120 documents
2026-01-05 09:02 WARN  Slow response from the search tool
2026-01-05 09:03 INFO  Answered 3 questions
2026-01-05 09:04 INFO  Service stopped
```

::: practice
**Read a large file lazily.** Write a generator `read_large_file(file_path)` that yields a file's lines one at a time, and use it to print the lines of `large_file.txt` without their line breaks.

```python title="Notebook cell"
def read_large_file(file_path):
    with open(file_path, "r") as file:
        for line in file:
            yield line


for line in read_large_file("large_file.txt"):
    print(line.strip())
```

```output real
2026-01-05 09:00 INFO  Service started
2026-01-05 09:01 INFO  Loaded 120 documents
2026-01-05 09:02 WARN  Slow response from the search tool
2026-01-05 09:03 INFO  Answered 3 questions
2026-01-05 09:04 INFO  Service stopped
```

A file object already reads one line at a time ([lesson 1.17](lesson:1.17)); the generator wraps it so filtering or parsing can live in one place, and memory stays flat whether the file has five lines or five million. The file closes when the generator finishes.
:::
