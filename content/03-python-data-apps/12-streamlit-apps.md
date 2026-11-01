+++
number = "3.12"
title = "Streamlit apps"
lede = "Streamlit turns a Python script into a web app: each `st.` call draws an element, widgets are function calls that return the user's input, and every interaction runs the script again from the top."
summary = "Run a Streamlit app, show text, tables and charts, take input with widgets, and understand why the whole script reruns on every change."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/14-Streamlit: app.py, widgets.py, classification.py"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Flask apps answer requests with routes and HTML ([lesson 3.9](lesson:3.9)). A Streamlit app is just a script: no routes, no HTML, no JavaScript. It is the quickest way to put a model or a chart in front of someone, and the LLM apps of [module 06](module:06) use it as their front end.

## A first app

```python title="app.py"
import streamlit as st
import pandas as pd
import numpy as np

# Title of the application
st.title("Hello Streamlit")

# Display a simple text
st.write("This is a simple text")

# Create a simple DataFrame
df = pd.DataFrame({
    'first column': [1, 2, 3, 4],
    'second column': [10, 20, 30, 40],
})

# Display the DataFrame
st.write("Here is the dataframe")
st.write(df)

# Create a line chart
chart_data = pd.DataFrame(
    np.random.randn(20, 3), columns=['a', 'b', 'c']
)
st.line_chart(chart_data)
```

```zsh title="Terminal"
streamlit run app.py
```

```output illustrative note="the Network URL shows your own address"
  You can now view your Streamlit app in your browser.

  Local URL: http://localhost:8501
  Network URL: http://192.168.1.20:8501
```

Start the app with `streamlit run`, not `python`: the `streamlit` command runs the script inside its own web server and opens the page in your browser. The very first run asks for an email address in the terminal; press Enter to skip it.

The page shows the title, the text, the DataFrame as an interactive table, and a line chart of 20 random values for each of `a`, `b` and `c`. `st.write` displays almost anything: text, numbers, DataFrames, dictionaries. Ctrl+C in the terminal stops the server.

## The script reruns on every change

Press **R** in the page, or choose **Rerun** from its menu, and the chart changes: Streamlit ran the whole script again, and `np.random.randn` drew new numbers. The same happens on every interaction with a widget, and it is the one rule behind every Streamlit app.

::: visual streamlit-rerun | Run player | Streamlit reruns your script
Run the widgets app: each change to a widget runs the script again from the first line.
:::

Each run rebuilds the page from top to bottom. Widgets keep their values between runs and return them each time; ordinary variables start fresh. Expensive work at the top of the script, such as loading data or a model, runs again too, which is what Streamlit's caches are for (practice task).

## Widgets

```python title="widgets.py"
import streamlit as st
import pandas as pd

st.title("Streamlit Text Input")

name = st.text_input("Enter your name:")

age = st.slider("Select your age:", 0, 100, 25)

st.write(f"Your age is {age}.")

options = ["Python", "Java", "C++", "JavaScript"]
choice = st.selectbox("Choose your favorite language:", options)
st.write(f"You selected {choice}.")

if name:
    st.write(f"Hello, {name}")

data = {
    "Name": ["John", "Jane", "Jake", "Jill"],
    "Age": [28, 24, 35, 40],
    "City": ["New York", "Los Angeles", "Chicago", "Houston"],
}

df = pd.DataFrame(data)
df.to_csv("sampledata.csv")
st.write(df)

uploaded_file = st.file_uploader("Choose a CSV file", type="csv")

if uploaded_file is not None:
    df = pd.read_csv(uploaded_file)
    st.write(df)
```

```zsh title="Terminal"
streamlit run widgets.py
```

Each widget is a function that draws the control and returns its current value:

| Widget | Returns |
|---|---|
| `st.text_input(label)` | The text typed so far, `""` at first |
| `st.slider(label, min, max, start)` | The chosen number, `start` at first |
| `st.selectbox(label, options)` | The chosen option, the first one at first |
| `st.file_uploader(label, type="csv")` | `None` until a file is chosen, then the file, which `pd.read_csv` can read |

`if name:` is false for the empty string ([lesson 1.5](lesson:1.5)), so the greeting appears only after you type a name and press Enter. `df.to_csv("sampledata.csv")` sits in the script's body, so it writes the file again on every rerun.

## Flask or Streamlit?

| | Flask | Streamlit |
|---|---|---|
| You write | Routes that return HTML or JSON | One script of `st.` calls |
| Input arrives as | A request: form fields, URL parts, a JSON body | Return values of widget calls |
| On each interaction | One route runs | The whole script runs again |
| Start it with | `python app.py` | `streamlit run app.py` |
| Good for | Websites and APIs | Dashboards, demos, model front ends |

## Practice

::: practice
**An iris species predictor.** Train a `RandomForestClassifier` on scikit-learn's iris dataset (150 flowers, four measurements each, three species) and build an app with four sidebar sliders, one per measurement, that shows the predicted species. Load the data in a function cached with `@st.cache_data`.

```python title="classification.py"
import streamlit as st
import pandas as pd
from sklearn.datasets import load_iris
from sklearn.ensemble import RandomForestClassifier


@st.cache_data
def load_data():
    iris = load_iris()
    df = pd.DataFrame(iris.data, columns=iris.feature_names)
    df['species'] = iris.target
    return df, iris.target_names


df, target_names = load_data()

model = RandomForestClassifier()
model.fit(df.iloc[:, :-1], df['species'])

st.sidebar.title("Input Features")
sepal_length = st.sidebar.slider("Sepal length", float(df['sepal length (cm)'].min()), float(df['sepal length (cm)'].max()))
sepal_width = st.sidebar.slider("Sepal width", float(df['sepal width (cm)'].min()), float(df['sepal width (cm)'].max()))
petal_length = st.sidebar.slider("Petal length", float(df['petal length (cm)'].min()), float(df['petal length (cm)'].max()))
petal_width = st.sidebar.slider("Petal width", float(df['petal width (cm)'].min()), float(df['petal width (cm)'].max()))

input_data = [[sepal_length, sepal_width, petal_length, petal_width]]

# Prediction
prediction = model.predict(input_data)
predicted_species = target_names[prediction[0]]

st.write("Prediction")
st.write(f"The predicted species is: {predicted_species}")
```

```zsh title="Terminal"
streamlit run classification.py
```

The sliders start at each measurement's minimum, and the page first shows "The predicted species is: setosa". `@st.cache_data` runs `load_data` once and hands back the stored result on every rerun. The model, though, is trained again on every slider move: wrap the training in a function marked `@st.cache_resource`, Streamlit's cache for objects such as models and connections, to train it once. Each prediction also prints `UserWarning: X does not have valid feature names` in the terminal, because the model was trained on a DataFrame with column names and `input_data` is a plain list; passing `pd.DataFrame(input_data, columns=df.columns[:-1])` instead silences it.
:::
