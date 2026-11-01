+++
number = "1.15"
title = "Modules and packages"
lede = "Import code from the standard library, from installed packages and from your own files, and run a file as a script."
summary = "Import code from the standard library, installed packages and your own files."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/5-Modules: 5.1-import.ipynb, package/, test.py"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A **module** is a Python file you can import; a **package** is a folder of modules. Every library you install, from NumPy to LangChain, is a package, imported in one of the ways below.

## Import a module

```python title="Notebook cell"
import math
print(math.sqrt(16))

from math import sqrt, pi
print(sqrt(25), pi)
```

```output real
4.0
5.0 3.141592653589793
```

`import math` gives you the module; you reach its contents as `math.sqrt`. `from math import sqrt, pi` brings those two names in directly.

## Give it a short name

```python title="Notebook cell"
import numpy as np
np.array([1, 2, 3, 4])
```

```output real
array([1, 2, 3, 4])
```

`as` renames the import. Some short names are near-universal: `np` for NumPy, `pd` for pandas. NumPy is a third-party package, so it has to be installed first ([lesson 1.1](lesson:1.1)).

## Import everything

```python title="Notebook cell"
from math import *
print(sqrt(16), pi)
```

```output real
4.0 3.141592653589793
```

`*` brings in every public name of the module. It works, but readers can no longer see where a name comes from, and an imported name can silently replace one of yours. Prefer explicit imports.

## Your own package

Build this folder next to your notebook:

```text
my-project/
├── notebook.ipynb
├── test.py
└── package/
    ├── __init__.py
    ├── maths.py
    └── subpackages/
        ├── __init__.py
        └── mult.py
```

```python title="package/__init__.py"
"""Marks this folder as a package. Runs when the package is first imported."""
```

```python title="package/maths.py"
def addition(a, b):
    return a + b


def subtraction(a, b):
    return a - b
```

```python title="package/subpackages/__init__.py"
# empty: marks subpackages as a package too
```

```python title="package/subpackages/mult.py"
def multiply(a, b):
    return a * b
```

```python title="Notebook cell"
from package.maths import addition
print(addition(2, 3))

from package import maths
print(maths.subtraction(4, 3))

from package.subpackages.mult import multiply
print(multiply(4, 5))
```

```output real
5
1
20
```

Dots follow the folders: `package.subpackages.mult` is `package/subpackages/mult.py`. Python finds `package` because it searches the folder the notebook runs in, which in VS Code is the notebook's own folder **VERIFY**. `__init__.py` makes a folder a regular package and runs on its first import; it can stay empty.

## Run a file as a script

```python title="test.py"
from package.maths import *
from package.subpackages.mult import multiply

print(addition(2, 3))
print(subtraction(4, 3))
print(multiply(4, 5))
```

```zsh title="Terminal"
python test.py
```

```output real
5
1
20
```

## Code that runs only as a script

Every module has a name in `__name__`. It is `"__main__"` when the file is run directly, and the module's own name when it is imported:

```python title="greet.py"
def greet(name):
    return f"Hello, {name}!"


if __name__ == "__main__":
    print(greet("Alice"))
```

```zsh title="Terminal"
python greet.py
```

```output real
Hello, Alice!
```

```python title="Notebook cell"
from greet import greet
print(greet("Bob"))
```

```output real
Hello, Bob!
```

Run as a script, the file prints its greeting; imported, it only provides `greet()`, and the block under the `if` stays silent. Scripts that start a web server or an agent end with this block.
