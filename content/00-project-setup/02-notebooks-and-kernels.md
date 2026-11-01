+++
number = "0.2"
title = "Notebooks and kernels in VS Code"
lede = "Run notebook cells with your project's environment, and install packages where the notebook can import them."
summary = "Run notebook cells inside a project's environment and install packages into the right place."
type = "build"
status = "published"
source = "1 Setup"
chips = [["i-layers", "Concept + code"], ["i-code", "ipykernel 7"]]
+++

A notebook runs its cells in a **kernel**: a Python process that keeps your variables from one cell to the next. The kernel's Python decides which packages you can import, so point it at your project's `.venv`. That environment needs `ipykernel`, which is already in the `requirements.txt` from [lesson 0.1](lesson:0.1).

## Pick the kernel

1. Open the project folder in VS Code (**File → Open Folder…**). Install the **Python** and **Jupyter** extensions if VS Code asks for them.
2. Create a notebook: **Create: New Jupyter Notebook** in the Command Palette (⇧⌘P), or a new file ending in `.ipynb`.
3. Click **Select Kernel** (top right) → **Python Environments** → your project's `.venv`.

Check which Python runs the cells:

```python title="Notebook cell"
import sys
print(sys.executable)
```

```output illustrative note="your path will differ"
/Users/you/my-agent/.venv/bin/python
```

It should point into your project's `.venv`. If it doesn't, pick the kernel again.

::: windows
Command Palette: Ctrl+Shift+P. The path ends in `.venv\Scripts\python.exe`.
:::

## Install packages

Add the package to `requirements.txt` and run `uv pip install -r requirements.txt` in the terminal. If the import still fails, or the notebook keeps using an old version, click **Restart** in the notebook toolbar and run the cells again.

To install from inside a notebook, use `%pip`. It installs into the kernel's own Python, if the environment has pip. Environments made with `uv venv` don't, so there it fails:

```python title="Notebook cell"
%pip install pandas
```

```output real note="path trimmed"
…python: No module named pip
Note: you may need to restart the kernel to use updated packages.
```

Avoid `!pip install`: it runs whichever pip the shell finds first, which may belong to another Python.

## Register a named kernel (optional)

VS Code finds `.venv` by itself. Jupyter Lab and Jupyter Notebook need the environment registered by name:

```zsh title="Terminal · my-agent/ (my-agent)"
python -m ipykernel install --user --name=my-agent --display-name "Python (my-agent)"  # (1)
jupyter kernelspec list
```

::: annots
1. Run it with the environment active. `--name` is the internal name (no spaces), `--display-name` is what kernel lists show. It writes a small `kernel.json` that says which Python to start.
:::

```output illustrative note="macOS paths"
Installed kernelspec my-agent in /Users/you/Library/Jupyter/kernels/my-agent
Available kernels:
  my-agent    /Users/you/Library/Jupyter/kernels/my-agent
  python3     /Users/you/my-agent/.venv/share/jupyter/kernels/python3
```

Remove it with `jupyter kernelspec uninstall my-agent`.

## If something goes wrong

| Problem | Fix |
|---|---|
| `ModuleNotFoundError` in the notebook, but the terminal has the package | The notebook runs another Python: check the kernel name (top right) and pick `.venv` |
| `.venv` is not in the kernel list | Open the project folder itself, not just the notebook file |
| `FileNotFoundError` for a file in the project | The notebook runs in its own folder, so relative paths start there |
| An upgraded package still behaves like the old version | Restart the kernel |
