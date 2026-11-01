+++
number = "3.7"
title = "SQLite databases"
lede = "SQLite is a SQL database stored in a single file, and Python ships with a driver for it: no server to install. Connect, run SQL through a cursor, and commit your changes."
summary = "Create a table, insert, query, update and delete rows, commit transactions, pass values safely with placeholders, and close the connection."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/11-Working With Databases: 11.1-sqlite.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

The `sqlite3` module is part of the standard library. SQLite is self-contained and serverless: the whole database lives in one file next to your notebook, which makes it a handy store for small apps and experiments. The SQL is ordinary SQL; keywords are not case-sensitive, so `CREATE TABLE` and `Create Table` are the same.

## Connect and create a table

```python title="Notebook cell"
import sqlite3

# Connect to a SQLite database: the file is created if it doesn't exist
connection = sqlite3.connect('example.db')
connection
```

```output real note="the address differs on each run"
<sqlite3.Connection at 0x1e93a760400>
```

```python title="Notebook cell"
cursor = connection.cursor()

# Create a table
cursor.execute('''
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER,
    department TEXT
)
''')

# Commit the changes
connection.commit()
```

A **cursor** runs SQL and holds the rows of the last query. `IF NOT EXISTS` makes the cell safe to run twice. An `INTEGER PRIMARY KEY` column numbers the rows by itself: leave it out of an `INSERT` and SQLite fills in the next number.

## Insert and read rows

```python title="Notebook cell"
# Insert data into the table
cursor.execute('''
INSERT INTO employees (name, age, department)
VALUES ('Alice', 32, 'Data Scientist')
''')

cursor.execute('''
INSERT INTO employees (name, age, department)
VALUES ('Bob', 25, 'Engineering')
''')

cursor.execute('''
INSERT INTO employees (name, age, department)
VALUES ('Charlie', 35, 'Finance')
''')

# Commit the changes
connection.commit()
```

```python title="Notebook cell"
# Query the data from the table
cursor.execute('SELECT * FROM employees')
rows = cursor.fetchall()

for row in rows:
    print(row)
```

```output real
(1, 'Alice', 32, 'Data Scientist')
(2, 'Bob', 25, 'Engineering')
(3, 'Charlie', 35, 'Finance')
```

`execute` returns the cursor itself, which is why a notebook would echo `<sqlite3.Cursor at 0x…>` for a lone `execute` call. `fetchall()` returns the rows as a list of tuples. Running the insert cell again adds the three rows again, with new ids.

## Update and delete

```python title="Notebook cell"
# Update the data in the table
cursor.execute('''
UPDATE employees
SET age = 34
WHERE name = 'Alice'
''')

connection.commit()

cursor.execute('SELECT * FROM employees')
for row in cursor.fetchall():
    print(row)
```

```output real
(1, 'Alice', 34, 'Data Scientist')
(2, 'Bob', 25, 'Engineering')
(3, 'Charlie', 35, 'Finance')
```

```python title="Notebook cell"
# Delete the data from the table
cursor.execute('''
DELETE FROM employees
WHERE name = 'Bob'
''')

connection.commit()

cursor.execute('SELECT * FROM employees')
for row in cursor.fetchall():
    print(row)
```

```output real
(1, 'Alice', 34, 'Data Scientist')
(3, 'Charlie', 35, 'Finance')
```

In SQL, text goes in single quotes. Double quotes name a column: SQLite accepts `name = "Alice"` only because it finds no column called `Alice` and falls back to text, and some builds turn that fallback off. `name = "name"` even compares the column with itself and matches every row.

## Commit, or lose the change

Before an `INSERT`, `UPDATE` or `DELETE`, Python's `sqlite3` opens a **transaction**. Other connections see nothing until you call `commit()`, and if the connection closes first, the changes are gone. `rollback()` throws them away on purpose. A `with connection:` block commits when the block ends, or rolls back if it raises an error; it does not close the connection.

## Values from outside: placeholders

The SQL above is fixed text. When a value comes from a user, a form or a model, never paste it into the SQL with an f-string: the value can change the query itself. Pass it separately with a `?` placeholder:

```python title="Notebook cell"
name = "x' OR '1'='1"

# Unsafe: the value becomes part of the SQL
cursor.execute(f"SELECT * FROM employees WHERE name = '{name}'")
print(cursor.fetchall())

# Safe: the ? placeholder passes the value as data
cursor.execute("SELECT * FROM employees WHERE name = ?", (name,))
print(cursor.fetchall())
```

```output real
[(1, 'Alice', 34, 'Data Scientist'), (3, 'Charlie', 35, 'Finance')]
[]
```

The f-string turned the condition into `name = 'x' OR '1'='1'`, which is true for every row: an **SQL injection**. With `?`, SQLite looks for an employee literally called `x' OR '1'='1` and finds none. The values travel as a tuple, so a single value needs the trailing comma: `(name,)`.

## Close the connection

```python title="Notebook cell"
connection.close()

cursor.execute('SELECT * FROM employees')
```

```output real note="last line of the error"
ProgrammingError: Cannot operate on a closed database.
```

A closed connection can't run anything; connect again to continue.

## Coming from Java

| JDBC | Python `sqlite3` |
|---|---|
| `DriverManager.getConnection(url)` | `sqlite3.connect('example.db')` |
| `Statement`, `ResultSet` | A cursor runs the SQL and holds the result |
| `PreparedStatement` with `?` | `cursor.execute(sql, (value,))`, `executemany(sql, rows)` |
| Auto-commit on by default | A transaction opens before each change: call `commit()` |
| `try`-with-resources closes the connection | `with connection:` commits or rolls back, but doesn't close |
| A row is a `ResultSet` position | A row is a tuple |

## Practice

::: practice
**A sales table.** Connect to `sales_data.db`, create a `sales` table with an id, a date, a product, a sales figure and a region, insert these five rows with one `executemany` call, then print all rows and close the connection: `('2023-01-01', 'Product1', 100, 'North')`, `('2023-01-02', 'Product2', 200, 'South')`, `('2023-01-03', 'Product1', 150, 'East')`, `('2023-01-04', 'Product3', 250, 'West')`, `('2023-01-05', 'Product2', 300, 'North')`.

```python title="Notebook cell"
# Connect to a SQLite database
connection = sqlite3.connect('sales_data.db')
cursor = connection.cursor()

# Create a table for sales data
cursor.execute('''
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    product TEXT NOT NULL,
    sales INTEGER,
    region TEXT
)
''')

# Insert data into the sales table
sales_data = [
    ('2023-01-01', 'Product1', 100, 'North'),
    ('2023-01-02', 'Product2', 200, 'South'),
    ('2023-01-03', 'Product1', 150, 'East'),
    ('2023-01-04', 'Product3', 250, 'West'),
    ('2023-01-05', 'Product2', 300, 'North'),
]

cursor.executemany('''
INSERT INTO sales (date, product, sales, region)
VALUES (?, ?, ?, ?)
''', sales_data)

connection.commit()
```

```python title="Notebook cell"
# Query data from the sales table
cursor.execute('SELECT * FROM sales')
rows = cursor.fetchall()

for row in rows:
    print(row)

connection.close()
```

```output real
(1, '2023-01-01', 'Product1', 100, 'North')
(2, '2023-01-02', 'Product2', 200, 'South')
(3, '2023-01-03', 'Product1', 150, 'East')
(4, '2023-01-04', 'Product3', 250, 'West')
(5, '2023-01-05', 'Product2', 300, 'North')
```

`executemany` runs the statement once per tuple, filling the four `?` placeholders in order. The ids come from the `INTEGER PRIMARY KEY` column.
:::
