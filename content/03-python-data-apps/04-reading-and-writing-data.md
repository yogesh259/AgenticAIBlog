+++
number = "3.4"
title = "Reading and writing data"
lede = "pandas reads JSON, CSV, HTML tables, Excel workbooks and pickle files into DataFrames with `read_*` functions, and writes them back with `to_*` methods."
summary = "Read JSON text, a CSV file from a URL, tables from a web page and an Excel workbook, and write DataFrames back to JSON, CSV, Excel and pickle."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/10-Data Analysis With Python: 10.4-readdata.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Every format has a pair: `pd.read_csv` and `df.to_csv`, `pd.read_json` and `df.to_json`, and so on. Each `read_*` function accepts a file name, a URL, or an open file object. Two cells read from the web, so they need an internet connection.

## JSON

```python title="Notebook cell"
import pandas as pd
from io import StringIO

Data = '{"employee_name": "James", "email": "james@gmail.com", "job_profile": [{"title1":"Team Lead", "title2":"Sr. Developer"}]}'
df = pd.read_json(StringIO(Data))
df
```

```output real
  employee_name            email  \
0         James  james@gmail.com

                                         job_profile
0  {'title1': 'Team Lead', 'title2': 'Sr. Develop...
```

`read_json` expects a file, a URL or a file-like object; pandas 3 treats a plain string as a file name. `StringIO` wraps text so it behaves like an open file. Nested JSON stays nested: `job_profile` holds a dictionary. The JSON module of [lesson 1.16](lesson:1.16) reads JSON into dictionaries and lists; pandas reads it straight into a table.

```python title="Notebook cell"
print(df.to_json())
print(df.to_json(orient='index'))
print(df.to_json(orient='records'))
```

```output real
{"employee_name":{"0":"James"},"email":{"0":"james@gmail.com"},"job_profile":{"0":{"title1":"Team Lead","title2":"Sr. Developer"}}}
{"0":{"employee_name":"James","email":"james@gmail.com","job_profile":{"title1":"Team Lead","title2":"Sr. Developer"}}}
[{"employee_name":"James","email":"james@gmail.com","job_profile":{"title1":"Team Lead","title2":"Sr. Developer"}}]
```

`orient` sets the layout. The default, `columns`, maps each column to its row labels and values; `index` maps each row label to its values; `records` is a list with one object per row, the layout web APIs use.

## CSV from a URL

```python title="Notebook cell"
df = pd.read_csv("https://archive.ics.uci.edu/ml/machine-learning-databases/wine/wine.data", header=None)
df.head()
```

```output real
   0      1     2     3     4    5     6     7     8     9     10    11    12  \
0   1  14.23  1.71  2.43  15.6  127  2.80  3.06  0.28  2.29  5.64  1.04  3.92
1   1  13.20  1.78  2.14  11.2  100  2.65  2.76  0.26  1.28  4.38  1.05  3.40
2   1  13.16  2.36  2.67  18.6  101  2.80  3.24  0.30  2.81  5.68  1.03  3.17
3   1  14.37  1.95  2.50  16.8  113  3.85  3.49  0.24  2.18  7.80  0.86  3.45
4   1  13.24  2.59  2.87  21.0  118  2.80  2.69  0.39  1.82  4.32  1.04  2.93

     13
0  1065
1  1050
2  1185
3  1480
4   735
```

This file has no header line, so `header=None` numbers the columns instead of taking names from the first row.

```python title="Notebook cell"
df.to_csv("wine.csv")
pd.read_csv("wine.csv").head(2)
```

```output real
   Unnamed: 0  0      1     2     3     4    5     6     7     8     9    10  \
0           0  1  14.23  1.71  2.43  15.6  127  2.80  3.06  0.28  2.29  5.64
1           1  1  13.20  1.78  2.14  11.2  100  2.65  2.76  0.26  1.28  4.38

     11    12    13
0  1.04  3.92  1065
1  1.05  3.40  1050
```

`to_csv` writes the index too, as an extra first column; reading the file back turns it into `Unnamed: 0`. Write `df.to_csv("wine.csv", index=False)` unless the index carries information.

## Tables on a web page

```python title="Notebook cell"
url = "https://en.wikipedia.org/wiki/Mobile_country_code"
pd.read_html(url, match="Country", header=0, storage_options={"User-Agent": "pandas-tutorial/1.0"})[0].head()
```

```output real note="read from the live page, which can change"
   Mobile country code                                    Country ISO 3166  \
0                  289                                 A Abkhazia    GE-AB
1                  412                                Afghanistan       AF
2                  276                                    Albania       AL
3                  603                                    Algeria       DZ
4                  544  American Samoa (United States of America)       AS

                             Mobile network codes National MNC authority  \
0        List of mobile network codes in Abkhazia                    NaN
1     List of mobile network codes in Afghanistan                    NaN
2         List of mobile network codes in Albania                    NaN
3         List of mobile network codes in Algeria                    NaN
4  List of mobile network codes in American Samoa                    NaN

                    Remarks
0  MCC is not listed by ITU
1                       NaN
2                       NaN
3                       NaN
4                       NaN
```

`read_html` returns every `<table>` on the page as a list of DataFrames, using the `lxml` package. `match` keeps only the tables that contain that text, and `header=0` takes the first row as the column names. Wikipedia refuses requests that carry Python's default user agent (`HTTP Error 403: Forbidden`), so `storage_options` sends a name for the script instead.

## Excel

```python title="Notebook cell"
# Write a small workbook, then read it back
pd.DataFrame({'Name': ['Alice', 'Jack', 'John'], 'Age': [32, 34, 31]}).to_excel('data.xlsx', index=False)

df_excel = pd.read_excel('data.xlsx')
df_excel
```

```output real
    Name  Age
0  Alice   32
1   Jack   34
2   John   31
```

`read_excel` and `to_excel` use the `openpyxl` package and read the first sheet unless you name another with `sheet_name=`.

## Pickle

```python title="Notebook cell"
df_excel.to_pickle('df_excel')
pd.read_pickle('df_excel')
```

```output real
    Name  Age
0  Alice   32
1   Jack   34
2   John   31
```

A pickle file stores the DataFrame exactly as it is in memory, types included, and only Python can read it ([lesson 2.11](lesson:2.11) met pickling between processes). Reading a pickle can run code hidden in the file, so only open pickles you created yourself.

## Formats at a glance

| Format | Read | Write | Needs |
|---|---|---|---|
| CSV | `pd.read_csv(path_or_url)` | `df.to_csv(path, index=False)` | - |
| JSON | `pd.read_json(StringIO(text))`, a path or URL | `df.to_json(orient='records')` | - |
| HTML tables | `pd.read_html(url)` → list of DataFrames | `df.to_html()` | `lxml` |
| Excel | `pd.read_excel(path, sheet_name=0)` | `df.to_excel(path, index=False)` | `openpyxl` |
| Pickle | `pd.read_pickle(path)` | `df.to_pickle(path)` | - |
