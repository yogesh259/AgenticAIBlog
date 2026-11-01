+++
number = "1.11"
title = "Dictionaries"
lede = "A dictionary maps keys to values: look values up by name, change them, loop over them, and copy them without surprises."
summary = "Store and look up values by key, loop over them, and copy them safely."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/3-Data Structures: 3.4-Dictionaries.ipynb; 4-Functions: 4.2-examplesfunctions.ipynb (get idiom)"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A dictionary stores **key-value pairs**: you look a value up by its key instead of by position. Model messages, settings, JSON data and graph state are all dictionaries, so this is the collection you will use most in agent code.

## Create a dictionary

```python title="Notebook cell"
empty_dict = {}
print(type(empty_dict))

student = {"name": "Alice", "age": 32, "grade": 24}
print(student)

student = {"name": "Alice", "age": 32, "name": 24}
print(student)
```

```output real
<class 'dict'>
{'name': 'Alice', 'age': 32, 'grade': 24}
{'name': 24, 'age': 32}
```

Keys are unique: when a key repeats, the last value wins and the key keeps its first position. Keys must be unchangeable values (strings, numbers, tuples); values can be anything. Dictionaries keep their keys in the order they were added.

## Read values

```python title="Notebook cell"
student = {"name": "Alice", "age": 32, "grade": "A"}

print(student["grade"])
print(student.get("grade"))
print(student.get("last_name"))
print(student.get("last_name", "Not Available"))
```

```output real
A
A
None
Not Available
```

`get()` returns `None`, or the default you give it, when the key is missing. Square brackets raise an error instead:

```python title="Notebook cell"
student["last_name"]
```

```output real note="last line of the error"
KeyError: 'last_name'
```

## Add, change and delete

```python title="Notebook cell"
student["age"] = 33
student["address"] = "India"
print(student)

del student["grade"]
print(student)
```

```output real
{'name': 'Alice', 'age': 33, 'grade': 'A', 'address': 'India'}
{'name': 'Alice', 'age': 33, 'address': 'India'}
```

Assigning to an existing key updates it; assigning to a new key adds it.

## Keys, values and items

```python title="Notebook cell"
print(student.keys())
print(student.values())
print(student.items())
```

```output real
dict_keys(['name', 'age', 'address'])
dict_values(['Alice', 33, 'India'])
dict_items([('name', 'Alice'), ('age', 33), ('address', 'India')])
```

```python title="Notebook cell"
for key in student.keys():
    print(key)

for value in student.values():
    print(value)

for key, value in student.items():
    print(f"{key}: {value}")
```

```output real
name
age
address
Alice
33
India
name: Alice
age: 33
address: India
```

Looping over the dictionary itself (`for key in student:`) also gives the keys. `items()` gives pairs, which the loop unpacks into `key` and `value`.

## Copies: two names, one dictionary

```python title="Notebook cell"
student = {"name": "Alice", "age": 33}
student_copy = student
student["name"] = "Bob"

print(student_copy)
print(student is student_copy)
```

```output real
{'name': 'Bob', 'age': 33}
True
```

`=` copies nothing. `student_copy` is a second name for the same dictionary, so a change through one name shows up through the other. `is` checks whether two names point at the same object. To get a separate dictionary, ask for a copy:

```python title="Notebook cell"
student_copy1 = student.copy()
student["name"] = "Carol"

print(student_copy1)
print(student is student_copy1)
```

```output real
{'name': 'Bob', 'age': 33}
False
```

`.copy()` is a **shallow** copy: a new outer dictionary whose values are the same objects. When a value is itself a dictionary or a list, both copies still share it; `copy.deepcopy()` copies all the way down:

```python title="Notebook cell"
import copy

team = {"lead": {"name": "Alice"}}
shallow = team.copy()
deep = copy.deepcopy(team)

team["lead"]["name"] = "Zoe"
print(shallow["lead"]["name"], deep["lead"]["name"])
```

```output real
Zoe Alice
```

::: visual names-and-copies | Run player | Two names, one dictionary
The cells above, one line at a time: names, the dictionaries they point at, and what each change reaches.
:::

## Nested dictionaries

```python title="Notebook cell"
students = {
    "student1": {"name": "Alice", "age": 32},
    "student2": {"name": "Peter", "age": 35},
}

print(students["student2"]["name"])

for student_id, student_info in students.items():
    print(f"{student_id}: {student_info}")
    for key, value in student_info.items():
        print(f"  {key}: {value}")
```

```output real
Peter
student1: {'name': 'Alice', 'age': 32}
  name: Alice
  age: 32
student2: {'name': 'Peter', 'age': 35}
  name: Peter
  age: 35
```

## Dictionary comprehensions

```python title="Notebook cell"
squares = {x: x ** 2 for x in range(5)}
print(squares)

evens = {x: x ** 2 for x in range(10) if x % 2 == 0}
print(evens)
```

```output real
{0: 0, 1: 1, 2: 4, 3: 9, 4: 16}
{0: 0, 2: 4, 4: 16, 6: 36, 8: 64}
```

The same idea as a list comprehension ([lesson 1.8](lesson:1.8)), with `key: value` in front.

## Which collection?

| | List | Tuple | Set | Dictionary |
|---|---|---|---|---|
| Written as | `[1, 2]` | `(1, 2)` | `{1, 2}` | `{"a": 1}` |
| Keeps order | yes | yes | no | yes, of insertion |
| Can change | yes | no | yes | yes |
| Duplicates | allowed | allowed | removed | keys unique |
| Find items by | position | position | membership | key |

## Practice

::: practice
**Count frequencies.** Count how often each number appears in a list.

```python title="Notebook cell"
numbers = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4]
frequency = {}

for number in numbers:
    if number in frequency:
        frequency[number] += 1
    else:
        frequency[number] = 1
print(frequency)
```

```output real
{1: 1, 2: 2, 3: 3, 4: 4}
```

A shorter body for the loop: `frequency[number] = frequency.get(number, 0) + 1`.
:::

::: practice
**Merge two dictionaries.** Combine two dictionaries into a new one; where both have a key, keep the second one's value.

```python title="Notebook cell"
dict1 = {"a": 1, "b": 2}
dict2 = {"b": 3, "c": 4}

merged_dict = {**dict1, **dict2}
print(merged_dict)
```

```output real
{'a': 1, 'b': 3, 'c': 4}
```

`**` unpacks a dictionary's pairs into the new one; later pairs overwrite earlier ones with the same key.
:::
