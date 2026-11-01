+++
number = "3.6"
title = "Statistical plots with Seaborn"
lede = "Seaborn draws on Matplotlib but takes a DataFrame and column names, and it groups, averages and summarises the data for you: one call per chart."
summary = "Scatter and line plots, bar, box and violin plots per category, histograms and density curves, a pairplot and a correlation heatmap."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/10-Data Analysis With Python: 10.6-seaborn.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
data = ["sales_data.csv"]
+++

With Matplotlib you pass lists of numbers ([lesson 3.5](lesson:3.5)); with Seaborn you pass a DataFrame as `data=` and name its columns. Seaborn draws on Matplotlib's axes, so `plt.title()` and `plt.show()` still apply.

## A dataset to plot

```python title="Notebook cell"
import seaborn as sns

# Basic plotting with Seaborn
tips = sns.load_dataset('tips')
tips
```

```output real
     total_bill   tip     sex smoker   day    time  size
0         16.99  1.01  Female     No   Sun  Dinner     2
1         10.34  1.66    Male     No   Sun  Dinner     3
2         21.01  3.50    Male     No   Sun  Dinner     3
3         23.68  3.31    Male     No   Sun  Dinner     2
4         24.59  3.61  Female     No   Sun  Dinner     4
..          ...   ...     ...    ...   ...     ...   ...
239       29.03  5.92    Male     No   Sat  Dinner     3
240       27.18  2.00  Female    Yes   Sat  Dinner     2
241       22.67  2.00    Male    Yes   Sat  Dinner     2
242       17.82  1.75    Male     No   Sat  Dinner     2
243       18.78  3.00  Female     No  Thur  Dinner     2

[244 rows x 7 columns]
```

`load_dataset` downloads one of Seaborn's sample datasets the first time (it needs an internet connection) and returns a DataFrame: 244 restaurant bills with the tip, the guests' sex, smoker or not, the day, lunch or dinner, and the party size.

## Relationships: scatter and line plots

```python title="Notebook cell"
import matplotlib.pyplot as plt

# Create a scatter plot
sns.scatterplot(x='total_bill', y='tip', data=tips)
plt.title("Scatter Plot of Total Bill vs Tip")
plt.show()
```

```output real alt="Tips against total bills: the points rise to the right" image="plots/06-statistical-plots-with-seaborn-1.svg"
```

```python title="Notebook cell"
sns.lineplot(x='size', y='total_bill', data=tips)
plt.title("Line Plot of Total bill by size")
plt.show()
```

```output real note="the band varies slightly between runs" alt="The mean total bill per party size, rising from 1 to 6, inside a shaded band" image="plots/06-statistical-plots-with-seaborn-2.svg"
```

Each party size appears many times, so `lineplot` draws the **mean** bill per size. The shaded band is a 95% confidence interval: where the mean would probably fall with another sample of bills. Seaborn estimates it by resampling the data at random, so the band shifts a little between runs.

## Categories: bar, box and violin plots

```python title="Notebook cell"
sns.barplot(x='day', y='total_bill', data=tips)
plt.title('Bar Plot of Total Bill By Day')
plt.show()
```

```output real note="the black lines vary slightly between runs" alt="Four bars of the mean bill per day, each with a black confidence line" image="plots/06-statistical-plots-with-seaborn-3.svg"
```

```python title="Notebook cell"
sns.boxplot(x="day", y='total_bill', data=tips)
```

```output real alt="Four box plots of total bills, one per day, with outliers drawn as dots" image="plots/06-statistical-plots-with-seaborn-4.svg"
<Axes: xlabel='day', ylabel='total_bill'>
```

```python title="Notebook cell"
sns.violinplot(x='day', y='total_bill', data=tips)
```

```output real alt="Four violin shapes of total bills, one per day" image="plots/06-statistical-plots-with-seaborn-5.svg"
<Axes: xlabel='day', ylabel='total_bill'>
```

A bar shows the mean, with the same confidence interval as a black line. A **box plot** shows the spread: the box runs from the 25th to the 75th percentile with the median as a line inside, the whiskers reach the furthest values within 1.5 box lengths, and dots beyond them are outliers. A **violin plot** shows the same spread as a smooth outline, wide where many values lie.

