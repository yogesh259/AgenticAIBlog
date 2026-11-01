+++
number = "15.4"
title = "Adaptive RAG"
lede = "Route each question before retrieving: topics the index holds go to the vector store, everything else to web search. After the answer is written, two graders check that it is grounded and that it answers the question, and send the run back when it isn't."
summary = "Query analysis and self-correction, the router with a Literal choice, the retrieval grader, the answer chain, the hallucination and answer graders, the rewriter, the state, nodes and edges with a conditional entry point, the graph, two saved runs replayed step by step, the three loops and why none of them ends, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "15 RAG with LangGraph: 4-AdaptiveRAG.ipynb (cells 1-16; the model created once in provider tabs, moved imports fixed, the hub prompt written out, an undefined pprint fixed, cells split so the graph builds without a key); 35-39-RAGS.pdf (slides 3-4); the loops and their exits, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

[Lesson 15.1](lesson:15.1)'s adaptive RAG joins two ideas. *Query analysis* decides how to handle a question before anything is retrieved: here a router picks the source, the vector store for the topics it holds and web search for everything else. *Self-correction* checks each step and goes back when a check fails: the chunks are graded as in [lesson 15.3](lesson:15.3), and once the answer is written, one grader asks whether the documents support it and another whether it answers the question. The index is [lesson 15.3](lesson:15.3)'s three blog posts.

## The index

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()  ## loading all the environment variables
```

```python title="Notebook cell" norun
### Build Index

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import WebBaseLoader
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings

# Set embeddings
embd = OpenAIEmbeddings()

# Docs to index
urls = [
    "https://lilianweng.github.io/posts/2023-06-23-agent/",
    "https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/",
    "https://lilianweng.github.io/posts/2023-10-25-adv-attack-llm/",
]

# Load
docs = [WebBaseLoader(url).load() for url in urls]
docs_list = [item for sublist in docs for item in sublist]

# Split
text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    chunk_size=500, chunk_overlap=50
)
doc_splits = text_splitter.split_documents(docs_list)

# Add to vectorstore
vectorstore = FAISS.from_documents(
    documents=doc_splits,
    embedding=embd
)


retriever = vectorstore.as_retriever()
```

The index of [lesson 15.3](lesson:15.3), except that neighbouring chunks now share up to 50 tokens (`chunk_overlap=50`), so a sentence cut at a boundary is whole in one of them.

## The model

:::: tabs
::: tab OpenAI
```python title="Notebook cell" norun
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
```

OpenAI retires `gpt-4o-mini` on 14 January 2027 and names `gpt-6-luna` as its replacement: change the name then. The saved outputs below came from `gpt-4o-mini`.
:::
::: tab Groq
```python title="Notebook cell" norun
from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-120b", temperature=0)
```
:::
::: tab Gemini
```python title="Notebook cell" norun
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite", temperature=0)
```
:::
::: tab Ollama
```python title="Notebook cell" norun
from langchain_ollama import ChatOllama

llm = ChatOllama(model="qwen3.5", temperature=0)
```
:::
::::

The router, the three graders, the answer chain and the rewriter all use this `llm`.

## Route the question

```python title="Notebook cell"
### Router

from typing import Literal

from langchain_core.prompts import ChatPromptTemplate

from pydantic import BaseModel, Field


# Data model
class RouteQuery(BaseModel):
    """Route a user query to the most relevant datasource."""

    datasource: Literal["vectorstore", "web_search"] = Field(
        ...,
        description="Given a user question choose to route it to web search or a vectorstore.",
    )


# Prompt
system = """You are an expert at routing a user question to a vectorstore or web search.
The vectorstore contains documents related to agents, prompt engineering, and adversarial attacks.
Use the vectorstore for questions on these topics. Otherwise, use web-search."""
route_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "{question}"),
    ]
)
```

```python title="Notebook cell" norun
# LLM with function call
structured_llm_router = llm.with_structured_output(RouteQuery)

question_router = route_prompt | structured_llm_router

