+++
number = "15.1"
title = "Agentic, corrective and adaptive RAG"
lede = "A RAG chain retrieves once and answers from whatever came back. Put the steps in a graph and a model can decide along the way: whether to search, where, whether the results are any good, and whether the answer holds up."
summary = "Where a fixed RAG pipeline breaks, agentic RAG (retrievers as tools), corrective RAG (grade the chunks, rewrite, search the web), adaptive RAG (route the question, check the answer), the research behind each, the building blocks, what the extra calls cost, what goes wrong, which to use, interview questions and two practice tasks in plain Python."
type = "concept"
status = "published"
source = "15 RAG with LangGraph: 35-39-RAGS.pdf (slides 1-4) and 37.1-Corrective+RAGs.pdf (slides 1-2); the papers behind each pattern, the building blocks, costs, failure modes, interview questions and practice added"
chips = [["i-layers", "Concept"]]
+++

The RAG app of [lesson 6.8](lesson:6.8) runs the same two steps for every question: retrieve four chunks, then answer from them. That works when the question is about the documents and the search finds the right passages. It fails when the question needs no documents, belongs to another collection, isn't covered at all, or when the search returns the wrong passages and the model answers anyway. Each of those needs a decision in the middle of a run, and a chain has no place for one; a graph does ([lesson 10.1](lesson:10.1)). Retrieval and generation become nodes, and grades decide the edges between them. Three well-known designs work this way: agentic RAG, corrective RAG and adaptive RAG. This lesson covers the ideas and their trade-offs; lessons [15.2](lesson:15.2) to [15.4](lesson:15.4) build each one, and [lesson 15.5](lesson:15.5) combines them in one script.

## Where a fixed pipeline breaks

| Situation | What a RAG chain does | The decision that helps | Pattern |
|---|---|---|---|
| The question needs no documents ("Hi", "What is 15% of 80?") | Retrieves anyway; the chunks can distract the model | Retrieve or not | Agentic |
| The documents live in several collections (policies, contracts) | Searches the one store it was built with | Which collection | Agentic (one tool per store), adaptive (a router) |
| No collection covers the question | Answers from unrelated chunks, or says it doesn't know | Look elsewhere, such as the web | Adaptive (route first), corrective (fall back) |
| Some retrieved chunks are off-topic | Puts them in the prompt with the rest | Grade each chunk, drop the bad ones | Corrective |
| The question's words differ from the documents' | Retrieves the wrong chunks | Rewrite the question, search again | All three |
| The answer says things the chunks don't | Returns it | Check the answer against the chunks | Adaptive |
| The answer misses the point of the question | Returns it | Check the answer against the question | Adaptive |

Every decision is one more model call, and every "search again" is a loop. Both have a price, covered below.

## Agentic RAG

Agentic RAG adds agents to the RAG pipeline: a model figures out how to retrieve the most relevant information before using it to answer. The simplest form is a *retrieval agent*, a model given a retriever as a tool ([lesson 9.3](lesson:9.3)). It decides whether to call it, which one when there are several, and what query to send. A question about leave goes to the company-policy store, a question about a contract clause to the legal store, a greeting to neither; when no store fits, the agent can say it doesn't know.

In LangGraph that is the ReAct graph of [lesson 11.4](lesson:11.4) with retrievers as its tools, and `create_agent` builds the same loop ([lesson 9.4](lesson:9.4)). The graph of [lesson 15.2](lesson:15.2) adds two steps after retrieval: a relevance check on what came back, and a rewrite of the question that sends the agent round again when the check fails.

The agent writes the search query itself, from the whole conversation, which helps with follow-ups such as "and for contractors?". That freedom is also the risk: the model may skip retrieval and answer from memory, or search five times where once would do. A system prompt that says when to search, or a forced tool call, keeps it in line.

## Corrective RAG

Corrective RAG (CRAG) checks the retrieved documents before using them, and corrects the retrieval when they fail. A grader judges each document's relevance to the question (self-grading); when the grades are poor, the question is rewritten and searched on the web instead of being answered from bad context. Its parts are a retrieval evaluator (the grader), a generator, and the corrective actions: refining the retrieved knowledge or replacing it.

The idea comes from a 2024 paper by Yan and others. There, a small fine-tuned model (T5-large, 0.77 billion parameters) scores each document, and two thresholds turn the scores into one of three actions:

