+++
number = "6.3"
title = "Introduction to RAG"
lede = "Retrieval-augmented generation (RAG) lets a model answer from your documents instead of from memory: find the passages a question needs, put them in the prompt, and let the model answer from them."
summary = "Why language models need RAG, the pipeline built up from first principles, its four stages and two phases, RAG compared with long prompts and fine-tuning, the main RAG architectures, how to improve and evaluate retrieval, and what goes wrong."
type = "concept"
status = "published"
source = "15 RAG with LangGraph: 35-39-RAGS.pdf (slide 1, traditional and agentic RAG); 4 Langchain: 1.1-openai/1.1.2-Simpleapp.ipynb (cell 6, the pipeline comment); explanations added"
chips = [["i-layers", "Concept"]]
+++

Language models are trained once, on public data up to a cutoff date. Ask one about your internal API, a customer's contract or yesterday's incident report and it has nothing to go on, yet it still writes a fluent answer, often a wrong one. Retrieval-augmented generation (RAG) is the standard fix and the most common pattern in production LLM applications: at request time, search your own data for the passages relevant to the question, put them in the prompt, and have the model answer from them. Support assistants over product documentation, internal knowledge-base search, assistants that read a code repository, and chat over contracts or policies are built this way. This lesson covers the ideas and the trade-offs; the lessons after it build each piece in code.

## What a model can't do on its own

| Limit | What happens |
|---|---|
| Knowledge cutoff | Training data ends at a date; anything newer is unknown to the model |
| No private data | It has never seen your company's documents, tickets or code |
| Finite context window | One call can read only so many tokens, and every token is paid for |
| No sources | It can't say where an answer came from, so nobody can check it |
| Probabilistic output | It produces the most likely-sounding text even when it lacks the facts: a confident, wrong answer, called a hallucination |

The two answers about "Langsmith" in [lesson 6.1](lesson:6.1) showed the first and the last. Retraining the model whenever documents change would be slow and costly; RAG changes what the model reads instead.

## RAG in one picture

::: visual rag-simple | Figure | RAG in one picture
One question: search first, then answer from what the search found.
:::

## Why each piece is needed

::: visual rag-principles | Run player | From a plain model call to RAG
Start from a model that guesses, then add one piece at a time.
:::

Every piece answers a problem the previous step left open: pasting all documents is too big, so split them; finding chunks by keywords misses paraphrases, so embed them; embedding on every question would be slow, so store the vectors ahead of time; then each question needs only one search and one model call.

## Four stages, two phases

| Stage | What happens | When it runs | Lessons |
|---|---|---|---|
| Ingestion (indexing) | Load documents, split them into chunks, embed each chunk, store the vectors | Once, and again when the documents change | [6.4](lesson:6.4) to [6.7](lesson:6.7) |
| Retrieval | Embed the question with the same model; find the nearest chunks | For each question | [6.7](lesson:6.7), [6.7](lesson:6.7) |
| Augmentation | Build the prompt from instructions, the chunks and the question | For each question | [6.8](lesson:6.8) |
| Generation | The model answers from that prompt | For each question | [6.1](lesson:6.1), [6.8](lesson:6.8) |

The augmented prompt is plain text. For the question "Who approves remote work?" and two retrieved chunks, the model receives:

```text title="An augmented prompt"
Answer the question using only the context below.
If the context does not contain the answer, say you don't know.

<context>
Employees may work remotely up to three days a week.

Remote work requests go to the team lead.
</context>

Question: Who approves remote work?
```

Only the second chunk answers the question; the first came along because it is about the same topic. Retrieval returns the nearest chunks, not only the relevant ones, which is why the instructions matter.

## RAG, a long prompt or fine-tuning?

| Approach | Good for | Limits |
|---|---|---|
| Paste whole documents into the prompt | A few short documents that fit in the context window | Every question pays for all the text, and answers get slower; models use facts in the middle of very long prompts less reliably **VERIFY** |
| Fine-tune the model on your documents | Teaching a style, a format or a narrow task | Costly, slow to update, a poor way to add facts, and gives no sources **VERIFY** |
| RAG | Many or changing documents; answers that cite their sources | Only as good as its retrieval; more parts to build and check |

The approaches combine: a fine-tuned model can still use RAG, and a model with a large context window can take more retrieved chunks.

## Beyond the basic pipeline

The pipeline in this lesson always retrieves once, then generates. It is often called 2-step or naive RAG, and every RAG app starts there. The common extensions add a model's judgement around it:

| Variant | What it adds | Where |
|---|---|---|
| Agentic RAG | The model decides whether to search, which source to search, and whether to search again, using retrievers as tools | [Lesson 15.2](lesson:15.2) |
| Corrective RAG | Checks around the pipeline: grade the retrieved chunks, rewrite the question and retry, verify the answer | [Lessons 15.3](lesson:15.3) and [15.4](lesson:15.4) |
| Adaptive RAG | Route each question to no retrieval, the index or the web, then check the answer against the chunks and the question | [Lesson 15.4](lesson:15.4) |
| Vectorless RAG | Finds the relevant sections without embeddings or a vector store | [Lesson 16.1](lesson:16.1) |

## Making retrieval better

Most RAG failures are retrieval failures, so most improvements happen there:

| Technique | Idea |
|---|---|
| Better chunks | Sizes and overlap that keep one idea per chunk; splitting along headings or keys ([lesson 6.5](lesson:6.5)) |
| Metadata filters | Search only chunks whose metadata match, such as one department or recent dates |
| Hybrid search | Combine embedding search with keyword search (BM25), which catches exact names, product codes and acronyms that embeddings blur |
| Reranking | Retrieve 20 to 50 candidates quickly, reorder them with a slower, more accurate model that reads the question and each chunk together (a cross-encoder), and keep the best few **VERIFY** |
| Query rewriting | Have a model rephrase a vague question, or write several versions of it, before searching |

