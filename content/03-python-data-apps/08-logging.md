+++
number = "3.8"
title = "Logging"
lede = "The `logging` module records what a program does, with a severity level on every message, and sends the records to the console, a file or both, configured in one place."
summary = "Log levels, `basicConfig` with a format and a log file, named loggers with their own levels, and one logging setup shared by every module."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/12-Logging In Python: 12.1-logging.ipynb, 12.2-multiplelogger.ipynb, app.py, logs/logger.py, logs/test.py"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

`print` writes text; a log record also carries a level, a time and the name of the part of the program that wrote it, and a single setting decides which records appear and where they go. Libraries log too: later you will turn down a chatty library's logger with one line ([lesson 18.2](lesson:18.2)).

## Log levels

```python title="Notebook cell"
import logging

# Configure the basic logging settings
logging.basicConfig(level=logging.DEBUG)

# Log messages with different severity levels
logging.debug("This is a debug message")
logging.info("This is an info message")
logging.warning("This is a warning message")
logging.error("This is an error message")
logging.critical("This is a critical message")
```

```output real
DEBUG:root:This is a debug message
INFO:root:This is an info message
WARNING:root:This is a warning message
ERROR:root:This is an error message
CRITICAL:root:This is a critical message
```

The default format is `LEVEL:logger name:message`; `root` is the logger behind the module-level functions. Log records go to the error stream, `stderr`, not to `print`'s `stdout`; a notebook shows both under the cell.

| Level | Value | Use it for |
|---|---|---|
| `DEBUG` | 10 | Details for diagnosing a problem |
| `INFO` | 20 | Confirmation that things work as expected |
| `WARNING` | 30 | Something unexpected, or a problem coming soon; the program still works |
| `ERROR` | 40 | A function failed |
| `CRITICAL` | 50 | The program itself may not be able to continue |

`level` is a threshold: records below it are dropped. Without any setup the threshold is `WARNING`, so `debug` and `info` print nothing.

## Format and log to a file

```python title="Notebook cell"
logging.basicConfig(
    filename='app.log',
    filemode='w',
    level=logging.DEBUG,
    format='%(asctime)s-%(name)s-%(levelname)s-%(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    force=True,
)

logging.debug("This is a debug message")
logging.info("This is an info message")
logging.warning("This is a warning message")
logging.error("This is an error message")
logging.critical("This is a critical message")
```

```python title="Notebook cell"
with open('app.log') as f:
    print(f.read())
```

```output real note="the times differ on each run"
2026-10-30 10:46:56-root-DEBUG-This is a debug message
2026-10-30 10:46:56-root-INFO-This is an info message
2026-10-30 10:46:56-root-WARNING-This is a warning message
2026-10-30 10:46:56-root-ERROR-This is an error message
2026-10-30 10:46:56-root-CRITICAL-This is a critical message
```

`basicConfig` configures logging only once per process: if logging is already set up, later calls are silently ignored. In a notebook that means a second `basicConfig` does nothing until you restart the kernel, so this cell passes `force=True`, which replaces the earlier setup.

`format` builds each line from fields such as `%(asctime)s` (the time), `%(name)s` (the logger), `%(levelname)s` and `%(message)s`; `datefmt` formats the time. `filemode='w'` starts a new file on each run, while the default `'a'` appends.

## One logger per part of a program

```python title="Notebook cell"
# Create a logger for module1
logger1 = logging.getLogger("module1")
logger1.setLevel(logging.DEBUG)

# Create a logger for module2
logger2 = logging.getLogger("module2")
logger2.setLevel(logging.WARNING)

# Configure logging settings
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    force=True,
)
```

```python title="Notebook cell"
# Log messages with different loggers
logger1.debug("This is debug message for module1")
logger2.warning("This is a warning message for module 2")
logger2.error("This is an error message")
```

```output real note="the times differ on each run"
2026-10-30 10:46:56 - module1 - DEBUG - This is debug message for module1
2026-10-30 10:46:56 - module2 - WARNING - This is a warning message for module 2
2026-10-30 10:46:56 - module2 - ERROR - This is an error message
```

