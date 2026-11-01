+++
number = "3.3"
title = "Cleaning and summarising data"
lede = "Real data has gaps and the wrong types. pandas finds and fills them, then filters, sorts, groups and joins tables in a few calls, much like SQL."
summary = "Find and fill missing values, rename columns and fix types, filter and sort rows, summarise groups with `groupby`, and join tables with `merge`."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/10-Data Analysis With Python: 10.3-datamanipulation.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
data = ["data.csv"]
+++

The data for this lesson is [data.csv](data/data.csv): 50 days of sales with a category, a value, a product and a region, and a few values missing on purpose. Download it into your project folder. If you know SQL, the table at the end maps each step to its SQL equivalent.

## Look at the data

```python title="Notebook cell"
import pandas as pd

df = pd.read_csv('data.csv')
# Fetch the first 5 rows
df.head(5)
```

```output real
         Date Category  Value   Product  Sales Region
0  2023-01-01        A   28.0  Product1  754.0   East
1  2023-01-02        B   39.0  Product3  110.0  North
2  2023-01-03        C   32.0  Product2  398.0   East
3  2023-01-04        B    8.0  Product1  522.0   East
4  2023-01-05        B   26.0  Product3  869.0  North
```

```python title="Notebook cell"
df.describe()
```

```output real
           Value       Sales
count  47.000000   46.000000
mean   51.744681  557.130435
std    29.050532  274.598584
min     2.000000  108.000000
25%    27.500000  339.000000
50%    54.000000  591.500000
75%    70.000000  767.500000
max    99.000000  992.000000
```

```python title="Notebook cell"
df.dtypes
```

```output real
Date            str
Category        str
Value       float64
Product         str
Sales       float64
Region          str
dtype: object
```

`describe()` counts 47 values in `Value` and 46 in `Sales` out of 50 rows: some are missing. Missing values show up as `NaN` ("not a number"), which is a float, so both columns are `float64` even though they hold whole numbers.

## Find missing values

```python title="Notebook cell"
df.isnull().any()
```

```output real
Date        False
Category    False
Value        True
Product     False
Sales        True
Region      False
dtype: bool
```

```python title="Notebook cell"
df.isnull().sum()
```

```output real
Date        0
Category    0
Value       3
Product     0
Sales       4
Region      0
dtype: int64
```

`isnull()` gives a table of `True` and `False`. `any()` asks, per column, whether any value is missing; `sum()` counts them, since `True` counts as 1.

## Fill missing values

```python title="Notebook cell"
df_filled = df.fillna(0)
```

```python title="Notebook cell"
# Fill the missing values with the mean of the column
df['Sales_fillNA'] = df['Sales'].fillna(df['Sales'].mean())
df.loc[10:12]
```

```output real
          Date Category  Value   Product  Sales Region  Sales_fillNA
10  2023-01-11        B    7.0  Product1  842.0  North    842.000000
11  2023-01-12        B   60.0  Product2    NaN   West    557.130435
12  2023-01-13        A   70.0  Product3  628.0  South    628.000000
```

`fillna` returns a new DataFrame or Series with the gaps filled; `df` itself keeps its gaps. Filling with the column's mean keeps the average unchanged; the mean ignores missing values. Row 11 had no sales figure and now gets 557.13.

## Rename columns and change types

```python title="Notebook cell"
df = df.rename(columns={'Date': 'Sales Date'})
df.head()
```

```output real
   Sales Date Category  Value   Product  Sales Region  Sales_fillNA
0  2023-01-01        A   28.0  Product1  754.0   East         754.0
1  2023-01-02        B   39.0  Product3  110.0  North         110.0
2  2023-01-03        C   32.0  Product2  398.0   East         398.0
3  2023-01-04        B    8.0  Product1  522.0   East         522.0
4  2023-01-05        B   26.0  Product3  869.0  North         869.0
```

`rename` takes a dictionary of old and new names. It ignores names that don't exist, so a typo changes nothing without any error; `errors='raise'` turns that into `KeyError: "['Sale Date'] not found in axis"`.

```python title="Notebook cell"
# Change the data type: fill the gaps first
df['Value_new'] = df['Value'].fillna(df['Value'].mean()).astype(int)
df.head()
```

```output real
   Sales Date Category  Value   Product  Sales Region  Sales_fillNA  Value_new
0  2023-01-01        A   28.0  Product1  754.0   East         754.0         28
1  2023-01-02        B   39.0  Product3  110.0  North         110.0         39
2  2023-01-03        C   32.0  Product2  398.0   East         398.0         32
3  2023-01-04        B    8.0  Product1  522.0   East         522.0          8
4  2023-01-05        B   26.0  Product3  869.0  North         869.0         26
```

`astype(int)` converts a column to whole numbers, but an integer can't hold `NaN`: on the raw column it raises `IntCastingNaNError: Cannot convert non-finite values (NA or inf) to integer`. Hence the fill first.

```python title="Notebook cell"
df['New Value'] = df['Value'].apply(lambda x: x * 2)
df.head()
```

```output real
   Sales Date Category  Value   Product  Sales Region  Sales_fillNA  \
0  2023-01-01        A   28.0  Product1  754.0   East         754.0
1  2023-01-02        B   39.0  Product3  110.0  North         110.0
2  2023-01-03        C   32.0  Product2  398.0   East         398.0
3  2023-01-04        B    8.0  Product1  522.0   East         522.0
4  2023-01-05        B   26.0  Product3  869.0  North         869.0

   Value_new  New Value
0         28       56.0
1         39       78.0
2         32       64.0
3          8       16.0
4         26       52.0
```

