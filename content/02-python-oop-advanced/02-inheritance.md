+++
number = "2.2"
title = "Inheritance"
lede = "A child class starts with everything its parent has, then adds or replaces what it needs. Python searches the classes in a fixed order to find each attribute."
summary = "Build a class on another, call the parent's initialiser, use two parents, and read the lookup order."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/8-Class And Objects: 8.2-inheritance.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Inheritance reuses a class's code in another class. Agent code leans on it all the time: graph state inherits from `TypedDict`, data models from Pydantic's `BaseModel`, middleware from a library base class. Two things differ from Java: the parent's initialiser only runs if you call it, and a class can have several parents.

## A child class

```python title="Notebook cell"
class Car:
    def __init__(self, windows, doors, enginetype):
        self.windows = windows
        self.doors = doors
        self.enginetype = enginetype

    def drive(self):
        print(f"The person will drive the {self.enginetype} car")


car1 = Car(4, 5, "petrol")
car1.drive()
```

```output real
The person will drive the petrol car
```

```python title="Notebook cell"
class Tesla(Car):
    def __init__(self, windows, doors, enginetype, is_selfdriving):
        super().__init__(windows, doors, enginetype)
        self.is_selfdriving = is_selfdriving

    def selfdriving(self):
        print(f"Tesla supports self driving: {self.is_selfdriving}")


tesla1 = Tesla(4, 5, "electric", True)
tesla1.selfdriving()
tesla1.drive()
```

```output real
Tesla supports self driving: True
The person will drive the electric car
```

`class Tesla(Car)` is Java's `extends`. `Tesla` has no `drive()`, so Python finds it in `Car`. `super().__init__(...)` runs `Car`'s initialiser on the same object, which sets `windows`, `doors` and `enginetype`. A child with no `__init__` of its own simply uses the parent's; but once the child defines one, Python never calls the parent's for you. Leave the line out and those attributes are never set:

```python title="Notebook cell"
class BrokenTesla(Car):
    def __init__(self, windows, doors, enginetype, is_selfdriving):
        self.is_selfdriving = is_selfdriving


BrokenTesla(4, 5, "electric", True).drive()
```

```output real note="last line of the error"
AttributeError: 'BrokenTesla' object has no attribute 'enginetype'
```

## Two parents

```python title="Notebook cell"
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        print("Subclass must implement this method")


class Pet:
    def __init__(self, owner):
        self.owner = owner


class Dog(Animal, Pet):
    def __init__(self, name, owner):
        Animal.__init__(self, name)
        Pet.__init__(self, owner)

    def speak(self):
        return f"{self.name} says woof"


dog = Dog("Buddy", "Alice")
print(dog.speak())
print(f"Owner: {dog.owner}")
```

```output real
Buddy says woof
Owner: Alice
```

A Java class has one parent plus interfaces; a Python class can have several parent classes. Here the two parents take different arguments and neither calls `super()`, so `Dog` calls each initialiser by name and passes `self` along. `Animal.speak()` only prints a reminder; `Dog.speak()` replaces it, and [lesson 2.3](lesson:2.3) turns the reminder into a rule.

## The lookup order

```python title="Notebook cell"
print([cls.__name__ for cls in Dog.__mro__])
print(isinstance(dog, Animal), isinstance(dog, Pet), issubclass(Dog, Pet))
```

```output real
['Dog', 'Animal', 'Pet', 'object']
True True True
```

To find any attribute of `dog`, Python looks in the object itself, then in each class of `Dog.__mro__` (the method resolution order) and stops at the first match. Parents come in the order you listed them, and every class ends with `object`. Two consequences:

- A child's method wins because its class comes first: that is overriding.
- `super()` means "the next class in this order", not "my parent". With one parent the two are the same.

`isinstance()` is Java's `instanceof`: an object counts as an instance of every class in its lookup order.

::: visual lookup-order | Figure | Where Python looks up an attribute
The class diagram of `Dog(Animal, Pet)` beside the numbered search for `dog.speak()`, which stops at `Dog`.
:::

## Your own exception classes

An exception type is an ordinary class that inherits from `Exception`:

```python title="Notebook cell"
class InsufficientFundsError(Exception):
    pass


class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def withdraw(self, amount):
        if amount > self.balance:
            raise InsufficientFundsError(f"{self.owner} has only {self.balance}")
        self.balance -= amount


account = BankAccount("Alice", 100)
try:
    account.withdraw(500)
except InsufficientFundsError as ex:
    print(f"Refused: {ex}")
```

```output real
Refused: Alice has only 100
```

`pass` is enough: `Exception` already stores the message. Callers can now catch exactly this error, and leave others alone ([lesson 1.19](lesson:1.19)). Python has no checked exceptions, so nothing forces a caller to catch it or to declare it.

Library classes work the same way. You will write `class State(TypedDict)` for graph state ([lesson 10.2](lesson:10.2)), `class Answer(BaseModel)` for structured data ([lesson 4.2](lesson:4.2)), and middleware classes that call `super().__init__()` and override hook methods ([lesson 17.3](lesson:17.3)).

## Coming from Java

| Java | Python |
|---|---|
| `class Tesla extends Car` | `class Tesla(Car):` |
| `super(...)` runs first, and implicitly if you leave it out | `super().__init__(...)` runs only if you call it, anywhere in `__init__` |
| One parent class, any number of interfaces | Any number of parent classes, searched in `__mro__` order |
| `obj instanceof Car` | `isinstance(obj, Car)` |
| `Object` | `object` |
| `class MyError extends Exception`, checked or unchecked | `class MyError(Exception): pass`, never checked |
