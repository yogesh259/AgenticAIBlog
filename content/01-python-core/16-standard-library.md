+++
number = "1.16"
title = "The standard library"
lede = "Modules that come with Python, no install needed: math, random, os, shutil, json, csv, datetime, time and re."
summary = "The built-in modules later lessons rely on: math, random, os, json, csv, datetime, time and re."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/5-Modules: 5.2-Standardlibrary.ipynb, source.txt"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Python ships with a large **standard library**: modules you import without installing anything. A quick tour of the ones you will meet most.

## array, math and random

```python title="Notebook cell"
import array
arr = array.array("i", [1, 2, 3, 4])
print(arr)

import math
print(math.sqrt(16))
print(math.pi)
```

```output real
array('i', [1, 2, 3, 4])
4.0
3.141592653589793
```

`array` stores numbers of one type compactly (`"i"` means integers); in practice lists, or NumPy arrays for maths, are used far more.

```python title="Notebook cell"
import random
print(random.randint(1, 10))
print(random.choice(["apple", "banana", "cherry"]))
```

```output real note="random: the values differ on each run"
9
apple
```

## os and shutil: folders and files

```python title="Notebook cell"
import os
print(os.getcwd())
```

```output illustrative note="your path will differ"
/Users/you/my-project
```

`os` talks to the operating system: the current folder, creating and listing folders ([lesson 1.18](lesson:1.18)), and environment variables such as API keys ([lesson 0.3](lesson:0.3)).

`shutil` works on whole files. Create `source.txt` next to your notebook, then copy it:

```text title="source.txt"
Hello, how are you?
I am fine.
```

```python title="Notebook cell"
import shutil
shutil.copyfile("source.txt", "destination.txt")
```

```output real
'destination.txt'
```

It returns the path of the copy.

## json

```python title="Notebook cell"
import json

data = {"name": "Alice", "age": 25}
json_str = json.dumps(data)
print(json_str, type(json_str))

parsed_data = json.loads(json_str)
print(parsed_data, type(parsed_data))
```

```output real
{"name": "Alice", "age": 25} <class 'str'>
{'name': 'Alice', 'age': 25} <class 'dict'>
```

JSON is a text format for data. `json.dumps()` turns a dictionary into a JSON string and `json.loads()` reads it back. Web APIs and language models exchange structured data as JSON text, so you will use these two often.

## csv

```python title="Notebook cell"
import csv

with open("example.csv", mode="w", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(["name", "age"])
    writer.writerow(["Alice", 32])

with open("example.csv", mode="r") as file:
    reader = csv.reader(file)
    for row in reader:
        print(row)
```

```output real
['name', 'age']
['Alice', '32']
```

Each row is written from a list and read back as a list of strings: `32` comes back as `'32'`. The csv module asks for `newline=""` when writing; without it Windows adds a blank line between rows. `with open(...)` is explained in [lesson 1.17](lesson:1.17).

## datetime and time

```python title="Notebook cell"
from datetime import datetime, timedelta

now = datetime.now()
yesterday = now - timedelta(days=1)
print(now)
print(yesterday)
```

```output real note="the time when the cell ran"
2026-10-30 07:51:11.002606
2026-10-29 07:51:11.002606
```

```python title="Notebook cell"
import time

start = time.time()
time.sleep(2)
print(time.time() - start)
```

```output real note="close to 2; the exact value differs on each run"
2.0014536380767822
```

`time.time()` is the current time in seconds; the difference between two calls measures how long something took. `time.sleep(2)` pauses for 2 seconds.

## re: regular expressions

```python title="Notebook cell"
import re

pattern = r"\d+"
text = "There are 123 apples 456"
match = re.search(pattern, text)
print(match.group())

print(re.search(pattern, "no digits here"))
```

```output real
123
None
```

A regular expression describes a text pattern: `\d+` means "one or more digits". The `r` before the quotes makes a raw string, so the backslash reaches `re` unchanged. `re.search()` returns the first match, or `None` when there is none: check before calling `.group()`. A full example is the email check in [lesson 1.13](lesson:1.13).
