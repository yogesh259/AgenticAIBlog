+++
number = "6.5"
title = "Splitting documents into chunks"
lede = "A text splitter cuts documents into chunks small enough to search precisely and to fit in a prompt: by characters with a little overlap, or along the structure of HTML and JSON."
summary = "Split text with RecursiveCharacterTextSplitter and CharacterTextSplitter, choose chunk size and overlap, and split HTML by headings and JSON by keys."
type = "concept"
status = "published"
source = "4 Langchain: 3.3-Data Trnasformer/3.3-RecuriveCharactertextsplitter.ipynb, 3.4-CharacterTextsplitter.ipynb, 3.5-HTMLtextsplitter.ipynb, 3.6-RecursiveJsonSplitter.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
data = ["speech.txt", "attention.pdf"]
+++

A 15-page paper is one long text. Sent whole with every question it costs many tokens, may not fit the model's context window, and buries the one relevant paragraph; searched whole, it matches every question a little and none well. Retrieval apps therefore cut documents into chunks of a few hundred characters and search those. The files are [lesson 6.4](lesson:6.4)'s: [speech.txt](data/speech.txt) and [attention.pdf](data/attention.pdf).

## Split documents

```python title="Notebook cell"
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

docs = PyPDFLoader("attention.pdf").load()

text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
final_documents = text_splitter.split_documents(docs)
len(final_documents)
```

```output real
DeprecationWarning: `langchain-community` is being sunset and is no longer actively maintained. See https://github.com/langchain-ai/langchain-community/issues/674 for details and migration guidance toward standalone integration packages.
94
```

The 15 pages became chunks of at most 500 characters. `split_documents` copies each page's metadata into its chunks, so every chunk still knows its file and page:

```python title="Notebook cell"
print(final_documents[0])
print(final_documents[1])
```

```output real
page_content='Provided proper attribution is provided, Google hereby grants permission to
reproduce the tables and figures in this paper solely for use in journalistic or
scholarly works.
Attention Is All You Need
Ashish Vaswani∗
Google Brain
avaswani@google.com
Noam Shazeer∗
Google Brain
noam@google.com
Niki Parmar∗
Google Research
nikip@google.com
Jakob Uszkoreit∗
Google Research
usz@google.com
Llion Jones∗
Google Research
llion@google.com
Aidan N. Gomez∗ †
University of Toronto
aidan@cs.toronto.edu' metadata={'producer': 'pdfTeX-1.40.25', 'creator': 'LaTeX with hyperref', 'creationdate': '2023-08-03T00:07:29+00:00', 'author': '', 'keywords': '', 'moddate': '2023-08-03T00:07:29+00:00', 'ptex.fullbanner': 'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023) kpathsea version 6.3.5', 'subject': '', 'title': '', 'trapped': '/False', 'source': 'attention.pdf', 'total_pages': 15, 'page': 0, 'page_label': '1'}
page_content='University of Toronto
aidan@cs.toronto.edu
Łukasz Kaiser∗
Google Brain
lukaszkaiser@google.com
Illia Polosukhin∗ ‡
illia.polosukhin@gmail.com
Abstract
The dominant sequence transduction models are based on complex recurrent or
convolutional neural networks that include an encoder and a decoder. The best
performing models also connect the encoder and decoder through an attention
mechanism. We propose a new simple network architecture, the Transformer,' metadata={'producer': 'pdfTeX-1.40.25', 'creator': 'LaTeX with hyperref', 'creationdate': '2023-08-03T00:07:29+00:00', 'author': '', 'keywords': '', 'moddate': '2023-08-03T00:07:29+00:00', 'ptex.fullbanner': 'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023) kpathsea version 6.3.5', 'subject': '', 'title': '', 'trapped': '/False', 'source': 'attention.pdf', 'total_pages': 15, 'page': 0, 'page_label': '1'}
```

