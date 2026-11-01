+++
number = "6.6"
title = "Embeddings"
lede = "An embedding model turns a text into a vector, a fixed-length list of numbers, so that texts with similar meanings get similar vectors. Vector stores search these vectors to find the chunks that match a question."
summary = "Create embeddings with OpenAI, Ollama and Hugging Face models, tell embed_query from embed_documents, and choose between hosted and local models."
type = "concept"
status = "published"
source = "4 Langchain: 4-Embeddings/4.1-embedding.ipynb (cells 1-10), 4.2-ollamaemnedding.ipynb, 4.3-huggingface.ipynb, 4.4-ollamaQwen.ipynb (cell 4)"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["OPENAI_API_KEY"]
+++

Search by keywords misses a chunk that says "belligerents" when the question says "at war". An embedding model reads the whole text and returns numbers that describe its meaning, so texts about the same thing get vectors close together even when they share no words. Retrieval embeds every chunk once ([lesson 6.7](lesson:6.7)), embeds each question the same way, and returns the chunks whose vectors are nearest.

Two rules follow. Documents and questions must be embedded by the same model, because vectors from different models don't compare. And a model always returns vectors of the same length, whatever the length of the text.

## What an embedding is

An embedding model is a neural network that reads a whole text and outputs one fixed-length list of numbers. Three things happen inside it:

1. The text is cut into tokens, and each token gets a starting vector.
2. A transformer, the same architecture as a chat model, lets each token's vector take in the tokens around it, so "bank" in "river bank" ends up far from "bank" in "bank loan".
3. The token vectors are combined into one, usually by averaging them or by keeping a special summary token, and often scaled to length 1.

**How it learns meaning.** The model is trained on millions of pairs of texts that belong together, such as a question and its answer or a title and its article. Training pulls each pair's vectors together and pushes unrelated texts apart (contrastive learning) **VERIFY**. No single number stands for a word or a topic you could name; meaning is spread across all of them, and only distances and directions carry it.

**Dense and sparse vectors.** Embeddings are dense: a few hundred to a few thousand numbers, nearly all non-zero. Classic keyword search uses sparse vectors with one position per word of the vocabulary, almost all zero (TF-IDF, BM25). Dense vectors match meaning, so "remote work" finds "working from home"; sparse ones match exact terms, such as a product code or a person's name. Hybrid search uses both ([lesson 6.3](lesson:6.3)).

**Bi-encoders and cross-encoders.** An embedding model is a bi-encoder: it encodes the question and each chunk separately, so the chunks are embedded once and searched in milliseconds. A cross-encoder reads the question and one chunk together and outputs a relevance score. It is more accurate but must run once per pair at question time, so it reranks a short list instead of searching everything.

**Length and memory.** Longer vectors can hold finer distinctions but take more memory and slow the search: 1,000 chunks of 3,072 numbers at 4 bytes each take about 12 MB, a million chunks about 12 GB. Some models put the most information in the first numbers, so their vectors can be cut short with little loss, which is what OpenAI's `dimensions=` does (Matryoshka embeddings) **VERIFY**.

**Where embeddings fail.** They capture topic better than precise logic: "the policy allows remote work" and "the policy does not allow remote work" land close together. Numbers, dates, rare names and codes get blurred; text beyond the model's input limit is cut off; and a model trained on general web text may not separate legal, medical or in-house terms well. Keyword search, metadata filters and reranking cover these gaps.

## How similarity is measured

| Measure | What it compares | Similar texts give | Used by |
|---|---|---|---|
| Cosine similarity | The angle between two vectors, from -1 to 1 | Close to 1 | Most comparisons of meaning |
| Dot product | The sum of the products of matching numbers | A large value | Fast scoring of vectors of length 1 |
| Euclidean (L2) distance | The straight-line distance between the points | Close to 0 | FAISS and Chroma by default ([6.7](lesson:6.7), [6.7](lesson:6.7)) |

For vectors of length 1, which OpenAI's and many other models return, the three rank results the same way: the squared L2 distance equals 2 minus 2 times the cosine similarity. With other vectors, use the measure the model was trained for.

Choosing a model comes down to a few questions: which languages it covers, how long its vectors are (storage and speed), how long a text it accepts (longer chunks are cut), and whether it may be hosted (a price per token, and your text leaves your machine) or must run locally (free, slower on a CPU). Public benchmarks such as MTEB rank embedding models by task **VERIFY**.

## Create embeddings

Pick a provider; each class has the same methods, so the rest of the module works with any of them.