print(
    question_router.invoke(
        {"question": "Who won the Cricket world cup 2023 "}
    )
)
```

```output saved note="from a run with gpt-4o-mini; answers vary per run"
datasource='web_search'
```

```python title="Notebook cell" norun
print(question_router.invoke({"question": "What are the types of agent memory?"}))
```

```output saved note="from a run with gpt-4o-mini; answers vary per run"
datasource='vectorstore'
```

The router is [lesson 13.3](lesson:13.3)'s structured-output routing. The `Literal` turns the choice into an `enum` the model must pick from ([lesson 9.5](lesson:9.5)), and `Field(...)` makes it required. The router knows the index only through the system message, which names its three topics: index a post about another topic, and questions about it still go to the web until that sentence changes.

## Grade the documents

```python title="Notebook cell"
### Retrieval Grader


# Data model
class GradeDocuments(BaseModel):
    """Binary score for relevance check on retrieved documents."""

    binary_score: str = Field(
        description="Documents are relevant to the question, 'yes' or 'no'"
    )


# Prompt
system = """You are a grader assessing relevance of a retrieved document to a user question. \n
    If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant. \n
    It does not need to be a stringent test. The goal is to filter out erroneous retrievals. \n
    Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question."""
grade_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "Retrieved document: \n\n {document} \n\n User question: {question}"),
    ]
)
```

```python title="Notebook cell" norun
# LLM with function call
structured_llm_grader = llm.with_structured_output(GradeDocuments)

retrieval_grader = grade_prompt | structured_llm_grader
question = "agent memory"
## context
docs = retriever.invoke(question)
doc_txt = docs[1].page_content
print(retrieval_grader.invoke({"question": question, "document": doc_txt}))
```

```output saved note="from a run with gpt-4o-mini; answers vary per run"
binary_score='yes'
```

[Lesson 15.3](lesson:15.3)'s grader, with one more sentence in the prompt that says what it is for: filtering out erroneous retrievals, not a stringent test. A `Literal["yes", "no"]` field would be safer for this grader and the two below ([lesson 15.3](lesson:15.3) shows why).

## Generate

```python title="Notebook cell"
### Generate

from langchain_core.output_parsers import StrOutputParser

# Prompt: rlm/rag-prompt from LangChain's prompt hub, written out
prompt = ChatPromptTemplate.from_messages(
    [
        (
            "human",
            "You are an assistant for question-answering tasks. Use the following pieces of "
            "retrieved context to answer the question. If you don't know the answer, just say "
            "that you don't know. Use three sentences maximum and keep the answer concise.\n"
            "Question: {question} \nContext: {context} \nAnswer:",
        )
    ]
)


# Post-processing
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)
```

```python title="Notebook cell" norun
# Chain
rag_chain = prompt | llm | StrOutputParser()

# Run
generation = rag_chain.invoke({"context": docs, "question": question})
print(generation)
```

```output saved note="from a run with gpt-4o-mini; answers vary per run"
Agent memory in LLM-powered autonomous agents consists of short-term and long-term memory. Short-term memory utilizes in-context learning, while long-term memory allows agents to retain and recall information over extended periods, often using an external vector store for fast retrieval. This dual memory system enhances the agent's ability to learn from past experiences and improve future performance.
```

The same prompt and the same unused `format_docs` as [lesson 15.3](lesson:15.3): the chunks reach the prompt as `Document` objects.

## Check the answer

```python title="Notebook cell"
### Hallucination Grader


# Data model
class GradeHallucinations(BaseModel):
    """Binary score for hallucination present in generation answer."""

    binary_score: str = Field(
        description="Answer is grounded in the facts, 'yes' or 'no'"
    )


# Prompt
system = """You are a grader assessing whether an LLM generation is grounded in / supported by a set of retrieved facts. \n
     Give a binary score 'yes' or 'no'. 'Yes' means that the answer is grounded in / supported by the set of facts."""
hallucination_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "Set of facts: \n\n {documents} \n\n LLM generation: {generation}"),
    ]
)
```

```python title="Notebook cell" norun
# LLM with function call
structured_llm_grader = llm.with_structured_output(GradeHallucinations)

hallucination_grader = hallucination_prompt | structured_llm_grader
hallucination_grader.invoke({"documents": docs, "generation": generation})
```

```output saved note="from a run with gpt-4o-mini; answers vary per run"
GradeHallucinations(binary_score='yes')
```

```python title="Notebook cell"
### Answer Grader