`RecursiveCharacterTextSplitter` is the splitter to start with for ordinary text. It tries separators in order, `"\n\n"` (paragraphs), `"\n"` (lines), `" "` (words) and `""` (characters), and moves to the next only for pieces still longer than `chunk_size`. It then joins neighbouring pieces back up to `chunk_size`, so chunks end at the largest boundary that fits: a paragraph if possible, otherwise a line, otherwise a word. `chunk_size` counts characters (`len`), not tokens; the defaults are 4,000 and 200.

## Split a string, with overlap

```python title="Notebook cell"
speech = ""
with open("speech.txt") as f:
    speech = f.read()

text_splitter = RecursiveCharacterTextSplitter(chunk_size=100, chunk_overlap=20)
text = text_splitter.create_documents([speech])
print(text[0])
print(text[1])
```

```output real
page_content='The world must be made safe for democracy. Its peace must be planted upon the tested foundations of'
page_content='foundations of political liberty. We have no selfish ends to serve. We desire no conquest, no'
```

The second chunk begins with "foundations of", the last words of the first. `chunk_overlap=20` lets each chunk start with up to 20 characters from the end of the one before, in whole words, so a sentence cut at a chunk boundary still appears in full in one of them. Each chunk is a `Document`:

```python title="Notebook cell"
len(text), type(text[0])
```

```output real
(49, langchain_core.documents.base.Document)
```

::: visual chunk-overlap | Interactive figure | Chunks and overlap
Pick a splitter and its settings; each chunk is a band under the first two paragraphs of `speech.txt`.
:::

The splitters have three methods:

| Method | Takes | Returns |
|---|---|---|
| `split_documents(docs)` | A list of `Document`s | `Document`s, metadata copied from their source |
| `create_documents([text, ...])` | A list of strings | `Document`s with empty metadata (or `metadatas=[...]`) |
| `split_text(text)` | One string | A list of strings |

## Split on one separator only

```python title="Notebook cell"
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import CharacterTextSplitter

docs = TextLoader("speech.txt").load()

text_splitter = CharacterTextSplitter(separator="\n\n", chunk_size=100, chunk_overlap=20)
chunks = text_splitter.split_documents(docs)
[len(chunk.page_content) for chunk in chunks]
```

```output real
Created a chunk of size 470, which is longer than the specified 100
Created a chunk of size 347, which is longer than the specified 100
Created a chunk of size 668, which is longer than the specified 100
Created a chunk of size 982, which is longer than the specified 100
Created a chunk of size 789, which is longer than the specified 100
[470, 347, 1, 668, 982, 789, 355]
```

`CharacterTextSplitter` cuts only at its one separator, `"\n\n"` by default. A paragraph longer than `chunk_size` has nowhere to be cut, so it stays whole and the splitter logs a warning for it. The 1-character chunk is the paragraph `…` that marks a gap in the speech. Use this splitter when the separator itself is the boundary you want, for example one record per blank-line-separated block; otherwise use the recursive one.

Sizes are a trade-off: small chunks match a question precisely but carry little context, large ones carry context but cost more tokens and match less sharply. This module uses 500 characters with 50 of overlap for the paper, and 1,000 with 200 for web pages; check what the search returns and adjust.

Sizes count characters; in English, 1,000 characters are roughly 250 tokens **VERIFY**, so a 1,000-character chunk is a small part of any model's context window. Splitting along the document's own structure (next sections) or where the topic changes (semantic chunking, which uses an embedding model to find the shifts) are the next steps when fixed sizes cut badly **VERIFY**.

## Split by structure

The splitters above treat text as a sequence of characters. A web page or an API response has structure, headings or nested keys, and a chunk cut along that structure can say which section it came from.

