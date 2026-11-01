+++
number = "3.5"
title = "Plotting with Matplotlib"
lede = "Matplotlib draws charts from lists, arrays and DataFrames: lines, bars, histograms, scatter plots and pies, one figure or several side by side."
summary = "Line plots and their styles, several plots in one figure, bar charts, histograms, scatter plots and pie charts, and plotting a DataFrame."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/10-Data Analysis With Python: 10.5-matplotlib.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
data = ["sales_data.csv"]
+++

`matplotlib.pyplot`, imported as `plt`, keeps track of a current figure: each call adds to it, and `plt.show()` displays it. In a notebook the figure appears under the cell; in a script, `plt.show()` opens a window and waits until you close it.

## A line plot

```python title="Notebook cell"
import matplotlib.pyplot as plt

x = [1, 2, 3, 4, 5]
y = [1, 4, 9, 16, 25]

# Create a line plot
plt.plot(x, y)
plt.xlabel('X axis')
plt.ylabel('Y Axis')
plt.title("Basic Line Plot")
plt.show()
```

```output real alt="A line rising from (1, 1) to (5, 25), with axis labels and the title Basic Line Plot" image="plots/05-plotting-with-matplotlib-1.svg"
```

## Style the line

```python title="Notebook cell"
x = [1, 2, 3, 4, 5]
y = [1, 4, 9, 16, 25]

# Create a customised line plot
plt.plot(x, y, color='red', linestyle='--', marker='o', linewidth=3, markersize=9)
plt.grid(True)
```

```output real alt="The same curve as a thick red dashed line with round markers, over a grid" image="plots/05-plotting-with-matplotlib-2.svg"
```

`linestyle` takes `'-'`, `'--'`, `':'` or `'-.'`; `marker` puts a symbol on each point (`'o'`, `'x'`, `'s'` for squares). Colours can be names or hex codes such as `'#3776ab'`.

## Several plots in one figure

```python title="Notebook cell"
x = [1, 2, 3, 4, 5]
y1 = [1, 4, 9, 16, 25]
y2 = [1, 2, 3, 4, 5]

plt.figure(figsize=(9, 5))

plt.subplot(2, 2, 1)
plt.plot(x, y1, color='green')
plt.title("Plot 1")

plt.subplot(2, 2, 2)
plt.plot(y1, x, color='red')
plt.title("Plot 2")

plt.subplot(2, 2, 3)
plt.plot(x, y2, color='blue')
plt.title("Plot 3")

plt.subplot(2, 2, 4)
plt.plot(x, y2, color='green')
plt.title("Plot 4")
```

```output real alt="A 2 by 2 grid of line plots titled Plot 1 to Plot 4" image="plots/05-plotting-with-matplotlib-3.svg"
Text(0.5, 1.0, 'Plot 4')
```

`figure(figsize=(9, 5))` starts a new figure 9 by 5 inches. `subplot(2, 2, n)` divides it into 2 rows and 2 columns and draws in slot `n`, counted from 1, left to right, then top to bottom. Calling `plt.tight_layout()` before showing keeps the titles from overlapping the numbers of the plot above.

The text above the picture is the value of the cell's last line: `plt.title()` returns the title it created, and the notebook shows it. End a cell with `plt.show()` to show only the figure.

## Bar charts and histograms

```python title="Notebook cell"
categories = ['A', 'B', 'C', 'D', 'E']
values = [5, 7, 3, 8, 6]

# Create a bar plot
plt.bar(categories, values, color='purple')
plt.xlabel('Categories')
plt.ylabel('Values')
plt.title('Bar Plot')
plt.show()
```

```output real alt="Five purple bars for categories A to E with heights 5, 7, 3, 8 and 6" image="plots/05-plotting-with-matplotlib-4.svg"
```

A **histogram** shows how values are distributed: it divides their range into bins and counts the values in each one.

```python title="Notebook cell"
data = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5]

# Create a histogram
plt.hist(data, bins=5, color='orange', edgecolor='black')
```

```output real alt="Five orange bars of heights 1 to 5, one per bin" image="plots/05-plotting-with-matplotlib-5.svg"
(array([1., 2., 3., 4., 5.]),
 array([1. , 1.8, 2.6, 3.4, 4.2, 5. ]),
 <BarContainer object of 5 artists>)
```

