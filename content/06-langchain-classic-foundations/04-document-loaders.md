+++
number = "6.4"
title = "Document loaders"
lede = "A loader reads a source, such as a text file, a PDF, a web page, an arXiv paper or a Wikipedia article, and returns a list of Document objects: the text plus metadata about where it came from."
summary = "Load text files, PDFs, web pages, arXiv papers and Wikipedia articles into Documents, and read their page_content and metadata."
type = "concept"
status = "published"
source = "4 Langchain: 3.2-DataIngestion/3.2-DataIngestion.ipynb"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
data = ["speech.txt", "attention.pdf"]
+++

Every retrieval app starts by getting text in. LangChain has loaders for hundreds of sources, and they all return the same thing, a list of `Document` objects, so the splitters, embeddings and vector stores of the next lessons work with any of them.

Download [speech.txt](data/speech.txt), the opening of President Wilson's 1917 address to Congress, and [attention.pdf](data/attention.pdf), "Attention Is All You Need", the paper that introduced the Transformer (also on arXiv as 1706.03762), into your project folder.

## Load documents

Five loaders, five kinds of source. The first two read the files from the downloads above; the other three read from the internet. All five return the same thing.

:::: tabs
::: tab Text file
```python title="Notebook cell"
from langchain_community.document_loaders import TextLoader

loader = TextLoader("speech.txt")
text_documents = loader.load()
print(len(text_documents))
print(text_documents[0].metadata)
print(text_documents[0].page_content[:200])
```

```output real
DeprecationWarning: `langchain-community` is being sunset and is no longer actively maintained. See https://github.com/langchain-ai/langchain-community/issues/674 for details and migration guidance toward standalone integration packages.
1
{'source': 'speech.txt'}
The world must be made safe for democracy. Its peace must be planted upon the tested foundations of political liberty. We have no selfish ends to serve. We desire no conquest, no dominion. We seek no
```

`load()` returns a list; a text file gives one `Document`, with the file's name as its `source`.
:::
::: tab PDF
```python title="Notebook cell"
from langchain_community.document_loaders import PyPDFLoader

loader = PyPDFLoader("attention.pdf")
docs = loader.load()
len(docs)
```

```output real
15
```

`PyPDFLoader` (it uses the `pypdf` package) returns one `Document` per page:

```python title="Notebook cell"
docs[0].metadata
```

```output real
{'producer': 'pdfTeX-1.40.25',
 'creator': 'LaTeX with hyperref',
 'creationdate': '2023-08-03T00:07:29+00:00',
 'author': '',
 'keywords': '',
 'moddate': '2023-08-03T00:07:29+00:00',
 'ptex.fullbanner': 'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023) kpathsea version 6.3.5',
 'subject': '',
 'title': '',
 'trapped': '/False',
 'source': 'attention.pdf',
 'total_pages': 15,
 'page': 0,
 'page_label': '1'}
```

`page` counts from 0; `page_label` is the number printed on the page; the rest comes from the PDF's own properties. Every loader returns the same class:

```python title="Notebook cell"
type(docs[0])
```

```output real
langchain_core.documents.base.Document
```
:::
::: tab Web page
```python title="Notebook cell" norun
from langchain_community.document_loaders import WebBaseLoader
import bs4

loader = WebBaseLoader(
    web_paths=("https://lilianweng.github.io/posts/2023-06-23-agent/",),
    bs_kwargs=dict(parse_only=bs4.SoupStrainer(
        class_=("post-title", "post-content", "post-header")
    )),
)
docs = loader.load()
print(len(docs[0].page_content))
print(docs[0].page_content.strip()[:200])
```

```output saved
43047
LLM Powered Autonomous Agents
    
Date: June 23, 2023  |  Estimated Reading Time: 31 min  |  Author: Lilian Weng

Building agents with LLM (large language model) as its core controller is a cool con
```

