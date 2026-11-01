+++
number = "6.8"
title = "A Simple RAG App"
lede = "The whole module in one Python file: a PDF as the documents, Gemini for the embeddings and the answers, FAISS as the store. Read the script to revise; press Explain on it for every step explained, enough to understand RAG from this page alone."
summary = "A complete RAG app in one script with Gemini, the points to remember for each step, how to run it, and which line changes for each alternative."
type = "build"
status = "published"
source = "Summary of this module; 4 Langchain: 1.1-openai/1.1.2-Simpleapp.ipynb (identical copies: 1.2-ollama/1.2.1-Simpleapp.ipynb and both in 5 OpenAI and Ollama) in the Explain boxes; Gemini as in 5 OpenAI and Ollama: 1.1-openai/1.1.1-GettingStarted.ipynb (cell 4)"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["GOOGLE_API_KEY"]
data = ["attention.pdf"]
+++

Lessons 6.1 to 6.7 met the tools one at a time: four model providers, five loaders, four splitters, four embedding classes, two vector stores. This lesson picks one of each and puts them in one script, so the pipeline can be read, run and remembered as a whole; it is the page to come back to for the syntax. Each class in the script has its box in the map below.

::: visual rag-two-phases | Figure | The app in LangChain classes
The top row runs once and builds the index; the bottom row runs for every question.
:::

## Before you run it

- `GOOGLE_API_KEY` in your `.env` file, created in Google AI Studio ([lesson 6.1](lesson:6.1)).
- [attention.pdf](data/attention.pdf) in the project folder.
- The packages of [lesson 6.1](lesson:6.1)'s `requirements.txt`; the script uses `langchain-google-genai`, `langchain-community`, `langchain-text-splitters`, `langchain-classic`, `faiss-cpu` and `pypdf`.

## The script

```python title="rag_app.py" explain
"""Answer questions about a PDF with Gemini: load, split, embed, store, retrieve, answer."""
import sys

from dotenv import load_dotenv
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()  # GOOGLE_API_KEY from .env

# 1. Model: messages in, an AIMessage out (lesson 6.1)
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite", temperature=0)

# 2. Load: one Document per page (lesson 6.4)
docs = PyPDFLoader("attention.pdf").load()

# 3. Split: chunks of up to 1,000 characters, each repeating up to 200 of the last (lesson 6.5)
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.split_documents(docs)

# 4. Embed: one vector per chunk, and later per question, from the same model (lesson 6.6)
embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")

# 5. Store and retrieve: FAISS keeps the vectors; the retriever returns the 4 nearest chunks (lesson 6.7)
vectorstore = FAISS.from_documents(chunks, embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
print(f"Indexed {len(chunks)} chunks from {len(docs)} pages")

# 6. Prompt and chain: stuff the chunks into {context}, the question into {input} (explained below)
prompt = ChatPromptTemplate.from_template(
    """Answer the question using only the context below.
If the context does not contain the answer, say you don't know.

<context>
{context}
</context>

Question: {input}"""
)
document_chain = create_stuff_documents_chain(llm, prompt)
rag_chain = create_retrieval_chain(retriever, document_chain)

if __name__ == "__main__":
    question = " ".join(sys.argv[1:]) or "What is multi-head attention?"
    response = rag_chain.invoke({"input": question})
    print(response["answer"])
    print("Sources: pages", ", ".join(doc.metadata["page_label"] for doc in response["context"]))
```

::: walkthrough

The script has two phases. **Indexing** (steps 2 to 5) turns the PDF into a searchable index each time the script starts. **Answering** (step 6 and the last block) runs for every question: find the relevant chunks, put them in the prompt, ask the model.

```python title="Setup" norun
import sys

from dotenv import load_dotenv
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()  # GOOGLE_API_KEY from .env
```

**Setup.** Each import names the package that provides it. `langchain_core` holds the shared basics (prompts, messages, the `Document` class); provider packages such as `langchain_google_genai` hold the models; `langchain_community` holds the PDF loader and FAISS; `langchain_classic` holds the ready-made chains. `load_dotenv()` copies `GOOGLE_API_KEY` from the `.env` file into the environment, where the Gemini classes look for it, so the key never appears in the code.