`getLogger(name)` returns the logger with that name, creating it the first time. Each logger has its own level: `logger2` would drop a `debug` or `info` record. The loggers have no output of their own: their records travel up to the root logger, whose handler `basicConfig` set up, so they share its format and destination.

## Configure once, import everywhere

In a program of several files, set up logging in one module and import it everywhere else:

```python title="logger.py"
import logging

# Configure logging once, for every module that imports this one
logging.basicConfig(
    filename='app.log',
    filemode='w',
    level=logging.DEBUG,
    format='%(asctime)s-%(name)s-%(levelname)s-%(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
```

```python title="test.py"
from logger import logging


def add(a, b):
    logging.debug("The addition operation is taking place")
    return a + b


logging.debug("The addition function is called")
add(10, 15)
```

```zsh title="Terminal"
python test.py
```

```zsh title="Terminal"
cat app.log
```

```output real note="the times differ on each run"
2026-10-30 10:46:57-root-DEBUG-The addition function is called
2026-10-30 10:46:57-root-DEBUG-The addition operation is taking place
```

Importing `logger` runs its `basicConfig` once; `logging` in `test.py` is the same standard module, already configured. Larger programs usually call `basicConfig` in the entry point and give each module a logger named after itself, so every record says where it came from:

```python title="Any module" norun
import logging

logger = logging.getLogger(__name__)  # "shop.orders" in shop/orders.py


def place_order(item):
    logger.info("Placing an order for %s", item)
```

Passing values as arguments, `"... %s", item`, builds the text only if the record is kept; an f-string is always built, even when the level drops the record.

## Coming from Java

| Java (SLF4J and Logback) | Python `logging` |
|---|---|
| `LoggerFactory.getLogger(Orders.class)` | `logging.getLogger(__name__)` |
| `TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| Appenders | Handlers: `StreamHandler` (console), `FileHandler` |
| Pattern layout, `%d %-5level %logger - %msg` | `format='%(asctime)s %(levelname)s %(name)s - %(message)s'` |
| `logback.xml`, read at start-up | `logging.basicConfig(...)` in code, honoured once per process |
| `log.debug("Adding {} + {}", a, b)` | `logger.debug("Adding %s + %s", a, b)` |
| Loggers form a hierarchy by package name | The same, by dotted names; records travel up to the root's handlers |

## Practice

::: practice
**A calculator that logs.** Write `add`, `subtract`, `multiply` and `divide` functions that log each result at `DEBUG` level through a logger named `ArithmeticApp`, and log a division by zero at `ERROR` level instead of crashing. Send the records both to the console and to `app1.log`. Call each function once, dividing 20 by 0.

```python title="app.py"
import logging

# Logging settings: a file and the console
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler("app1.log"),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger("ArithmeticApp")


def add(a, b):
    result = a + b
    logger.debug(f"Adding {a} + {b} = {result}")
    return result


def subtract(a, b):
    result = a - b
    logger.debug(f"Subtracting {a} - {b} = {result}")
    return result


def multiply(a, b):
    result = a * b
    logger.debug(f"Multiplying {a} * {b} = {result}")
    return result


def divide(a, b):
    try:
        result = a / b
        logger.debug(f"Dividing {a} / {b} = {result}")
        return result
    except ZeroDivisionError:
        logger.error("Division by zero error")
        return None


add(10, 15)
subtract(15, 10)
multiply(10, 20)
divide(20, 0)
```

```zsh title="Terminal"
python app.py
```

```output real note="the times differ on each run"
2026-10-30 10:46:59 - ArithmeticApp - DEBUG - Adding 10 + 15 = 25
2026-10-30 10:46:59 - ArithmeticApp - DEBUG - Subtracting 15 - 10 = 5
2026-10-30 10:46:59 - ArithmeticApp - DEBUG - Multiplying 10 * 20 = 200
2026-10-30 10:46:59 - ArithmeticApp - ERROR - Division by zero error
```

`handlers` replaces the single default handler with a list: a `FileHandler` appends every record to `app1.log`, and a `StreamHandler` writes it to the console. Run the script twice and `app1.log` holds both runs, since a `FileHandler` appends by default.
:::
