+++
number = "16.2"
title = "Index a document with PageIndex"
lede = "Upload a PDF to PageIndex and get back its tree: sections with page ranges, text and summaries. Read the tree, print it, and build the same tree on your own machine, with a model or without one."
summary = "Install PageIndex, load the keys, create the clients, upload a PDF and wait for its tree, fetch and read the tree, print and count its nodes, build it locally with the open-source script or the SDK, build its structure with no model at all, and two practice tasks."
type = "concept"
status = "published"
source = "16 Vectorless RAG: PageIndex_Vectorless_RAG_CrashCourse.ipynb (cells 2-13 and 33-37; attention.pdf instead of the original PDF, the key read from .env, page_index renamed start_index, the command line and the JSON loading fixed); the SDK's local mode, PageIndex Flash and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
data = ["attention.pdf", "attention_tree.json"]
+++

Vectorless RAG starts like any RAG app: the document is indexed once, before any question ([lesson 16.1](lesson:16.1)). PageIndex does that in its cloud. You upload a PDF, wait while it works out the sections and writes a summary of each, and fetch the result: a tree. The same tree can also be built on your own machine. This lesson indexes [attention.pdf](data/attention.pdf), "Attention Is All You Need", the paper [lesson 6.8](lesson:6.8) answered questions about with a vector store.

## Install the packages

Add two lines to `requirements.txt` and run your install command again ([lesson 0.1](lesson:0.1)):

```text title="requirements.txt"
pageindex
openai
```

`pageindex` is PageIndex's SDK: the cloud client and, since August 2026, the open-source indexer that runs on your machine. `openai` is OpenAI's own SDK, which [lesson 16.3](lesson:16.3) calls directly; `langchain-openai` ([lesson 6.1](lesson:6.1)) already installs it, and listing it names a package your code imports.

## Load the keys