The `<Axes: ...>` line is the cell's last value, the plot area Seaborn drew on; end with `plt.show()` to hide it.

## Distributions: histogram and density

```python title="Notebook cell"
sns.histplot(tips['total_bill'], bins=10, kde=True)
```

```output real alt="A histogram of total bills in 10 bins with a smooth curve over it" image="plots/06-statistical-plots-with-seaborn-6.svg"
<Axes: xlabel='total_bill', ylabel='Count'>
```

```python title="Notebook cell"
sns.kdeplot(tips['total_bill'], fill=True)
```

```output real alt="A filled smooth curve of total bills, peaking near 15 dollars" image="plots/06-statistical-plots-with-seaborn-7.svg"
<Axes: xlabel='total_bill', ylabel='Density'>
```

`kde=True` adds a **kernel density estimate**: a smoothed version of the histogram. `kdeplot` draws only the curve; its height is a density, so the area under it is 1.

## Every pair at once

```python title="Notebook cell"
sns.pairplot(tips)
```

```output real note="the address differs on each run" alt="A 3 by 3 grid: scatter plots for each pair of total bill, tip and size, histograms on the diagonal" image="plots/06-statistical-plots-with-seaborn-8.png"
<seaborn.axisgrid.PairGrid at 0x1556fa7dac0>
```

`pairplot` draws a scatter plot for every pair of numeric columns and a histogram of each column on the diagonal: a first look at a new dataset.

## Correlation heatmap

```python title="Notebook cell"
corr = tips[['total_bill', 'tip', 'size']].corr()
corr
```

```output real
            total_bill       tip      size
total_bill    1.000000  0.675734  0.598315
tip           0.675734  1.000000  0.489299
size          0.598315  0.489299  1.000000
```

```python title="Notebook cell"
sns.heatmap(corr, annot=True, cmap='coolwarm')
```

```output real alt="A 3 by 3 heatmap of the correlations, each square labelled with its value" image="plots/06-statistical-plots-with-seaborn-9.svg"
<Axes: >
```

A **correlation** runs from -1 to 1: near 1, two columns rise together; near 0 they are unrelated; near -1 one falls as the other rises. Bills and tips correlate at 0.68. `annot=True` writes the numbers in the squares, and `cmap` picks the colours.

## Which plot for what

| Question | Seaborn call |
|---|---|
| How do two numbers relate? | `scatterplot`, `lineplot` |
| How does a number differ between groups? | `barplot` (mean), `boxplot`, `violinplot` (spread) |
| How is one number distributed? | `histplot`, `kdeplot` |
| A first look at every pair | `pairplot` |
| Which columns move together? | `heatmap` of `df.corr()` |

## Practice

::: practice
**Sales totals.** With `sales_data.csv` ([lesson 3.2](lesson:3.2)), plot the total revenue per product category, then per region, as Seaborn bar plots of 10 by 6 inches with a title and axis labels.

```python title="Notebook cell"
import pandas as pd

sales_df = pd.read_csv('sales_data.csv')

# Plot total sales by product
plt.figure(figsize=(10, 6))
sns.barplot(x='Product Category', y="Total Revenue", data=sales_df, estimator=sum)
plt.title('Total Sales by Product')
plt.xlabel('Product')
plt.ylabel('Total Sales')
plt.show()
```

```output real note="the black lines vary slightly between runs" alt="Total revenue per product category as bars, Electronics the tallest, each with a black confidence line" image="plots/06-statistical-plots-with-seaborn-10.svg"
```

```python title="Notebook cell"
# Plot total sales by region
plt.figure(figsize=(10, 6))
sns.barplot(x='Region', y="Total Revenue", data=sales_df, estimator=sum)
plt.title('Total Sales by Region')
plt.xlabel('Region')
plt.ylabel('Total Sales')
plt.show()
```

```output real note="the black lines vary slightly between runs" alt="Total revenue per region as three bars, each with a black confidence line" image="plots/06-statistical-plots-with-seaborn-11.svg"
```

`estimator=sum` makes each bar the total instead of the mean. The black lines are still confidence intervals, computed for the totals; `errorbar=None` leaves them out.
:::
