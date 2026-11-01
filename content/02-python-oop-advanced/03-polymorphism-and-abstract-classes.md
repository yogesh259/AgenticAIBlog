+++
number = "2.3"
title = "Polymorphism and abstract classes"
lede = "One call, many behaviours: `animal.speak()` runs whatever the object's own class defines. Abstract base classes turn that expectation into a check."
summary = "Override methods, write one function for many classes, rely on duck typing, and require methods with an abstract base class."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/8-Class And Objects: 8.3-Polymorphism.ipynb, 8.5-Abstraction.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Polymorphism lets one piece of code work with objects of different classes, each doing its own version of the same method. Java needs a shared supertype or interface for that; Python only needs the method to exist when the call runs. An abstract base class adds a check, much like a Java abstract class.

## Override a method

```python title="Notebook cell"
class Animal:
    def speak(self):
        return "Sound of the animal"


class Dog(Animal):
    def speak(self):
        return "Woof!"


class Cat(Animal):
    def speak(self):
        return "Meow!"


def animal_speak(animal):
    print(animal.speak())


dog = Dog()
cat = Cat()
print(dog.speak())
print(cat.speak())
animal_speak(dog)
```

```output real
Woof!
Meow!
Woof!
```

`Dog.speak` wins over `Animal.speak` because the lookup reaches `Dog` first ([lesson 2.2](lesson:2.2)). Nothing checks the override when the code runs: misspell the name and you silently add a second method instead of replacing the first. Since Python 3.12, `@typing.override` marks an override so that a type checker can catch the typo.

## One function, many classes

```python title="Notebook cell"
class Shape:
    def area(self):
        return "The area of the figure"


class Rectangle(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return 3.14 * self.radius * self.radius


def print_area(shape):
    print(f"The area is {shape.area()}")


print_area(Rectangle(4, 5))
print_area(Circle(3))
```

```output real
The area is 20
The area is 28.259999999999998
```

`print_area` never checks the type; each shape answers `area()` its own way. The long decimal is float rounding ([lesson 1.13](lesson:1.13)); `math.pi` instead of `3.14` would also be more accurate.

## Duck typing

```python title="Notebook cell"
class Robot:
    def speak(self):
        return "Beep"


animal_speak(Robot())
```

```output real
Beep
```

`Robot` shares no parent with `Dog`, yet `animal_speak` accepts it: Python only checks that the object has a `speak()` method, at the moment of the call ("if it walks like a duck and quacks like a duck, it's a duck"). A shared parent class documents what callers expect; nothing enforces it until a call fails with `AttributeError`.

## Abstract base classes

```python title="Notebook cell"
from abc import ABC, abstractmethod


class Vehicle(ABC):
    def drive(self):
        print("The vehicle is used for driving")

    @abstractmethod
    def start_engine(self):
        pass


class Car(Vehicle):
    def start_engine(self):
        print("Car engine started")


class Motorcycle(Vehicle):
    def start_engine(self):
        print("Motorcycle engine started")


def operate_vehicle(vehicle):
    vehicle.start_engine()
    vehicle.drive()


operate_vehicle(Car())
operate_vehicle(Motorcycle())
```

```output real
Car engine started
The vehicle is used for driving
Motorcycle engine started
The vehicle is used for driving
```

`Vehicle` inherits from `ABC` and marks `start_engine` with `@abstractmethod` (a decorator, [lesson 2.8](lesson:2.8)). `drive()` is an ordinary method every vehicle shares. Callers use `start_engine()` without knowing how each vehicle does it: that is **abstraction**. Python enforces the contract when an object is created:

```python title="Notebook cell"
Vehicle()
```

```output real note="last line of the error"
TypeError: Can't instantiate abstract class Vehicle without an implementation for abstract method 'start_engine'
```

```python title="Notebook cell"
class Bicycle(Vehicle):
    pass


Bicycle()
```

```output real note="last line of the error"
TypeError: Can't instantiate abstract class Bicycle without an implementation for abstract method 'start_engine'
```

Any class that still has an abstract method can't be instantiated, so a missing method shows up when the object is built, not at the first call.

## Coming from Java

| Java | Python |
|---|---|
| `@Override`, checked by the compiler | Nothing at run time; `@typing.override` (3.12+) for type checkers |
| `interface Speaker { String speak(); }` | Usually nothing: any object with a `speak()` method works |
| `abstract class Vehicle` with `abstract void startEngine();` | `class Vehicle(ABC)` with `@abstractmethod def start_engine(self)` |
| Compile error when a method is missing | `TypeError` when the object is created |
| Overloading: same name, different parameter types | One method per name; use default arguments or `*args` ([lesson 1.12](lesson:1.12)) |