```python title="Step 1 · Model" norun
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite", temperature=0)
```

**1. The chat model.** A chat model takes messages (instructions, the user's question) and returns an `AIMessage` whose text is the answer. Nothing is sent yet: this line only configures the client. `temperature=0` makes the model pick the likeliest wording, so answers vary less between runs, which suits factual questions. Every provider's class has the same `invoke`, so `ChatOpenAI(...)` or a local `ChatOllama(...)` could replace this line and nothing else would change.

```python title="Step 2 · Load" norun
docs = PyPDFLoader("attention.pdf").load()
```

**2. Load.** A loader turns a source into `Document` objects: `page_content` holds the text, `metadata` says where it came from. `PyPDFLoader` reads the PDF's text layer and returns one `Document` per page, 15 for this paper, with `source`, `page` (from 0) and `page_label` (the printed number). That metadata travels through every later step, which is how the answer can cite its pages.

```python title="Step 3 · Split" norun
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.split_documents(docs)
```

**3. Split.** A whole page is too long to send with every question and too broad to match one question well, so pages are cut into chunks. `chunk_size=1000` counts characters, about 250 tokens of English. The splitter cuts at paragraph breaks where it can, then at line breaks, then between words, so chunks end at natural boundaries. `chunk_overlap=200` repeats the end of each chunk at the start of the next, so a sentence cut at a boundary is whole in one of them. Every chunk keeps its page's metadata: 52 chunks in all.

```python title="Step 4 · Embed" norun
embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
```

**4. Embed.** An embedding model turns a text into a vector, a fixed-length list of numbers (3,072 for this model), placed so that texts with similar meanings land close together. That is how a question finds the chunk that answers it, even in different words. This one object embeds the chunks in step 5 (`embed_documents`) and every question later (`embed_query`). Both must come from the same model: vectors from different models don't compare, so changing the model means rebuilding the index.

```python title="Step 5 · Store and retrieve" norun
vectorstore = FAISS.from_documents(chunks, embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
print(f"Indexed {len(chunks)} chunks from {len(docs)} pages")
```

**5. Store and retrieve.** `FAISS.from_documents` embeds all 52 chunks in one batch and keeps each vector next to its chunk, in memory. A search embeds the question and returns the chunks whose vectors are nearest; FAISS measures distance, so lower means closer. `as_retriever` wraps the store in the interface chains expect, `retriever.invoke(question)` returning a list of `Document`s, and `k=4` sets how many chunks each question gets: more finds more, but makes the prompt longer, slower and noisier. Steps 2 to 5 are the indexing phase; here they run at every start.

```python title="Step 6 · Prompt and chains" norun
prompt = ChatPromptTemplate.from_template(
    """Answer the question using only the context below.
If the context does not contain the answer, say you don't know.

<context>
{context}
</context>

Question: {input}"""
)
document_chain = create_stuff_documents_chain(llm, prompt)
rag_chain = create_retrieval_chain(retriever, document_chain)
```

**6. Prompt and chains.** The prompt is where retrieval meets the model. `{context}` receives the retrieved chunks and `{input}` the question; without `{input}` the question would never reach the model. The two instructions keep the answer on the context and make the model admit when the answer isn't there, the main guard against made-up answers.

`create_stuff_documents_chain` "stuffs" the documents into the prompt: it joins their text with blank lines, fills `{context}`, calls the model and returns the answer as a string. `create_retrieval_chain` puts the retriever in front of it: it sends `input` to the retriever, passes the found documents on as `context`, and returns a dict with `input`, `context` and `answer`. Both chains come from `langchain_classic.chains` since LangChain 1.0; [module 07](module:07) builds the same pipeline with LCEL.

```python title="Ask" norun
if __name__ == "__main__":
    question = " ".join(sys.argv[1:]) or "What is multi-head attention?"
    response = rag_chain.invoke({"input": question})
    print(response["answer"])
    print("Sources: pages", ", ".join(doc.metadata["page_label"] for doc in response["context"]))
```

**Ask.** `python rag_app.py "your question"` passes the words in `sys.argv`; without any, a default question is used. One `invoke` runs the whole answering phase: embed the question, retrieve 4 chunks, fill the prompt, call the model. `response["context"]` holds the chunks the answer was built from, and their `page_label`s tell the reader where to check it. `if __name__ == "__main__":` keeps this block from running when another file imports `rag_chain`.

In one sentence: index your documents as vectors once, then for each question retrieve the nearest chunks and let the model answer from them, and only from them.

:::

The embedding model name is Google's at the time of writing, and the chat model is the one of [lesson 6.1](lesson:6.1): check both in Google's model list **VERIFY**, since Google retires older models. Any current Gemini chat model works in step 1; changing the embedding model means building the index again.

## Run it

```zsh title="Terminal" norun
python rag_app.py "What is multi-head attention?"
```

```output illustrative note="the counts are real; the answer and the sources vary per run"
Indexed 52 chunks from 15 pages
Multi-head attention runs several attention functions ("heads") in parallel, each on its own learned projection of the queries, keys and values, and concatenates their outputs. This lets the model attend to information from different representation subspaces at different positions; the Transformer uses 8 heads.
Sources: pages 4, 4, 5, 2
```

```zsh title="Terminal" norun
python rag_app.py "Who won the 2018 World Cup?"
```

```output illustrative
Indexed 52 chunks from 15 pages
I don't know.
Sources: pages 12, 1, 11, 13
```

The retriever always returns four chunks, even for a question the paper can't answer; the prompt is what keeps the model from answering from memory. Every run embeds all 52 chunks again before the first question: fine for one paper, slow and costly for a library of them (practice).

## Swap one piece

Every loader returns `Document`s, every splitter takes and returns them, every embeddings class has `embed_documents` and `embed_query`, every vector store has `as_retriever`, and every chat model has `invoke`. That shared interface is why each alternative in the module changes one line of the script:

| Step | In the script | Alternatives |
|---|---|---|
| Model | `ChatGoogleGenerativeAI(...)` | `ChatOpenAI(model="gpt-4o")`, `ChatGroq(model=...)` ([6.1](lesson:6.1)), `ChatOllama(model="qwen3.5")` ([6.2](lesson:6.2)) |
| Load | `PyPDFLoader("attention.pdf")` | `TextLoader`, `WebBaseLoader`, `ArxivLoader`, `WikipediaLoader` ([6.4](lesson:6.4)) |
| Split | `RecursiveCharacterTextSplitter(...)` | `CharacterTextSplitter` ([6.5](lesson:6.5)); `HTMLHeaderTextSplitter`, `RecursiveJsonSplitter` ([6.5](lesson:6.5)) |
| Embed | `GoogleGenerativeAIEmbeddings(...)` | `OpenAIEmbeddings`, `OllamaEmbeddings`, `HuggingFaceEmbeddings` ([6.6](lesson:6.6)) |
| Store | `FAISS.from_documents(...)` | `Chroma.from_documents(..., persist_directory=...)` ([6.7](lesson:6.7)) |
| Chain | `create_retrieval_chain(...)` | An LCEL chain ([module 07](module:07)); an agent with a retriever tool ([15.2](lesson:15.2)) |

## Practice

::: practice
**Index once.** Save the FAISS index to a folder on the first run and load it on later runs, so only the first run embeds the chunks.

```python title="rag_app.py (step 5, changed)" norun
from pathlib import Path

index_dir = Path("faiss_attention")
if index_dir.exists():
    vectorstore = FAISS.load_local(index_dir, embeddings, allow_dangerous_deserialization=True)
else:
    vectorstore = FAISS.from_documents(chunks, embeddings)
    vectorstore.save_local(index_dir)
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
```

Loading and splitting can move into the `else` branch too, since only a new index needs them. The folder holds a pickle, which is safe here because the script wrote it ([lesson 6.7](lesson:6.7)); delete it when the PDF or the embedding model changes.
:::

::: practice
**Ask a web page.** Point the script at LangSmith's documentation page on usage limits instead of the PDF, and print each source's address instead of a page number.

```python title="rag_app.py (changed lines)" norun
from langchain_community.document_loaders import WebBaseLoader

docs = WebBaseLoader("https://docs.smith.langchain.com/tutorials/Administrators/manage_spend").load()

print("Sources:", sorted({doc.metadata["source"] for doc in response["context"]}))
```

Only the loader and the last line change: web pages have no `page_label`, but every loader sets `source`.
:::
