+++
number = "2.11"
title = "Multiprocessing"
lede = "A process is a separate running Python with its own memory and its own interpreter lock, so several processes can compute on several CPU cores at once. They cost more to start and share no objects."
summary = "Processes with `start` and `join`, the `__main__` guard, why notebooks can't start them, process pools, and when processes pay off."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/16-Multithreading and Multiprocessing: multi_processing.py, advance_multi_processing.py, factorial_multi_processing.py"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Processes are the way around the GIL ([lesson 2.10](lesson:2.10)): each one is a separate Python, so CPU-bound work really runs in parallel. The `multiprocessing` module mirrors the `threading` module, with two catches: the script needs a `__main__` guard, and the work has to be defined in a file, not in a notebook. This lesson runs scripts from a terminal.

## Two processes

```python title="multi_processing.py"
import multiprocessing
import time


def square_numbers():
    for i in range(5):
        time.sleep(1)
        print(f"Square: {i * i}")


def cube_numbers():
    for i in range(5):
        time.sleep(1.5)
        print(f"Cube: {i * i * i}")


if __name__ == "__main__":
    p1 = multiprocessing.Process(target=square_numbers)
    p2 = multiprocessing.Process(target=cube_numbers)
    t = time.time()

    p1.start()
    p2.start()

    p1.join()
    p2.join()

    finished_time = time.time() - t
    print(finished_time)
```

```zsh title="Terminal"
python multi_processing.py
```

```output real note="the time varies"
Square: 0
Cube: 0
Square: 1
Square: 4
Cube: 1
Square: 9
Cube: 8
Square: 16
Cube: 27
Cube: 64
9.088640213012695
```

`Process` takes the same `target`, `start()` and `join()` as `Thread`. The run lasts as long as the slower process, 5 × 1.5 seconds, plus a little time to start the processes.

## Why the `__main__` guard

On macOS and Windows, each new process is a fresh Python that imports your script to find `square_numbers`. The guard ([lesson 1.15](lesson:1.15)) keeps that import from starting processes of its own; code outside it runs again in every process. Linux used a different start method until Python 3.14; put the guard in every script that starts processes.

::: warn Without the guard
The script fails with `RuntimeError: An attempt has been made to start a new process before the current process has finished its bootstrapping phase.`
:::

## Not from a notebook

Threads work in a notebook; processes don't, on macOS and Windows. A new process can't import a notebook, so it can't find a function defined in one:

::: warn A process started from a notebook
`AttributeError: Can't get attribute 'square_numbers' on <module '__main__' (<class '_frozen_importlib.BuiltinImporter'>)>`. Put the function in a `.py` file next to the notebook and import it from there (`from workers import square_numbers`); then pools and processes work from the notebook too.
:::

## A pool of processes

```python title="advance_multi_processing.py"
from concurrent.futures import ProcessPoolExecutor
import time


def square_number(number):
    time.sleep(2)
    return f"Square: {number * number}"


numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 2, 3, 12, 14]

if __name__ == "__main__":
    with ProcessPoolExecutor(max_workers=3) as executor:
        results = executor.map(square_number, numbers)

    for result in results:
        print(result)
```

```zsh title="Terminal"
python advance_multi_processing.py
```

```output real
Square: 1
Square: 4
Square: 9
Square: 16
Square: 25
Square: 36
Square: 49
Square: 64
Square: 81
Square: 121
Square: 4
Square: 9
Square: 144
Square: 196
```

The same interface as `ThreadPoolExecutor`: swap the class and the calls run in processes. Fourteen two-second tasks on three workers take five rounds, about 10 seconds. Arguments and results travel between processes by **pickling**, Python's serialisation, so they must be values pickle can handle: numbers, strings, lists, dicts, and objects of classes defined at the top level of a module. Without `max_workers`, the pool starts one process per CPU core.

## Threads or processes?

| | Threads | Processes |
|---|---|---|
| Good for | Waiting: web requests, files, model and tool calls | Computing: number crunching, parsing, image work |
| Memory | Shared: every thread sees the same objects | Separate: data is copied between processes |
| Python code running at once | One thread (the GIL) | One per process, on separate cores |
| Start-up cost | Small | A new Python per process |
| In a notebook | Works | Needs the function in a `.py` file |
| Pool | `ThreadPoolExecutor` | `ProcessPoolExecutor`, `multiprocessing.Pool` |

::: visual threads-vs-processes | Figure | Threads share a process; processes share nothing
One process with two threads and one lock, beside two processes with their own memory, lock and core.
:::

## Coming from Java

| Java | Python |
|---|---|
| Threads use every core | Threads take turns; CPU work goes to processes |
| `ForkJoinPool`, parallel streams | `ProcessPoolExecutor`, `multiprocessing.Pool` |
| `public static void main(String[] args)` | `if __name__ == "__main__":` |
| Threads share one heap | Processes share nothing: arguments and results are pickled and copied |

## Practice

::: practice
**Factorials in parallel.** Use `multiprocessing.Pool().map` to compute the factorials of 5000, 6000, 700 and 8000, print how many digits each one has and how long the pool took. Then time a plain loop doing the same work. Which is faster, and why?

```python title="factorial_multi_processing.py"
import math
import multiprocessing
import sys
import time

# Allow converting integers with up to 100,000 digits to text
sys.set_int_max_str_digits(100000)


def compute_factorial(number):
    print(f"Computing factorial of {number}")
    result = math.factorial(number)
    print(f"Factorial of {number} has {len(str(result))} digits")
    return result


if __name__ == "__main__":
    numbers = [5000, 6000, 700, 8000]

    start_time = time.time()
    with multiprocessing.Pool() as pool:
        results = pool.map(compute_factorial, numbers)
    end_time = time.time()

    print(f"Digits: {[len(str(result)) for result in results]}")
    print(f"Time taken: {end_time - start_time} seconds")

    start_time = time.time()
    digits = [len(str(math.factorial(number))) for number in numbers]
    print(f"Plain loop: {time.time() - start_time} seconds")
```

```zsh title="Terminal"
python factorial_multi_processing.py
```

```output real note="the times vary, and the order of the worker lines can change"
Computing factorial of 5000
Computing factorial of 6000
Factorial of 5000 has 16326 digits
Computing factorial of 700
Factorial of 700 has 1690 digits
Computing factorial of 8000
Factorial of 6000 has 20066 digits
Factorial of 8000 has 27753 digits
Digits: [16326, 20066, 1690, 27753]
Time taken: 2.2934460639953613 seconds
Plain loop: 0.015795230865478516 seconds
```

The plain loop wins easily: each factorial takes a few milliseconds, less than starting a process. Processes pay off when every task runs for seconds. `Pool()` starts one worker per CPU core. Since Python 3.11, turning an integer of more than 4,300 digits into text raises `ValueError: Exceeds the limit (4300 digits) for integer string conversion`, and 8000! has 27,753 digits, hence `sys.set_int_max_str_digits`. That line sits outside the guard on purpose, so each worker process runs it too.
:::
