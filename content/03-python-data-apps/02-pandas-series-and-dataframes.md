+++
number = "3.2"
title = "pandas: Series and DataFrames"
lede = "pandas puts labels on NumPy arrays: a Series is one labelled column, and a DataFrame is a table of columns that share one row index. It is the usual way to load, inspect and change tabular data in Python."
summary = "Build Series and DataFrames, read and change rows and columns with `loc`, `iloc`, `at` and `iat`, and load a CSV file."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/10-Data Analysis With Python: 10.2-pandas.ipynb; 10.5-matplotlib.ipynb (info)"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
data = ["sales_data.csv"]
+++

Think of a DataFrame as a SQL table held in memory: named columns, one type per column, and rows you can filter, change, group and join ([lesson 3.3](lesson:3.3)). Each column is a Series, which is a NumPy array plus labels.

## A Series

```python title="Notebook cell"
import pandas as pd

# A Series is one labelled column, like a column of a table
data = [1, 2, 3, 4, 5]
series = pd.Series(data)
print("Series \n", series)
print(type(series))
```

```output real
Series
 0    1
1    2
2    3
3    4
4    5
dtype: int64
<class 'pandas.Series'>
```

```python title="Notebook cell"
# A Series from a dictionary: the keys become the labels
data = {'a': 1, 'b': 2, 'c': 3}
series_dict = pd.Series(data)
print(series_dict)
```

```output real
a    1
b    2
c    3
dtype: int64
```

```python title="Notebook cell"
data = [10, 20, 30]
index = ['a', 'b', 'c']
pd.Series(data, index=index)
```

```output real
a    10
b    20
c    30
dtype: int64
```

The left column is the **index**: labels for the values, `0, 1, 2…` unless you give your own. `dtype` is the type of the values, as in NumPy ([lesson 3.1](lesson:3.1)).

## A DataFrame

```python title="Notebook cell"
# A DataFrame from a list of dictionaries: one dictionary per row
data = [
    {'Name': 'Alice', 'Age': 32, 'City': 'Bangalore'},
    {'Name': 'John', 'Age': 34, 'City': 'Bangalore'},
    {'Name': 'Maria', 'Age': 32, 'City': 'Bangalore'},
    {'Name': 'Jack', 'Age': 32, 'City': 'Bangalore'},
]
df = pd.DataFrame(data)
print(df)
print(type(df))
```

```output real
    Name  Age       City
0  Alice   32  Bangalore
1   John   34  Bangalore
2  Maria   32  Bangalore
3   Jack   32  Bangalore
<class 'pandas.DataFrame'>
```

```python title="Notebook cell"
# A DataFrame from a dictionary of lists: one list per column
data = {
    'Name': ['Alice', 'John', 'Jack'],
    'Age': [25, 30, 45],
    'City': ['Bangalore', 'New York', 'Florida'],
}
df = pd.DataFrame(data)
print(df)
print(type(df))
```

```output real
    Name  Age       City
0  Alice   25  Bangalore
1   John   30   New York
2   Jack   45    Florida
<class 'pandas.DataFrame'>
```

A list of dictionaries is rows; a dictionary of lists is columns. Both make the same kind of table. The row form is the shape of JSON that web APIs return, so you will meet it often.

## Read columns, rows and single values

```python title="Notebook cell"
df['Name']
```

```output real
0    Alice
1     John
2     Jack
Name: Name, dtype: str
```

```python title="Notebook cell"
df.loc[0]
```

```output real
Name        Alice
Age            25
City    Bangalore
Name: 0, dtype: object
```

```python title="Notebook cell"
df.iloc[0]
```

```output real
Name        Alice
Age            25
City    Bangalore
Name: 0, dtype: object
```

`df['Name']` returns one column as a Series; its `Name:` line is the Series' own name. `loc` selects rows by their **label**, `iloc` by their **position**. Here they agree, because the labels are 0, 1, 2; the next section shows when they don't.

```python title="Notebook cell"
# One value by row label and column name
df.at[2, 'Age']
```

```output real
np.int64(45)
```

```python title="Notebook cell"
df.at[2, 'Name']
```

```output real
'Jack'
```

```python title="Notebook cell"
# One value by row and column position
df.iat[2, 2]
```

```output real
'Florida'
```

`at` and `iat` read one value, by label and by position. A number comes back as a NumPy number, which a notebook shows with its type, `np.int64(45)`; `print` shows `45`.

## Add and remove columns and rows

```python title="Notebook cell"
# Add a column
df['Salary'] = [50000, 60000, 70000]
df
```

```output real
    Name  Age       City  Salary
0  Alice   25  Bangalore   50000
1   John   30   New York   60000
2   Jack   45    Florida   70000
```

```python title="Notebook cell"
# Remove a column
df.drop('Salary', axis=1, inplace=True)
df
```

```output real note="a notebook also shows the warning's file and line"
Pandas4Warning: The inplace keyword in DataFrame.drop is deprecated and will be removed in a future version (PDEP-8).
See https://pandas.pydata.org/docs/dev/whatsnew/v3.1.0.html#deprecation-inplace for more details.
    Name  Age       City
0  Alice   25  Bangalore
1   John   30   New York
2   Jack   45    Florida
```

```python title="Notebook cell"
# Add 1 to every age
df['Age'] = df['Age'] + 1
df
```

```output real
    Name  Age       City
0  Alice   26  Bangalore
1   John   31   New York
2   Jack   46    Florida
```

```python title="Notebook cell"
# Remove the row labelled 0
df.drop(0, inplace=True)
df
```