| Action | When | What happens |
|---|---|---|
| Correct | At least one document scores above the upper threshold | Keep the documents, cut them into short strips, drop the strips that score low |
| Incorrect | Every document scores below the lower threshold | Discard them; rewrite the question as search keywords and use web results |
| Ambiguous | Anything in between | Use both the refined documents and the web results |

The LangGraph version built in [lesson 15.3](lesson:15.3) keeps the shape and simplifies the parts: a chat model grades each chunk "yes" or "no", relevant chunks are kept whole, and if *any* chunk fails, the question is rewritten and one web search adds its results. That trigger is far more eager than the paper's, which searches only when every document fails. The paper also found that its small trained evaluator judged relevance better than prompted ChatGPT (84.3% against 58 to 65% on its PopQA test): a grader is a model with its own error rate, and a better grader can matter more than a bigger generator.

## Adaptive RAG

Adaptive RAG adjusts its strategy to each question: it digs deep when a question needs it and answers simply when it doesn't, balancing speed and accuracy. It joins two ideas. *Query analysis* decides how to handle a question before any retrieval. *Self-corrective* (or self-reflective) RAG checks its own steps and loops back when a check fails.

Three questions show the range. "What is the capital of India?" needs no retrieval: the model knows. "What are company XYZ's leave policies in India?" needs one search of XYZ's documents. "How has India's economy changed since 1991?" may need several searches, each building on the last. The 2024 Adaptive-RAG paper by Jeong and others trains a small classifier to predict exactly that: no retrieval, single-step retrieval, or iterative multi-step retrieval. The self-correction comes from Self-RAG (Asai and others, 2023), which trains a model to decide when to retrieve and to critique the passages and its own answer.

The LangGraph version built in [lesson 15.4](lesson:15.4) uses a chat model for both halves. A router sends questions about the indexed topics to the vector store and everything else to web search. Three graders do the critique: the retrieval grader filters the chunks as in corrective RAG; after the answer is written, a hallucination grader checks that the documents support it (if not, generate again), and an answer grader checks that it addresses the question (if not, rewrite the question and retrieve again). It routes by source rather than by complexity; a third route that answers from the model alone is easy to add.

::: visual rag-graphs | Figure | Three RAG graphs
The three patterns as the graphs of lessons 15.2 to 15.4, coloured by what each step does.
:::

## The building blocks

The three graphs are made of the same few parts, each a short chain:

| Block | Takes | Returns | Built from | Lesson |
|---|---|---|---|---|
| Retriever tool | A query the model writes | The chunks' text, joined | `create_retriever_tool` | [15.2](lesson:15.2) |
| Router | The question | `"vectorstore"` or `"web_search"` | Prompt, model, structured output with a `Literal` | [15.4](lesson:15.4), [13.3](lesson:13.3) |
| Document grader | The question and one chunk | `"yes"` or `"no"` | Prompt, model, structured output | [15.3](lesson:15.3) |
| Hallucination grader | The chunks and the answer | `"yes"` or `"no"` | The same | [15.4](lesson:15.4) |
| Answer grader | The question and the answer | `"yes"` or `"no"` | The same | [15.4](lesson:15.4) |
| Question rewriter | The question | A better question | Prompt, model, string parser | [15.3](lesson:15.3) |
| Web search | A query | Page snippets | The Tavily tool | [11.3](lesson:11.3) |

Each grader is a model used as a judge ([lesson 13.5](lesson:13.5)). Its verdict comes back as a Pydantic object ([lesson 9.5](lesson:9.5)), and a conditional edge compares it with a label to pick the next node: the model judges, code turns.

## What it costs

Every check is a model call, and the calls run one after another. With four chunks per search:

| Pattern | Model calls when all goes well | Each extra round adds |
|---|---|---|
| Basic RAG ([6.8](lesson:6.8)) | 1: answer | - |
| Agentic ([15.2](lesson:15.2)) | 3: decide, grade, answer | 3: rewrite, decide, grade |
| Corrective ([15.3](lesson:15.3)) | 5: grade 4 chunks, answer | The web path: a rewrite and a search |
| Adaptive ([15.4](lesson:15.4)) | 8: route, grade 4 chunks, answer, 2 checks | Regenerating: 3; rewriting: 8 |