# Data model
class GradeAnswer(BaseModel):
    """Binary score to assess answer addresses question."""

    binary_score: str = Field(
        description="Answer addresses the question, 'yes' or 'no'"
    )


# Prompt
system = """You are a grader assessing whether an answer addresses / resolves a question \n
     Give a binary score 'yes' or 'no'. Yes' means that the answer resolves the question."""
answer_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "User question: \n\n {question} \n\n LLM generation: {generation}"),
    ]
)
```

```python title="Notebook cell" norun
# LLM with function call
structured_llm_grader = llm.with_structured_output(GradeAnswer)

answer_grader = answer_prompt | structured_llm_grader
answer_grader.invoke({"question": question, "generation": generation})
```

```output saved note="from a run with gpt-4o-mini; answers vary per run"
GradeAnswer(binary_score='yes')
```

Two more judges with the same one-field shape, and "yes" is good news in both. The hallucination grader reads all the documents and the answer in one call and returns one verdict for the whole answer: it can't say which sentence is unsupported. The answer grader reads only the question and the answer, so it can pass a fluent answer that the documents don't support; that is why both run.

## Rewrite and search

```python title="Notebook cell"
### Question Re-writer

# Prompt
system = """You a question re-writer that converts an input question to a better version that is optimized \n
     for vectorstore retrieval. Look at the input and try to reason about the underlying semantic intent / meaning."""
re_write_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        (
            "human",
            "Here is the initial question: \n\n {question} \n Formulate an improved question.",
        ),
    ]
)
```

```python title="Notebook cell" norun
question_rewriter = re_write_prompt | llm | StrOutputParser()
question_rewriter.invoke({"question": question})
```

```output saved note="from a run with gpt-4o-mini; answers vary per run"
'What are the key concepts and techniques related to agent memory in artificial intelligence?'
```

```python title="Notebook cell" norun
### Search

from langchain_community.tools.tavily_search import TavilySearchResults

web_search_tool = TavilySearchResults(k=3)
```

The rewriter of [lesson 15.3](lesson:15.3), worded for vector store retrieval instead of web search, and the same Tavily tool (whose `k` is ignored: it returns five results).

## State, nodes and edges

```python title="Notebook cell"
from typing import List

from typing_extensions import TypedDict


class GraphState(TypedDict):
    """
    Represents the state of our graph.

    Attributes:
        question: question
        generation: LLM generation
        documents: list of documents
    """

    question: str
    generation: str
    documents: List[str]
```

```python title="Notebook cell"
from langchain_core.documents import Document


def retrieve(state):
    """
    Retrieve documents

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): New key added to state, documents, that contains retrieved documents
    """
    print("---RETRIEVE---")
    question = state["question"]

    # Retrieval
    documents = retriever.invoke(question)
    return {"documents": documents, "question": question}


def generate(state):
    """
    Generate answer

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): New key added to state, generation, that contains LLM generation
    """
    print("---GENERATE---")
    question = state["question"]
    documents = state["documents"]

    # RAG generation
    generation = rag_chain.invoke({"context": documents, "question": question})
    return {"documents": documents, "question": question, "generation": generation}


def grade_documents(state):
    """
    Determines whether the retrieved documents are relevant to the question.

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): Updates documents key with only filtered relevant documents
    """

    print("---CHECK DOCUMENT RELEVANCE TO QUESTION---")
    question = state["question"]
    documents = state["documents"]

    # Score each doc
    filtered_docs = []
    for d in documents:
        score = retrieval_grader.invoke(
            {"question": question, "document": d.page_content}
        )
        grade = score.binary_score
        if grade == "yes":
            print("---GRADE: DOCUMENT RELEVANT---")
            filtered_docs.append(d)
        else:
            print("---GRADE: DOCUMENT NOT RELEVANT---")
            continue
    return {"documents": filtered_docs, "question": question}


