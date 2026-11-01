+++
number = "1.18"
title = "File paths"
lede = "Find out where your code is running, create and list folders, and build paths that work on macOS, Linux and Windows."
summary = "Build and check file paths that work on every operating system."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/6-File Handling: 6.2-filepath.ipynb; 5-Modules: 5.2-Standardlibrary.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A relative path such as `"example.txt"` is looked up from the **current working directory**. The `os` module tells you which folder that is and helps you build paths that work on any operating system. The examples use the `example.txt` from [lesson 1.17](lesson:1.17):

```text title="example.txt"
Hello world
This is a new line
```

## Where am I?

```python title="Notebook cell"
import os
cwd = os.getcwd()
print(f"Current working directory is {cwd}")
```

```output illustrative note="your path will differ"
Current working directory is /Users/you/my-project
```

A notebook in VS Code runs in its own folder **VERIFY**, so files next to it can be opened by name alone.

## Create and list folders

```python title="Notebook cell"
new_directory = "package"
os.mkdir(new_directory)
print(f"Directory '{new_directory}' created")
```

```output real
Directory 'package' created
```

Run the same cell again and it fails, because the folder now exists:

```output illustrative note="last line of the error, on macOS"
FileExistsError: [Errno 17] File exists: 'package'
```

`os.makedirs(new_directory, exist_ok=True)` creates the folder only when it is missing, and can create several levels at once.

```python title="Notebook cell"
items = os.listdir(".")
print(items)
```

```output illustrative note="your files will differ"
['example.txt', 'notebook.ipynb', 'package']
```

`"."` means the current folder.

## Join paths

```python title="Notebook cell"
dir_name = "folder"
file_name = "file.txt"
full_path = os.path.join(dir_name, file_name)
print(full_path)
```

```output illustrative note="macOS and Linux; Windows prints folder\file.txt"
folder/file.txt
```

macOS and Linux separate folders with `/`, Windows with `\`. `os.path.join()` uses the right one for the machine it runs on, so build paths with it instead of gluing strings together.

```python title="Notebook cell"
full_path = os.path.join(os.getcwd(), dir_name, file_name)
print(full_path)
```

```output illustrative note="your path will differ"
/Users/you/my-project/folder/file.txt
```

## Check a path

```python title="Notebook cell"
path = "example1.txt"
if os.path.exists(path):
    print(f"The path '{path}' exists")
else:
    print(f"The path '{path}' does not exist")
```

```output real
The path 'example1.txt' does not exist
```

```python title="Notebook cell"
for path in ["example.txt", "package"]:
    if os.path.isfile(path):
        print(f"The path '{path}' is a file.")
    elif os.path.isdir(path):
        print(f"The path '{path}' is a directory.")
    else:
        print(f"The path '{path}' is neither a file nor a directory.")
```

```output real
The path 'example.txt' is a file.
The path 'package' is a directory.
```

Check before you open: reading a file that isn't there raises `FileNotFoundError` ([lesson 1.19](lesson:1.19)).

## Absolute paths

```python title="Notebook cell"
relative_path = "example.txt"
absolute_path = os.path.abspath(relative_path)
print(absolute_path)
```

```output illustrative note="your path will differ"
/Users/you/my-project/example.txt
```

`abspath()` turns a relative path into the full path from the top of the disk.
