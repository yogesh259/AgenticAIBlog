+++
number = "6.7"
title = "Vector stores: FAISS and Chroma"
lede = "A vector store keeps each chunk next to its embedding and finds the chunks nearest to a question's embedding. FAISS does it in memory and saves to files; Chroma is a small database that writes to disk as you add."
summary = "Build FAISS and Chroma stores from chunks, search them with and without scores, use them as retrievers, save and reopen them, then see how vector search works inside and how to choose a store."
type = "concept"
status = "published"
source = "4 Langchain: 5-VectorStore/5.1-Faiss.ipynb, 5.2-Chroma.ipynb; 4-Embeddings/4.1-embedding.ipynb (cells 11-14)"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
data = ["speech.txt"]
+++

A vector store keeps each chunk with its embedding and answers one question fast: which stored vectors are nearest to this one? This lesson uses two. FAISS (Facebook AI Similarity Search) is a library from Meta that keeps the index in memory and saves it to files. Chroma is a small open-source database that keeps chunks, metadata and vectors together and writes them to disk as they are added. LangChain gives both the same methods, so each tab below shows the same step for one store. The code embeds with a local Ollama model ([lesson 6.2](lesson:6.2)), so it needs no key, and reads [speech.txt](data/speech.txt).

## Build a store and search it

:::: tabs
::: tab FAISS
```python title="Notebook cell"
from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import OllamaEmbeddings
from langchain_text_splitters import CharacterTextSplitter

loader = TextLoader("speech.txt")
documents = loader.load()
text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=30)
docs = text_splitter.split_documents(documents)
[len(doc.page_content) for doc in docs]
```

```output real
DeprecationWarning: `langchain-community` is being sunset and is no longer actively maintained. See https://github.com/langchain-ai/langchain-community/issues/674 for details and migration guidance toward standalone integration packages.
[822, 671, 982, 789, 355]
```

The speech splits at its blank lines into five chunks of up to 1,000 characters ([lesson 6.5](lesson:6.5)).

```python title="Notebook cell" norun
embeddings = OllamaEmbeddings()
db = FAISS.from_documents(docs, embeddings)
```

`from_documents` calls `embed_documents` once for all chunks and stores each vector with its chunk and metadata ([lesson 6.6](lesson:6.6)). `OllamaEmbeddings()` without a model uses `llama2`: run `ollama pull llama2` first, or pass an embedding model such as `model="mxbai-embed-large"`.

```python title="Notebook cell" norun
### querying
query = "How does the speaker describe the desired outcome of the war?"
docs = db.similarity_search(query)
docs[0].page_content
```

```output saved
'It is a distressing and oppressive duty, gentlemen of the Congress, which I have performed in thus addressing you. There are, it may be, many months of fiery trial and sacrifice ahead of us. It is a fearful thing to lead this great peaceful people into war, into the most terrible and disastrous of all wars, civilization itself seeming to be in the balance. But the right is more precious than peace, and we shall fight for the things which we have always carried nearest our hearts—for democracy, for the right of those who submit to authority to have a voice in their own governments, for the rights and liberties of small nations, for a universal dominion of right by such a concert of free peoples as shall bring peace and safety to all nations and make the world itself at last free.'
```

`similarity_search` embeds the query with `embed_query` and returns the 4 nearest chunks, nearest first; `k=2` returns two. The best match shares almost no words with the question ("outcome" never appears); it describes the peace the war should bring.
:::
::: tab Chroma
```python title="Notebook cell"
## building a sample vectordb
from langchain_chroma import Chroma
from langchain_community.document_loaders import TextLoader
from langchain_community.embeddings import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

loader = TextLoader("speech.txt")
data = loader.load()

# Split
text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=0)
splits = text_splitter.split_documents(data)
len(splits)
```

```output real
9
```

```python title="Notebook cell" norun
embedding = OllamaEmbeddings()
vectordb = Chroma.from_documents(documents=splits, embedding=embedding)

## query it
query = "What does the speaker believe is the main reason the United States should enter the war?"
docs = vectordb.similarity_search(query)
docs[0].page_content
```

```output saved
'To such a task we can dedicate our lives and our fortunes, everything that we are and everything that we have, with the pride of those who know that the day has come when America is privileged to spend her blood and her might for the principles that gave her birth and happiness and the peace which she has treasured. God helping her, she can do no other.'
```