:::: tabs
::: tab HTML
```python title="Notebook cell"
from langchain_text_splitters import HTMLHeaderTextSplitter

html_string = """
<!DOCTYPE html>
<html>
<body>
    <div>
        <h1>Foo</h1>
        <p>Some intro text about Foo.</p>
        <div>
            <h2>Bar main section</h2>
            <p>Some intro text about Bar.</p>
            <h3>Bar subsection 1</h3>
            <p>Some text about the first subtopic of Bar.</p>
            <h3>Bar subsection 2</h3>
            <p>Some text about the second subtopic of Bar.</p>
        </div>
        <div>
            <h2>Baz</h2>
            <p>Some text about Baz</p>
        </div>
        <br>
        <p>Some concluding text about Foo</p>
    </div>
</body>
</html>
"""

headers_to_split_on = [
    ("h1", "Header 1"),
    ("h2", "Header 2"),
    ("h3", "Header 3"),
]

html_splitter = HTMLHeaderTextSplitter(headers_to_split_on)
html_header_splits = html_splitter.split_text(html_string)
html_header_splits
```

```output real
[Document(metadata={'Header 1': 'Foo'}, page_content='Foo'),
 Document(metadata={'Header 1': 'Foo'}, page_content='Some intro text about Foo.'),
 Document(metadata={'Header 1': 'Foo', 'Header 2': 'Bar main section'}, page_content='Bar main section'),
 Document(metadata={'Header 1': 'Foo', 'Header 2': 'Bar main section'}, page_content='Some intro text about Bar.'),
 Document(metadata={'Header 1': 'Foo', 'Header 2': 'Bar main section', 'Header 3': 'Bar subsection 1'}, page_content='Bar subsection 1'),
 Document(metadata={'Header 1': 'Foo', 'Header 2': 'Bar main section', 'Header 3': 'Bar subsection 1'}, page_content='Some text about the first subtopic of Bar.'),
 Document(metadata={'Header 1': 'Foo', 'Header 2': 'Bar main section', 'Header 3': 'Bar subsection 2'}, page_content='Bar subsection 2'),
 Document(metadata={'Header 1': 'Foo', 'Header 2': 'Bar main section', 'Header 3': 'Bar subsection 2'}, page_content='Some text about the second subtopic of Bar.'),
 Document(metadata={'Header 1': 'Foo', 'Header 2': 'Baz'}, page_content='Baz'),
 Document(metadata={'Header 1': 'Foo'}, page_content='Some text about Baz  \nSome concluding text about Foo')]
```

Each pair in `headers_to_split_on` names a heading tag and the metadata key for its text. The splitter starts a new `Document` at each of those headings, the heading itself included, and every `Document` carries the headings above it: "Some text about the first subtopic of Bar." knows it sits under Foo, then Bar main section, then Bar subsection 1. A retriever that finds this chunk can show its section, and the headings can be used to filter results.

The last `Document` shows a quirk of the current version: "Some text about Baz" was joined with the closing paragraph under `Header 1` alone, so it lost its `Baz` heading. Check the splits of your own pages before relying on the metadata.

`split_text_from_url` downloads a page first:

```python title="Notebook cell" norun
url = "https://plato.stanford.edu/entries/goedel/"

headers_to_split_on = [
    ("h1", "Header 1"),
    ("h2", "Header 2"),
    ("h3", "Header 3"),
    ("h4", "Header 4"),
]
html_splitter = HTMLHeaderTextSplitter(headers_to_split_on)
html_header_splits = html_splitter.split_text_from_url(url)
len(html_header_splits)
```

```output saved note="from an earlier version of the splitter and of the page"
45
```

The Stanford Encyclopedia's article on Kurt Gödel becomes one `Document` per section, and a passage in section 2.1.2 carries `{'Header 1': 'Kurt Gödel', 'Header 2': '2. Gödel’s Mathematical Work', 'Header 3': '2.1 The Completeness Theorem', 'Header 4': '2.1.2 Proof of the Completeness Theorem'}`. Sections can still be long: split them again with `RecursiveCharacterTextSplitter`, whose `split_documents` keeps the metadata.
:::
::: tab JSON
```python title="Notebook cell" norun
import json
import requests

json_data = requests.get("https://api.smith.langchain.com/openapi.json").json()
list(json_data), len(json_data["paths"])
```

```output saved note="the API grows, so your count will be higher"
(['openapi', 'info', 'paths', 'components'], 129)
```

The OpenAPI description of LangSmith's REST API is one JSON object of about 300,000 characters: 129 endpoints under `paths`, and their data types under `components`.