def transform_query(state):
    """
    Transform the query to produce a better question.

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): Updates question key with a re-phrased question
    """

    print("---TRANSFORM QUERY---")
    question = state["question"]
    documents = state["documents"]

    # Re-write question
    better_question = question_rewriter.invoke({"question": question})
    return {"documents": documents, "question": better_question}


def web_search(state):
    """
    Web search based on the re-phrased question.

    Args:
        state (dict): The current graph state

    Returns:
        state (dict): Updates documents key with appended web results
    """

    print("---WEB SEARCH---")
    question = state["question"]

    # Web search
    docs = web_search_tool.invoke({"query": question})
    web_results = "\n".join([d["content"] for d in docs])
    web_results = Document(page_content=web_results)

    return {"documents": web_results, "question": question}


### Edges ###


def route_question(state):
    """
    Route question to web search or RAG.

    Args:
        state (dict): The current graph state

    Returns:
        str: Next node to call
    """

    print("---ROUTE QUESTION---")
    question = state["question"]
    source = question_router.invoke({"question": question})
    if source.datasource == "web_search":
        print("---ROUTE QUESTION TO WEB SEARCH---")
        return "web_search"
    elif source.datasource == "vectorstore":
        print("---ROUTE QUESTION TO RAG---")
        return "vectorstore"


def decide_to_generate(state):
    """
    Determines whether to generate an answer, or re-generate a question.

    Args:
        state (dict): The current graph state

    Returns:
        str: Binary decision for next node to call
    """

    print("---ASSESS GRADED DOCUMENTS---")
    state["question"]
    filtered_documents = state["documents"]

    if not filtered_documents:
        # All documents have been filtered check_relevance
        # We will re-generate a new query
        print(
            "---DECISION: ALL DOCUMENTS ARE NOT RELEVANT TO QUESTION, TRANSFORM QUERY---"
        )
        return "transform_query"
    else:
        # We have relevant documents, so generate answer
        print("---DECISION: GENERATE---")
        return "generate"


def grade_generation_v_documents_and_question(state):
    """
    Determines whether the generation is grounded in the document and answers question.

    Args:
        state (dict): The current graph state

    Returns:
        str: Decision for next node to call
    """

    print("---CHECK HALLUCINATIONS---")
    question = state["question"]
    documents = state["documents"]
    generation = state["generation"]

    score = hallucination_grader.invoke(
        {"documents": documents, "generation": generation}
    )
    grade = score.binary_score

    # Check hallucination
    if grade == "yes":
        print("---DECISION: GENERATION IS GROUNDED IN DOCUMENTS---")
        # Check question-answering
        print("---GRADE GENERATION vs QUESTION---")
        score = answer_grader.invoke({"question": question, "generation": generation})
        grade = score.binary_score
        if grade == "yes":
            print("---DECISION: GENERATION ADDRESSES QUESTION---")
            return "useful"
        else:
            print("---DECISION: GENERATION DOES NOT ADDRESS QUESTION---")
            return "not useful"
    else:
        print("---DECISION: GENERATION IS NOT GROUNDED IN DOCUMENTS, RE-TRY---")
        return "not supported"
```

The last branch called `pprint`, which nothing imports: the first answer the hallucination grader rejected would have stopped the run with `NameError`. It is `print` here. The rest, compared with [lesson 15.3](lesson:15.3):

- **`grade_documents` sets no flag.** `decide_to_generate` rewrites the question only when no chunk is left, the rule [lesson 15.3](lesson:15.3)'s practice arrives at.
- **`web_search` returns one `Document`, not a list,** and doesn't keep the retrieved chunks. The prompts accept it, since they turn any value into text, but code that loops over `documents` would not.
- **Two routers call models.** `route_question` runs on the edge out of `START`, and `grade_generation_v_documents_and_question` runs the hallucination grader, then the answer grader only for a grounded answer. Their verdicts are printed, never stored.

## The graph

```python title="Notebook cell"
from langgraph.graph import END, StateGraph, START

workflow = StateGraph(GraphState)

# Define the nodes
workflow.add_node("web_search", web_search)  # web search
workflow.add_node("retrieve", retrieve)  # retrieve
workflow.add_node("grade_documents", grade_documents)  # grade documents
workflow.add_node("generate", generate)  # generate
workflow.add_node("transform_query", transform_query)  # transform_query