```output real note="a notebook also shows the warning's file and line"
Pandas4Warning: The inplace keyword in DataFrame.drop is deprecated and will be removed in a future version (PDEP-8).
See https://pandas.pydata.org/docs/dev/whatsnew/v3.1.0.html#deprecation-inplace for more details.
   Name  Age      City
1  John   31  New York
2  Jack   46   Florida
```

`axis=1` means columns, `axis=0` (the default) rows. `inplace=True` changes `df` itself and returns `None`; recent pandas versions warn that it will go away, and the current form assigns the result instead: `df = df.drop(columns='Salary')`, `df = df.drop(index=0)`. Column arithmetic such as `df['Age'] + 1` works on the whole column at once, as with NumPy arrays.

Dropping row 0 left the labels 1 and 2 in place, so labels and positions now differ:

```python title="Notebook cell"
print(df.loc[1])
print(df.iloc[1])
```

```output real
Name        John
Age           31
City    New York
Name: 1, dtype: object
Name       Jack
Age          46
City    Florida
Name: 2, dtype: object
```

`df.loc[1]` is the row labelled 1 (John); `df.iloc[1]` is the second row (Jack). `df.loc[0]` now raises `KeyError: 0`.

::: visual labels-and-positions | Figure | Labels and positions
The table before and after `drop(0)`: `loc` follows the labels, `iloc` the positions.
:::

## Load a CSV file

Download [sales_data.csv](data/sales_data.csv), 240 sales of a fictional shop, into your project folder.

```python title="Notebook cell"
df = pd.read_csv('sales_data.csv')
df.head(5)
```

```output real
   Transaction ID        Date Product Category             Product Name  \
0           10001  2024-01-01      Electronics            iPhone 14 Pro
1           10002  2024-01-02  Home Appliances         Dyson V11 Vacuum
2           10003  2024-01-03         Clothing         Levi's 501 Jeans
3           10004  2024-01-04            Books        The Da Vinci Code
4           10005  2024-01-05  Beauty Products  Neutrogena Skincare Set

   Units Sold  Unit Price  Total Revenue         Region Payment Method
0           2      999.99        1999.98  North America    Credit Card
1           1      499.99         499.99         Europe         PayPal
2           3       69.99         209.97           Asia     Debit Card
3           4       15.99          63.96  North America    Credit Card
4           1       89.99          89.99         Europe         PayPal
```

```python title="Notebook cell"
df.tail(5)
```

```output real
     Transaction ID        Date Product Category  \
235           10236  2024-08-23  Home Appliances
236           10237  2024-08-24         Clothing
237           10238  2024-08-25            Books
238           10239  2024-08-26  Beauty Products
239           10240  2024-08-27           Sports

                                        Product Name  Units Sold  Unit Price  \
235  Nespresso Vertuo Next Coffee and Espresso Maker           1      159.99
236                        Nike Air Force 1 Sneakers           3       90.00
237           The Handmaid's Tale by Margaret Atwood           3       10.99
238             Sunday Riley Luna Sleeping Night Oil           1       55.00
239                       Yeti Rambler 20 oz Tumbler           2       29.99

     Total Revenue         Region Payment Method
235         159.99         Europe         PayPal
236         270.00           Asia     Debit Card
237          32.97  North America    Credit Card
238          55.00         Europe         PayPal
239          59.98           Asia    Credit Card
```

`read_csv` reads the file into a DataFrame, taking the column names from the first line. `head(n)` and `tail(n)` show the first and last rows; wide tables wrap, and the `\` at the end of a line means the table continues below.

```python title="Notebook cell"
# The type of each column, then a statistical summary of the numeric columns
print("Data types:\n", df.dtypes)
print("Statistical summary:\n", df.describe())
```

```output real
Data types:
 Transaction ID        int64
Date                    str
Product Category        str
Product Name            str
Units Sold            int64
Unit Price          float64
Total Revenue       float64
Region                  str
Payment Method          str
dtype: object
Statistical summary:
        Transaction ID  Units Sold   Unit Price  Total Revenue
count       240.00000  240.000000   240.000000     240.000000
mean      10120.50000    2.158333   236.395583     335.699375
std          69.42622    1.322454   429.446695     485.804469
min       10001.00000    1.000000     6.500000       6.500000
25%       10060.75000    1.000000    29.500000      62.965000
50%       10120.50000    2.000000    89.990000     179.970000
75%       10180.25000    3.000000   249.990000     399.225000
max       10240.00000   10.000000  3899.990000    3899.990000
```

```python title="Notebook cell"
df.info()
```

```output real
<class 'pandas.DataFrame'>
RangeIndex: 240 entries, 0 to 239
Data columns (total 9 columns):
 #   Column            Non-Null Count  Dtype
---  ------            --------------  -----
 0   Transaction ID    240 non-null    int64
 1   Date              240 non-null    str
 2   Product Category  240 non-null    str
 3   Product Name      240 non-null    str
 4   Units Sold        240 non-null    int64
 5   Unit Price        240 non-null    float64
 6   Total Revenue     240 non-null    float64
 7   Region            240 non-null    str
 8   Payment Method    240 non-null    str
dtypes: float64(2), int64(2), str(5)
memory usage: 32.0 KB
```

Text columns have the type `str` (older pandas versions showed `object`). `describe()` summarises only the numeric columns: `count` counts the values that are present, which is how it reveals missing ones ([lesson 3.3](lesson:3.3)), and `std` is the sample standard deviation. `info()` lists every column with its type and its number of non-missing values.
