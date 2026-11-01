+++
number = "3.9"
title = "Flask: routes and templates"
lede = "Flask turns Python functions into web pages: a decorator ties each function to a URL, and what the function returns is the page. Templates keep the HTML in separate files."
summary = "A first Flask app, routes, the development server and debug mode, HTML responses and templates from a `templates` folder."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/13-Flask: flask/app.py, flask/main.py, templates/index.html, templates/about.html"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Flask is a small web framework: you write functions, and Flask calls the right one for each URL a browser asks for. An app is a script you run from a terminal; while it runs, it answers requests. This lesson and the next two build three small apps; make a folder for them.

## A first app

```python title="app.py"
from flask import Flask

# A WSGI application: the object a web server calls for every request
app = Flask(__name__)


@app.route("/")
def welcome():
    return "Welcome to this Flask app. It is running on your computer."


@app.route("/index")
def index():
    return "Welcome to the index page"


if __name__ == "__main__":
    app.run(debug=True)
```

```zsh title="Terminal" server
python app.py
```

```output illustrative note="the PIN differs on each run"
 * Serving Flask app 'app'
 * Debug mode: on
WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
 * Restarting with stat
 * Debugger is active!
 * Debugger PIN: 123-456-789
```

Open <http://127.0.0.1:5000> in a browser to see the welcome text, and <http://127.0.0.1:5000/index> for the other page. The terminal logs each request; Ctrl+C stops the server.

`Flask(__name__)` creates the application; the module's name tells Flask where to look for the `templates` folder later on. `@app.route("/")` registers the function below it for that URL ([lesson 2.8](lesson:2.8) shows how decorators work), and the string it returns is sent to the browser as the page. **WSGI** is the standard interface between Python web apps and web servers, as the Servlet API is in Java.

You can also ask from a notebook, with the Requests package from [lesson 2.10](lesson:2.10), while the server runs:

```python title="Notebook cell"
import requests

print(requests.get("http://127.0.0.1:5000/").text)
print(requests.get("http://127.0.0.1:5000/index").text)
print(requests.get("http://127.0.0.1:5000/missing").status_code)
```

```output real
Welcome to this Flask app. It is running on your computer.
Welcome to the index page
404
```

A URL without a route gets status **404**, Not Found.

## Debug mode

`app.run(debug=True)` starts Flask's development server with two helpers: it restarts when you save a change to the script, and when a route fails, the browser shows the traceback with a console that runs Python code on your computer, unlocked by the PIN printed in the terminal. Keep debug mode on your own machine; for real users, a production WSGI server such as Gunicorn runs `app`.

## HTML and templates

A route can return HTML in a string, but whole pages belong in template files. Flask looks for them in a folder named `templates` next to the script:

```text title="Project folder"
main.py
templates/
    index.html
    about.html
```

```html title="templates/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Flask App</title>
</head>
<body>
    <h1>Welcome to My Flask App!</h1>
    <p>This is a simple web application built with Flask.</p>
</body>
</html>
```

```html title="templates/about.html"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>About</title>
</head>
<body>
    <h1>About</h1>
    <p>This is the about page of my Flask app.</p>
</body>
</html>
```

```python title="main.py"
from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def welcome():
    return "<html><H1>Welcome to the Flask app</H1></html>"


@app.route("/index")
def index():
    return render_template('index.html')


@app.route('/about')
def about():
    return render_template('about.html')


if __name__ == "__main__":
    app.run(debug=True)
```

Stop the first app with Ctrl+C, then start this one:

```zsh title="Terminal" server
python main.py
```

```python title="Notebook cell"
print(requests.get("http://127.0.0.1:5000/").text)
print(requests.get("http://127.0.0.1:5000/about").text)
```

```output real
<html><H1>Welcome to the Flask app</H1></html>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>About</title>
</head>
<body>
    <h1>About</h1>
    <p>This is the about page of my Flask app.</p>
</body>
</html>
```

`render_template` reads the file from `templates` and returns its HTML. So far the templates are plain HTML; [lesson 3.10](lesson:3.10) fills them with data.

## Common problems

| Problem | Fix |
|---|---|
| `Address already in use`, port 5000 is in use (on macOS the AirPlay Receiver takes port 5000) | Start on another port: `app.run(debug=True, port=5001)`, or turn off AirPlay Receiver in System Settings |
| `jinja2.exceptions.TemplateNotFound: index.html` | Put the file in a folder named `templates`, next to the script |
| `404 Not Found` | The URL must match a route exactly: `/index`, not `/index.html` |
| A change doesn't show | Save the file; debug mode restarts the server. Then reload the page |

## Coming from Java

| Spring MVC | Flask |
|---|---|
| A `@Controller` class with `@GetMapping("/")` methods | `@app.route("/")` on plain functions |
| The Servlet API | WSGI |
| Embedded Tomcat, started by `SpringApplication.run` | `app.run()`, Flask's development server |
| A view name, rendered by Thymeleaf from `templates/` | `render_template("index.html")`, rendered by Jinja from `templates/` |
| Spring Boot DevTools restarts | `debug=True` restarts on save |