Without a folder, the database lives in memory and disappears when the notebook stops. Chunks go into a collection named `langchain` unless you pass `collection_name=`. Any embeddings object works: [lesson 6.6](lesson:6.6)'s `OpenAIEmbeddings(model="text-embedding-3-large", dimensions=1024)` too.

Import `Chroma` from `langchain_chroma`. Older code imports it from `langchain_community.vectorstores`, a deprecated class that still runs.
:::
::::

## Read the scores

:::: tabs
::: tab FAISS
```python title="Notebook cell" norun
docs_and_score = db.similarity_search_with_score(query)
for doc, score in docs_and_score:
    print(round(float(score)), doc.page_content[:40].replace("\n", " "))
```

```output saved
15553 It is a distressing and oppressive duty,
15925 To such a task we can dedicate our lives
16787 …  It will be all the easier for us to c
19336 We have borne with their present governm
```

When you already have a vector, search with it directly:

```python title="Notebook cell" norun
embedding_vector = embeddings.embed_query(query)
docs_score = db.similarity_search_by_vector(embedding_vector)
docs_score[0].page_content[:40]
```

```output saved
'It is a distressing and oppressive duty,'
```
:::
::: tab Chroma
```python title="Notebook cell" norun
## similarity Search With Score
docs = vectordb.similarity_search_with_score(query)
for doc, score in docs:
    print(round(score), doc.page_content[:40])
```

```output saved
15574 To such a task we can dedicate our lives
18241 The world must be made safe for democrac
18735 government in the hour of test. They are
22469 Just because we fight without rancor and
```

As with FAISS, the score is the squared distance between the vectors: lower is closer, and its scale depends on the model.
:::
::::

::: visual nearest-chunks | Figure | Nearest chunks and their scores
What `similarity_search` returns for the question above, drawn in two dimensions.
:::

The score is a distance, not a similarity: lower means closer. FAISS returns the squared Euclidean distance between the two vectors. Its size depends on the model: these `llama2` vectors give thousands, while vectors of length 1, such as OpenAI's, give values from 0 to 4. Compare scores only within one index, and prefer the order to a fixed threshold.

## Use it as a retriever

:::: tabs
::: tab FAISS
```python title="Notebook cell" norun
retriever = db.as_retriever()
docs = retriever.invoke(query)
len(docs), docs[0].page_content[:40]
```

```output saved
(4, 'It is a distressing and oppressive duty,')
```

A retriever wraps the store in LangChain's standard interface: `invoke(question)` in, documents out. Chains take retrievers, not stores ([lesson 6.8](lesson:6.8)'s `create_retrieval_chain`), and `as_retriever(search_kwargs={"k": 2})` sets the number of results.
:::
::: tab Chroma
```python title="Notebook cell" norun
### Retriever option
retriever = vectordb.as_retriever()
retriever.invoke(query)[0].page_content[:40]
```

```output saved
'To such a task we can dedicate our lives'
```

The retriever is what chains take, exactly as with FAISS: swapping the store in [lesson 6.8](lesson:6.8)'s app changes one line.
:::
::::

## Save and reopen

:::: tabs
::: tab FAISS
```python title="Notebook cell" norun
### Saving And Loading
db.save_local("faiss_index")

new_db = FAISS.load_local("faiss_index", embeddings, allow_dangerous_deserialization=True)
docs = new_db.similarity_search(query)
docs[0].page_content[:40]
```

```output saved
'It is a distressing and oppressive duty,'
```

`save_local` writes a folder with two files: `index.faiss` (the vectors) and `index.pkl` (the chunks and metadata, as a pickle). Reloading needs the same embeddings model, to embed new queries the way the index was built.

**Only load indexes you made.** Loading a pickle can run any code stored in it, so `load_local` refuses with a `ValueError` ("The de-serialization relies loading a pickle file…") unless you pass `allow_dangerous_deserialization=True`. Pass it only for folders you created yourself; never for an index downloaded or received from someone else.
:::
::: tab Chroma
```python title="Notebook cell" norun
## Saving to the disk
vectordb = Chroma.from_documents(documents=splits, embedding=embedding, persist_directory="./chroma_db")

# load from disk
db2 = Chroma(persist_directory="./chroma_db", embedding_function=embedding)
docs = db2.similarity_search(query)
print(docs[0].page_content)
```

