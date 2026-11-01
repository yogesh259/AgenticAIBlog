+++
number = "0.1"
title = "Set up a Python project"
lede = "Install Python once. Then give every project its own environment and a requirements.txt file, so one command installs everything the project needs, with pip or with its faster alternative, uv."
summary = "Install Python, create a virtual environment and install a project's packages from requirements.txt with pip or uv."
type = "build"
status = "published"
source = "1 Setup"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12 · uv 0.13"]]
+++

::: in-short
- Install **Python** once per machine. Python 3.12 is a safe choice.
- Give each project a **virtual environment**: a `.venv` folder with its own Python and its own packages. Activate it and the prompt shows the project's name.
- List the project's packages in **requirements.txt**, one per line. One command installs them all: `pip install -r requirements.txt`.
- **uv** is a faster alternative to pip: `uv venv` creates the environment and `uv pip install -r requirements.txt` installs the list.
:::

## The building blocks

### Install Python

Install Python once per machine, in any of these ways:

- **Anaconda** ([anaconda.com/download](https://www.anaconda.com/download)): Python plus the `conda` tool and many data-science packages. A large install, popular for data science.
- **python.org** ([python.org/downloads](https://www.python.org/downloads/)): the official installer for macOS and Windows. On Windows, tick "Add python.exe to PATH" on the first screen.
- **Homebrew** on macOS: `brew install python@3.12`.
- **uv**, below, downloads Python by itself when it can't find the version a project asks for, so with uv you can skip this step.

LangChain 1.x needs Python 3.10 or newer; 3.12 is a safe, widely supported choice.

### Virtual environments

A virtual environment is a folder inside the project, usually named `.venv`, with its own `python` and its own installed packages.

- **Activate** it (`source .venv/bin/activate`) and, in that terminal, `python` means the environment's Python. The prompt starts with the environment's name, such as `(my-agent)`.
- **Deactivate** it (`deactivate`) to get back to the Python you had before.
- The folder is disposable: delete it, create it again and reinstall from `requirements.txt`.

### pip, uv and conda

- **pip** is Python's own package installer. It comes with Python and installs into the active environment.
- **uv** ([docs.astral.sh/uv](https://docs.astral.sh/uv/)) does the same job much faster, with familiar commands: `uv venv` creates an environment and `uv pip install` installs into it. It can also download Python.
- **conda**, from Anaconda, creates environments too; inside one, you can still install packages with `pip`.

Pick one per project. The steps below use uv; the pip and conda versions follow them.

### requirements.txt

A plain text file in the project folder that lists the packages the project needs, one per line.

- A bare name such as `pandas` gets the newest version. Add a version only when you need one: `pandas==2.2.3` for exactly that version, `langchain>=1.0` for that version or newer.
- Lines starting with `#` are comments.
- `pip install -r requirements.txt` installs every line. Run it again after adding a line: packages already installed are skipped.

## Step by step

Commands are for macOS and Linux. Where Windows differs, a line underneath shows the Windows version.

### 1. Check Python

```zsh title="Terminal"
python3 --version  # (1)
```

::: annots
1. Prints the installed version. No Python yet? Install it as shown above, or go on: uv fetches Python in step 3.
:::

```output real note="your version may differ"
Python 3.12.10
```

::: windows
`python --version` or `py --version`
:::

### 2. Install uv

```zsh title="Terminal"
curl -LsSf https://astral.sh/uv/install.sh | sh  # (1)
uv --version
```

::: annots
1. The official installer. `pip install uv` and `brew install uv` work too. Open a new terminal if `uv` is not found yet.
:::

```output real note="platform tag trimmed"
uv 0.13.6 (329bf9448 2026-10-26)
```

::: windows
`powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
:::

### 3. Create the project and its environment

```zsh title="Terminal"
mkdir my-agent
cd my-agent
uv venv --python 3.12  # (1)
```

::: annots
1. Creates the environment in a `.venv` folder with Python 3.12, downloading that version first if it is missing. Leave out `--python` to use whichever Python uv finds.
:::

```output illustrative note="paths trimmed; Windows shows its own activate command"
Using CPython 3.12.10 interpreter at: …
Creating virtual environment at: .venv
Activate with: source .venv/bin/activate
```

### 4. Activate it

```zsh title="Terminal · my-agent/"
source .venv/bin/activate  # (1)
```

::: annots
1. From now on, `python` in this terminal is the environment's Python. The prompt starts with `(my-agent)`, the folder's name. With Anaconda installed you will see `(my-agent) (base)`: the first name is the one in use. `deactivate` leaves the environment.
:::

```output illustrative note="your prompt will differ"
(my-agent) you@MacBook my-agent %
```

::: windows
`.venv\Scripts\activate` (PowerShell or Command Prompt)
:::

### 5. List the packages in requirements.txt

Create `requirements.txt` in the project folder, in your editor or with `touch requirements.txt`, and write one package per line:

```text title="my-agent/requirements.txt"
langchain-openai  # (1)
python-dotenv  # (2)
ipykernel  # (3)
```

::: annots
1. LangChain's connector for OpenAI models.
2. Loads API keys from a `.env` file ([lesson 0.3](lesson:0.3)).
3. Lets notebooks run in this environment ([lesson 0.2](lesson:0.2)).
:::

### 6. Install everything with one command

```zsh title="Terminal · my-agent/"
uv pip install -r requirements.txt  # (1)
```

::: annots
1. Installs every package in the file, plus the packages they depend on, into `.venv`. `-r` means "read the list from this file". With pip, the command is `pip install -r requirements.txt`.
:::

```output real note="trimmed; counts and times vary by platform"
Resolved 66 packages in 586ms
Installed 66 packages in 12.26s
 + annotated-types==0.8.0
 …
 + ipykernel==7.4.0
 …
 + langchain-openai==1.7.3
 …
 + python-dotenv==1.2.4
 …
```

Need another package later? Add it as a new line, for example `pandas`, and run the same command again:

```zsh title="Terminal · my-agent/"
uv pip install -r requirements.txt  # (1)
```

::: annots
1. Only what is new gets installed: pandas, plus numpy, which pandas needs. When nothing changed, uv only prints a line such as `Checked 3 packages in 39ms`.
:::

```output real note="times vary"
Resolved 68 packages in 638ms
Prepared 2 packages in 3.86s
Installed 2 packages in 2.57s
 + numpy==2.5.4
 + pandas==3.1.0
```

### 7. Check what is installed

```zsh title="Terminal · my-agent/"
uv pip list  # (1)
python -c "import langchain_openai, dotenv; print('imports ok')"  # (2)
```

::: annots
1. Lists every package in `.venv`: the ones in your file and everything they pulled in. With pip: `pip list`.
2. A quick test that the imports work with the environment's Python.
:::

```output real note="trimmed"
Package                 Version
----------------------- ----------
annotated-types         0.8.0
…
ipykernel               7.4.0
…
langchain-openai        1.7.3
…
pandas                  3.1.0
…
python-dotenv           1.2.4
…
imports ok
```

### 8. Start again if something breaks

```zsh title="Terminal · my-agent/"
deactivate
rm -rf .venv  # (1)
```

::: annots
1. Deletes the environment and nothing else. Repeat steps 3, 4 and 6, and `requirements.txt` brings every package back.
:::

::: windows
`Remove-Item -Recurse -Force .venv` instead of `rm -rf .venv`.
:::

### The same with pip or conda

With only Python installed, its built-in `venv` module and pip do the same job, more slowly:

```zsh title="Terminal · pip"
python3 -m venv .venv  # (1)
source .venv/bin/activate
pip install -r requirements.txt
```

::: annots
1. Creates `.venv` from the Python you ran. Unlike `uv venv`, it includes pip.
:::

::: windows
`python -m venv .venv`, then `.venv\Scripts\activate`.
:::

With Anaconda, create the environment with conda and install the same file with pip:

```zsh title="Terminal · conda"
conda create -p venv python==3.12 -y  # (1)
conda activate ./venv  # (2)
pip install -r requirements.txt
conda deactivate
```

::: annots
1. `-p venv` puts the environment in a `venv` folder inside the project. `python==3.12` means exactly 3.12.0; `python=3.12`, with one `=`, gets the newest 3.12 release. `-y` skips the confirmation.
2. An environment created with `-p` is a folder, so activate it by its path: `./venv` or `venv/`. The prompt then shows the folder's full path; `conda config --set env_prompt '({name})'` shortens it to `(venv)`.
:::

### Or let uv keep the list for you

Instead of editing `requirements.txt` by hand, you can let uv keep the list: `uv add` installs a package and records it in the project's `pyproject.toml` file.

```zsh title="Terminal"
uv init demouv --no-package  # (1)
cd demouv
uv add pandas  # (2)
uv run main.py  # (3)
```

::: annots
1. Creates the folder with `pyproject.toml` (the project's settings and package list), `.python-version` and a starter `main.py`. `--no-package` keeps it a plain folder for scripts and notebooks; without it, uv sets up an installable package in `src/`.
2. Installs pandas, creating `.venv` on first use, and records it in `pyproject.toml`; `uv.lock` pins the exact version of every package. `uv add -r requirements.txt` adds a whole existing list.
3. Runs a file with the project's environment, no activation needed. On another machine, `uv sync` rebuilds `.venv` from `uv.lock`.
:::

Both ways work. `requirements.txt` is simpler and works with any tool; a uv project also pins exact versions.

## Quick reference

| Task | pip | uv |
|---|---|---|
| Create an environment | `python3 -m venv .venv` | `uv venv --python 3.12` |
| Activate it | `source .venv/bin/activate` | `source .venv/bin/activate` |
| Install the whole list | `pip install -r requirements.txt` | `uv pip install -r requirements.txt` |
| Install one package | `pip install pandas` | `uv pip install pandas` |
| List installed packages | `pip list` | `uv pip list` |
| Leave the environment | `deactivate` | `deactivate` |
| Start again | `rm -rf .venv` | `rm -rf .venv` |

On Windows: `python` instead of `python3`, and `.venv\Scripts\activate` to activate.

| Also useful | Command |
|---|---|
| Install uv | `curl -LsSf https://astral.sh/uv/install.sh \| sh` or `pip install uv` |
| conda: environment in a `venv/` folder | `conda create -p venv python==3.12 -y` |
| conda: activate, leave | `conda activate ./venv` · `conda deactivate` |
| uv project: create | `uv init demouv --no-package` |
| uv project: add a package, or a whole list | `uv add pandas` · `uv add -r requirements.txt` |
| uv project: run a file | `uv run main.py` |
| uv project: rebuild `.venv` elsewhere | `uv sync` |

## Common problems

::: warn `ModuleNotFoundError` for a package you installed
The package went into a different Python. A `pip install` with no environment active goes into the system Python, or into Anaconda's `(base)`, which the project doesn't use. Check that the prompt starts with `(my-agent)`, activate if it doesn't, and install again. With no environment active and no `.venv` in the folder, uv stops with "No virtual environment found" instead of installing.
:::

::: warn Plain `pip` inside a uv environment
`uv venv` doesn't put pip in the environment, so `pip install`, `pip list` and `uv run pip list` fall through to some other pip on your machine, such as Anaconda's, and install or list *that* Python's packages. Use `uv pip install` and `uv pip list`, or create the environment with `uv venv --seed` to include pip.
:::

::: warn `conda activate venv` can't find the environment
An environment created with `-p venv` is a folder, not a named environment, and a bare `venv` is looked up as a name. Give the path: `conda activate ./venv`.
:::

::: tip Copy the recipe, not the environment
`.venv` holds paths and files built for one machine, so it breaks when copied or moved. Keep `requirements.txt` with your code, and in git, then create the environment again on each machine. uv puts a `.gitignore` inside `.venv`, so git skips it.
:::