## How to know it works

Collect real questions with their expected answers, an evaluation set, and check the two halves separately:

| Check | Question it answers | Typical measures |
|---|---|---|
| Retrieval | Did the chunks that hold the answer come back in the top k? | Hit rate or recall at k; the rank of the first relevant chunk **VERIFY** |
| Generation | Is the answer correct, relevant to the question, and supported by the retrieved chunks? | Correctness, relevance and groundedness, often graded by another model (an "LLM as judge") |

A wrong answer with the right chunks retrieved is a prompt or model problem; a wrong answer without them is a retrieval problem. LangSmith runs such evaluations ([lesson 12.1](lesson:12.1)).

## What can go wrong

Debug in pipeline order: look at the retrieved chunks before blaming the model.

| Symptom | Likely cause | First thing to try |
|---|---|---|
| The answer ignores your documents | The chunk with the answer wasn't retrieved | Print the retrieved chunks; change chunk size, `k` or the embedding model |
| The answer is half right | The answer was split across two chunks | Larger chunks or more overlap |
| A confident answer the documents don't support | The prompt lets the model fall back on its training | Answer only from the context, otherwise say "I don't know" |
| An outdated answer | The index was built from old documents | Rebuild the index when documents change |
| Vague questions retrieve the wrong chunks | The question's words are far from the documents' | Rewrite the question before searching |

| Term | Meaning |
|---|---|
| Grounding | Making the model answer from given sources, not from memory |
| Context window | The most tokens a model reads and writes in one call, prompt included |
| Chunk | A piece of a document, the unit that is embedded, stored and retrieved |
| Embedding | A vector that represents a text's meaning; similar texts get nearby vectors |
| Vector store | A store that keeps vectors with their chunks and finds the nearest to a query |
| Retriever | Anything with `invoke(question)` that returns relevant documents |
| Top-k | The number of chunks retrieved per question, 4 by default in LangChain |

## Interview questions

::: check
Your team wants an assistant that answers questions from 10,000 internal documents. Sketch the design.

Two parts. An indexing job loads each source, splits documents into chunks of roughly 500 to 1,000 characters with some overlap, embeds them and stores them with metadata: source, date, section heading, who may read it. The query path embeds the question, retrieves the top k chunks the user is allowed to see, optionally reranks them, and prompts the model to answer only from them and cite their sources. Around both: re-indexing when documents change, an evaluation set, and logs of what was retrieved for each answer.
:::

::: check
Users report answers that quote an outdated policy. Where do you look?

At the index first. Was the new version indexed, and the old one removed? Re-indexing without stable IDs leaves both versions in the store. Then at retrieval: the old text may simply match the question's wording better. Fixes: stable chunk IDs with delete-on-update, a date in the metadata to filter or boost recent documents, and a rebuild whenever a source changes.
:::

::: check
How do you make sure users only see answers from documents they may read?

Enforce it at retrieval, never in the prompt. Store each chunk's access groups or tenant in its metadata and filter every search by the user's groups, or keep one index per tenant. The model can only repeat what was retrieved, so the filter is the security boundary; caches and logs must respect it too.
:::

::: check
How do you choose the chunk size and k?

Start with about 500 to 1,000 characters, 10 to 20 percent overlap and k = 4, then measure on real questions. Answers cut off at a chunk boundary call for larger chunks or more overlap; noisy context calls for smaller chunks or a reranker. A larger k finds more but makes prompts longer, slower and costlier. Documents with headings split better along their structure.
:::

::: check
How do you know a RAG system works, and keeps working?

Build an evaluation set of real questions with expected answers and the documents that hold them. Measure retrieval (did the right chunk come back in the top k?) separately from generation (is the answer correct, relevant and supported by the retrieved chunks?), often with a model as the grader and humans spot-checking. Re-run it after every change to chunking, models or prompts.
:::

::: check
The answers use the context but sometimes add details that aren't in it. How do you reduce that?

Tighten the prompt (answer only from the context, otherwise say you don't know), lower the temperature, retrieve fewer and more relevant chunks with a reranker, and ask for citations of the chunks used. For higher stakes, add a check that compares the answer with the chunks and rejects unsupported claims: the corrective RAG pattern.
:::

::: check
A question needs facts from several documents, such as comparing two policies. Why can basic RAG fail, and what helps?

One search for the whole question may return chunks about only one policy, or several near-duplicates of the same passage. Splitting the question into sub-questions and retrieving for each, generating several phrasings of the query, or letting an agent search repeatedly until it has both sides all help.
:::

::: check
When is RAG the wrong tool?

When the task needs a skill or a format rather than facts (use examples in the prompt or fine-tuning); when all the data fits comfortably in the context window and rarely changes (put it in the prompt); when the answer is a calculation over structured data (let the model query the database through a tool); and when the latency budget leaves no room for a search.
:::

## Further reading

- LangChain documentation, [Retrieval](https://docs.langchain.com/oss/python/langchain/retrieval): the building blocks and the 2-step, agentic and hybrid architectures.
- Pinecone, [Retrieval-Augmented Generation](https://www.pinecone.io/learn/retrieval-augmented-generation/): the limits of models and the four stages, with hybrid search and reranking.
- Lewis and others, [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) (2020): the paper that named the technique.
