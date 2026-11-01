+++
number = "1.5"
title = "Conditions: if, elif and else"
lede = "Let the program choose: run a block only when a test is true, pick one of several branches, or nest one decision inside another."
summary = "Run different code depending on a condition, with nested checks and truthiness."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/2-Control Flow: Conditionalstatements.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A condition is a test that is either true or false, usually a comparison ([lesson 1.4](lesson:1.4)). `if` runs a block only when its test is true; `else` and `elif` say what happens otherwise.

## if

```python title="Notebook cell"
age = 20

if age >= 18:
    print("You are allowed to vote in the elections")
```

```output real
You are allowed to vote in the elections
```

`age >= 18` is `True`, so the indented block runs. With `age = 16` the cell would print nothing.

## else

```python title="Notebook cell"
age = 16

if age >= 18:
    print("You are eligible for voting")
else:
    print("You are a minor")
```

```output real
You are a minor
```

`else` runs when the test is false. Exactly one of the two blocks runs.

## elif

```python title="Notebook cell"
age = 17

if age < 13:
    print("You are a child")
elif age < 18:
    print("You are a teenager")
else:
    print("You are an adult")
```

```output real
You are a teenager
```

`elif` means "else if". Python checks the tests from the top and runs only the first block whose test is true; `else` catches everything left. Order matters: `age < 18` is checked only after `age < 13` turned out false.

## Nested conditions

A block can contain another `if`:

```python title="Notebook cell" input="7"
num = int(input("Enter the number: "))

if num > 0:
    print("The number is positive")
    if num % 2 == 0:
        print("The number is even")
    else:
        print("The number is odd")
else:
    print("The number is zero or negative")
```

```output real note="typed 7"
The number is positive
The number is odd
```

## What counts as true

A test doesn't have to be a comparison. Any value works: `0`, `0.0`, `""`, `[]`, `{}` and `None` count as false, everything else as true.

```python title="Notebook cell"
name = ""

if name:
    print("Hello", name)
else:
    print("No name given")
```

```output real
No name given
```

Two mistakes stop a condition from running at all:

| Code | Error |
|---|---|
| `if age = 18:` | `SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?` |
| `if age == 18` (no colon) | `SyntaxError: expected ':'` |

## Practice

::: practice
**Leap year.** A year is a leap year if it divides by 4, except years that divide by 100, unless they also divide by 400. Read a year and say whether it is one.

```python title="Notebook cell" input="2024"
year = int(input("Enter the year: "))

if year % 4 == 0:
    if year % 100 == 0:
        if year % 400 == 0:
            print(year, "is a leap year")
        else:
            print(year, "is not a leap year")
    else:
        print(year, "is a leap year")
else:
    print(year, "is not a leap year")
```

```output real note="typed 2024"
2024 is a leap year
```

Try 1900 (divides by 100, not by 400: not a leap year) and 2000 (divides by 400: a leap year).
:::

::: practice
**Calculator with a chosen operation.** Read two numbers and an operation (`+`, `-`, `*` or `/`) and print the result. Refuse to divide by zero.

```python title="Notebook cell" input="12|3|*"
num1 = float(input("Enter first number: "))
num2 = float(input("Enter second number: "))
operation = input("Enter operation (+, -, *, /): ")

if operation == "+":
    result = num1 + num2
elif operation == "-":
    result = num1 - num2
elif operation == "*":
    result = num1 * num2
elif operation == "/":
    if num2 != 0:
        result = num1 / num2
    else:
        result = "Error! Division by zero."
else:
    result = "Invalid operation."

print("Result:", result)
```

```output real note="typed 12, 3 and *"
Result: 36.0
```
:::

::: practice
**Ticket price.** Children under 5 go free and children up to 12 pay $10. Teenagers up to 17 pay $12 with a student card, $15 without; adults up to 64 pay $18 or $25; seniors pay $20. Read the age and whether the person is a student, and print the price.

```python title="Notebook cell" input="16|Yes"
age = int(input("Enter your age: "))
is_student = input("Are you a student? (yes/no): ").lower()

if age < 5:
    price = "Free"
elif age <= 12:
    price = "$10"
elif age <= 17:
    if is_student == "yes":
        price = "$12"
    else:
        price = "$15"
elif age <= 64:
    if is_student == "yes":
        price = "$18"
    else:
        price = "$25"
else:
    price = "$20"

print("Ticket Price:", price)
```

```output real note="typed 16 and Yes"
Ticket Price: $12
```

`.lower()` makes the answer case-insensitive, so `Yes` and `yes` both count.
:::

::: practice
**Employee bonus.** The bonus percentage depends on the performance rating (1.0 to 5.0) and the years of service: 20, 15 or 10 % for a rating of 4.5 or more (more than 10 years, more than 5, otherwise), 15, 10 or 5 % for 3.5 or more, nothing below. Read the years, the rating and the salary, and print the bonus.

```python title="Notebook cell" input="12|4.6|50000"
years_of_service = int(input("Enter years of service: "))
performance_rating = float(input("Enter performance rating (1.0 to 5.0): "))

if performance_rating >= 4.5:
    if years_of_service > 10:
        bonus_percentage = 20
    elif years_of_service > 5:
        bonus_percentage = 15
    else:
        bonus_percentage = 10
elif performance_rating >= 3.5:
    if years_of_service > 10:
        bonus_percentage = 15
    elif years_of_service > 5:
        bonus_percentage = 10
    else:
        bonus_percentage = 5
else:
    bonus_percentage = 0

salary = float(input("Enter current salary: "))
bonus_amount = salary * bonus_percentage / 100

print("Bonus Amount: ${:.2f}".format(bonus_amount))
```

```output real note="typed 12, 4.6 and 50000"
Bonus Amount: $10000.00
```
:::

::: practice
**Login check.** Compare a username and password with stored ones and print whether the login succeeds, the password is wrong, or the user doesn't exist.

```python title="Notebook cell" input="admin|secret123"
stored_username = "admin"
stored_password = "secret123"

username = input("Enter username: ")
password = input("Enter password: ")

if username == stored_username:
    if password == stored_password:
        print("Login successful!")
    else:
        print("Incorrect password.")
else:
    print("Username not found.")
```

```output real note="typed admin and secret123"
Login successful!
```

Fine for practising conditions; real applications never store passwords in code or as plain text.
:::
