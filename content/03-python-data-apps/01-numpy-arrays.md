+++
number = "3.1"
title = "NumPy arrays"
lede = "A NumPy array holds many numbers of one type in one block of memory, and arithmetic on it applies to every element at once. pandas, Matplotlib and scikit-learn are all built on it."
summary = "Create arrays, read their shape, compute on whole arrays, slice rows and columns, and pick values with a condition."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/10-Data Analysis With Python: 10.1-numpy.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A Python list can hold anything, and adding two lists joins them. A NumPy array holds one type of value, and `a + b` adds the arrays element by element, without a Python loop. That makes it fast, and it is the shape data takes in every data library that follows.

This module needs these packages. NumPy is already in your `requirements.txt` ([lesson 1.1](lesson:1.1)); add these lines and run your install command again ([lesson 0.1](lesson:0.1)):

```text title="requirements.txt"
pandas
matplotlib
seaborn
lxml
openpyxl
flask
streamlit
scikit-learn
```

`lxml` and `openpyxl` let pandas read web pages and Excel files; scikit-learn is used by one practice task in [lesson 3.12](lesson:3.12).

## Create an array

```python title="Notebook cell"
import numpy as np

# Create a 1-D array
arr1 = np.array([1, 2, 3, 4, 5])
print(arr1)
print(type(arr1))
print(arr1.shape)
```

```output real
[1 2 3 4 5]
<class 'numpy.ndarray'>
(5,)
```

An array prints without commas. Its **shape** is a tuple with one number per axis: `(5,)` is a single axis of five values.

## Shapes and reshape

```python title="Notebook cell"
arr2 = np.array([1, 2, 3, 4, 5])
arr2.reshape(1, 5)  # 1 row and 5 columns
```

```output real
array([[1, 2, 3, 4, 5]])
```

```python title="Notebook cell"
arr2 = np.array([[1, 2, 3, 4, 5]])
arr2.shape
```

```output real
(1, 5)
```

```python title="Notebook cell"
# A 2-D array: a list of rows
arr2 = np.array([[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]])
print(arr2)
print(arr2.shape)
```

```output real
[[1 2 3 4 5]
 [2 3 4 5 6]]
(2, 5)
```

```python title="Notebook cell"
np.arange(0, 10, 2).reshape(5, 1)
```

```output real
array([[0],
       [2],
       [4],
       [6],
       [8]])
```

A list of lists becomes a 2-D array, and its shape reads `(rows, columns)`. `reshape` returns the same values arranged in a new shape; the array you call it on doesn't change. `np.arange` works like `range` but returns an array. The number of values must fit the new shape:

```python title="Notebook cell"
np.arange(0, 10, 2).reshape(3, 2)
```

```output real note="last line of the error"
ValueError: cannot reshape array of size 5 into shape (3,2)
```

::: visual array-shapes | Figure | Four shapes
The same values as one axis, one row, one column and a two-row table, with axis 0 and axis 1.
:::

## Ready-made arrays and attributes

```python title="Notebook cell"
np.ones((3, 4))
```

```output real
array([[1., 1., 1., 1.],
       [1., 1., 1., 1.],
       [1., 1., 1., 1.]])
```

```python title="Notebook cell"
# Identity matrix
np.eye(3)
```

```output real
array([[1., 0., 0.],
       [0., 1., 0.],
       [0., 0., 1.]])
```

```python title="Notebook cell"
arr = np.array([[1, 2, 3], [4, 5, 6]])

print("Array:\n", arr)
print("Shape:", arr.shape)
print("Number of dimensions:", arr.ndim)
print("Size (number of elements):", arr.size)
print("Data type:", arr.dtype)
print("Item size (in bytes):", arr.itemsize)
```

```output real
Array:
 [[1 2 3]
 [4 5 6]]
Shape: (2, 3)
Number of dimensions: 2
Size (number of elements): 6
Data type: int64
Item size (in bytes): 8
```

`ones` and `eye` fill with floats, hence `1.`. `dtype` is the one type every element shares: whole numbers become `int64`, 8 bytes each.

## Arithmetic on whole arrays

```python title="Notebook cell"
arr1 = np.array([1, 2, 3, 4, 5])
arr2 = np.array([10, 20, 30, 40, 50])

print("Addition:", arr1 + arr2)
print("Subtraction:", arr1 - arr2)
print("Multiplication:", arr1 * arr2)
print("Division:", arr1 / arr2)
```

```output real
Addition: [11 22 33 44 55]
Subtraction: [ -9 -18 -27 -36 -45]
Multiplication: [ 10  40  90 160 250]
Division: [0.1 0.1 0.1 0.1 0.1]
```

Each operation pairs the elements at the same position: **vectorised** arithmetic. The same operator means something else on a list:

