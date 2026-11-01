+++
number = "3.11"
title = "Flask: a JSON API"
lede = "An API answers programs instead of people: it takes and returns JSON. Four HTTP methods, GET, POST, PUT and DELETE, map onto reading, creating, updating and deleting records."
summary = "Build a to-do API with GET, POST, PUT and DELETE routes, return JSON with `jsonify`, read JSON bodies with `request.json`, and call it from Python with `requests`."
type = "concept"
status = "published"
source = "2 Complete-Python-Bootcamp/13-Flask: flask/api.py, flask/sample.json"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

The pages in [lesson 3.10](lesson:3.10) were HTML for a browser. An API returns data, as JSON, for other programs: a front end, a script, or an agent calling a tool. The app below keeps a to-do list in memory and offers the four classic operations on it.

## The app

```python title="api.py"
from flask import Flask, jsonify, request

app = Flask(__name__)

# Initial data in the to-do list
items = [
    {"id": 1, "name": "Item 1", "description": "This is item 1"},
    {"id": 2, "name": "Item 2", "description": "This is item 2"},
]


@app.route('/')
def home():
    return "Welcome to the sample to-do list app"


# GET: retrieve all the items
@app.route('/items', methods=['GET'])
def get_items():
    return jsonify(items)


# GET: retrieve a specific item by id
@app.route('/items/<int:item_id>', methods=['GET'])
def get_item(item_id):
    item = next((item for item in items if item["id"] == item_id), None)
    if item is None:
        return jsonify({"error": "item not found"})
    return jsonify(item)


# POST: create a new item
@app.route('/items', methods=['POST'])
def create_item():
    if not request.json or 'name' not in request.json:
        return jsonify({"error": "item not found"})
    new_item = {
        "id": items[-1]["id"] + 1 if items else 1,
        "name": request.json['name'],
        "description": request.json["description"],
    }
    items.append(new_item)
    return jsonify(new_item)


# PUT: update an existing item
@app.route('/items/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    item = next((item for item in items if item["id"] == item_id), None)
    if item is None:
        return jsonify({"error": "Item not found"})
    item['name'] = request.json.get('name', item['name'])
    item['description'] = request.json.get('description', item['description'])
    return jsonify(item)


# DELETE: delete an item
@app.route('/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    global items
    items = [item for item in items if item["id"] != item_id]
    return jsonify({"result": "Item deleted"})


if __name__ == '__main__':
    app.run(debug=True)
```

```zsh title="Terminal" server
python api.py
```

Several routes share a URL and differ by method: `GET /items` lists, `POST /items` creates. `jsonify` turns lists and dictionaries into a JSON response with the `application/json` content type. `next((item for item in items if …), None)` returns the first matching item, or `None` when there is none ([lesson 2.6](lesson:2.6)). `delete_item` assigns a new list to `items`, a name defined outside the function, so it declares `global items` first; without that line, Python would treat `items` as a new local variable.

## Read: GET

A browser can show `GET` routes: open <http://127.0.0.1:5000/items>. From Python, `requests` sends every method, and `.json()` turns the answer back into Python objects:

```python title="Notebook cell"
import requests

BASE = "http://127.0.0.1:5000"

print(requests.get(f"{BASE}/items").json())
print(requests.get(f"{BASE}/items/1").json())
print(requests.get(f"{BASE}/items/9").json())
```

```output real
[{'description': 'This is item 1', 'id': 1, 'name': 'Item 1'}, {'description': 'This is item 2', 'id': 2, 'name': 'Item 2'}]
{'description': 'This is item 1', 'id': 1, 'name': 'Item 1'}
{'error': 'item not found'}
```

Flask sorts the keys of each JSON object alphabetically, which is why `description` comes first.

## Create, update and delete: POST, PUT and DELETE

```python title="Notebook cell"
new_item = {"name": "New Item", "description": "This is a new item"}
response = requests.post(f"{BASE}/items", json=new_item)
print(response.json())
```

```output real
{'description': 'This is a new item', 'id': 3, 'name': 'New Item'}
```

```python title="Notebook cell"
update = {"name": "Updated Item", "description": "This item has been updated"}
print(requests.put(f"{BASE}/items/3", json=update).json())
```

```output real
{'description': 'This item has been updated', 'id': 3, 'name': 'Updated Item'}
```

```python title="Notebook cell"
print(requests.delete(f"{BASE}/items/1").json())
print(requests.get(f"{BASE}/items").json())
```

```output real
{'result': 'Item deleted'}
[{'description': 'This is item 2', 'id': 2, 'name': 'Item 2'}, {'description': 'This item has been updated', 'id': 3, 'name': 'Updated Item'}]
```

`json=` sends a dictionary as a JSON body with the matching `Content-Type: application/json` header, and `request.json` in the app reads it back as a dictionary. `PUT` changes only the fields it receives: `.get('name', item['name'])` keeps the old value for a missing key. The list lives in the server's memory, so restarting the server brings back the two original items.

Postman or `curl` work too. The `POST` above, as a `curl` command in a terminal:

```zsh title="Terminal" norun
curl -X POST -H "Content-Type: application/json" -d '{"name": "New Item", "description": "This is a new item"}' http://127.0.0.1:5000/items
```

## Status codes

Every response carries a status code, and API clients check it before they read the body:

```python title="Notebook cell"
print(requests.get(f"{BASE}/items/9").status_code)
print(requests.post(f"{BASE}/items", data={"name": "Form Item"}).status_code)
print(requests.post(f"{BASE}/items", json={"name": "No description"}).status_code)
```

```output real
200
415
500
```

- **200 for a missing item.** The app returns its error message with the default status, 200, OK. Return the right code with the body: `return jsonify({"error": "item not found"}), 404`.
- **415 for a form.** A body that isn't JSON is refused with 415, Unsupported Media Type, as soon as the code touches `request.json`, before its own check runs.
- **500 for a missing field.** `request.json["description"]` raises `KeyError`, a server error; `request.json.get("description", "")` would accept the item.

Deleting an id that doesn't exist also answers "Item deleted"; a careful API checks first and returns 404.

| Method | Route | Does | SQL |
|---|---|---|---|
| `GET` | `/items`, `/items/<id>` | Read | `SELECT` |
| `POST` | `/items` | Create | `INSERT` |
| `PUT` | `/items/<id>` | Update | `UPDATE` |
| `DELETE` | `/items/<id>` | Delete | `DELETE` |

## Coming from Java

| Spring | Flask |
|---|---|
| `@RestController` methods returning objects, turned into JSON by Jackson | `return jsonify(obj)` |
| `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping` | `methods=['GET']`, `['POST']`, `['PUT']`, `['DELETE']` |
| `@RequestBody Item item` | `request.json`, a dictionary |
| `ResponseEntity.status(404).body(error)` | `return jsonify(error), 404` |
| `RestTemplate`, `WebClient` | `requests.get`, `requests.post(url, json=...)` |
