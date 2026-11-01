+++
number = "1.3"
title = "Strings and f-strings"
lede = "Text is a `str`: read it by position, check what it contains, clean it with methods, and build new text with f-strings."
summary = "Quotes, indexing, len and in, the common string methods, split and join, and f-strings with format specs."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp: string uses in Loops.ipynb, 3.1.1-ListExamples.ipynb, 3.3-Sets.ipynb, 4.2-examplesfunctions.ipynb, 4.4-Mapsfunction.ipynb, 6.1-fileoperation.ipynb, Conditionalstatements.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Prompts, model replies, file contents and document chunks are all strings, so text handling comes up in every agentic AI project. A string is a sequence of characters. These are the operations you will use most.

## Create strings

```python title="Notebook cell"
first = 'Alice'
quote = "It's fine"
poem = """Roses are red,
violets are blue."""

print(first, quote)
print(poem)
print(first + " " + "Smith")
print("-" * 10)
```

```output real
Alice It's fine
Roses are red,
violets are blue.
Alice Smith
----------
```

Single and double quotes work the same: pick the one your text doesn't contain. Triple quotes allow line breaks. `+` joins strings and `*` repeats them.

## Length, positions and membership

```python title="Notebook cell"
text = "Alice Smith"
print(len(text))
print(text[0], text[-1])
print(text[0:5])
print("Smith" in text)
```

```output real
11
A h
Alice
True
```

Positions start at 0, and negative positions count from the end. `text[0:5]` takes positions 0 to 4: slicing works the same way as for lists ([lesson 1.7](lesson:1.7)). A string can't be changed in place:

```python title="Notebook cell"
text[0] = "a"
```

```output real note="last line of the error"
TypeError: 'str' object does not support item assignment
```

So every method below returns a new string and leaves the original as it was.

## Clean and test text

```python title="Notebook cell"
s = "  Hello, World!  "
print("[" + s + "]")
print("[" + s.strip() + "]")
print(s.strip().lower())
print(s.strip().upper())
print(s.strip().replace("World", "Python"))
print("42".isdigit(), "abc".islower(), "ABC".isupper())
```

```output real
[  Hello, World!  ]
[Hello, World!]
hello, world!
HELLO, WORLD!
Hello, Python!
True True True
```

`strip()` removes spaces and line breaks from both ends, which is handy for lines read from a file or text typed by a user. Methods can be chained: `s.strip().lower()` lowercases the stripped copy.

## Split and join

```python title="Notebook cell"
words = "Python makes text easy".split()
print(words)
print("a,b,c".split(","))
print(" ".join(words))
print("\n\n".join(["First chunk", "Second chunk"]))
```

```output real
['Python', 'makes', 'text', 'easy']
['a', 'b', 'c']
Python makes text easy
First chunk

Second chunk
```

`split()` with no argument splits on any run of spaces or line breaks; `split(",")` splits on that exact text. `join()` is called on the separator and glues a list of strings together. Joining retrieved document chunks with `"\n\n"` into one block of context is a common step before sending them to a model.

## f-strings

```python title="Notebook cell"
name = "Alice"
score = 88.4567
print(f"{name} scored {score}")
print(f"{name} scored {score:.2f}")
print(f"{name.upper()} has {len(name)} letters")
```

```output real
Alice scored 88.4567
Alice scored 88.46
ALICE has 5 letters
```

An f-string has an `f` before the opening quote. Python evaluates each `{...}` and puts the result into the text. A colon inside the braces starts a format spec: `:.2f` means "a number with 2 decimal places".

The older `format()` method fills empty braces in order:

```python title="Notebook cell"
print("{} scored {:.2f}".format(name, score))
```

```output real
Alice scored 88.46
```

Prompt templates use the same `{name}` placeholders without the `f`: the library fills them in when the prompt is used ([module 06](module:06)).