A question that takes one call in a chain can take eight in a graph, each adding a second or more of waiting. Three habits keep that down: a small, fast model for the router and graders and a strong one for the answer; grading the chunks in one batch, in parallel, rather than one after another ([lesson 13.2](lesson:13.2)); and checks only where a wrong answer costs more than the delay. Practice 1 counts the calls.

## What goes wrong

| Failure | Why it happens | Guard |
|---|---|---|
| A loop that never ends | The index lacks the answer, so every rewrite retrieves nothing useful; or a strict checker rejects every answer | Count attempts in the state and leave after two or three with an honest "I don't know"; keep a `recursion_limit` as the backstop ([lesson 11.4](lesson:11.4)) |
| Too many web searches | One off-topic chunk in four is normal, and "any chunk failed" triggers the search | Search only when no chunk, or too few, pass |
| A grader that misjudges | Verdicts vary with wording, and `"Yes"` is not `"yes"` | `temperature=0`, a `Literal["yes", "no"]` field, and a test of the grader on labelled examples |
| Losing the user's question | A rewrite replaces the question in the state, so a bad rewrite changes what gets answered, and nothing can tell | Keep the original question: search with the rewrite, grade and answer against the original |
| A misrouted question | The router's prompt lists the index's topics, and the index changes | Keep that description next to the indexing code; log every route |
| Instructions hidden in retrieved text | Pages and documents can carry text aimed at the model (prompt injection) | Tell graders and the generator to treat retrieved text as data; prefer trusted sites; show the sources |
| Data leaving | Web search sends the question to a third party | Route confidential questions away from web search |

## Which one to use

- Start with basic RAG and better retrieval ([lesson 6.3](lesson:6.3)): chunking, metadata filters, hybrid search and reranking fix more answers than any graph.
- Add a relevance grade and one rewrite when retrieval often misses; add a web fallback when questions go beyond your documents and web content is acceptable.
- Add the answer checks when an unsupported answer costs more than the extra seconds: medical, legal and financial answers.
- Use an agent with retriever tools when there are several collections, or when many questions need no retrieval at all.
- Measure whatever you add: an evaluation set with expected answers shows whether each grader and loop earns its calls ([lesson 6.3](lesson:6.3)).

## Interview questions

::: check
Your RAG assistant answers confidently from chunks about the wrong product version. Which pattern addresses this, and how would you build the check?

A document grader, the core of corrective RAG: after retrieval, a model judges each chunk's relevance to the question with a structured yes or no, and only relevant chunks reach the prompt. If none pass, rewrite the question and retrieve again, or fall back to another source. For a product version, a metadata filter at retrieval time is cheaper and exact, so do both: filter first, then grade what is left.
:::

::: check
Compare agentic RAG with a router in front of a vector store and a web search.

In agentic RAG the model decides inside a loop: whether to retrieve, which tool, with what query, and whether to search again after seeing the results. A router decides once, up front, from the question alone, and the rest of the graph is fixed. The router is cheaper, predictable and easy to test; the agent handles follow-up questions and multi-step searches but may skip retrieval or search too often, so it needs instructions and limits.
:::

::: check
The usual LangGraph corrective RAG searches the web when any retrieved chunk is irrelevant. What is wrong with that rule, and what would you use instead?

With four chunks per search, one off-topic chunk is common even when the other three answer the question, so the rule sends most questions to the web: slower, costlier, and mixing in content nobody needed. The CRAG paper searches only when every document fails, and blends both sources when its evaluator is unsure. Use "no chunk passed" or "fewer than two passed", and measure how often the web path runs.
:::

::: check
An adaptive RAG graph sometimes runs for minutes and then fails with `GraphRecursionError`. Where do you look?

At the loops without exits. If the index doesn't hold the answer, rewrite, retrieve and grade repeat forever; if the hallucination grader keeps rejecting, generate repeats. Count attempts in the state and route to a fallback answer after two or three, keep `recursion_limit` as the last line of defence, and read the traces to see which grader keeps saying no and whether it is right ([lesson 12.1](lesson:12.1)).
:::

::: check
How would you check that the hallucination grader itself works?

Build a small labelled set: answers known to be supported by their chunks, and answers with planted unsupported claims. Run the grader on it and count how many unsupported answers it catches and how many good ones it rejects. Tune the prompt, the model and the temperature on that set, and run it again whenever one of them changes. A grader nobody has measured only adds latency.
:::

::: check
Why do the graders return a structured yes or no instead of a sentence?

