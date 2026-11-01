+++
number = "2.5"
title = "Magic methods and operator overloading"
lede = "Python turns built-in syntax into method calls: `print(x)` calls `x.__str__()`, `a + b` calls `a.__add__(b)`. Define those methods and your objects work with that syntax."
summary = "What dunder methods are, `__str__` and `__repr__`, containers, operators, comparison and hashing."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/8-Class And Objects: 8.6-magicmethods.ipynb, 8.7-OperatorOverloading.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Magic methods, or **dunder** methods (for "double underscore"), are methods Python calls for you when you use built-in syntax on an object. You rarely call them yourself. They fill the roles of Java's `toString()`, `equals()`, `hashCode()` and `compareTo()`, and they also cover what Java doesn't allow: operators on your own classes.

## Who calls what

| You write | Python calls | Java |
|---|---|---|
| `Person("Alice", 34)` | `__init__` | constructor |
| `print(p)`, `str(p)`, `f"{p}"` | `__str__`, or `__repr__` if there is no `__str__` | `toString()` |
| `repr(p)`, the notebook's display, items inside a list | `__repr__` | `toString()` |
| `len(c)` | `__len__` | `size()` |
| `c[i]` | `__getitem__` | `get(i)` |
| `a + b`, `a - b`, `a * b`, `a / b` | `__add__`, `__sub__`, `__mul__`, `__truediv__` | not possible |
| `a == b` | `__eq__` | `equals()` |
| `a < b`, `sorted()`, `min()` | `__lt__` | `compareTo()` |
| `hash(a)`, set items, dictionary keys | `__hash__` | `hashCode()` |
| `for x in c` | `__iter__` ([lesson 2.6](lesson:2.6)) | `iterator()` |

## Printing: `__str__` and `__repr__`

```python title="Notebook cell"
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


person = Person("Alice", 34)
print(person)
```

```output real note="the address differs on each run"
<__main__.Person object at 0x000001FF8305BEC0>
```

```python title="Notebook cell"
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __str__(self):
        return f"{self.name}, {self.age} years old"

    def __repr__(self):
        return f"Person(name={self.name}, age={self.age})"


person = Person("Alice", 34)
print(person)
print(repr(person))
[person]
```

```output real
Alice, 34 years old
Person(name=Alice, age=34)
[Person(name=Alice, age=34)]
```

`__str__` is for people: `print()` and f-strings use it. `__repr__` is for developers: the notebook's display, items inside a list, logs and debuggers. If you write only one, write `__repr__`; `print()` falls back to it. By convention it looks like the code that rebuilds the object, quotes included: `f"Person(name={self.name!r}, age={self.age!r})"` gives `Person(name='Alice', age=34)`.

## Containers: `__len__` and `__getitem__`

```python title="Notebook cell"
class Playlist:
    def __init__(self, songs):
        self.songs = songs

    def __len__(self):
        return len(self.songs)

    def __getitem__(self, index):
        return self.songs[index]


playlist = Playlist(["Intro", "Theme", "Outro"])
print(len(playlist))
print(playlist[0], playlist[-1])
print(playlist[1:])
for song in playlist:
    print(song)
```

```output real
3
Intro Outro
['Theme', 'Outro']
Intro
Theme
Outro
```

`__getitem__` receives whatever is inside the brackets, a number or a slice, and passes it on to the list. With no `__iter__`, a `for` loop falls back to calling `__getitem__` with 0, 1, 2 and so on until `IndexError`. [Lesson 2.6](lesson:2.6) shows the usual way to make objects loopable.

## Operators: `+`, `-`, `*` and `==`

```python title="Notebook cell"
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __sub__(self, other):
        return Vector(self.x - other.x, self.y - other.y)

    def __mul__(self, other):
        return Vector(self.x * other, self.y * other)

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"


v1 = Vector(2, 3)
v2 = Vector(4, 5)

print(v1 + v2)
print(v1 - v2)
print(v1 * 3)
print(v1 == Vector(2, 3))
```

```output real
Vector(6, 8)
Vector(-2, -2)
Vector(6, 9)
True
```

`v1 + v2` runs `v1.__add__(v2)`. Each method builds a new `Vector` and leaves both operands unchanged, the way numbers behave. `__mul__` takes a number here, so `v1 * 3` works.

## When an operator is missing

| You see | Why | Fix |
|---|---|---|
| `TypeError: unsupported operand type(s) for *: 'int' and 'Vector'` for `3 * v1` | `int` can't multiply a `Vector`, and `Vector` has no reversed version | Add `__rmul__ = __mul__` to the class |
| `TypeError: '<' not supported between instances of 'Vector' and 'Vector'` | No `__lt__` | Define `__lt__`; then `sorted()`, `min()`, `max()` and `heapq` work too ([sorting recipes](lesson:5.1)) |
| `TypeError: unhashable type: 'Vector'` in a set or as a dictionary key | Defining `__eq__` removes the default `__hash__`, because equal objects must hash alike | Define `__hash__` from the same fields: `hash((self.x, self.y))` |
| `==` gives `False` for two equal-looking objects | No `__eq__`, so `==` compares identity, like `is` | Define `__eq__` |

`@dataclass` writes `__init__`, `__repr__` and `__eq__` for you from a list of fields ([lesson 4.1](lesson:4.1)).

## Practice

::: practice
**Complex numbers.** Write a `ComplexNumber` class with a `real` and an `imag` part that supports `+`, `-`, `*`, `/` and `==`, and shows as `2 + 3i`. Try it on `2 + 3i` and `1 + 4i`.

```python title="Notebook cell"
class ComplexNumber:
    def __init__(self, real, imag):
        self.real = real
        self.imag = imag

    def __add__(self, other):
        return ComplexNumber(self.real + other.real, self.imag + other.imag)

    def __sub__(self, other):
        return ComplexNumber(self.real - other.real, self.imag - other.imag)

    def __mul__(self, other):
        real_part = self.real * other.real - self.imag * other.imag
        imag_part = self.real * other.imag + self.imag * other.real
        return ComplexNumber(real_part, imag_part)

    def __truediv__(self, other):
        denominator = other.real ** 2 + other.imag ** 2
        real_part = (self.real * other.real + self.imag * other.imag) / denominator
        imag_part = (self.imag * other.real - self.real * other.imag) / denominator
        return ComplexNumber(real_part, imag_part)

    def __eq__(self, other):
        return self.real == other.real and self.imag == other.imag

    def __repr__(self):
        return f"{self.real} + {self.imag}i"


c1 = ComplexNumber(2, 3)
c2 = ComplexNumber(1, 4)

print(c1 + c2)
print(c1 - c2)
print(c1 * c2)
print(c1 / c2)
print(c1 == c2)
```

```output real
3 + 7i
1 + -1i
-10 + 11i
0.8235294117647058 + -0.29411764705882354i
False
```

Multiplication and division use the usual formulas for `a + bi`. This `__repr__` shows a negative part as `+ -1i`. Python has complex numbers built in, written with `j`: `(2 + 3j) / (1 + 4j)` gives the same result.
:::