```output saved
To such a task we can dedicate our lives and our fortunes, everything that we are and everything that we have, with the pride of those who know that the day has come when America is privileged to spend her blood and her might for the principles that gave her birth and happiness and the peace which she has treasured. God helping her, she can do no other.
```

With `persist_directory`, Chroma writes every chunk to the `chroma_db` folder as it is added; there is no separate save step. `Chroma(...)` opens the folder again, in this notebook or a later one, without embedding anything. It needs the same embeddings model to embed new queries; note the argument's name here, `embedding_function`, where `from_documents` takes `embedding`.

**Running the cell again adds the chunks again.** `from_documents` adds to the collection it opens. Run the cell above twice and the folder holds every chunk twice, so a search returns the same text in two of its four places. Delete the folder before rebuilding, or give each chunk an ID: adding an existing ID replaces the chunk instead (practice).
:::
::::

## How vector search works

Finding the nearest vectors sounds simple: compare the query with every stored vector and keep the closest. That is exact search, and the `IndexFlatL2` that `FAISS.from_documents` builds does just that, one comparison per stored chunk. It is always right, and fast enough for thousands to a few hundred thousand chunks; for hundreds of millions it is too slow **VERIFY**. Large collections use approximate nearest neighbour (ANN) indexes, which skip most comparisons and accept missing a true neighbour now and then:

| Index | Idea | Trade-off |
|---|---|---|
| Flat (exact) | Compare the query with every vector | Always right; time grows with the collection |
| IVF (inverted file) | Group the vectors into clusters around centre points; search only the few clusters nearest the query | Much faster; misses neighbours in clusters it skipped; `nprobe` sets how many clusters to search |
| HNSW (graph) | Link each vector to its near neighbours in a layered graph; walk from a sparse top layer down towards the query | Very fast with high recall, at the cost of memory; Chroma's index **VERIFY**; `ef` sets how wide the walk is |
| PQ (product quantization) | Compress each vector to a few bytes by coding its pieces against small codebooks | Far less memory, approximate distances; often combined with IVF |

An ANN index is judged by its recall: the share of the true k nearest neighbours it returns, often above 95 percent. Its settings trade recall against speed and memory, and the right point depends on the app: a reranker after retrieval forgives a missed neighbour more easily than an app that shows the first result.

## Filter, add and delete

```python title="Notebook cell" norun
from langchain_core.documents import Document

hits = db.similarity_search(query, k=2, filter={"source": "speech.txt"})
note = Document(page_content="A note added later.", metadata={"source": "notes.txt"})
db.add_documents([note], ids=["note-1"])
db.delete(ids=["note-1"])
```

`filter` keeps only chunks whose metadata match. FAISS applies it after the search: it fetches `fetch_k` candidates (20 by default), drops those that don't match and returns at most `k`, so a narrow filter can return fewer than `k`. An index grows with `add_documents` and shrinks with `delete`, both by ID, without rebuilding.

## Choosing a vector store

| | FAISS | Chroma |
|---|---|---|
| What it is | A search library for vectors | A database of documents, metadata and vectors |
| Where the data lives | In memory, until `save_local` | In memory, or in `persist_directory` as it is added |
| Reopening | `load_local(..., allow_dangerous_deserialization=True)` | `Chroma(persist_directory=..., embedding_function=...)` |
| Running the build twice | A new index each time | The same chunks added again, unless they have IDs |
| Packages | `faiss-cpu`, `langchain-community` | `chromadb`, `langchain-chroma` |

| Option | What it is | Fits |
|---|---|---|
| FAISS | A library inside your Python process | Prototypes and fixed document sets, saved to files |
| Chroma | A small database, inside your process or as a server | Apps that add documents over time and filter by metadata |
| pgvector | An extension for the PostgreSQL database | Apps that already keep their data in Postgres |
| Hosted services such as Pinecone, Qdrant Cloud or Weaviate | Vector databases run for you | Large collections and many users, with no server to run **VERIFY** |

All of them have LangChain integrations with the methods of this lesson, so the choice can wait until the app needs it.

## Interview questions

::: check
Exact or approximate nearest-neighbour search: what do you give up, and when is it worth it?