```python title="Notebook cell" norun
from langchain_text_splitters import RecursiveJsonSplitter

json_splitter = RecursiveJsonSplitter(max_chunk_size=300)
json_chunks = json_splitter.split_json(json_data)
len(json_chunks)
```

```output saved
1001
```

```python title="Notebook cell" norun
for chunk in json_chunks[:3]:
    print(chunk)
```

```output saved
{'openapi': '3.1.0', 'info': {'title': 'LangSmith', 'version': '0.1.0'}, 'paths': {'/api/v1/sessions/{session_id}': {'get': {'tags': ['tracer-sessions'], 'summary': 'Read Tracer Session', 'description': 'Get a specific session.'}}}}
{'paths': {'/api/v1/sessions/{session_id}': {'get': {'operationId': 'read_tracer_session_api_v1_sessions__session_id__get', 'security': [{'API Key': []}, {'Tenant ID': []}, {'Bearer Auth': []}, {'API Key': []}]}}}}
{'paths': {'/api/v1/sessions/{session_id}': {'get': {'parameters': [{'name': 'session_id', 'in': 'path', 'required': True, 'schema': {'type': 'string', 'format': 'uuid', 'title': 'Session Id'}}, {'name': 'include_stats', 'in': 'query', 'required': False, 'schema': {'type': 'boolean', 'default': False, 'title': 'Include Stats'}}, {'name': 'accept', 'in': 'header', 'required': False, 'schema': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'title': 'Accept'}}]}}}}
```

The splitter walks the nested dicts depth first and starts a new chunk when the next value would push it past `max_chunk_size` characters, measured on the chunk as JSON text. Each chunk repeats the keys that lead to its values (`paths`, then the endpoint, then `get`), so it is valid JSON and still says what it describes. Nested dicts are kept whole when they fit, and chunks are at least `min_chunk_size` characters (100 here, 200 below the maximum by default). Lists and long strings are never cut, which is why the third chunk is longer than 300; `split_json(json_data, convert_lists=True)` turns lists into dicts with keys `"0"`, `"1"`, … so they can be split too **VERIFY**.

The same splitter returns `Document`s or strings:

```python title="Notebook cell" norun
## The splitter can also output documents
docs = json_splitter.create_documents(texts=[json_data])
for doc in docs[:3]:
    print(doc)
```

```output saved note="the third chunk is cut short here"
page_content='{"openapi": "3.1.0", "info": {"title": "LangSmith", "version": "0.1.0"}, "paths": {"/api/v1/sessions/{session_id}": {"get": {"tags": ["tracer-sessions"], "summary": "Read Tracer Session", "description": "Get a specific session."}}}}'
page_content='{"paths": {"/api/v1/sessions/{session_id}": {"get": {"operationId": "read_tracer_session_api_v1_sessions__session_id__get", "security": [{"API Key": []}, {"Tenant ID": []}, {"Bearer Auth": []}, {"API Key": []}]}}}}'
page_content='{"paths": {"/api/v1/sessions/{session_id}": {"get": {"parameters": [{"name": "session_id", "in": "path", "required": true, ...'
```

```python title="Notebook cell" norun
texts = json_splitter.split_text(json_data)
print(texts[0])
print(texts[1])
```

```output saved
{"openapi": "3.1.0", "info": {"title": "LangSmith", "version": "0.1.0"}, "paths": {"/api/v1/sessions/{session_id}": {"get": {"tags": ["tracer-sessions"], "summary": "Read Tracer Session", "description": "Get a specific session."}}}}
{"paths": {"/api/v1/sessions/{session_id}": {"get": {"operationId": "read_tracer_session_api_v1_sessions__session_id__get", "security": [{"API Key": []}, {"Tenant ID": []}, {"Bearer Auth": []}, {"API Key": []}]}}}}
```

| Method | Takes | Returns |
|---|---|---|
| `split_json(json_data)` | A dict | A list of dicts |
| `create_documents(texts=[json_data])` | A list of dicts | `Document`s holding JSON text |
| `split_text(json_data)` | A dict | A list of JSON strings |

