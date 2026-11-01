+++
number = "3.10"
title = "Flask: forms, URL variables and Jinja"
lede = "Web pages take input in two ways: form fields sent with a POST request, and values inside the URL. Jinja templates then turn that data into HTML with expressions, conditions and loops."
summary = "Handle GET and POST, read form fields safely, take typed values from the URL, fill templates with `{{ }}`, `{% if %}` and `{% for %}`, and redirect after a form."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/13-Flask: flask/getpost.py, flask/jinja.py, templates/form.html, result.html, result1.html, getresult.html"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

A browser asks for a page with a **GET** request and sends a filled-in form with a **POST** request. One route can handle both: show the form on GET, process it on POST. The apps below run like the ones in [lesson 3.9](lesson:3.9), with their templates in the `templates` folder.

## A form: GET shows it, POST handles it

```html title="templates/form.html"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Form</title>
</head>
<body>
    <h1>Submit a Form</h1>
    <form action="/submit" method="post">
        <label for="name">Name:</label>
        <input type="text" id="name" name="name">
        <input type="submit" value="Submit">
    </form>
</body>
</html>
```

```python title="getpost.py"
from flask import Flask, render_template, request
from markupsafe import escape

app = Flask(__name__)


@app.route('/submit', methods=['GET', 'POST'])
def submit():
    if request.method == 'POST':
        name = request.form['name']
        return f'Hello {escape(name)}!'
    return render_template('form.html')


if __name__ == "__main__":
    app.run(debug=True)
```

```zsh title="Terminal" server
python getpost.py
```

Open <http://127.0.0.1:5000/submit>, type a name and press Submit: the browser posts the form to `/submit`, and the page greets you. `methods` lists the request types a route accepts (GET only, by default); `request.method` says which one arrived, and `request.form` holds the posted fields by their `name` attribute.

`requests` can post a form the way a browser does, with `data=`:

```python title="Notebook cell"
import requests

print(requests.post("http://127.0.0.1:5000/submit", data={"name": "Alice"}).text)
print(requests.post("http://127.0.0.1:5000/submit", data={"name": "<b>Alice</b>"}).text)
print(requests.post("http://127.0.0.1:5000/submit", data={}).status_code)
```

```output real
Hello Alice!
Hello &lt;b&gt;Alice&lt;/b&gt;!
500
```

## Escape what users send

`escape` turns `<` and `>` into `&lt;` and `&gt;`, so the browser shows the text instead of running it. Without it, a "name" such as `<script>…</script>` would run as code in the page of whoever opens it: a **cross-site scripting** attack. Templates escape every `{{ }}` value for you; escape by hand only when you build HTML in Python, as here.

A post without the `name` field fails at `request.form['name']`. In debug mode Flask shows that as a server error, status **500**, with the traceback, to help you find it; without debug mode the answer is **400**, Bad Request. `request.form.get('name')` returns `None` instead of failing.

## Values in the URL and templates with data

```python title="jinja.py"
from flask import Flask, redirect, render_template, request, url_for

app = Flask(__name__)


# Variable rule: <int:score> takes an integer from the URL
@app.route('/success/<int:score>')
def success(score):
    res = ""
    if score >= 50:
        res = "PASSED"
    else:
        res = "FAILED"
    return render_template('success.html', results=res)


@app.route('/successres/<int:score>')
def successres(score):
    res = ""
    if score >= 50:
        res = "PASSED"
    else:
        res = "FAILED"
    exp = {'score': score, "res": res}
    return render_template('result1.html', results=exp)


# The if condition lives in the template
@app.route('/successif/<int:score>')
def successif(score):
    return render_template('result.html', results=score)


@app.route('/submit', methods=['POST', 'GET'])
def submit():
    total_score = 0
    if request.method == 'POST':
        science = float(request.form['science'])
        maths = float(request.form['maths'])
        c = float(request.form['c'])
        data_science = float(request.form['datascience'])
        total_score = (science + maths + c + data_science) / 4
    else:
        return render_template('getresult.html')
    return redirect(url_for('successres', score=total_score))


if __name__ == "__main__":
    app.run(debug=True)
```

```html title="templates/success.html"
<h1>The result is {{ results }}</h1>
```

```html title="templates/result1.html"
<html>
<body>
<h2>Final Results</h2>
{% for key, value in results.items() %}
{# This is the comment section #}
<h1>{{ key }}</h1>
<h2>{{ value }}</h2>
{% endfor %}
</body>
</html>
```