`plt.hist` returns the count per bin, the bin edges (six edges make five bins from 1 to 5) and the bars, and the notebook shows them above the picture.

## Scatter plots and pie charts

```python title="Notebook cell"
x = [1, 2, 3, 4, 5]
y = [2, 3, 4, 5, 6]

# Create a scatter plot
plt.scatter(x, y, color="blue", marker='x')
```

```output real note="the address differs on each run" alt="Five blue crosses on a straight line from (1, 2) to (5, 6)" image="plots/05-plotting-with-matplotlib-6.svg"
<matplotlib.collections.PathCollection at 0x2526e9d63f0>
```

```python title="Notebook cell"
labels = ['A', 'B', 'C', 'D']
sizes = [30, 20, 40, 10]
colors = ['gold', 'yellowgreen', 'lightcoral', 'lightskyblue']
explode = (0.2, 0, 0, 0)  # move out the first slice

# Create a pie chart
plt.pie(sizes, explode=explode, labels=labels, colors=colors, autopct="%1.1f%%", shadow=True)
```

```output real note="the address differs on each run" alt="A pie chart with slices A 30%, B 20%, C 40% and D 10%, slice A pulled out" image="plots/05-plotting-with-matplotlib-7.svg"
<matplotlib.container.PieContainer at 0x2526ea0dd30>
```

A pie turns the sizes into shares of their total. `explode` pushes slices out of the centre, and `autopct` labels each slice with its share: `%1.1f` prints a number with one decimal, and `%%` a percent sign.

## Which chart for what

| Chart | Call | Shows |
|---|---|---|
| Line | `plt.plot(x, y)` | A trend, often over time |
| Bar | `plt.bar(labels, values)` | Amounts per category |
| Histogram | `plt.hist(values, bins=n)` | How values are distributed |
| Scatter | `plt.scatter(x, y)` | How two measures relate |
| Pie | `plt.pie(sizes, labels=labels)` | Shares of a whole |

## Practice

::: practice
**Sales charts.** Load `sales_data.csv` ([lesson 3.2](lesson:3.2)) and check its columns with `info()`. Print the total revenue per product category and plot it as a bar chart, then plot the total revenue per date as a line. Make the dates on the x-axis readable.

```python title="Notebook cell"
import pandas as pd

sales_data_df = pd.read_csv('sales_data.csv')
sales_data_df.info()
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

```python title="Notebook cell"
# Total sales by product category
total_sales_by_product = sales_data_df.groupby('Product Category')['Total Revenue'].sum()
print(total_sales_by_product)
```

```output real
Product Category
Beauty Products     2621.90
Books               1861.93
Clothing            8128.93
Electronics        34982.41
Home Appliances    18646.16
Sports             14326.52
Name: Total Revenue, dtype: float64
```

```python title="Notebook cell"
total_sales_by_product.plot(kind='bar', color='teal')
```

```output real alt="Teal bars of total revenue per category, Electronics the tallest" image="plots/05-plotting-with-matplotlib-8.svg"
<Axes: xlabel='Product Category'>
```

```python title="Notebook cell"
# Sales trend over time
sales_trend = sales_data_df.groupby('Date')['Total Revenue'].sum().reset_index()
plt.plot(sales_trend['Date'], sales_trend['Total Revenue'])
```

```output real note="the address differs on each run" alt="A revenue line whose x-axis labels overlap into a solid black band" image="plots/05-plotting-with-matplotlib-9.png"
[<matplotlib.lines.Line2D at 0x2526e988aa0>]
```

```python title="Notebook cell"
sales_trend['Date'] = pd.to_datetime(sales_trend['Date'])
plt.plot(sales_trend['Date'], sales_trend['Total Revenue'])
plt.xticks(rotation=45)
plt.show()
```

```output real alt="The same revenue line over a date axis with one readable label per month" image="plots/05-plotting-with-matplotlib-10.svg"
```

A DataFrame or Series has a `plot()` method that draws with Matplotlib; `kind` picks the chart. `reset_index()` turns the group labels back into a column. Dates read from a CSV file are text, so Matplotlib puts all 240 of them on the axis as separate labels, which overlap into a black band. `pd.to_datetime` turns them into dates, and Matplotlib then picks a few readable ticks; `xticks(rotation=45)` tilts them.
:::