# Build graph
workflow.add_conditional_edges(
    START,
    route_question,
    {
        "web_search": "web_search",
        "vectorstore": "retrieve",
    },
)
workflow.add_edge("web_search", "generate")
workflow.add_edge("retrieve", "grade_documents")
workflow.add_conditional_edges(
    "grade_documents",
    decide_to_generate,
    {
        "transform_query": "transform_query",
        "generate": "generate",
    },
)
workflow.add_edge("transform_query", "retrieve")
workflow.add_conditional_edges(
    "generate",
    grade_generation_v_documents_and_question,
    {
        "not supported": "generate",
        "useful": END,
        "not useful": "transform_query",
    },
)

# Compile
app = workflow.compile()
```

```python title="Notebook cell"
for edge in app.get_graph().edges:
    kind = f" (conditional: {edge.data})" if edge.data else " (conditional)" if edge.conditional else ""
    print(f"{edge.source} -> {edge.target}{kind}")
```

```output real
__start__ -> retrieve (conditional: vectorstore)
__start__ -> web_search (conditional)
generate -> __end__ (conditional: useful)
generate -> generate (conditional: not supported)
generate -> transform_query (conditional: not useful)
grade_documents -> generate (conditional)
grade_documents -> transform_query (conditional)
retrieve -> grade_documents
transform_query -> retrieve
web_search -> generate
```

`add_conditional_edges(START, route_question, ...)` makes the entry point conditional: the first decision runs before any node, and the path map turns the router's `"vectorstore"` into the node name `retrieve`. The graph has three cycles: `generate` back to itself, `generate` through `transform_query` to `retrieve`, and `grade_documents` through `transform_query` to `retrieve`.

## Two questions

```python title="Notebook cell" norun
app.invoke({"question": "What is machine learning"})
```

```output saved note="from a run with gpt-4o-mini; the web result trimmed; answers vary per run"
---ROUTE QUESTION---
---ROUTE QUESTION TO WEB SEARCH---
---WEB SEARCH---
---GENERATE---
---CHECK HALLUCINATIONS---
---DECISION: GENERATION IS GROUNDED IN DOCUMENTS---
---GRADE GENERATION vs QUESTION---
---DECISION: GENERATION ADDRESSES QUESTION---
{'question': 'What is machine learning',
 'generation': 'Machine learning (ML) is a subfield of artificial intelligence (AI) that enables machines to learn from data and past experiences to identify patterns and make predictions with minimal human intervention. It allows computers to perform tasks autonomously without explicit programming, improving their performance over time as they are exposed to more data. Essentially, ML focuses on developing algorithms that can learn and generalize from data to perform various tasks.',
 'documents': Document(metadata={}, page_content='What Is Machine Learning?\nMachine learning (ML) is a discipline of artificial intelligence (AI) that provides machines with the ability to automatically learn from data and past experiences while identifying patterns to make predictions with minimal human intervention. [...]')}
```

```python title="Notebook cell" norun
app.invoke({"question": "What is agent memory"})
```

```output saved note="from a run with gpt-4o-mini; documents trimmed; answers vary per run"
---ROUTE QUESTION---
---ROUTE QUESTION TO RAG---
---RETRIEVE---
---CHECK DOCUMENT RELEVANCE TO QUESTION---
---GRADE: DOCUMENT RELEVANT---
---GRADE: DOCUMENT RELEVANT---
---GRADE: DOCUMENT RELEVANT---
---GRADE: DOCUMENT RELEVANT---
---ASSESS GRADED DOCUMENTS---
---DECISION: GENERATE---
---GENERATE---
---CHECK HALLUCINATIONS---
---DECISION: GENERATION IS GROUNDED IN DOCUMENTS---
---GRADE GENERATION vs QUESTION---
---DECISION: GENERATION ADDRESSES QUESTION---
{'question': 'What is agent memory',
 'generation': 'Agent memory refers to the mechanisms by which an autonomous agent retains and recalls information. It includes short-term memory, which utilizes in-context learning, and long-term memory, which allows for the retention of information over extended periods through external storage systems. This memory structure enables agents to improve their performance by learning from past experiences and interactions.',
 'documents': [Document(id='f04b98b3-40ce-4054-bd24-db973875ed8c', metadata={'source': 'https://lilianweng.github.io/posts/2023-06-23-agent/', 'title': "LLM Powered Autonomous Agents | Lil'Log", ...}, page_content="LLM Powered Autonomous Agents | Lil'Log [...]"),
  Document(id='b2b91dc3-164f-47ef-bb1b-942f43a6eb35', metadata={...}, page_content='Fig. 8. Categorization of human memory.\nWe can roughly consider the following mappings:\n\nSensor [...]'),
  Document(id='27435126-cbdd-419a-ae5f-b64fbaa862de', metadata={...}, page_content='One interesting observation is that while the LLM-based evaluation concluded that GPT-4 and ChemCr [...]'),
  Document(id='be5b7243-e3ef-4063-9631-36dc698ef0ab', metadata={...}, page_content='Fig. 7. Comparison of AD, ED, source policy and RL^2 on environments that require memory and explo [...]')]}