Approximate search gives up a little recall, the occasional true neighbour it doesn't return, for searches that stay fast as the collection grows to millions of vectors. Below roughly a few hundred thousand vectors exact search is usually fast enough and simpler; above that, or under tight latency limits, an HNSW or IVF index pays off.
:::

::: check
How does HNSW find neighbours so quickly?

It builds a graph in layers: the top layer links a few vectors with long jumps, lower layers link more vectors with shorter ones, and the bottom layer holds all of them. A search starts at the top, moves greedily to the neighbour closest to the query, drops a layer and repeats, so it reaches the right region in a handful of hops instead of comparing against everything.
:::

::: check
What does recall at k mean for a vector index, and how do you raise it?

The share of the true k nearest neighbours, found by exact search, that the index returns. It rises with wider searches (`ef` in HNSW, `nprobe` in IVF), more links per vector or less compression, each costing speed or memory. Measure it on your own vectors against a flat index.
:::

::: check
Why does `FAISS.load_local` need `allow_dangerous_deserialization=True`?

The chunks and metadata are saved with Python's pickle, and loading a pickle can run any code stored in it. LangChain refuses unless you confirm you trust the file: fine for an index your own code wrote, never for one downloaded or sent by someone else.
:::

::: check
FAISS or a vector database such as Chroma: how do you choose?

FAISS is a library inside your process: fastest to start, no server, but saving, updating, filtering and sharing are your job. A vector database stores documents and metadata with the vectors, persists every change, filters inside the search, and can serve several apps. Prototypes and fixed document sets suit FAISS; apps whose documents change, or that several services share, suit a database.
:::

::: check
What is the difference between filtering before and after the vector search?

Filtering after the search (post-filtering, as LangChain's FAISS does) finds the nearest candidates first and drops the ones that don't match, so a narrow filter can leave fewer than k results. Filtering during the search (as a database's `where` clause does) only considers matching vectors, so it returns k when k exist, at some cost to search speed.
:::

::: check
How do you keep an index in sync when documents change?

Give each chunk a stable ID, for example the file path plus the chunk's position or a hash of its text. When a document changes, delete its old chunks by ID and add the new ones; adding with an existing ID replaces the chunk. Re-embed only what changed, and rebuild everything only when the embedding model changes.
:::

## Practice

::: practice
**A FAISS index without Ollama.** Build the same index with `HuggingFaceEmbeddings` ([lesson 6.6](lesson:6.6)), print the two closest chunks to the question with their scores, then save it, reload it and print how many vectors it holds (`index.ntotal`).

```python title="Notebook cell" norun
from langchain_huggingface import HuggingFaceEmbeddings

hf = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
chunks = text_splitter.split_documents(documents)
hf_db = FAISS.from_documents(chunks, hf)

for doc, score in hf_db.similarity_search_with_score(query, k=2):
    print(round(float(score), 3), doc.page_content[:40])

hf_db.save_local("faiss_hf")
again = FAISS.load_local("faiss_hf", hf, allow_dangerous_deserialization=True)
again.index.ntotal
```

```output illustrative note="scores depend on the model; the count does not"
0.912 It is a distressing and oppressive duty,
1.004 To such a task we can dedicate our lives
5
```

This model returns vectors of length 1, so its scores fall between 0 and 4. `chunks` is split again because `docs` now holds search results.
:::

::: practice
**No duplicates.** Build the store in `chroma_db` twice and count its chunks with `vectordb.get()["ids"]`. Then delete the folder and build it twice again, this time with an ID for each chunk.

```python title="Notebook cell" norun
for _ in range(2):
    vectordb = Chroma.from_documents(documents=splits, embedding=embedding, persist_directory="./chroma_db")
print(len(vectordb.get()["ids"]))
```

```output illustrative note="on an empty folder; checked with stand-in embeddings"
18
```

```python title="Notebook cell" norun
import shutil

shutil.rmtree("./chroma_db")
ids = [f"speech-{i}" for i in range(len(splits))]
for _ in range(2):
    vectordb = Chroma.from_documents(
        documents=splits, embedding=embedding, persist_directory="./chroma_db", ids=ids
    )
print(len(vectordb.get()["ids"]))
```

```output illustrative note="checked with stand-in embeddings"
9
```

`get()` returns the stored `ids`, `documents` and `metadatas`. With IDs, the second build replaces the nine chunks instead of adding nine more. `shutil.rmtree` deletes a folder and everything in it, so check the path first.
:::