:::: tabs
::: tab OpenAI
```python title="Notebook cell" norun
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings

load_dotenv()

embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
text = "This is a tutorial on OPENAI embedding"
query_result = embeddings.embed_query(text)
len(query_result), query_result[:5]
```

```output saved
(3072,
 [0.001956823281943798,
  0.041745562106370926,
  -0.013878178782761097,
  -0.039858128875494,
  0.023981492966413498])
```

`text-embedding-3-large` returns 3,072 numbers per text; one number means nothing on its own, only the pattern does. These models can also return shorter vectors:

```python title="Notebook cell" norun
embeddings_1024 = OpenAIEmbeddings(model="text-embedding-3-large", dimensions=1024)
query_result = embeddings_1024.embed_query(text)
len(query_result)
```

```output saved
1024
```

`dimensions=1024` gives vectors a third as long: a smaller, faster index, with slightly less precise matches **VERIFY** in OpenAI's embedding guide. Every vector in one store must come from the same model and the same `dimensions`.
:::
::: tab Ollama
Ollama ([lesson 6.2](lesson:6.2)) serves embedding models too, on your own machine:

```python title="Notebook cell" norun
from langchain_community.embeddings import OllamaEmbeddings

embeddings = OllamaEmbeddings(model="gemma:2b")  # by default it uses llama2
r1 = embeddings.embed_documents(
    [
        "Alpha is the first letter of Greek alphabet",
        "Beta is the second letter of Greek alphabet",
    ]
)
len(r1), len(r1[0])
```

```output saved
(2, 2048)
```

```python title="Notebook cell" norun
query = embeddings.embed_query("What is the second letter of Greek alphabet ")
query[:5]
```

```output saved
[-2.1879360675811768,
 0.14874324202537537,
 -3.0123283863067627,
 0.02546125277876854,
 -0.12956245243549347]
```

`gemma:2b` is a chat model; its vectors work, but models trained only for embedding are smaller, faster and usually match better:

```python title="Notebook cell" norun
### Other Embedding Models
### https://ollama.com/blog/embedding-models
embeddings = OllamaEmbeddings(model="mxbai-embed-large")
text = "This is a test document."
query_result = embeddings.embed_query(text)
len(query_result)
```

```output saved
1024
```

Pull it first with `ollama pull mxbai-embed-large`. Without a model name, this class uses `llama2`, which must be pulled too.

**The current class.** `OllamaEmbeddings` from `langchain_community` is deprecated. The maintained class is `from langchain_ollama import OllamaEmbeddings`, which requires `model=` and adds no prefixes.
:::
::: tab Hugging Face
`HuggingFaceEmbeddings` downloads a model from the Hugging Face Hub once and runs it in Python with the `sentence-transformers` library, with no server and no key:

```python title="Notebook cell" norun
from langchain_huggingface import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
text = "this is atest documents"
query_result = embeddings.embed_query(text)
len(query_result), query_result[:5]
```

```output saved
(384,
 [-0.043112218379974365,
  0.13562124967575073,
  0.02233991213142872,
  0.00721671711653471,
  0.03421058505773544])
```

```python title="Notebook cell" norun
doc_result = embeddings.embed_documents([text, "This is not a test document."])
doc_result[0][:5]
```

```output saved
[-0.043112222105264664,
 0.13562120497226715,
 0.02233995869755745,
 0.007216695696115494,
 0.03421061113476753]
```

`all-MiniLM-L6-v2` is small (about 90 MB) and returns 384 numbers. The first call downloads it to a cache folder in your home directory; later calls load it from there and run on your CPU. This model embeds questions and documents the same way: the two vectors for `text` differ only in the last digits, which come from rounding. Public models download without a key; a free `HF_TOKEN` in `.env` raises Hugging Face's download limits and is needed for gated models **VERIFY**. A notebook may print a `TqdmWarning` about `IProgress` on the first import: harmless, it only means progress bars show as text.

:::
::: tab Gemini
```python title="Notebook cell" norun
from langchain_google_genai import GoogleGenerativeAIEmbeddings

embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
query_result = embeddings.embed_query("This is a test document.")
len(query_result)
```

```output illustrative note="the model's default length"
3072
```

Gemini's embedding model runs on Google's servers with the same key as its chat models (`GOOGLE_API_KEY`), and it is the one [lesson 6.8](lesson:6.8)'s script uses. The model name is Google's at the time of writing **VERIFY**.
:::
::::

Every embeddings class has the same two methods:

| Method | Takes | Returns | Used for |
|---|---|---|---|
| `embed_documents(texts)` | A list of strings | A list of vectors | The chunks, when building an index |
| `embed_query(text)` | One string | One vector | The question, at search time |

