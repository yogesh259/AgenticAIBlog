+++
number = "1.17"
title = "Reading and writing files"
lede = "Open a file with `with open()`, read it whole or line by line, write and append text, and handle binary data."
summary = "Read and write text and binary files safely with open() and with."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/6-File Handling: 6.1-fileoperation.ipynb, example.txt"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Agents read documents, save results and keep logs, so file handling comes up in every project. Create `example.txt` next to your notebook with these lines:

```text title="example.txt"
Hello, how are you?
I am good.
Alice is my name.
Welcome to Python.
```

## Read a whole file

```python title="Notebook cell"
with open("example.txt", "r") as file:
    content = file.read()
    print(content)
```

```output real
Hello, how are you?
I am good.
Alice is my name.
Welcome to Python.
```

`open()` gives you a file object; `"r"` opens it for reading. The `with` block closes the file when the block ends, even if an error happens inside it, so you never have to remember `file.close()`.

## Read line by line

```python title="Notebook cell"
with open("example.txt", "r") as file:
    for line in file:
        print(line.strip())
```

```output real
Hello, how are you?
I am good.
Alice is my name.
Welcome to Python.
```

Looping over a file gives one line at a time, each ending in a line break. `strip()` removes it; without it, `print` would add a second one and the output would be double-spaced.

## Write and append

```python title="Notebook cell"
with open("example.txt", "w") as file:
    file.write("Hello World!\n")
    file.write("this is a new line.")

with open("example.txt", "a") as file:
    file.write("Append operation taking place!\n")

lines = ["First line\n", "Second line\n", "Third line\n"]
with open("example.txt", "a") as file:
    file.writelines(lines)

with open("example.txt", "r") as file:
    print(file.read())
```

```output real
Hello World!
this is a new line.Append operation taking place!
First line
Second line
Third line
```

`"w"` empties the file before writing; `"a"` adds to the end. Neither `write()` nor `writelines()` adds line breaks: the appended text lands right after "this is a new line." because that line had no `\n`.

| Mode | Opens for | If the file exists | If it doesn't |
|---|---|---|---|
| `"r"` | reading (the default) | reads from the start | `FileNotFoundError` |
| `"w"` | writing | empties it first | creates it |
| `"a"` | appending | writes at the end | creates it |
| `"w+"` | writing and reading | empties it first | creates it |
| `"rb"`, `"wb"` | reading, writing bytes | as `"r"`, `"w"` | as `"r"`, `"w"` |

## Binary files

```python title="Notebook cell"
data = b"\x00\x01\x02\x03\x04"
with open("example.bin", "wb") as file:
    file.write(data)

with open("example.bin", "rb") as file:
    content = file.read()
    print(content)
```

```output real
b'\x00\x01\x02\x03\x04'
```

`b"..."` is a `bytes` value: raw bytes rather than text. Images, PDFs and audio are read and written in binary mode.

## Write, then read back

```python title="Notebook cell"
with open("example.txt", "w+") as file:
    file.write("Hello world\n")
    file.write("This is a new line\n")

    file.seek(0)
    content = file.read()
    print(content)
```

```output real
Hello world
This is a new line
```

An open file keeps a position, like a cursor. After writing, it sits at the end, so reading would return nothing; `seek(0)` moves it back to the start.

::: windows
`open()` uses the system's text encoding, which on Windows is often not UTF-8. For text with accents or other non-English characters, pass `encoding="utf-8"`.
:::

## Practice

::: practice
**Copy a text file.** Read `example.txt` and write its content to `destination.txt`, then print the copy.

```python title="Notebook cell"
with open("example.txt", "r") as source_file:
    content = source_file.read()

with open("destination.txt", "w") as destination_file:
    destination_file.write(content)

with open("destination.txt", "r") as file:
    print(file.read())
```

```output real
Hello world
This is a new line
```

For a straight copy, `shutil.copyfile()` does it in one line ([lesson 1.16](lesson:1.16)).
:::

::: practice
**Count lines, words and characters.** Write `count_text_file(file_path)` that returns all three counts for a text file.

```python title="Notebook cell"
def count_text_file(file_path):
    with open(file_path, "r") as file:
        lines = file.readlines()
        line_count = len(lines)
        word_count = sum(len(line.split()) for line in lines)
        char_count = sum(len(line) for line in lines)
    return line_count, word_count, char_count

lines, words, characters = count_text_file("example.txt")
print(f"Lines: {lines}, Words: {words}, Characters: {characters}")
```

```output real
Lines: 2, Words: 7, Characters: 31
```

`readlines()` returns all lines as a list. The character count includes the line breaks.
:::