The names match the character splitters' methods above, but here `texts` holds dicts, not strings. Documents and strings hold JSON text (`true`, double quotes); `split_json` returns Python dicts (`True`, single quotes when printed).
:::
::::

## Practice

::: practice
**Compare chunk sizes.** Split `speech.txt` with the recursive splitter at chunk sizes 100, 300 and 1,000 (overlap 20 each) and print, for each size, the number of chunks and the length of the longest.

```python title="Notebook cell"
for size in (100, 300, 1000):
    splitter = RecursiveCharacterTextSplitter(chunk_size=size, chunk_overlap=20)
    pieces = splitter.split_text(speech)
    print(size, len(pieces), max(len(piece) for piece in pieces))
```

```output real
100 49 99
300 17 299
1000 5 982
```

No chunk exceeds its size: the recursive splitter can always fall back to a smaller separator. At 1,000, whole paragraphs fit, so most chunks are paragraphs.
:::

::: practice
**Find the overlap.** Print the text that `text[0]` and `text[1]` share: the longest end of the first chunk that is also the start of the second.

```python title="Notebook cell"
a, b = text[0].page_content, text[1].page_content
shared = next(a[i:] for i in range(len(a) + 1) if b.startswith(a[i:]))
shared, len(shared)
```

```output real
('foundations of', 14)
```

The loop tries the longest ends first, so the first match is the longest. The empty string (at `i = len(a)`) always matches, which keeps `next()` from failing when two chunks share nothing.
:::

::: practice
**Your own page.** Split this HTML at `h1` and `h2` and print each chunk's metadata next to its text.

```python title="Notebook cell"
html = """
<h1>Agents</h1>
<p>An agent calls tools in a loop until the task is done.</p>
<h2>Tools</h2>
<p>A tool is a function the model can ask to run.</p>
<h2>Memory</h2>
<p>Memory keeps the conversation between turns.</p>
"""
splitter = HTMLHeaderTextSplitter([("h1", "Header 1"), ("h2", "Header 2")])
for doc in splitter.split_text(html):
    print(doc.metadata, "|", doc.page_content)
```

```output real
{'Header 1': 'Agents'} | Agents
{'Header 1': 'Agents'} | An agent calls tools in a loop until the task is done.
{'Header 1': 'Agents', 'Header 2': 'Tools'} | Tools
{'Header 1': 'Agents', 'Header 2': 'Tools'} | A tool is a function the model can ask to run.
{'Header 1': 'Agents', 'Header 2': 'Memory'} | Memory
{'Header 1': 'Agents', 'Header 2': 'Memory'} | Memory keeps the conversation between turns.
```

Each heading is a `Document` of its own, and the `h2` sections inherit `Header 1` from the `h1` above them.
:::

::: practice
**Split a config.** Split this agent configuration with `max_chunk_size=100` and print each chunk with its length as JSON text.

```python title="Notebook cell"
import json
from langchain_text_splitters import RecursiveJsonSplitter

config = {
    "agent": {"name": "support-bot", "model": "gpt-4o", "temperature": 0},
    "tools": {
        "search": {"description": "Search the help centre", "max_results": 5},
        "ticket": {"description": "Open a support ticket", "fields": {"title": "str", "body": "str"}},
    },
}
splitter = RecursiveJsonSplitter(max_chunk_size=100)
for chunk in splitter.split_json(config):
    print(len(json.dumps(chunk)), chunk)
```

```output real
71 {'agent': {'name': 'support-bot', 'model': 'gpt-4o', 'temperature': 0}}
82 {'tools': {'search': {'description': 'Search the help centre', 'max_results': 5}}}
63 {'tools': {'ticket': {'description': 'Open a support ticket'}}}
66 {'tools': {'ticket': {'fields': {'title': 'str', 'body': 'str'}}}}
```

Every chunk keeps the keys above its values. The ticket tool doesn't fit in 100 characters, so its description and its fields went to two chunks, both still under `tools`, then `ticket`.
:::