`WebBaseLoader` downloads each address in `web_paths` and extracts the text with BeautifulSoup ([lesson 2.10](lesson:2.10)). `bs_kwargs` goes to BeautifulSoup: a `SoupStrainer` keeps only the elements with these CSS classes (the post's title, header and body), so menus and footers stay out of the text. Find the class names with your browser's Inspect tool.

Importing `WebBaseLoader` logs "USER_AGENT environment variable not set": sites see requests without a name, and some refuse them. A line such as `USER_AGENT=my-rag-app/0.1` in `.env` names your requests, as long as `load_dotenv()` runs before the import **VERIFY**.
:::
::: tab arXiv
```python title="Notebook cell" norun
from langchain_community.document_loaders import ArxivLoader

docs = ArxivLoader(query="1706.03762", load_max_docs=2).load()
len(docs), docs[0].metadata["Title"], docs[0].metadata["Published"]
```

```output saved
(1, 'Attention Is All You Need', '2023-08-02')
```

`query` takes an arXiv ID, as here, or search words; `load_max_docs` caps the number of papers. The loader downloads each PDF and reads the text with PyMuPDF (the `pymupdf` package). Metadata holds `Published`, `Title`, `Authors` and `Summary` (the abstract). It needs `arxiv` below version 4, as pinned in [lesson 6.1](lesson:6.1): version 4 removed a function the loader calls, and the error reads `'Search' object has no attribute 'results'`.
:::
::: tab Wikipedia
```python title="Notebook cell" norun
from langchain_community.document_loaders import WikipediaLoader

docs = WikipediaLoader(query="Generative AI", load_max_docs=2).load()
len(docs), docs[0].metadata["title"], len(docs[0].page_content)
```

```output saved
(2, 'Generative AI', 4000)
```

`WikipediaLoader` searches Wikipedia and loads up to `load_max_docs` articles (default 25), best match first. Each text is cut at `doc_content_chars_max` characters, 4,000 by default; metadata holds `title`, `summary` and `source`, the article's address.
:::
::::

## What a loader returns

Every loader returns a list of `Document` objects, each with two attributes:

| Attribute | Holds |
|---|---|
| `page_content` | The text, as a string |
| `metadata` | A dict about the text: at least its `source`; loaders add more, such as page numbers |

Metadata travels with the text through splitting and search, so an answer can say where it came from (the script of [lesson 6.8](lesson:6.8) prints them).

| Loader | Reads | One `Document` per | Package it uses |
|---|---|---|---|
| `TextLoader` | A text file | File | - |
| `PyPDFLoader` | A PDF | Page | `pypdf` |
| `WebBaseLoader` | Web pages | Address | `beautifulsoup4` |
| `ArxivLoader` | arXiv papers | Paper | `arxiv`, `pymupdf` |
| `WikipediaLoader` | Wikipedia articles | Article | `wikipedia` |

::: note langchain-community is being sunset
LangChain stopped maintaining `langchain-community` in May 2026 and archived its repository in June: it gets no more fixes, and importing it prints the `DeprecationWarning` in the first output above. Its loaders still work, so this module uses them. For new code, prefer a standalone integration package where one exists, listed on LangChain's integrations page; most model providers and databases have one, such as `langchain-openai` and `langchain-chroma`. Where none exists, read the source with its own library and build the `Document`s yourself: `Document` belongs to `langchain-core`, which is maintained.

```python title="Notebook cell"
from pypdf import PdfReader
from langchain_core.documents import Document

reader = PdfReader("attention.pdf")
pages = [
    Document(page_content=page.extract_text(), metadata={"source": "attention.pdf", "page": i})
    for i, page in enumerate(reader.pages)
]
len(pages), pages[0].metadata
```

```output real
(15, {'source': 'attention.pdf', 'page': 0})
```
:::

## What loaders don't do

A loader extracts text; it doesn't check it. `PyPDFLoader` reads a PDF's text layer, so a scanned PDF without one loads as empty pages and needs text recognition (OCR) first, and tables or columns come out as plain lines, as on the paper's first page above. Look at `page_content` before indexing: text the loader misses, retrieval can never find.

## Practice

::: practice
**Find a section in the PDF.** Load `attention.pdf` and print the `page` and `page_label` of the first page that mentions "Scaled Dot-Product Attention".

```python title="Notebook cell"
pages = PyPDFLoader("attention.pdf").load()
first = next(doc for doc in pages if "Scaled Dot-Product Attention" in doc.page_content)
first.metadata["page"], first.metadata["page_label"]
```

```output real
(3, '4')
```

`next()` with a generator expression stops at the first match ([lesson 2.7](lesson:2.7)). Page 3, counted from 0, is the fourth page, printed as 4.
:::

::: practice
**Only the title.** Load the same blog post, keeping only the element with the class `post-title`.

```python title="Notebook cell" norun
loader = WebBaseLoader(
    web_paths=("https://lilianweng.github.io/posts/2023-06-23-agent/",),
    bs_kwargs=dict(parse_only=bs4.SoupStrainer(class_="post-title")),
)
loader.load()[0].page_content.strip()
```

```output illustrative
'LLM Powered Autonomous Agents'
```

`class_` takes one class name or a tuple of them. `strip()` removes the blank lines and spaces around the title.
:::