The cloud needs `PAGEINDEX_API_KEY`, created at [dash.pageindex.ai/api-keys](https://dash.pageindex.ai/api-keys), and lesson 16.3's model calls need `OPENAI_API_KEY`. Put both in `.env` ([lesson 0.3](lesson:0.3)).

```python title="Notebook cell" norun
import os, json, time
from dotenv import load_dotenv

load_dotenv()

PAGEINDEX_API_KEY = os.getenv("PAGEINDEX_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

print("PageIndex key loaded:", "set" if PAGEINDEX_API_KEY else "missing")
print("OpenAI key loaded:   ", "set" if OPENAI_API_KEY else "missing")
```

```output illustrative note="with both keys in .env"
PageIndex key loaded: set
OpenAI key loaded:    set
```

Read the PageIndex key from the environment like every other key; examples that paste it into the code leak it with the notebook.

## Create the clients

```python title="Notebook cell" norun
from pageindex import PageIndexClient
from openai import OpenAI

pi_client = PageIndexClient(api_key=PAGEINDEX_API_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

print("PageIndex client ready")
print("OpenAI client ready")
```

```output saved note="emojis removed"
PageIndex client ready
OpenAI client ready
```

With an API key, `PageIndexClient` keeps your documents in your PageIndex cloud account. Without one it quietly becomes a local client (the last section of this lesson), so a missing `PAGEINDEX_API_KEY` raises no error here; `PageIndexClient(index="cloud")`, the newer spelling, reads the key itself and fails at once when it is missing. The OpenAI client, which lesson 16.3 uses, does fail at once: `OpenAIError: Missing credentials`.

## Upload a PDF

```python title="Notebook cell" norun
# Replace with the path to your PDF file
# Good candidates: annual reports, research papers, legal documents, textbooks

PDF_PATH = "./attention.pdf"

print(f"Uploading: {PDF_PATH}")
result = pi_client.submit_document(PDF_PATH)
doc_id = result["doc_id"]

print("Uploaded!")
print(f"Document ID: {doc_id}")
print("   (Save this ID: you'll use it throughout the notebook)")
```

```output illustrative
Uploading: ./attention.pdf
Uploaded!
Document ID: pi-cmh0q3d2x00c9k1s7r5wybn4e
   (Save this ID: you'll use it throughout the notebook)
```

`submit_document` uploads the file and returns at once with the `doc_id` and the stored name; PageIndex builds the tree in the background. The cloud takes PDF, PowerPoint and Word files. Every later call names the document by its ID, and `pi_client.list_documents()` finds it again in a later session.

## Wait for the tree

```python title="Notebook cell" norun
# PageIndex builds the tree asynchronously.
# For a 50-page PDF this typically takes 30-90 seconds.

print("Building tree index...")
print("   (This runs once per document: the index is cached for reuse)")

while True:
    status_result = pi_client.get_document(doc_id)
    status = status_result.get("status")
    print(f"   Status: {status}")

    if status == "completed":
        print("\nTree index ready!")
        break
    elif status == "failed":
        print("\nProcessing failed. Check your PDF format.")
        break

    time.sleep(5)
```

```output illustrative note="the number of polls varies"
Building tree index...
   (This runs once per document: the index is cached for reuse)
   Status: processing
   Status: processing
   Status: completed

Tree index ready!
```

`get_document` returns the document's metadata: its name, page count and `status`, which is `queued`, `processing`, `completed` or `failed`. The loop asks every five seconds. In pageindex 0.5, `pi_client.submit_document(PDF_PATH, wait=True)` does the waiting itself, polling less and less often and raising an error if processing fails or takes more than 30 minutes.

## Fetch the tree

```python title="Notebook cell" norun
tree_result = pi_client.get_tree(doc_id, node_summary=True)
pageindex_tree = tree_result.get("result", [])
```

`get_tree` returns the processing status and, under `result`, the tree as a list of top-level nodes; `node_summary=True` adds each node's summary. Save it, so a later session and the script of [lesson 16.3](lesson:16.3) don't need the cloud:

```python title="Notebook cell" norun
with open("attention_tree.json", "w") as f:
    json.dump(pageindex_tree, f, indent=2)
```

To run the rest of this lesson and the next without keys, download [attention_tree.json](data/attention_tree.json), a tree of the same paper built with PageIndex's open-source indexer (the last section shows how), and load it instead of calling the cloud:

```python title="Notebook cell"
import json

with open("attention_tree.json", encoding="utf-8") as f:
    pageindex_tree = json.load(f)
```

## Read a node

```python title="Notebook cell"
print(f"Top-level sections: {len(pageindex_tree)}")
print("\nRaw tree (first node):")
first = pageindex_tree[0] if pageindex_tree else {}
print(json.dumps({**first, "text": first.get("text", "")[:200] + " ..."}, indent=2))  # text cut short to print
```

```output real
Top-level sections: 9

Raw tree (first node):
{
  "title": "Abstract",
  "node_id": "0000",
  "start_index": 1,
  "end_index": 1,
  "text": "Provided proper attribution is provided, Google hereby grants permission to\nreproduce the tables and figures in this paper solely for use in journalistic or\nscholarly works.\nAttention Is All You Need\n ..."
}
```

A node carries its `title`, its `node_id`, its first and last page as `start_index` and `end_index`, its `text` (here the text of its pages), its subsections under `nodes` when it has any and, from the cloud with `node_summary=True`, a `summary`. The downloaded tree was built without a model, so it has no summaries.

pageindex 0.5 calls the first page `start_index`. Older versions, and code written for them, use `page_index`, which now comes back missing: `node.get("page_index", "?")` gives `?` for every node, and answers cite page `?`. The code in these lessons reads `start_index`.

## Print the tree

```python title="Notebook cell"
def print_tree(nodes, indent=0):
    """Recursively print tree titles for a visual overview."""
    for node in nodes:
        prefix = "  " * indent + ("└─ " if indent > 0 else "")
        page = node.get("start_index", "?")
        print(f"{prefix}[{node['node_id']}] {node['title']}  (p.{page})")
        if node.get("nodes"):
            print_tree(node["nodes"], indent + 1)


print("Full Document Structure:\n")
print_tree(pageindex_tree)
```

```output real
Full Document Structure:

[0000] Abstract  (p.1)
[0001] 1 Introduction  (p.2)
[0002] 2 Background  (p.2)
[0003] 3 Model Architecture  (p.2)
  └─ [0004] 3 Model Architecture (intro)  (p.2)
  └─ [0005] 3.1 Encoder and Decoder Stacks  (p.3)
  └─ [0006] 3.2 Attention  (p.3)
    └─ [0007] 3.2 Attention (intro)  (p.3)
    └─ [0008] 3.2.1 Scaled Dot-Product Attention  (p.4)
    └─ [0009] 3.2.2 Multi-Head Attention  (p.4)
    └─ [0010] 3.2.3 Applications of Attention in our Model  (p.5)
  └─ [0011] 3.3 Position-wise Feed-Forward Networks  (p.5)
  └─ [0012] 3.4 Embeddings and Softmax  (p.5)
  └─ [0013] 3.5 Positional Encoding  (p.6)
[0014] 4 Why Self-Attention  (p.6)
[0015] 5 Training  (p.7)
  └─ [0016] 5.1 Training Data and Batching  (p.7)
  └─ [0017] 5.2 Hardware and Schedule  (p.7)
  └─ [0018] 5.3 Optimizer  (p.7)
  └─ [0019] 5.4 Regularization  (p.7)
[0020] 6 Results  (p.8)
  └─ [0021] 6.1 Machine Translation  (p.8)
  └─ [0022] 6.2 Model Variations  (p.8)
  └─ [0023] 6.3 English Constituency Parsing  (p.9)
[0024] 7 Conclusion  (p.10)
[0025] References  (p.10)
```

This is what the search of lesson 16.3 reasons over: nine top-level nodes (the abstract, the seven sections and the references) and their subsections. A parent's opening pages, the text before its first subsection, become a child named "(intro)", so every page of text sits in a leaf: "3 Model Architecture" has no text of its own, and "3 Model Architecture (intro)" holds pages 2 and 3. Neighbouring sections share a page when one ends where the next begins.

## Count the nodes

```python title="Notebook cell"
def count_nodes(nodes):
    total = len(nodes)
    for n in nodes:
        if n.get("nodes"):
            total += count_nodes(n["nodes"])
    return total


total = count_nodes(pageindex_tree)
print(f"Total nodes in tree: {total}")
print("   Each node = one retrievable section of the document")
```

```output real
Total nodes in tree: 26
   Each node = one retrievable section of the document
```

Both functions walk the tree the same way: handle each node, then call themselves on its `nodes`. Lesson 16.3's `find_nodes_by_ids` is a third walk of the same shape.

## Build the tree on your own machine

The indexer behind the cloud is open source, so documents can stay on your machine: for private documents, or to see and change how trees are built. It still needs a model for the summaries, and in its standard mode for the structure too, so it reads `OPENAI_API_KEY`.

:::: tabs
::: tab run_pageindex.py
Clone the repository and install its requirements:

```zsh title="Terminal" norun
git clone https://github.com/VectifyAI/PageIndex.git
cd PageIndex
pip install -r requirements.txt
```

Build the tree:

```zsh title="Terminal" norun
python run_pageindex.py --pdf_path ../attention.pdf --mode standard \
    --model gpt-4o-2024-11-20 \
    --toc-check-pages 20 \
    --max-pages-per-node 10 \
    --if-add-node-summary yes \
    --if-add-node-text yes
```

```output illustrative note="progress lines trimmed"
Parsing PDF...
Parsing done, saving to file...
Tree structure saved to: ./results/attention_structure.json
```

`--toc-check-pages` is how many pages to scan for a table of contents, `--max-pages-per-node` the size at which a section is split further, and `--if-add-node-summary yes` asks for a summary per node (on Windows, type the command on one line, without the backslashes). Two flags are needed today that older instructions leave out. The script now builds trees with Flash by default, which refuses the other flags (`ValueError: --toc-check-pages is not supported in flash mode; use --mode standard`), so `--mode standard` selects the model-built tree. And standard mode leaves each node's text out unless `--if-add-node-text yes` asks for it; without the text, every answer in lesson 16.3 would read "Content not available." The script reads `OPENAI_API_KEY` and finds the project's `.env` from the folder it runs in; older versions read `CHATGPT_API_KEY` from a `.env` inside the clone, a name that still works with a deprecation warning. `--model` is the older name of `--index-model`. OpenAI shuts `gpt-4o-2024-11-20` down on 14 January 2027 and names `gpt-6-luna` as its replacement.

Load the result:

```python title="Notebook cell" norun
TREE_JSON_PATH = "PageIndex/results/attention_structure.json"

with open(TREE_JSON_PATH, "r") as f:
    local_tree = json.load(f)["structure"]

print(f"Local tree loaded: {count_nodes(local_tree)} total nodes")
print_tree(local_tree)
```

The file holds the document's name and, under `"structure"`, the tree. Counting the whole file instead fails with `AttributeError: 'str' object has no attribute 'get'`: the loop walks the dict's keys, which are strings.
:::
::: tab Python SDK
```python title="Notebook cell" norun
local_client = PageIndexClient()  # no api_key: indexed and stored on this machine

doc_id = local_client.submit_document("attention.pdf")["doc_id"]
local_tree = local_client.get_tree(doc_id, node_summary=True)["result"]
print_tree(local_tree)
```

Since August 2026 the `pageindex` package contains the open-source indexer, so no clone is needed. A client without an API key indexes during `submit_document` itself, so there is nothing to poll, with Flash by default (`mode="standard"` for the model-built tree). It stores documents under `./.pageindex` and answers the same calls as the cloud: `get_tree`, `get_document`, `list_documents`, `delete_document`. It uses the SDK's default models with your OpenAI key; `PageIndexClient(index="...")` names another model.
:::
::::

### With no model at all

Flash takes the structure from the layout: font sizes, section numbers, bookmarks. With the summaries and its model pass turned off, it needs no key at all:

```python title="Notebook cell"
from pageindex import page_index_flash

result = page_index_flash("attention.pdf", summary=False, optimize=False, use_embedded_toc=False)
print(result["toc_source"])
print_tree(result["structure"])
```

```output real
detected
[0000] Abstract  (p.1)
[0001] 1 Introduction  (p.2)
[0002] 2 Background  (p.2)
[0003] 3 Model Architecture  (p.2)
  └─ [0004] 3 Model Architecture (intro)  (p.2)
  └─ [0005] 3.1 Encoder and Decoder Stacks  (p.3)
  └─ [0006] 3.2 Attention  (p.3)
    └─ [0007] 3.2 Attention (intro)  (p.3)
    └─ [0008] 3.2.1 Scaled Dot-Product Attention  (p.4)
    └─ [0009] 3.2.2 Multi-Head Attention  (p.4)
    └─ [0010] 3.2.3 Applications of Attention in our Model  (p.5)
  └─ [0011] 3.3 Position-wise Feed-Forward Networks  (p.5)
  └─ [0012] 3.4 Embeddings and Softmax  (p.5)
  └─ [0013] 3.5 Positional Encoding  (p.6)
[0014] 4 Why Self-Attention  (p.6)
[0015] 5 Training  (p.7)
  └─ [0016] 5.1 Training Data and Batching  (p.7)
  └─ [0017] 5.2 Hardware and Schedule  (p.7)
  └─ [0018] 5.3 Optimizer  (p.7)
  └─ [0019] 5.4 Regularization  (p.7)
[0020] 6 Results  (p.8)
  └─ [0021] 6.1 Machine Translation  (p.8)
  └─ [0022] 6.2 Model Variations  (p.8)
  └─ [0023] 6.3 English Constituency Parsing  (p.9)
[0024] 7 Conclusion  (p.10)
[0025] References  (p.10)
```

`toc_source` says where the structure came from: `detected`, from the headings found in the text. This is the structure of the downloaded tree; the local client adds each node's text from its pages, and summaries when a model is configured.

`use_embedded_toc=False` matters for this paper. By default Flash also reads the PDF's bookmarks, which here carry the section titles without their numbers, and merges the two:

```python title="Notebook cell"
default = page_index_flash("attention.pdf", summary=False, optimize=False)
print(default["toc_source"])
print_tree(default["structure"][3:4])
```

```output real
bookmarks
[0003] Model Architecture  (p.2)
  └─ [0004] 1 Introduction  (p.2)
  └─ [0005] 2 Background  (p.2)
  └─ [0006] Encoder and Decoder Stacks  (p.3)
  └─ [0007] Attention  (p.3)
    └─ [0008] 3.1 Encoder and Decoder Stacks  (p.3)
    └─ [0009] Scaled Dot-Product Attention  (p.4)
    └─ [0010] Multi-Head Attention  (p.4)
      └─ [0011] 3.2.1 Scaled Dot-Product Attention  (p.4)
    └─ [0012] Applications of Attention in our Model  (p.5)
  └─ [0013] Position-wise Feed-Forward Networks  (p.5)
  └─ [0014] Embeddings and Softmax  (p.5)
    └─ [0015] 3.2.3 Applications of Attention in our Model  (p.5)
    └─ [0016] 3.3 Position-wise Feed-Forward Networks  (p.5)
  └─ [0017] Positional Encoding  (p.6)
```

"1 Introduction" and "2 Background" now sit inside "Model Architecture", and several sections appear twice, with and without their numbers. A search over this tree would open and cite the wrong sections. Whichever tool builds your trees, print a few before you index many documents the same way.

## Practice

::: practice
**Breadcrumbs.** Write `node_path(nodes, node_id)` that returns the titles from the top of the tree down to that node, or an empty list when the ID isn't in the tree. Print the paths of nodes `0009` and `0017`, and of an ID that doesn't exist.

```python title="Notebook cell"
def node_path(nodes, node_id, path=()):
    for node in nodes:
        here = path + (node["title"],)
        if node["node_id"] == node_id:
            return list(here)
        found = node_path(node.get("nodes", []), node_id, here)
        if found:
            return found
    return []


for node_id in ["0009", "0017", "0042"]:
    print(node_id, " > ".join(node_path(pageindex_tree, node_id)) or "not in the tree")
```

```output real
0009 3 Model Architecture > 3.2 Attention > 3.2.2 Multi-Head Attention
0017 5 Training > 5.2 Hardware and Schedule
0042 not in the tree
```

The path travels down the recursion as a tuple, so each branch extends its own copy and a dead end leaves nothing to undo. A path gives a chosen section its context: put it above the section's text in the answer prompt, or in the citation.
:::

::: practice
**Sections on a page.** Write `nodes_on_page(nodes, page)` that lists the leaves (nodes without subsections) whose pages include `page`. Try pages 4 and 7.

```python title="Notebook cell"
def nodes_on_page(nodes, page):
    found = []
    for node in nodes:
        if node.get("nodes"):
            found += nodes_on_page(node["nodes"], page)
        elif node["start_index"] <= page <= node["end_index"]:
            found.append(f"{node['node_id']} {node['title']}")
    return found


for page in [4, 7]:
    print(page, nodes_on_page(pageindex_tree, page))
```

```output real
4 ['0007 3.2 Attention (intro)', '0008 3.2.1 Scaled Dot-Product Attention', '0009 3.2.2 Multi-Head Attention']
7 ['0014 4 Why Self-Attention', '0016 5.1 Training Data and Batching', '0017 5.2 Hardware and Schedule', '0018 5.3 Optimizer', '0019 5.4 Regularization']
```

Page 7 belongs to five sections, which is why answers that cite a page alone are vague. The function also maps the other way: a vector hit carries its page number ([lesson 6.4](lesson:6.4)), and this tells you which sections it came from, one of the hybrid designs of [lesson 16.1](lesson:16.1).
:::
