+++
number = "1.13"
title = "Functions in practice"
lede = "Seven small functions to write yourself: conversions, checks, totals, recursion, word counts and pattern matching."
summary = "Small, real functions to read and write: conversions, checks, totals and recursion."
type = "build"
status = "published"
source = "2 Complete-Python-Bootcamp/4-Functions: 4.2-examplesfunctions.ipynb, sample.txt"
chips = [["i-layers", "Practice"], ["i-code", "Python 3.12"]]
+++

Each task below asks for one function. Write your own version first, then open the solution and compare. Together they use most of what the earlier lessons covered: conditions, loops, strings, lists, dictionaries and return values.

::: practice
**Temperature conversion.** Write `convert_temperature(temp, unit)`: with unit `"C"` it converts Celsius to Fahrenheit, with `"F"` Fahrenheit to Celsius, and with anything else it returns `None`.

```python title="Notebook cell"
def convert_temperature(temp, unit):
    """Convert a temperature between Celsius and Fahrenheit."""
    if unit == "C":
        return temp * 9 / 5 + 32  # Celsius to Fahrenheit
    elif unit == "F":
        return (temp - 32) * 5 / 9  # Fahrenheit to Celsius
    else:
        return None

print(convert_temperature(25, "C"))
print(convert_temperature(77, "F"))
```

```output real
77.0
25.0
```

Each branch ends the function with its own `return`.
:::

::: practice
**Password strength.** Write `is_strong_password(password)`: a strong password has at least 8 characters, a digit, a lowercase and an uppercase letter, and one of `!@#$%^&*()_+`.

```python title="Notebook cell"
def is_strong_password(password):
    """Check whether a password is strong."""
    if len(password) < 8:
        return False
    if not any(char.isdigit() for char in password):
        return False
    if not any(char.islower() for char in password):
        return False
    if not any(char.isupper() for char in password):
        return False
    if not any(char in "!@#$%^&*()_+" for char in password):
        return False
    return True

print(is_strong_password("WeakPwd"))
print(is_strong_password("Str0ngPwd!"))
```

```output real
False
True
```

Each failed rule returns `False` straight away; only a password that passes every check reaches `return True`. `any(...)` asks whether at least one character passes ([lesson 1.8](lesson:1.8)).
:::

::: practice
**Shopping cart total.** Each item in the cart is a dictionary with a name, a price and a quantity. Write `calculate_total_cost(cart)`.

```python title="Notebook cell"
def calculate_total_cost(cart):
    total_cost = 0
    for item in cart:
        total_cost += item["price"] * item["quantity"]
    return total_cost

cart = [
    {"name": "Apple", "price": 0.5, "quantity": 4},
    {"name": "Banana", "price": 0.3, "quantity": 6},
    {"name": "Orange", "price": 0.7, "quantity": 3},
]

total_cost = calculate_total_cost(cart)
print(total_cost)
print(round(total_cost, 2))
```

```output real
5.8999999999999995
5.9
```

Floats are stored in binary, so most decimals are approximations and sums like this one end in odd digits. Round for display with `round(value, 2)` or an f-string's `:.2f`.
:::

::: practice
**Palindrome.** Write `is_palindrome(s)`: true when the text reads the same backwards, ignoring case and spaces.

```python title="Notebook cell"
def is_palindrome(s):
    s = s.lower().replace(" ", "")
    return s == s[::-1]

print(is_palindrome("A man a plan a canal Panama"))
print(is_palindrome("Hello"))
```

```output real
True
False
```

`s[::-1]` is the string reversed ([lesson 1.7](lesson:1.7)).
:::

::: practice
**Factorial.** Write `factorial(n)`, the product 1 × 2 × … × n, using recursion: a function that calls itself.

```python title="Notebook cell"
def factorial(n):
    if n == 0:
        return 1
    else:
        return n * factorial(n - 1)

print(factorial(6))
```

```output real
720
```

`n == 0` is the base case that stops the calls. Without it the function would call itself until Python gives up with a `RecursionError`.
:::

::: practice
**Word frequency in a file.** Write `count_word_frequency(file_path)`: read a text file and count how often each word appears, ignoring case and punctuation. Save this text as `sample.txt` next to your notebook first:

```text title="sample.txt"
Hello world, how are you?
The world is big. The world is round!
```

```python title="Notebook cell"
def count_word_frequency(file_path):
    word_count = {}
    with open(file_path, "r") as file:
        for line in file:
            words = line.split()
            for word in words:
                word = word.lower().strip('.,!?;:"\'')
                word_count[word] = word_count.get(word, 0) + 1
    return word_count

word_frequency = count_word_frequency("sample.txt")
print(word_frequency)
```

```output real
{'hello': 1, 'world': 3, 'how': 1, 'are': 1, 'you': 1, 'the': 2, 'is': 2, 'big': 1, 'round': 1}
```

`with open(...)` reads the file line by line ([lesson 1.17](lesson:1.17)); `strip()` with an argument removes those characters from both ends of each word.
:::

::: practice
**Email check.** Write `is_valid_email(email)` with a regular expression: some allowed characters, an `@`, a domain, a dot and an ending.

```python title="Notebook cell"
import re

def is_valid_email(email):
    """Check whether an email address looks valid."""
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return re.match(pattern, email) is not None

print(is_valid_email("test@example.com"))
print(is_valid_email("invalid-email"))
```

```output real
True
False
```

`re.match` returns a match object, or `None` when the text doesn't fit the pattern ([lesson 1.16](lesson:1.16)).
:::