```python title="Notebook cell"
print([1, 2, 3] * 2)
print(np.array([1, 2, 3]) * 2)
```

```output real
[1, 2, 3, 1, 2, 3]
[2 4 6]
```

A **universal function** applies a maths function to every element:

```python title="Notebook cell"
arr = np.array([2, 3, 4, 5, 6])
print(np.sqrt(arr))  # square root
print(np.exp(arr))   # exponential
print(np.sin(arr))   # sine
print(np.log(arr))   # natural log
```

```output real
[1.41421356 1.73205081 2.         2.23606798 2.44948974]
[  7.3890561   20.08553692  54.59815003 148.4131591  403.42879349]
[ 0.90929743  0.14112001 -0.7568025  -0.95892427 -0.2794155 ]
[0.69314718 1.09861229 1.38629436 1.60943791 1.79175947]
```

## Index and slice rows and columns

```python title="Notebook cell"
arr = np.array([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]])
print("Array : \n", arr)
```

```output real
Array :
 [[ 1  2  3  4]
 [ 5  6  7  8]
 [ 9 10 11 12]]
```

```python title="Notebook cell"
print(arr[1:, 1:3])
```

```output real
[[ 6  7]
 [10 11]]
```

```python title="Notebook cell"
print(arr[0][0])
print(arr[0:2, 2:])
```

```output real
1
[[3 4]
 [7 8]]
```

```python title="Notebook cell"
arr[1:, 2:]
```

```output real
array([[ 7,  8],
       [11, 12]])
```

Inside the brackets, rows come first and columns second, each a slice with the rules of [lesson 1.7](lesson:1.7): the stop is never included, and a missing start or stop means "from the edge". `arr[0][0]` takes row 0 and then its first value; `arr[0, 0]` does it in one step and is the usual form.

::: visual slice-2d | Interactive figure | Slicing a 2-D array
Pick a slice of the 3 × 4 array: the first range picks rows, the second columns.
:::

## Change values through a slice

```python title="Notebook cell"
arr[0, 0] = 100
print(arr)
```

```output real
[[100   2   3   4]
 [  5   6   7   8]
 [  9  10  11  12]]
```

```python title="Notebook cell"
arr[1:] = 100
print(arr)
```

```output real
[[100   2   3   4]
 [100 100 100 100]
 [100 100 100 100]]
```

A single value assigned to a slice fills all of it. A slice of an array is a **view** of the same memory, not a copy, so changing a slice changes the array:

```python title="Notebook cell"
first_row = arr[0, :]
first_row[1] = 99
print(arr[0])
```

```output real
[100  99   3   4]
```

List slices copy ([lesson 1.7](lesson:1.7)); array slices don't. Call `.copy()` when you need an independent array.

## Statistics

```python title="Notebook cell"
# Normalisation: shift and scale the data to a mean of 0 and a standard deviation of 1
data = np.array([1, 2, 3, 4, 5])

mean = np.mean(data)
std_dev = np.std(data)

normalized_data = (data - mean) / std_dev
print("Normalized data:", normalized_data)
```

```output real
Normalized data: [-1.41421356 -0.70710678  0.          0.70710678  1.41421356]
```

```python title="Notebook cell"
data = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

print("Mean:", np.mean(data))
print("Median:", np.median(data))
print("Standard Deviation:", np.std(data))
print("Variance:", np.var(data))
```

```output real
Mean: 5.5
Median: 5.5
Standard Deviation: 2.8722813232690143
Variance: 8.25
```

Subtracting the mean and dividing by the standard deviation gives **z-scores**: how many standard deviations each value lies from the mean. `np.std` divides by n (the population formula); pandas divides by n - 1 (the sample formula), so its `std()` of the same ten numbers is 3.03 ([lesson 3.2](lesson:3.2)).

## Pick values with a condition

```python title="Notebook cell"
data = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
print(data >= 5)
data[(data >= 5) & (data <= 8)]
```

```output real
[False False False False  True  True  True  True  True  True]
array([5, 6, 7, 8])
```

A comparison gives an array of `True` and `False`, a **mask**; indexing with a mask keeps the values where it is `True`. Combine conditions with `&` (and), `|` (or) and `~` (not), each comparison in brackets. Python's `and` fails on arrays with `ValueError: The truth value of an array with more than one element is ambiguous`, and so does `&` without the brackets, because `&` binds tighter than `>=`.

## Coming from Java

| Java | NumPy |
|---|---|
| `int[] a` holds one declared type | An array holds one `dtype`, chosen from the values |
| A loop to add two arrays | `a + b` adds them element by element |
| `int[][]` is an array of arrays; rows can differ in length | A 2-D array is one block with a fixed `(rows, columns)` shape |
| `Arrays.copyOfRange` copies | A slice is a view; `.copy()` copies |
