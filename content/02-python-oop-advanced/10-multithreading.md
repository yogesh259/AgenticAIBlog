+++
number = "2.10"
title = "Multithreading"
lede = "Threads run several tasks inside one program at the same time. In Python they pay off when tasks wait, on the network, on disk or on `sleep`, not when they compute."
summary = "Threads with `start` and `join`, why waiting overlaps but computing doesn't (the GIL), and pools of threads."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/16-Multithreading and Multiprocessing: multi_threading.py, advance_multi_threading.py, webscrapping_multi_threading.py"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A task is **I/O-bound** when it spends most of its time waiting, for a web page, a file, a database or a model's reply, and **CPU-bound** when it keeps a processor busy computing. Threads speed up the first kind; for the second, Python needs processes ([lesson 2.11](lesson:2.11)). Agents are mostly waiting on models and tools, which makes threads, and later `asyncio`, the usual choice. This lesson runs scripts from a terminal.

## Two threads

```python title="multi_threading.py"
import threading
import time


def print_numbers():
    for i in range(5):
        time.sleep(2)
        print(f"Number: {i}")


def print_letter():
    for letter in "abcde":
        time.sleep(2)
        print(f"Letter: {letter}")


t1 = threading.Thread(target=print_numbers)
t2 = threading.Thread(target=print_letter)

t = time.time()
t1.start()
t2.start()

t1.join()
t2.join()

finished_time = time.time() - t
print(finished_time)
```

```zsh title="Terminal"
python multi_threading.py
```

```output real note="the time varies, and so can the order of each Number and Letter pair"
Number: 0
Letter: a
Number: 1
Letter: b
Number: 2
Letter: c
Number: 3
Letter: d
Number: 4
Letter: e
10.002547979354858
```

`Thread(target=...)` wraps a function. `start()` runs it in a new thread and returns at once; `join()` waits until that thread has finished, so the time is printed only at the end. Each function sleeps 2 seconds, five times: 10 seconds of waiting each. Run one after the other, that's 20 seconds; in two threads the waits overlap and the run takes 10. Both threads wake at the same moment, so either line of a pair can come first.

## Why threads don't speed up computing

CPython has a **global interpreter lock** (GIL): only one thread at a time runs Python code. A thread lets go of the lock while it waits for I/O, so waiting overlaps; computing doesn't. Two threads crunching numbers take turns on one core and finish no sooner than one thread would. Processes get around this, since each one has its own interpreter and its own lock ([lesson 2.11](lesson:2.11)). Python 3.13 added an optional free-threaded build without the GIL; the standard build still has one.

::: visual threads-timeline | Interactive figure | Threads, processes and the clock
Two tasks on a timeline: run one after the other, in two threads while waiting, in two threads while computing, and in two processes.
:::

## A pool of threads

```python title="advance_multi_threading.py"
from concurrent.futures import ThreadPoolExecutor
import time


def print_number(number):
    time.sleep(1)
    return f"Number: {number}"


numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3]

with ThreadPoolExecutor(max_workers=3) as executor:
    results = executor.map(print_number, numbers)

for result in results:
    print(result)
```

```zsh title="Terminal"
python advance_multi_threading.py
```

```output real
Number: 1
Number: 2
Number: 3
Number: 4
Number: 5
Number: 6
Number: 7
Number: 8
Number: 9
Number: 0
Number: 1
Number: 2
Number: 3
```

A pool keeps a fixed set of threads and feeds them tasks. `executor.map` works like `map()` ([lesson 1.14](lesson:1.14)), but the calls run on the pool: three workers take the 13 one-second tasks in five rounds, so the script takes about 5 seconds instead of 13. Results come back in the order of the input, however the tasks finish. Leaving the `with` block waits for every task. Without `max_workers`, the pool uses `min(32, os.cpu_count() + 4)` threads.

## Coming from Java

| Java | Python |
|---|---|
| `new Thread(runnable).start()` | `threading.Thread(target=func).start()` |
| `thread.join()` | `thread.join()` |
| `Executors.newFixedThreadPool(3)` | `ThreadPoolExecutor(max_workers=3)`, used in a `with` block |
| `executor.submit(task)` returns a `Future` | `executor.submit(func, arg)` returns a `Future`; `executor.map(func, items)` runs many |
| Threads compute in parallel on all cores | One thread runs Python code at a time (the GIL); waits overlap |
| `synchronized`, `ReentrantLock` | `threading.Lock()`, used as `with lock:` |
| Virtual threads for thousands of waiting tasks | `asyncio`, with `async` and `await` ([lesson 5.2](lesson:5.2)) |

## Practice

::: practice
**Fetch three pages at once.** Write a script that downloads three web pages in three threads with Requests, parses each with Beautiful Soup, prints how many characters of text it holds, and prints a final line once all three are done.

```python title="webscraping_multi_threading.py"
import threading

import requests
from bs4 import BeautifulSoup

urls = [
    "https://docs.langchain.com/oss/python/langchain/overview",
    "https://docs.langchain.com/oss/python/langchain/quickstart",
    "https://docs.langchain.com/oss/python/langgraph/overview",
]


def fetch_content(url):
    response = requests.get(url)
    soup = BeautifulSoup(response.content, "html.parser")
    print(f"Fetched {len(soup.text)} characters from {url}")


threads = []

for url in urls:
    thread = threading.Thread(target=fetch_content, args=(url,))
    threads.append(thread)
    thread.start()

for thread in threads:
    thread.join()

print("All web pages fetched")
```

```zsh title="Terminal"
python webscraping_multi_threading.py
```

```output real note="the counts change as the pages change, and the lines come in the order the downloads finish"
Fetched 7491 characters from https://docs.langchain.com/oss/python/langgraph/overview
Fetched 9446 characters from https://docs.langchain.com/oss/python/langchain/overview
Fetched 24926 characters from https://docs.langchain.com/oss/python/langchain/quickstart
All web pages fetched
```

`args=(url,)` passes the function's arguments as a tuple; the comma makes it a one-item tuple ([lesson 1.9](lesson:1.9)). Each `requests.get` spends its time waiting on the network, so the three downloads overlap.
:::