```

::: visual adaptive-run | Run player | Two questions through the adaptive graph
Replays the two saved runs: which node ran, what each router decided, and what the state held after each step.
:::

Machine learning isn't one of the index's three topics, so the router sent it to the web: the route, the answer and two checks, four model calls and one search. Agent memory is, so it took the long way: the route, four grades, the answer and two checks, eight model calls. Both passed every check on the first try, and both final states hold the documents the answer came from, a single web `Document` in the first case and a list of chunks in the second.

## Loops without exits

Neither run met a failing check. When one fails, three cycles can start, and none has a limit:

- **`generate` to `generate`** ("not supported"). The grader rejects the answer, and the same documents go to the same prompt. At `temperature=0` the new answer is much like the last, so a strict grader can reject it forever, three calls a round.
- **`generate` to `transform_query`** ("not useful"). For a question the router sent to the web, the rewrite is worded for the vector store and the next stop is `retrieve`: the run goes to the very source the router ruled out, and never returns to the web.
- **`grade_documents` to `transform_query`** (no chunk left). When the index doesn't hold the answer, each rewrite retrieves a new wording of the same miss.

Each ends only at `recursion_limit` ([lesson 11.4](lesson:11.4)). The exits are the ones [lesson 15.1](lesson:15.1) lists: count the attempts in the state and leave with an honest answer after two or three, send web questions back to the web, and keep the limit as a backstop. Practice 1 adds the counter; [lesson 15.5](lesson:15.5)'s script has all three.

## Interview questions

::: check
Why route before retrieving, instead of retrieving every time and grading what comes back?

For an off-topic question, retrieval returns the nearest chunks anyway, and four grading calls then reject them before the search can start: five wasted calls and their latency. A router spends one call to skip all of that, and it can send questions with no need for documents, such as greetings or arithmetic, straight to the model. Its cost is a new failure: a misroute, which the graders after it can't repair, because a web answer is never compared with the index.
:::

::: check
The hallucination grader says "no" and the graph regenerates from the same documents. Does that help?

Sometimes: a second sample may stick closer to the context. At `temperature=0` it is likely to repeat itself, and the loop has no limit. Better: count regenerations and stop after one or two; on the retry, tighten the prompt (answer only from the context, quote it, say "not in the documents" otherwise); and when it still fails, answer that the documents don't support an answer instead of showing an unsupported one.
:::

::: check
This graph makes eight model calls for a question it answers from the index. How do you make it cheaper and faster without losing the checks?

Use a small, fast model for the router and the graders and keep the strong one for the answer; grade the four chunks in one parallel batch; skip grading when the retrieval scores are high; run the answer grader only when it matters, or merge both checks into one call with two fields; cache the router's decision for repeated questions; stream the answer while the checks run, and retract it only when they fail.
:::

::: check
How would you keep the router's description of the index correct as documents are added?

Don't write it by hand: keep a short list of topics next to the indexing code (or generate it from the documents' metadata) and build the router's system message from that list, so both change together. Add test questions per topic to the evaluation set and check their routes after every re-index, and log every route in production so a sudden rise in web searches shows up.
:::

## Practice

::: practice
**Give the rewrite loop an exit.** Add an `attempts` counter to the state: `transform_query` adds one, and `decide_to_generate` sends the run to a `give_up` node once `attempts` reaches 2. Test the wiring with stand-in nodes, on an index that never has the answer.

```python title="Notebook cell"
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

