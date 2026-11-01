+++
number = "2.1"
title = "Classes and objects"
lede = "A class bundles data with the functions that work on it. In Python each object carries its own attributes, and the class holds the methods they share."
summary = "Define a class, create objects, give them attributes and methods, and see where each one lives."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/8-Class And Objects: 8.1-oops.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Classes in Python play the same role as in Java or C#, but the mechanics are looser: nothing is declared up front, `self` is written out, and an object is little more than a set of attributes plus a link to its class. Every library class you will use later, from a chat model to a graph, works this way.

This module needs only the standard library, plus Requests and Beautiful Soup for one practice task in [lesson 2.10](lesson:2.10). Add these lines to `requirements.txt` and run your install command again ([lesson 0.1](lesson:0.1)):

```text title="requirements.txt"
requests
beautifulsoup4
```

## Define a class and create objects

```python title="Notebook cell"
class Car:
    pass


audi = Car()
bmw = Car()

print(type(audi))
print(audi)
print(bmw)
```

```output real note="the addresses differ on each run"
<class '__main__.Car'>
<__main__.Car object at 0x000001F99CA0F9E0>
<__main__.Car object at 0x000001F99CCBC260>
```

Calling the class creates an object; there is no `new`. `pass` fills the empty body. `__main__` is the module the class was defined in, here the notebook itself ([lesson 1.15](lesson:1.15)). Until you give the class a `__repr__` ([lesson 2.5](lesson:2.5)), an object prints as its class and its memory address.

## Attributes belong to each object

```python title="Notebook cell"
audi.windows = 4
print(audi.windows)

tata = Car()
tata.doors = 4
print(tata.windows)
```

```output real note="last line of the error"
4
AttributeError: 'Car' object has no attribute 'windows'
```

Attributes are not declared in the class: assigning `audi.windows` creates `windows` on that one object. `tata` never got one, so reading it fails. `dir()` lists everything an object can reach:

```python title="Notebook cell"
dir(tata)
```

```output real
['__class__',
 '__delattr__',
 '__dict__',
 '__dir__',
 '__doc__',
 '__eq__',
 '__format__',
 '__ge__',
 '__getattribute__',
 '__getstate__',
 '__gt__',
 '__hash__',
 '__init__',
 '__init_subclass__',
 '__le__',
 '__lt__',
 '__module__',
 '__ne__',
 '__new__',
 '__reduce__',
 '__reduce_ex__',
 '__repr__',
 '__setattr__',
 '__sizeof__',
 '__str__',
 '__subclasshook__',
 '__weakref__',
 'doors']
```

The double-underscore names are what every class gets, mostly inherited from `object`, the class every class inherits from; Python calls them for you ([lesson 2.5](lesson:2.5)). Your own attribute, `doors`, comes last. The object's own attributes sit in a dictionary:

```python title="Notebook cell"
tata.__dict__
```

```output real
{'doors': 4}
```

## Initialise objects with `__init__`

```python title="Notebook cell"
class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def bark(self):
        print(f"{self.name} says woof")


dog1 = Dog("Buddy", 3)
dog2 = Dog("Lucy", 4)
print(dog1.name, dog1.age)
print(dog2.name, dog2.age)
dog1.bark()
dog2.bark()
```

```output real
Buddy 3
Lucy 4
Buddy says woof
Lucy says woof
```

`Dog("Buddy", 3)` creates an empty object, then calls `__init__` on it with your arguments. `__init__` fills the object in and returns nothing: it initialises, it doesn't construct. Setting attributes there is how every `Dog` gets the same ones.

`self` is the object a method works on. Python passes it for you, which this call shows:

```python title="Notebook cell"
Dog.bark(dog1)
```

```output real
Buddy says woof
```

`dog1.bark()` is shorthand for `Dog.bark(dog1)`: a method is a function stored on the class, and `self` is simply its first parameter. The name `self` is a convention; Java's `this` is the same idea, written out.

## Where attributes and methods live

A name assigned in the class body, outside any method, belongs to the class and is shared by all its objects:

```python title="Notebook cell"
class Dog:
    legs = 4                       # class attribute: one value, shared

    def __init__(self, name, age):
        self.name = name           # instance attributes: one set per object
        self.age = age

    def bark(self):
        print(f"{self.name} says woof")


dog1 = Dog("Buddy", 3)
dog2 = Dog("Lucy", 4)
print(dog1.__dict__)
print(dog1.legs, dog2.legs, Dog.legs)
```

```output real
{'name': 'Buddy', 'age': 3}
4 4 4
```

`legs` is not in `dog1.__dict__`. When Python reads `dog1.legs`, it looks in the object first and then in its class, and the same search finds `bark`. Inheritance adds more classes to the end of that search ([lesson 2.2](lesson:2.2)).

::: visual objects-and-class | Figure | Objects and their class
Two objects with their own attributes, one class with the shared attribute and the methods, and how `dog1.name`, `dog1.bark()` and `dog1.legs` are found.
:::

## Coming from Java

| Java | Python |
|---|---|
| `new Dog("Buddy", 3)` | `Dog("Buddy", 3)` |
| Constructor | `__init__(self, ...)`, which initialises an object Python has already created |
| `this`, implicit | `self`, the explicit first parameter of every method |
| Fields declared in the class | Attributes created by assignment, usually in `__init__`; any object can get more |
| `static` field | Class attribute, assigned in the class body |
| Overloaded constructors | One `__init__` with default arguments ([lesson 1.12](lesson:1.12)) |
| `toString()` | `__str__` and `__repr__` ([lesson 2.5](lesson:2.5)) |

## Practice

::: practice
**Bank account.** Write a `BankAccount` class with an `owner` and a `balance` that defaults to 0, and three methods: `deposit(amount)`, `withdraw(amount)`, which refuses to take more than the balance, and `get_balance()`. Open an account for Alice with 5000, deposit 100, withdraw 300, try to withdraw 10000, and print the balance.

```python title="Notebook cell"
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        print(f"{amount} is deposited. New balance is {self.balance}")

    def withdraw(self, amount):
        if amount > self.balance:
            print("Insufficient funds!")
        else:
            self.balance -= amount
            print(f"{amount} is withdrawn. New balance is {self.balance}")

    def get_balance(self):
        return self.balance


account = BankAccount("Alice", 5000)
print(account.balance)
account.deposit(100)
account.withdraw(300)
account.withdraw(10000)
print(account.get_balance())
```

```output real
5000
100 is deposited. New balance is 5100
300 is withdrawn. New balance is 4800
Insufficient funds!
4800
```

Every method reads or changes `self.balance`, the balance of the one account it was called on; `balance=0` makes the starting balance optional.
:::