Some models are trained to embed questions and passages slightly differently, so the two methods can differ. This `OllamaEmbeddings` class adds `passage: ` before each document and `query: ` before each question (its `embed_instruction` and `query_instruction` settings).

| Class | Model | Length | Runs on | Key |
|---|---|---|---|---|
| `OpenAIEmbeddings` | `text-embedding-3-large` | 3,072 (or `dimensions=`) | OpenAI's servers | `OPENAI_API_KEY` |
| `OllamaEmbeddings` | `gemma:2b` | 2,048 | Your machine, through Ollama | - |
| `OllamaEmbeddings` | `mxbai-embed-large` | 1,024 | Your machine, through Ollama | - |
| `HuggingFaceEmbeddings` | `all-MiniLM-L6-v2` | 384 | Your machine, in Python | - |
| `GoogleGenerativeAIEmbeddings` | `gemini-embedding-001` | 3,072 **VERIFY** | Google's servers | `GOOGLE_API_KEY` |

## Common problems

A chat model imported from a model file ([lesson 6.2](lesson:6.2)) may refuse to embed:

```python title="Notebook cell" norun
embeddings = OllamaEmbeddings(model="qwen3.5")
query_result = embeddings.embed_query("This is a test document.")
```

```output saved
ValueError: Error raised by inference API HTTP code: 500, {"error":"This server does not support embeddings. Start it with `--embeddings`"}
```

| Problem | Fix |
|---|---|
| HTTP 500, "does not support embeddings" | The model can't embed: use an embedding model such as `mxbai-embed-large` |
| "model not found" | `ollama pull` the model, or check the name with `ollama list` |
| Search returns unrelated chunks after a model change | Rebuild the index with the new model: old and new vectors don't compare |

## Interview questions

::: check
What is an embedding, and why do texts with similar meanings get similar vectors?

A fixed-length vector that a neural network computes for a text. The network was trained on pairs of related texts, pulling each pair's vectors together and pushing unrelated ones apart, so texts used in similar ways end up near each other. Nearness is measured with cosine similarity or a distance.
:::

::: check
Cosine similarity, dot product or Euclidean distance: which do you use?

The one the model was trained for, usually cosine. For vectors of length 1 the three give the same ranking, because the squared distance equals 2 minus 2 times the cosine similarity, so stores normalise vectors and use whichever is fastest. Without normalisation, the dot product also rewards long vectors, which can skew results.
:::

::: check
What is the difference between a bi-encoder and a cross-encoder, and where does each go in a RAG pipeline?

A bi-encoder embeds the question and each document separately, so documents can be embedded ahead of time and searched fast: it does the retrieval. A cross-encoder reads question and document together and scores the pair: slower but more accurate, so it reranks the top 20 to 50 results of the bi-encoder.
:::

::: check
When does keyword search beat embeddings?

When the exact term matters: product codes, error messages, names, acronyms and rare domain words, which embeddings blur into their neighbourhood of meaning. Embeddings win on paraphrases and questions worded unlike the documents. Hybrid search runs both and merges the results.
:::

::: check
You switched to a better embedding model. What else has to change?

Every stored vector: re-embed all chunks, because vectors from different models aren't comparable, and possibly the vector length the store expects. Then re-run the evaluation set to confirm retrieval really improved, and check the new model's input limit against your chunk sizes.
:::

## Practice

::: practice
**Rank by meaning.** Write `cosine(a, b)`, the cosine similarity of two vectors (their dot product divided by the product of their lengths: 1 means same direction). Embed three sentences and a question with `HuggingFaceEmbeddings`, which needs no key, and print the sentences from most to least similar to the question.

```python title="Notebook cell" norun
import math

def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))

sentences = [
    "Alpha is the first letter of the Greek alphabet",
    "Beta is the second letter of the Greek alphabet",
    "Paris is the capital of France",
]
question = embeddings.embed_query("What is the second letter of the Greek alphabet?")
vectors = embeddings.embed_documents(sentences)
for score, sentence in sorted(zip((cosine(question, v) for v in vectors), sentences), reverse=True):
    print(round(score, 2), sentence)
```

```output illustrative note="exact scores depend on the model version; the order is what matters"
0.86 Beta is the second letter of the Greek alphabet
0.71 Alpha is the first letter of the Greek alphabet
0.05 Paris is the capital of France
```

The Beta sentence ranks first: it answers the question. The Alpha sentence scores high too, with the same topic and almost the same words, which is why retrieval returns several chunks, not one; Paris scores near zero. Sorting `(score, sentence)` pairs sorts by score first ([lesson 5.1](lesson:5.1)'s sorting recipes).
:::