MAX_ATTEMPTS = 2


class CappedState(TypedDict):
    question: str
    generation: str
    documents: list
    attempts: int


def retrieve_nothing(state):
    print("---RETRIEVE---")
    return {"documents": []}  # a stand-in index that never has the answer


def rewrite(state):
    print("---TRANSFORM QUERY---")
    return {"question": state["question"] + " (rephrased)", "attempts": state["attempts"] + 1}


def answer(state):
    print("---GENERATE---")
    return {"generation": "An answer from the documents."}


def give_up(state):
    print("---GIVE UP---")
    return {"generation": "I could not find an answer to that in the documents."}


def decide_to_generate(state):
    if state["documents"]:
        return "generate"
    if state["attempts"] >= MAX_ATTEMPTS:
        return "give_up"
    return "transform_query"


builder = StateGraph(CappedState)
builder.add_node("retrieve", retrieve_nothing)
builder.add_node("transform_query", rewrite)
builder.add_node("generate", answer)
builder.add_node("give_up", give_up)
builder.add_edge(START, "retrieve")
builder.add_conditional_edges("retrieve", decide_to_generate,
                              {"generate": "generate", "transform_query": "transform_query", "give_up": "give_up"})
builder.add_edge("transform_query", "retrieve")
builder.add_edge("generate", END)
builder.add_edge("give_up", END)
capped = builder.compile()

result = capped.invoke({"question": "Who won the 2023 Cricket World Cup?", "attempts": 0})
print(result["generation"], "| attempts:", result["attempts"], "|", result["question"])
```

```output real
---RETRIEVE---
---TRANSFORM QUERY---
---RETRIEVE---
---TRANSFORM QUERY---
---RETRIEVE---
---GIVE UP---
I could not find an answer to that in the documents. | attempts: 2 | Who won the 2023 Cricket World Cup? (rephrased) (rephrased)
```

The grade step is folded into the router to keep the test short. The same counter bounds the "not useful" cycle, with `grade_generation_v_documents_and_question` returning a `give_up` route once `attempts` is spent, and a second counter, incremented by `generate`, bounds "not supported". The question in the final state shows why to keep the original too: after two rewrites, nobody can tell what was asked.
:::

::: practice
**Measure a grader.** Ten answers were labelled by a person ("yes" = supported by the documents) and graded by the hallucination grader. Write `grader_report(results)` that prints how many unsupported answers the grader caught and how many supported ones it rejected.

```python title="Notebook cell"
# (grader verdict, human label) per answer
results = [("yes", "yes"), ("yes", "yes"), ("no", "no"), ("yes", "no"), ("yes", "yes"),
           ("no", "yes"), ("yes", "yes"), ("no", "no"), ("yes", "no"), ("yes", "yes")]


def grader_report(results):
    unsupported = [verdict for verdict, label in results if label == "no"]
    supported = [verdict for verdict, label in results if label == "yes"]
    caught = unsupported.count("no")
    rejected = supported.count("no")
    print(f"unsupported answers caught: {caught} of {len(unsupported)}")
    print(f"supported answers rejected: {rejected} of {len(supported)}")


grader_report(results)
```

```output real
unsupported answers caught: 2 of 4
supported answers rejected: 1 of 6
```

The two numbers fail differently. A missed hallucination reaches the user; a rejected good answer costs a regeneration, three more calls, and in this graph possibly a loop. Ten examples are only a start: collect a few dozen of each kind from real questions, then change the prompt or the model and run the report again.
:::

## Further reading

- Jeong and others, [Adaptive-RAG: Learning to Adapt Retrieval-Augmented Large Language Models through Question Complexity](https://arxiv.org/abs/2403.14403) (NAACL 2024): routing by question complexity with a trained classifier.
- Asai and others, [Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection](https://arxiv.org/abs/2310.11511) (2023): the self-critique that the three graders imitate.