```html title="templates/result.html"
<h1>Based on the marks you have {{ results }}</h1>
{% if results >= 50 %}
<h1>You have passed with marks {{ results }}</h1>
{% else %}
<h2>You have failed with marks {{ results }}</h2>
{% endif %}
```

```html title="templates/getresult.html"
<!DOCTYPE html>
<html>
<body>

<h2>HTML Forms</h2>

<form action="/submit" method="post">
  <label for="science">Science:</label><br>
  <input type="text" id="science" name="science" value="0"><br>
  <label for="maths">Maths:</label><br>
  <input type="text" id="maths" name="maths" value="0"><br><br>
  <label for="c">C:</label><br>
  <input type="text" id="c" name="c" value="0"><br><br>
  <label for="datascience">Data Science:</label><br>
  <input type="text" id="datascience" name="datascience" value="0"><br><br>
  <input type="submit" value="Submit">
</form>

<p>If you click the "Submit" button, the form-data will be sent to a page called "/submit".</p>

</body>
</html>
```

Stop the previous app and start this one:

```zsh title="Terminal" server
python jinja.py
```

```python title="Notebook cell"
print(requests.get("http://127.0.0.1:5000/success/75").text)
print(requests.get("http://127.0.0.1:5000/success/abc").status_code)
```

```output real
<h1>The result is PASSED</h1>
404
```

A **variable rule** such as `<int:score>` captures that part of the URL, converts it to an `int` and passes it to the function as `score`. A part that isn't a whole number doesn't match the route: status 404. `render_template` passes your values to the template as keyword arguments, and `{{ results }}` prints one.

```python title="Notebook cell"
print(requests.get("http://127.0.0.1:5000/successres/75").text)
```

```output real
<html>
<body>
<h2>Final Results</h2>


<h1>score</h1>
<h2>75</h2>


<h1>res</h1>
<h2>PASSED</h2>

</body>
</html>
```

```python title="Notebook cell"
print(requests.get("http://127.0.0.1:5000/successif/75").text)
print(requests.get("http://127.0.0.1:5000/successif/30").text)
```

```output real
<h1>Based on the marks you have 75</h1>

<h1>You have passed with marks 75</h1>

<h1>Based on the marks you have 30</h1>

<h2>You have failed with marks 30</h2>
```

Templates are written in **Jinja**, which has three kinds of tags. The tag lines themselves leave blank lines in the HTML, which browsers ignore.

| Tag | Does | In the templates above |
|---|---|---|
| `{{ … }}` | Prints a value, escaped | `{{ results }}`, `{{ key }}` |
| `{% … %}` | Logic: `if`, `for`, closed by `endif`, `endfor` | `{% if results >= 50 %}`, `{% for key, value in results.items() %}` |
| `{# … #}` | A comment, never sent to the browser | `{# This is the comment section #}` |

## A form that redirects

Open <http://127.0.0.1:5000/submit>, enter four marks and submit: the average appears on the results page. Posting the form from a notebook shows what happens on the way:

```python title="Notebook cell"
response = requests.post(
    "http://127.0.0.1:5000/submit",
    data={"science": "70", "maths": "80", "c": "90", "datascience": "61"},
)
print(response.history)
print(response.url)
```

```output real
[<Response [302]>]
http://127.0.0.1:5000/successres/75
```

`submit` averages the marks (75.25) and answers with a **redirect**, status 302, to the results page; the browser, and `requests`, follow it with a GET. `url_for('successres', score=total_score)` builds that URL from the function's name, so URLs live in one place, the route. The rule says `int`, so 75.25 becomes `/successres/75`. Redirecting after a POST also means that reloading the results page doesn't send the form again.

Flask serves files such as CSS and images from a folder named `static` next to the app, and `url_for('static', filename='css/style.css')` builds their URLs.

## Coming from Java

| Spring MVC | Flask |
|---|---|
| `@PostMapping`, `@RequestMapping(method = …)` | `methods=['GET', 'POST']` |
| `@RequestParam String name` | `request.form['name']` |
| `@PathVariable int score` | `<int:score>` in the route, `score` as a parameter |
| `model.addAttribute("results", res)` | `render_template('result.html', results=res)` |
| Thymeleaf `th:text`, `th:if`, `th:each` | Jinja `{{ }}`, `{% if %}`, `{% for %}` |
| `"redirect:/successres/75"` | `redirect(url_for('successres', score=75))` |