`apply` calls a function on every value ([lesson 1.14](lesson:1.14)). For arithmetic, `df['Value'] * 2` gives the same result in one step and runs faster; `apply` is for logic that has no ready-made operation. A missing value stays missing: `NaN * 2` is `NaN`.

## Filter and sort rows

```python title="Notebook cell"
high = df[df['Sales'] > 900]
high[['Sales Date', 'Product', 'Sales']]
```

```output real
    Sales Date   Product  Sales
6   2023-01-07  Product1  936.0
21  2023-01-22  Product2  992.0
22  2023-01-23  Product3  942.0
43  2023-02-13  Product3  949.0
46  2023-02-16  Product1  938.0
```

```python title="Notebook cell"
df.sort_values('Sales', ascending=False)[['Product', 'Region', 'Sales']].head(3)
```

```output real
     Product Region  Sales
21  Product2  South  992.0
43  Product3   East  949.0
22  Product3  North  942.0
```

`df['Sales'] > 900` is a mask, a Series of `True` and `False` as in NumPy ([lesson 3.1](lesson:3.1)), and `df[mask]` keeps the rows where it is `True`. Combine conditions with `&` and `|`, each in brackets: `df[(df['Sales'] > 900) & (df['Region'] == 'West')]`. A list of names selects columns. `sort_values` returns a sorted copy; several keys go in a list, each with its own direction: `df.sort_values(['Region', 'Sales'], ascending=[True, False])`.

## Group and aggregate

```python title="Notebook cell"
grouped_mean = df.groupby('Product')['Value'].mean()
print(grouped_mean)
```

```output real
Product
Product1    46.214286
Product2    52.800000
Product3    55.166667
Name: Value, dtype: float64
```

```python title="Notebook cell"
grouped_sum = df.groupby(['Product', 'Region'])['Value'].sum()
print(grouped_sum)
```

```output real
Product   Region
Product1  East      292.0
          North       9.0
          South     100.0
          West      246.0
Product2  East       56.0
          North     127.0
          South     181.0
          West      428.0
Product3  East      202.0
          North     203.0
          South     215.0
          West      373.0
Name: Value, dtype: float64
```

```python title="Notebook cell"
# Several functions at once
grouped_agg = df.groupby('Region')['Value'].agg(['mean', 'sum', 'count'])
grouped_agg
```

```output real
             mean     sum  count
Region
East    42.307692   550.0     13
North   37.666667   339.0      9
South   62.000000   496.0      8
West    61.588235  1047.0     17
```

`groupby` splits the rows into groups by a column, applies a function to each group, and combines the results into a new Series or DataFrame indexed by the groups. Two keys give a two-level index: each product, then each region within it. `agg` applies several functions at once, one column per function; `count` counts values that are present.

::: visual split-apply-combine | Figure | Split, apply, combine
Six rows grouped by product, a mean per group, and the results combined into one Series.
:::

## Join two tables

```python title="Notebook cell"
df1 = pd.DataFrame({'Key': ['A', 'B', 'C'], 'Value1': [1, 2, 3]})
df2 = pd.DataFrame({'Key': ['A', 'B', 'D'], 'Value2': [4, 5, 6]})
print(df1)
print(df2)
```

```output real
  Key  Value1
0   A       1
1   B       2
2   C       3
  Key  Value2
0   A       4
1   B       5
2   D       6
```

```python title="Notebook cell"
# Merge the DataFrames on the 'Key' column
pd.merge(df1, df2, on="Key", how="inner")
```

```output real
  Key  Value1  Value2
0   A       1       4
1   B       2       5
```

```python title="Notebook cell"
pd.merge(df1, df2, on="Key", how="outer")
```

```output real
  Key  Value1  Value2
0   A     1.0     4.0
1   B     2.0     5.0
2   C     3.0     NaN
3   D     NaN     6.0
```

```python title="Notebook cell"
pd.merge(df1, df2, on="Key", how="left")
```

```output real
  Key  Value1  Value2
0   A       1     4.0
1   B       2     5.0
2   C       3     NaN
```

```python title="Notebook cell"
pd.merge(df1, df2, on="Key", how="right")
```

```output real
  Key  Value1  Value2
0   A     1.0       4
1   B     2.0       5
2   D     NaN       6
```

`merge` matches rows by the `on` column, like SQL's joins. `inner` keeps keys found in both tables; `outer` keeps all keys; `left` and `right` keep every key of one side. A key missing from one side gets `NaN` in that side's columns, and since `NaN` is a float, an integer column with a gap turns into floats: `1.0`, `2.0`.

## pandas in SQL terms

| SQL | pandas |
|---|---|
| `SELECT * FROM t LIMIT 5` | `df.head(5)` |
| `SELECT product, sales FROM t` | `df[['product', 'sales']]` |
| `WHERE sales > 900` | `df[df['sales'] > 900]` |
| `ORDER BY sales DESC` | `df.sort_values('sales', ascending=False)` |
| `GROUP BY product` with `AVG(value)` | `df.groupby('product')['value'].mean()` |
| `AVG`, `SUM` and `COUNT` together | `.agg(['mean', 'sum', 'count'])` |
| `INNER`, `LEFT`, `RIGHT` and `FULL OUTER JOIN … USING (key)` | `pd.merge(a, b, on='key', how='inner' / 'left' / 'right' / 'outer')` |
| `WHERE sales IS NULL` | `df[df['sales'].isnull()]` |
| `COALESCE(sales, 0)` | `df['sales'].fillna(0)` |
