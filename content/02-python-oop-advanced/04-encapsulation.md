+++
number = "2.4"
title = "Encapsulation"
lede = "Python has no `private` keyword. It protects an object's data with naming conventions, one renaming rule, and properties."
summary = "Public, protected and private attributes, name mangling, getters and setters, and properties."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/8-Class And Objects: 8.4-Encapsulation.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Encapsulation means keeping an object's data behind its methods, so the object can check every change. Java enforces access with keywords; Python trusts conventions, renames one kind of name, and offers properties so you never need `getX()` and `setX()` methods.

## Public attributes

```python title="Notebook cell"
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


def get_name(person):
    return person.name


person = Person("Alice", 34)
get_name(person)
```

```output real
'Alice'
```

A plain name is public: any code can read and change it.

## Private: two leading underscores

```python title="Notebook cell"
class Person:
    def __init__(self, name, age, gender):
        self.__name = name
        self.__age = age
        self.gender = gender


def get_name(person):
    return person.__name


person = Person("Alice", 34, "Female")
get_name(person)
```

```output real note="last line of the error"
AttributeError: 'Person' object has no attribute '__name'
```

```python title="Notebook cell"
print(person.__dict__)
print(person._Person__name)
```

```output real
{'_Person__name': 'Alice', '_Person__age': 34, 'gender': 'Female'}
Alice
```

Inside a class body, Python renames `__name` to `_Person__name`: **name mangling**. Code outside the class asks for `__name`, which doesn't exist; the value is still there under its new name. So two underscores protect an attribute from accidents, and from a subclass that happens to use the same name, not from someone set on reading it.

## Protected: one leading underscore

```python title="Notebook cell"
class Person:
    def __init__(self, name, age, gender):
        self._name = name
        self._age = age
        self.gender = gender


class Employee(Person):
    def __init__(self, name, age, gender):
        super().__init__(name, age, gender)


employee = Employee("Alice", 34, "Female")
print(employee._name)
```

```output real
Alice
```

One underscore is only a convention, meaning "internal: don't use from outside". Python enforces nothing, and subclasses use the name freely. Libraries mark their internals this way.

## Getters and setters

```python title="Notebook cell"
class Person:
    def __init__(self, name, age):
        self.__name = name
        self.__age = age

    def get_name(self):
        return self.__name

    def set_name(self, name):
        self.__name = name

    def get_age(self):
        return self.__age

    def set_age(self, age):
        if age > 0:
            self.__age = age
        else:
            print("Age cannot be negative.")


person = Person("Alice", 34)
print(person.get_name())
print(person.get_age())

person.set_age(35)
print(person.get_age())

person.set_age(-5)
```

```output real
Alice
34
35
Age cannot be negative.
```

Every change goes through `set_age`, which rejects bad values. It works, but Python code rarely looks like this.

## Properties

A property gives you the same checks behind plain attribute syntax:

```python title="Notebook cell"
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age             # runs the setter below

    @property
    def age(self):
        return self._age

    @age.setter
    def age(self, value):
        if value <= 0:
            raise ValueError("Age must be positive")
        self._age = value


person = Person("Alice", 34)
person.age = 35
print(person.age)
person.age = -5
```

```output real note="last line of the error"
35
ValueError: Age must be positive
```

Reading `person.age` runs the first method, and assigning to it runs the setter, even inside `__init__`. The value itself lives in `_age`. Start with a public attribute; if it later needs a check, turn it into a property and no caller has to change. `@property` is a decorator ([lesson 2.8](lesson:2.8)).

## Coming from Java

| Java | Python |
|---|---|
| `public` | A plain name: `self.name` |
| `protected` | `self._name`, by convention only |
| `private` | `self.__name`, renamed to `_Person__name`; still reachable |
| `getAge()` and `setAge()` | A property: `person.age` and `person.age = 35` |
| Checked by the compiler | Checked by nobody: a team convention |
