+++
number = "1.6"
title = "Loops: for and while"
lede = "Repeat a block for every item in a sequence, or for as long as a condition holds, and decide exactly when to stop."
summary = "Repeat code with for and while, and control a loop with break, continue and else."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/2-Control Flow: Loops.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A `for` loop runs its block once for each item of a sequence. A `while` loop runs it again and again while a condition stays true.

## for and range()

```python title="Notebook cell"
for i in range(5):
    print(i)
```

```output real
0
1
2
3
4
```

`range(5)` produces the numbers 0 to 4: five numbers, starting at 0, stopping before 5. Give it a start, a stop and a step for other sequences:

```python title="Notebook cell"
print(list(range(1, 6)))
print(list(range(1, 10, 2)))
print(list(range(10, 1, -1)))
print(list(range(10, 1, -2)))
```

```output real
[1, 2, 3, 4, 5]
[1, 3, 5, 7, 9]
[10, 9, 8, 7, 6, 5, 4, 3, 2]
[10, 8, 6, 4, 2]
```

`list()` collects the numbers so they print on one line. The start is included, the stop never is, and a negative step counts down.

## Loop over a string

```python title="Notebook cell"
text = "Alice"

for ch in text:
    print(ch, end=" ")
```

```output real
A l i c e
```

A `for` loop works on any sequence, here the characters of a string. `end=" "` makes `print` end with a space instead of a line break.

Don't name a variable `str`, `list` or `sum`: it hides the built-in of that name, and later calls like `str(5)` fail with `TypeError: 'str' object is not callable`.

## while

```python title="Notebook cell"
count = 0

while count < 5:
    print(count, end=" ")
    count = count + 1
```

```output real
0 1 2 3 4
```

The test is checked before every round. Without `count = count + 1` it would stay true forever and the loop would never end: stop a stuck cell with the **Interrupt** button in the notebook toolbar.

## break, continue and pass

```python title="Notebook cell"
for i in range(10):
    if i == 5:
        break
    print(i, end=" ")
```

```output real
0 1 2 3 4
```

`break` leaves the loop at once.

```python title="Notebook cell"
for i in range(10):
    if i % 2 == 0:
        continue
    print(i, end=" ")
```

```output real
1 3 5 7 9
```

`continue` skips the rest of this round and moves on to the next item.

```python title="Notebook cell"
for i in range(5):
    if i == 3:
        pass  # nothing to do here yet
    print(i, end=" ")
```

```output real
0 1 2 3 4
```

`pass` does nothing. It fills a block that Python requires but you have nothing to put in yet, so every number still prints.

## Nested loops

```python title="Notebook cell"
for i in range(3):
    for j in range(2):
        print(f"i:{i} and j:{j}")
```

```output real
i:0 and j:0
i:0 and j:1
i:1 and j:0
i:1 and j:1
i:2 and j:0
i:2 and j:1
```

The inner loop runs completely for each round of the outer loop: 3 × 2 = 6 lines.

## for … else: primes up to 100

```python title="Notebook cell"
for num in range(1, 101):
    if num > 1:
        for i in range(2, num):
            if num % i == 0:
                break
        else:
            print(num, end=" ")
```

```output real
2 3 5 7 11 13 17 19 23 29 31 37 41 43 47 53 59 61 67 71 73 79 83 89 97
```

The `else` belongs to the inner `for`, not to the `if`. It runs only when the loop finishes without `break`: no number from 2 to `num - 1` divides `num`, so `num` is prime.

## Practice

::: practice
**Sum of the first n numbers.** Add up 1 + 2 + … + 10, once with a `while` loop and once with a `for` loop.

```python title="Notebook cell"
n = 10

total = 0
count = 1
while count <= n:
    total = total + count
    count = count + 1
print("Sum of first 10 natural numbers:", total)

total = 0
for i in range(1, n + 1):
    total = total + i
print(total)
```

```output real
Sum of first 10 natural numbers: 55
55
```

`range(1, n + 1)` stops before `n + 1`, so it includes `n`.
:::