Because code acts on the verdict: a conditional edge compares it with a label to pick the next node. Structured output turns the reply into a field ([lesson 9.5](lesson:9.5)), and a `Literal["yes", "no"]` makes it one of two values, so "Yes, mostly." can't slip through as a route nobody planned for. An explanation, if you want one, goes in a second field for the logs.
:::

## Practice

::: practice
**Count the calls.** Write `model_calls(path, chunks=4)` that takes the nodes a run went through and returns how many model calls it made. `grade_documents` calls the model once per chunk; `retrieve` and `web_search` call none; every other node calls it once. Count the four runs below.

```python title="Notebook cell"
NO_MODEL = {"retrieve", "web_search"}


def model_calls(path, chunks=4):
    calls = 0
    for node in path:
        if node == "grade_documents":
            calls += chunks
        elif node not in NO_MODEL:
            calls += 1
    return calls


runs = {
    "agentic, found at once": ["agent", "retrieve", "check_relevance", "generate"],
    "corrective, web fallback": ["retrieve", "grade_documents", "transform_query", "web_search", "generate"],
    "adaptive, checks pass": ["route_question", "retrieve", "grade_documents", "generate",
                              "check_hallucinations", "check_answer"],
    "adaptive, one rewrite": ["route_question", "retrieve", "grade_documents", "generate",
                              "check_hallucinations", "check_answer", "transform_query",
                              "retrieve", "grade_documents", "generate",
                              "check_hallucinations", "check_answer"],
}
for name, path in runs.items():
    print(f"{name}: {model_calls(path)} calls")
```

```output real
agentic, found at once: 3 calls
corrective, web fallback: 6 calls
adaptive, checks pass: 8 calls
adaptive, one rewrite: 16 calls
```

Grading chunk by chunk is half of every adaptive run, and one rewrite doubles the bill. Grading all chunks in one batched call keeps the count but runs them in parallel; grading the joined text once, as the agentic graph does, makes one call but gives one verdict for all of them.
:::

::: practice
**Correct, incorrect or ambiguous.** The CRAG paper's evaluator scores each document between -1 and 1. Write `crag_action(scores, upper=0.5, lower=-0.5)`: `"correct"` if any score is above `upper`, `"incorrect"` if all are below `lower`, otherwise `"ambiguous"`. Compare it with the rule "search the web if any document fails", where a document fails below 0.

```python title="Notebook cell"
def crag_action(scores, upper=0.5, lower=-0.5):
    if any(score > upper for score in scores):
        return "correct"
    if all(score < lower for score in scores):
        return "incorrect"
    return "ambiguous"


def any_fails(scores):
    return "web search" if any(score < 0 for score in scores) else "generate"


cases = {
    "three good, one bad": [0.8, 0.7, -0.6, 0.6],
    "all bad": [-0.9, -0.7, -0.8, -0.6],
    "unsure": [0.2, -0.1, 0.3, -0.3],
}
for name, scores in cases.items():
    print(f"{name}: paper -> {crag_action(scores)}, any-fails rule -> {any_fails(scores)}")
```

```output real
three good, one bad: paper -> correct, any-fails rule -> web search
all bad: paper -> incorrect, any-fails rule -> web search
unsure: paper -> ambiguous, any-fails rule -> web search
```

The any-fails rule sends all three to the web. The thresholds keep a good retrieval, search only when nothing is usable, and blend both sources when unsure. The paper tuned its thresholds per dataset (0.59 and -0.99 on PopQA), so measure before choosing yours.
:::

## Further reading

- LangChain, [Build a custom RAG agent with LangGraph](https://docs.langchain.com/oss/python/langgraph/agentic-rag): the retrieval agent of lesson 15.2 as LangGraph's documentation builds it today.
- LangChain, [Retrieval](https://docs.langchain.com/oss/python/langchain/retrieval): the 2-step, agentic and hybrid RAG architectures.
- Yan and others, [Corrective Retrieval Augmented Generation](https://arxiv.org/abs/2401.15884) (2024): the evaluator, the three actions and the strip refinement.
- Jeong and others, [Adaptive-RAG: Learning to Adapt Retrieval-Augmented Large Language Models through Question Complexity](https://arxiv.org/abs/2403.14403) (NAACL 2024).
- Asai and others, [Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection](https://arxiv.org/abs/2310.11511) (2023).
