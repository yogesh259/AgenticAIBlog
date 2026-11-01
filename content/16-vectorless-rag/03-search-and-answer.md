+++
number = "16.3"
title = "Search the tree and answer"
lede = "The retrieval half of vectorless RAG: a model reads the tree and names the sections it needs, code collects them, and a second call answers from them, citing section and page. Then guide the search with domain rules, let PageIndex answer for you, and put the pipeline in one script."
summary = "Tree search with a JSON reply, finding the chosen nodes and two pitfalls of page-based trees, answers that cite section and page, the three steps as one function, expert rules in the search prompt, PageIndex's chat with conversation history, cleaning up, the pipeline in one script with Gemini, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "16 Vectorless RAG: PageIndex_Vectorless_RAG_CrashCourse.ipynb (cells 14-32, 38 and 41-42; questions and expert rules rewritten for attention.pdf, page_index renamed start_index); the parent and shared-page pitfalls, chat(), the one-script pipeline with Gemini, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
data = ["attention_tree.json"]
+++

[Lesson 16.2](lesson:16.2) built the index. This lesson answers questions from it in three steps, one function each: a model reads the tree and names the sections it needs (`llm_tree_search`), code collects those sections (`find_nodes_by_ids`), and a second model call answers from them, citing each section and page (`generate_answer`). The model calls use the OpenAI client from lesson 16.2's setup with `gpt-4o`. The tree is the one you saved there, or the download:

```python title="Notebook cell"
import json

with open("attention_tree.json", encoding="utf-8") as f:
    pageindex_tree = json.load(f)
```

## Search the tree

```python title="Notebook cell"
def llm_tree_search(query: str, tree: list, model: str = "gpt-4o") -> dict:
    """
    Core PageIndex retrieval:
    Sends the query + document tree to an LLM.
    LLM reasons over the structure and returns relevant node_ids.

    Returns: dict with 'thinking' (reasoning) and 'node_list' (node IDs)
    """

    # Compress tree to save tokens: only send titles + short summaries
    def compress(nodes):
        out = []
        for n in nodes:
            entry = {
                "node_id": n["node_id"],
                "title": n["title"],
                "page": n.get("start_index", "?"),
                "summary": n.get("text", "")[:150]  # first 150 chars
            }
            if n.get("nodes"):
                entry["children"] = compress(n["nodes"])
            out.append(entry)
        return out

    compressed_tree = compress(tree)

    prompt = f"""You are given a query and a document's tree structure (like a Table of Contents).
Your task: identify which node IDs most likely contain the answer to the query.
Think step-by-step about which sections are relevant.

Query: {query}

Document Tree:
{json.dumps(compressed_tree, indent=2)}

Reply ONLY in this exact JSON format:
{{
  "thinking": "<your step-by-step reasoning>",
  "node_list": ["node_id1", "node_id2"]
}}"""

    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )

    return json.loads(response.choices[0].message.content)
```

The prompt carries the question and a compressed tree: each node's ID, title, first page and the first 150 characters of its text, nested as in the document, about 1,800 tokens for this paper. The key is called `summary`, but on this tree it holds the start of a node's text, which is the top of its first page and often the end of the previous section; when the tree has real summaries (`node_summary=True` in the cloud), sending `n.get("summary")` gives the model better material. Asking for `thinking` before `node_list` makes the model reason before it commits, and records why it chose what it did.

`response_format={"type": "json_object"}` is OpenAI's JSON mode. It guarantees a reply that parses, not one with your keys, and the API rejects the request unless the word "JSON" appears in the prompt. Structured Outputs, a JSON schema or a Pydantic class as the format, also guarantees the keys, and OpenAI recommends it where a model supports it; [lesson 9.5](lesson:9.5) does the same through LangChain, and so does the script at the end of this lesson. OpenAI shuts `gpt-4o` down on 14 January 2027 and names `gpt-6-luna` as its replacement: change the default then.

```python title="Notebook cell" norun
query = "What does the paper say about how the model was trained?"

print(f"Query: {query}\n")
result = llm_tree_search(query, pageindex_tree)

print("LLM Reasoning:")
print(result.get("thinking", "N/A"))
print()
print("Selected Node IDs:", result.get("node_list", []))
```

```output illustrative note="answers vary per run"
Query: What does the paper say about how the model was trained?

LLM Reasoning:
The query asks how the model was trained. Node 0015, '5 Training', covers exactly this, and its children divide it into training data and batching (0016), hardware and schedule (0017), the optimizer (0018) and regularization (0019). Together they describe the whole training setup, so the section and all its subsections are relevant.

Selected Node IDs: ['0015', '0016', '0017', '0018', '0019']
```

The titles alone were enough: the model took the training section and every subsection, as a reader skimming the contents would.

## Find the chosen nodes

```python title="Notebook cell"
def find_nodes_by_ids(tree: list, target_ids: list) -> list:
    """Recursively walk the tree and collect nodes matching target_ids."""
    found = []
    for node in tree:
        if node["node_id"] in target_ids:
            found.append(node)
        if node.get("nodes"):
            found.extend(find_nodes_by_ids(node["nodes"], target_ids))
    return found
```

```python title="Notebook cell"
for node in find_nodes_by_ids(pageindex_tree, ["0017", "0016", "0006", "0099"]):
    print(node["node_id"], node["title"], f"(p.{node['start_index']})", len(node.get("text", "")), "characters")
```

```output real
0006 3.2 Attention (p.3) 0 characters
0016 5.1 Training Data and Batching (p.7) 3305 characters
0017 5.2 Hardware and Schedule (p.7) 3305 characters
```

The nodes come back in document order, whatever order the IDs were listed in, and an ID that isn't in the tree is skipped without a word. Two things about this tree matter for the next step. "3.2 Attention" has no text of its own, because its opening pages sit in its "(intro)" child; a search that picks only the parent retrieves nothing to answer from. And 5.1 and 5.2 hold the same 3,305 characters: in a page-based tree, sections that share a page share its text, and the answer prompt gets it twice. The practice tasks handle both.

## Write the answer

```python title="Notebook cell"
def generate_answer(query: str, nodes: list, model: str = "gpt-4o") -> str:
    """
    Takes retrieved nodes as context and generates a grounded answer.
    Instructs the LLM to cite section titles and page numbers.
    """
    if not nodes:
        return "No relevant sections found in the document."

    # Build context string from retrieved nodes
    context_parts = []
    for node in nodes:
        context_parts.append(
            f"[Section: '{node['title']}' | Page {node.get('start_index', '?')}]\n"
            f"{node.get('text', 'Content not available.')}"
        )
    context = "\n\n---\n\n".join(context_parts)

    prompt = f"""You are an expert document analyst.
Answer the question using ONLY the provided context.
For every claim you make, cite the section title and page number in parentheses.
Be concise and precise.

Question: {query}

Context:
{context}

Answer:"""

    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )

    return response.choices[0].message.content
```

Each section enters the context under a header with its title and first page, which is exactly what the model is told to cite. "Using ONLY the provided context" grounds the answer as in [lesson 6.3](lesson:6.3); the difference from vector RAG is that the context holds whole named sections rather than anonymous chunks.

## The whole pipeline

```python title="Notebook cell"
def vectorless_rag(query: str, tree: list, verbose: bool = True) -> str:
    """
    Full end-to-end PageIndex RAG pipeline:

    Step 1: LLM Tree Search  → finds relevant node_ids
    Step 2: Node Retrieval   → fetches section content
    Step 3: Answer Generation → produces cited answer
    """
    if verbose:
        print(f"{'=' * 55}")
        print(f"Query: {query}")
        print(f"{'=' * 55}")

    # Step 1: Tree Search
    search_result = llm_tree_search(query, tree)
    node_ids = search_result.get("node_list", [])

    if verbose:
        print(f"\nReasoning: {search_result.get('thinking', '')[:200]}...")
        print(f"Retrieved node IDs: {node_ids}")

    # Step 2: Retrieve nodes
    nodes = find_nodes_by_ids(tree, node_ids)

    if verbose:
        print(f"Sections found: {[n['title'] for n in nodes]}")

    # Step 3: Generate answer
    answer = generate_answer(query, nodes)

    if verbose:
        print(f"\nAnswer:\n{answer}")

    return answer
```

```python title="Notebook cell" norun
answer = vectorless_rag(
    query="What does the paper say about how the model was trained?",
    tree=pageindex_tree
)
```

```output illustrative note="answers vary per run"
=======================================================
Query: What does the paper say about how the model was trained?
=======================================================

Reasoning: The query asks how the model was trained. Node 0015, '5 Training', covers exactly this, and its children divide it into training data and batching (0016), hardware and schedule (0017), the optimizer (...
Retrieved node IDs: ['0015', '0016', '0017', '0018', '0019']
Sections found: ['5 Training', '5.1 Training Data and Batching', '5.2 Hardware and Schedule', '5.3 Optimizer', '5.4 Regularization']

Answer:
The paper trains the Transformer as follows:

1. **Data and batching**: WMT 2014 English-German, about 4.5 million sentence pairs with a shared byte-pair vocabulary of about 37,000 tokens, and WMT 2014 English-French, 36M sentences with a 32,000 word-piece vocabulary; each batch held about 25,000 source and 25,000 target tokens (Section: '5.1 Training Data and Batching', Page 7).
2. **Hardware and schedule**: one machine with 8 NVIDIA P100 GPUs; the base models trained for 100,000 steps or 12 hours at about 0.4 seconds per step, the big models for 300,000 steps or 3.5 days at 1.0 second per step (Section: '5.2 Hardware and Schedule', Page 7).
3. **Optimizer**: Adam with β1 = 0.9, β2 = 0.98 and ε = 10⁻⁹, and a learning rate that rises linearly for the first 4,000 warm-up steps and then falls with the inverse square root of the step number (Section: '5.3 Optimizer', Page 7).
4. **Regularization**: residual dropout with P_drop = 0.1 for the base model, and label smoothing of 0.1, which hurts perplexity but improves accuracy and BLEU (Section: '5.4 Regularization', Page 7).
```

Every claim names its section and page, so each can be checked against the PDF. Several questions in a row, with the progress printing turned off:

```python title="Notebook cell" norun
test_queries = [
    "What does the paper say about how the model was trained?",
    "Why use self-attention instead of recurrent layers?",
    "What BLEU scores did the big model reach?",
]

for q in test_queries:
    print()
    ans = vectorless_rag(q, pageindex_tree, verbose=False)
    print(f"Q: {q}")
    print(f"A: {ans[:300]}...")
    print("-" * 55)
```

```output illustrative note="answers vary per run"

Q: What does the paper say about how the model was trained?
A: The paper trains the Transformer as follows:

1. **Data and batching**: WMT 2014 English-German, about 4.5 million sentence pairs with a shared byte-pair vocabulary of about 37,000 tokens, and WMT 2014 English-French, 36M sentences with a 32,000 word-piece vocabulary; each batch held about 25,000 so...
-------------------------------------------------------

Q: Why use self-attention instead of recurrent layers?
A: The paper compares self-attention with recurrent and convolutional layers on three criteria: the total computational complexity per layer, the amount of computation that can be parallelized, measured by the minimum number of sequential operations, and the path length between long-range dependencies ...
-------------------------------------------------------

Q: What BLEU scores did the big model reach?
A: On WMT 2014 English-to-German the big model reached 28.4 BLEU, more than 2.0 BLEU above the best previously reported models, ensembles included (Section: '6.1 Machine Translation', Page 8). On English-to-French, Table 2 gives 41.8 BLEU, while the text of the same section says 41.0 (Section: '6.1 Mac...
-------------------------------------------------------
```

The third answer shows what citations are for: the paper gives two different numbers for the same result, and the answer says where each comes from. The pipeline runs the same on a tree built on your own machine ([lesson 16.2](lesson:16.2)), as long as its nodes carry their text.

## Add expert rules

A tree search takes domain knowledge as plain rules in its prompt ([lesson 16.1](lesson:16.1)). Routing rules for financial filings look like this:

```python title="Notebook cell"
# These are routing rules that tell the LLM WHERE to look for specific queries.
# Think of it as encoding a senior analyst's institutional knowledge.

FINANCIAL_EXPERT_RULES = """
Expert routing rules for financial documents (10-K, annual reports):
- EBITDA, profitability queries    → MD&A section (Management Discussion & Analysis)
- Liquidity, cash flow queries     → Cash Flow Statement + liquidity footnotes
- Risk factor queries              → Part I, Item 1A (Risk Factors)
- Revenue breakdown queries        → Segment reporting or Item 7
- Forward-looking / strategy       → CEO letter, Outlook, Strategy section
- Debt, credit, leverage queries   → Balance Sheet + debt footnotes
- Regulatory / compliance queries  → Legal Proceedings or regulatory filings
"""

print("Expert rules defined")
print("   These get injected into the retrieval prompt at query time.")
```

```output real
Expert rules defined
   These get injected into the retrieval prompt at query time.
```

Rules are written for one kind of document. For the paper, they route by its own sections:

```python title="Notebook cell"
PAPER_EXPERT_RULES = """
Route queries to the right section of the paper using these rules:

3 Model Architecture  → encoder, decoder, layers, attention, heads, feed-forward, embeddings, positional encoding
4 Why Self-Attention  → complexity per layer, parallelization, path length, recurrent vs convolutional layers
5 Training            → data, batching, hardware, training time, optimizer, learning rate, dropout, label smoothing
6 Results             → BLEU scores, translation results, model variations, parsing
7 Conclusion          → contributions, future work

Cross-cutting rules:
- "cost / how long / how fast"      → 5.2 Hardware and Schedule + 6.1 Machine Translation (training cost)
- "which parts matter / ablations"  → 6.2 Model Variations
- "how attention is computed"       → 3.2.1 + 3.2.2
"""
```

The search function gets the rules as one more part of its prompt:

```python title="Notebook cell"
def llm_tree_search_with_expert(
    query: str,
    tree: list,
    expert_rules: str,
    model: str = "gpt-4o"
) -> dict:
    """
    Same as llm_tree_search() but with domain expert rules injected.
    The LLM uses these rules to guide its reasoning.
    """

    def compress(nodes):
        out = []
        for n in nodes:
            entry = {"node_id": n["node_id"], "title": n["title"],
                     "page": n.get("start_index", "?"),
                     "summary": n.get("text", "")[:150]}
            if n.get("nodes"):
                entry["children"] = compress(n["nodes"])
            out.append(entry)
        return out

    prompt = f"""You are a domain expert analyzing a document.
Find all node IDs that most likely contain the answer to the query.
Use the expert routing rules below to guide your reasoning.

Query: {query}

Document Tree:
{json.dumps(compress(tree), indent=2)}

Expert Routing Rules (follow these carefully):
{expert_rules}

Reply ONLY in this JSON format:
{{
  "thinking": "<your reasoning, referencing the expert rules>",
  "node_list": ["node_id1", "node_id2"]
}}"""

    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)
```

The same question with and without the rules:

```python title="Notebook cell" norun
query = "How expensive was it to train the Transformer?"

print(f"Query: {query}\n")

# Without expert rules
print("-- Without Expert Rules --")
basic = llm_tree_search(query, pageindex_tree)
print("Nodes:", basic.get("node_list"))

print()

# With expert rules
print("-- With Expert Rules --")
guided = llm_tree_search_with_expert(query, pageindex_tree, PAPER_EXPERT_RULES)
print("Nodes:", guided.get("node_list"))
print("Reasoning:", guided.get("thinking", "")[:300])
```

```output illustrative note="answers vary per run"
Query: How expensive was it to train the Transformer?

-- Without Expert Rules --
Nodes: ['0015', '0016', '0017', '0018', '0019']

-- With Expert Rules --
Nodes: ['0017', '0021']
Reasoning: Following the cross-cutting rule for cost questions, I look at 5.2 Hardware and Schedule (0017), which gives the hardware and how long training took, and at 6.1 Machine Translation (0021), where Table 2 compares training costs in FLOPs. The other Training subsections cover data, the optimizer and re
```

Without the rules the model took everything about training; with them it went to the two places that hold numbers about cost, one of them in the results section, where the word "training" appears only in a table. The full pipeline with rules:

```python title="Notebook cell"
def expert_rag(query: str, tree: list, rules: str) -> str:
    """Expert-guided end-to-end RAG pipeline."""
    result = llm_tree_search_with_expert(query, tree, rules)
    nodes = find_nodes_by_ids(tree, result.get("node_list", []))
    return generate_answer(query, nodes)
```

```python title="Notebook cell" norun
answer = expert_rag(
    query="How expensive was it to train the Transformer?",
    tree=pageindex_tree,
    rules=PAPER_EXPERT_RULES
)
print(answer)
```

```output illustrative note="answers vary per run"
Training was cheap compared with earlier models. The models were trained on one machine with 8 NVIDIA P100 GPUs: the base model for 100,000 steps, about 12 hours, and the big model for 300,000 steps, 3.5 days (Section: '5.2 Hardware and Schedule', Page 7). Measured in floating-point operations, training the base model cost 3.3 × 10^18 and the big model 2.3 × 10^19, a fraction of the cost of the best previous models; on English-to-French the big model needed less than a quarter of the training cost of the previous state of the art (Section: '6.1 Machine Translation', Page 8).
```

Rules steer for better and for worse: a wrong or overly broad rule sends the search away from the answer just as reliably. Keep them short, specific to one document type, and test them on questions whose answers you know.

## Let PageIndex answer

PageIndex can run the whole search itself. Its chat takes a question and a `doc_id` and answers from the document with PageIndex's own model, so no OpenAI key is needed:

```python title="Notebook cell" norun
# No OpenAI key needed: PageIndex runs the LLM internally

question = "What are the key findings in this document?"

response = pi_client.chat_completions(
    messages=[{"role": "user", "content": question}],
    doc_id=doc_id
)

answer = response["choices"][0]["message"]["content"]
print("Chat API Answer:")
print(answer)
```

```output illustrative note="trimmed; answers vary per run"
Chat API Answer:
The paper's key findings:

- **A new architecture**: the Transformer drops recurrence and convolutions entirely and relies on multi-head self-attention in both the encoder and the decoder.
- **Better translations**: 28.4 BLEU on WMT 2014 English-to-German, more than 2 BLEU above the best previous results including ensembles, and a new single-model state of the art on English-to-French.
- **Cheaper training**: the computation runs in parallel; the big model trained for 3.5 days on eight P100 GPUs, a small fraction of the cost of earlier models.
- **It generalizes**: on English constituency parsing it performs well with large and with limited training data.
```

The reply has the shape of a Chat Completions response, hence `["choices"][0]["message"]["content"]`. A conversation works as with any chat model ([lesson 7.3](lesson:7.3)): the endpoint remembers nothing, so the code keeps the history and sends all of it with each question.

```python title="Notebook cell" norun
# Keep the full message history for context across turns

conversation_history = []


def chat_with_doc(user_message: str, doc_id: str) -> str:
    """Chat with a document, maintaining conversation history."""
    global conversation_history

    conversation_history.append({"role": "user", "content": user_message})

    response = pi_client.chat_completions(
        messages=conversation_history,
        doc_id=doc_id
    )

    assistant_reply = response["choices"][0]["message"]["content"]
    conversation_history.append({"role": "assistant", "content": assistant_reply})

    return assistant_reply


# Simulate a 3-turn conversation
questions = [
    "What does the Transformer use instead of recurrence?",
    "How does that change training time?",
    "Which results show it works?"
]

for q in questions:
    print(f"\nUser: {q}")
    reply = chat_with_doc(q, doc_id)
    print(f"Assistant: {reply[:400]}...")
    print("-" * 55)
```

```output illustrative note="answers vary per run"

User: What does the Transformer use instead of recurrence?
Assistant: The Transformer replaces recurrence entirely with attention. Its encoder and decoder are stacks of multi-head self-attention and position-wise feed-forward layers, and positional encodings added to the embeddings give the model the order of the tokens, since nothing in it is sequential (3 Model Architecture, pages 2-6)....
-------------------------------------------------------

User: How does that change training time?
Assistant: Because self-attention relates all positions in a constant number of sequential operations, the computation within a training example can run in parallel, where a recurrent layer must process positions one after another (4 Why Self-Attention, page 6). In practice the base model trained in 12 hours and the big model in 3.5 days on 8 P100 GPUs (5.2 Hardware and Schedule, page 7)....
-------------------------------------------------------

User: Which results show it works?
Assistant: The translation results: 28.4 BLEU on WMT 2014 English-to-German, more than 2 BLEU above the best previous models including ensembles, and a new single-model state of the art on English-to-French, at a fraction of the training cost (6.1 Machine Translation, page 8). It also does well on English constituency parsing (6.3, pages 9-10)....
-------------------------------------------------------
```

"That" in the second question means self-attention only because the first turn travels with it. `chat_completions` is kept for existing code; current code calls `pi_client.chat(question, doc_id=doc_id)`, which returns the answer as text and can stream it or add citations (`citations=True`). On a client created with `PageIndexClient(index="cloud", chat="gpt-...")`, the same calls run PageIndex's search agent with your model and key instead of PageIndex's.

## Clean up

```python title="Notebook cell" norun
pi_client.delete_document(doc_id)
```

```output illustrative
{'message': 'Document deleted successfully.'}
```

Deleting removes the tree and the stored file for good, so leave the document while you still have questions for it. A cloud document is billed every month while it is kept ($0.001 per page in September 2026).

## The pipeline in one script

The lesson as one terminal program, with Gemini as the model: read it to revise, press **Explain** on it for every step. It needs `GOOGLE_API_KEY` in `.env` ([lesson 6.1](lesson:6.1)), the packages of [lesson 6.1](lesson:6.1)'s `requirements.txt`, and a tree saved as JSON: `attention_tree.json` from [lesson 16.2](lesson:16.2), or any tree `get_tree` returns.

```python title="vectorless_rag.py" explain
"""Vectorless RAG in one script: Gemini searches a PageIndex tree, then answers from the sections it chose."""
import json

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

load_dotenv()  # GOOGLE_API_KEY from .env

TREE_FILE = "attention_tree.json"  # get_tree(doc_id)["result"], saved as JSON


# 1. The tree search's reply: the model's reasoning, then the node IDs it picks
class TreeSearch(BaseModel):
    thinking: str = Field(description="Step-by-step reasoning about which sections answer the query")
    node_list: list[str] = Field(description="IDs of the nodes most likely to contain the answer")


# 2. Model: with structured output for the search, plain for the answer
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite", temperature=0)
searcher = llm.with_structured_output(TreeSearch)


# 3. The tree as the model reads it: IDs, titles, first pages, a summary or the start of the text
def compress(nodes: list) -> list:
    out = []
    for n in nodes:
        entry = {"node_id": n["node_id"], "title": n["title"], "page": n.get("start_index"),
                 "summary": n.get("summary") or n.get("text", "")[:150]}
        if n.get("nodes"):
            entry["children"] = compress(n["nodes"])
        out.append(entry)
    return out


# 4. Step 1: the tree search
def tree_search(query: str, tree: list) -> TreeSearch:
    prompt = f"""You are given a query and a document's tree structure (like a table of contents).
Identify the node IDs most likely to contain the answer. Think step by step.

Query: {query}

Document tree:
{json.dumps(compress(tree), indent=2)}"""
    return searcher.invoke(prompt)


# 5. Step 2: the chosen nodes, in document order
def find_nodes_by_ids(tree: list, target_ids: list) -> list:
    found = []
    for node in tree:
        if node["node_id"] in target_ids:
            found.append(node)
        if node.get("nodes"):
            found.extend(find_nodes_by_ids(node["nodes"], target_ids))
    return found


# 6. Step 3: the answer, from the sections only, citing each one
def generate_answer(query: str, nodes: list) -> str:
    if not nodes:
        return "No relevant sections found in the document."
    context = "\n\n---\n\n".join(
        f"[Section: '{n['title']}' | Page {n.get('start_index', '?')}]\n{n.get('text', '')}" for n in nodes
    )
    prompt = f"""Answer the question using ONLY the context below.
Cite the section title and page number in parentheses for every claim. Be concise.

Question: {query}

Context:
{context}"""
    return llm.invoke(prompt).text


def main() -> None:
    with open(TREE_FILE, encoding="utf-8") as f:
        tree = json.load(f)
    print("Ask about the document. Type /quit to stop.")
    while True:
        query = input("Question: ").strip()
        if query == "/quit":
            break
        if not query:
            continue
        search = tree_search(query, tree)
        nodes = find_nodes_by_ids(tree, search.node_list)
        print("Sections:", ", ".join(f"{n['title']} (p.{n.get('start_index')})" for n in nodes))
        print(generate_answer(query, nodes))


if __name__ == "__main__":
    main()
```

::: walkthrough

The script has two halves. Steps 1 to 6 are the pipeline: a schema for the search's reply, the model, and one function per step; `main` loads the tree and runs the pipeline for each question you type.

```python title="Setup" norun
import json

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

load_dotenv()  # GOOGLE_API_KEY from .env

TREE_FILE = "attention_tree.json"  # get_tree(doc_id)["result"], saved as JSON
```

**Setup.** `json` reads the tree file and writes the compressed tree into the prompt. The model comes from LangChain's Gemini package, and Pydantic describes the search's reply. `load_dotenv()` puts `GOOGLE_API_KEY` from `.env` into the environment, where the Gemini class finds it. `TREE_FILE` names a tree saved from `get_tree`: the script needs no PageIndex key, because the index was built and saved beforehand.

```python title="Step 1 · Schema" norun
class TreeSearch(BaseModel):
    thinking: str = Field(description="Step-by-step reasoning about which sections answer the query")
    node_list: list[str] = Field(description="IDs of the nodes most likely to contain the answer")
```

**1. The search's reply.** The same two keys the lesson's JSON prompt asked for, now as a Pydantic class. With structured output the model's reply is checked against it, so the code always gets a `thinking` string and a list of IDs instead of hoping the JSON has them ([lesson 9.5](lesson:9.5)). Field order matters: the model writes its reasoning before it commits to IDs.

```python title="Step 2 · Model" norun
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite", temperature=0)
searcher = llm.with_structured_output(TreeSearch)
```

**2. The model.** One Gemini model does both calls. `with_structured_output(TreeSearch)` wraps it into a runnable whose `invoke` returns a `TreeSearch` object; the plain `llm` writes the answer as text. Temperature 0 makes the search pick the same sections more consistently. The name is Google's at the time of writing; check Google's model list **VERIFY**, since Google retires older models.

```python title="Step 3 · compress" norun
def compress(nodes: list) -> list:
    out = []
    for n in nodes:
        entry = {"node_id": n["node_id"], "title": n["title"], "page": n.get("start_index"),
                 "summary": n.get("summary") or n.get("text", "")[:150]}
        if n.get("nodes"):
            entry["children"] = compress(n["nodes"])
        out.append(entry)
    return out
```

**3. The tree as the model reads it.** A recursive copy that keeps only what the search needs: ID, title, first page and a summary, with subsections under `children`. Unlike the lesson's version, it sends a node's real `summary` when the tree has one and falls back to the first 150 characters of its text. Leaving the full text out keeps this paper's tree to about 1,800 tokens.

```python title="Step 4 · tree_search" norun
def tree_search(query: str, tree: list) -> TreeSearch:
    prompt = f"""You are given a query and a document's tree structure (like a table of contents).
Identify the node IDs most likely to contain the answer. Think step by step.

Query: {query}

Document tree:
{json.dumps(compress(tree), indent=2)}"""
    return searcher.invoke(prompt)
```

**4. Step 1, the search.** The prompt holds the question and the compressed tree as indented JSON. It no longer describes the reply's format: the schema does that, and the model's reply arrives as a `TreeSearch`. Expert rules would go here, as one more block of the prompt.

```python title="Step 5 · find_nodes_by_ids" norun
def find_nodes_by_ids(tree: list, target_ids: list) -> list:
    found = []
    for node in tree:
        if node["node_id"] in target_ids:
            found.append(node)
        if node.get("nodes"):
            found.extend(find_nodes_by_ids(node["nodes"], target_ids))
    return found
```

**5. Step 2, the chosen sections.** The lesson's function unchanged: a depth-first walk that collects every node whose ID was chosen, in document order. IDs the model invented match nothing and are dropped.

```python title="Step 6 · generate_answer" norun
def generate_answer(query: str, nodes: list) -> str:
    if not nodes:
        return "No relevant sections found in the document."
    context = "\n\n---\n\n".join(
        f"[Section: '{n['title']}' | Page {n.get('start_index', '?')}]\n{n.get('text', '')}" for n in nodes
    )
    prompt = f"""Answer the question using ONLY the context below.
Cite the section title and page number in parentheses for every claim. Be concise.

Question: {query}

Context:
{context}"""
    return llm.invoke(prompt).text
```

**6. Step 3, the answer.** With no sections the function says so instead of calling the model. Otherwise each section goes into the context under a header with its title and first page, and the prompt asks for an answer from the context only, with a citation for each claim. `.text` returns the reply as one string for any provider, including Gemini, whose `content` can be a list of blocks.

```python title="Question loop" norun
def main() -> None:
    with open(TREE_FILE, encoding="utf-8") as f:
        tree = json.load(f)
    print("Ask about the document. Type /quit to stop.")
    while True:
        query = input("Question: ").strip()
        if query == "/quit":
            break
        if not query:
            continue
        search = tree_search(query, tree)
        nodes = find_nodes_by_ids(tree, search.node_list)
        print("Sections:", ", ".join(f"{n['title']} (p.{n.get('start_index')})" for n in nodes))
        print(generate_answer(query, nodes))


if __name__ == "__main__":
    main()
```

**Question loop.** The tree is loaded once and reused for every question: the index is built once, the questions are many. Each question costs two model calls, the search and the answer, and the loop prints the chosen sections before the answer, so you can see what the answer was built from. `/quit` ends the program.

In one sentence: the model reads the outline and names sections, code fetches them, and the model answers from those sections only, citing each one.

:::

### Run it

```zsh title="Terminal" norun
python vectorless_rag.py
```

```output illustrative note="answers vary per run"
Ask about the document. Type /quit to stop.
Question: How many attention heads does the base model use, and why several?
Sections: 3.2.2 Multi-Head Attention (p.4)
The base model uses h = 8 parallel attention heads, each working in d_k = d_v = d_model/h = 64 dimensions (3.2.2 Multi-Head Attention, page 4). Several heads let the model attend to information from different representation subspaces at different positions, which a single head's averaging inhibits (3.2.2 Multi-Head Attention, page 4). Because each head is smaller, the total cost is similar to that of one head with full dimensionality (3.2.2 Multi-Head Attention, page 4).
Question: /quit
```

### Swap one piece

| Piece | In the script | Alternatives |
|---|---|---|
| Model | `ChatGoogleGenerativeAI(...)` | `ChatOpenAI(model="gpt-4o")`, `ChatGroq(model="openai/gpt-oss-120b")`, `ChatOllama(model="qwen3.5")` ([lesson 6.1](lesson:6.1)); a stronger model for the search, a cheaper one for the answer |
| Tree | `attention_tree.json` | Any tree from `get_tree`: the cloud, the local client, or `run_pageindex.py`'s file under `"structure"` ([lesson 16.2](lesson:16.2)) |
| Search guidance | None | Expert rules as one more block of the search prompt |
| Search rounds | One | A loop: ask whether the sections are enough and search again with what was read ([lesson 16.1](lesson:16.1)); or PageIndex's own agent, `pi_client.chat(query, doc_id=doc_id)` |
| Citations | In parentheses in the text | A Pydantic answer with a list of sources ([lesson 9.5](lesson:9.5)); `chat(..., citations=True)` with PageIndex |

## Interview questions

::: check
The tree search sometimes returns `{"sections": ["0017"]}` and the pipeline answers "No relevant sections found". What happened, and how do you prevent it?

JSON mode guarantees valid JSON, not your keys: the model chose another key, `result.get("node_list", [])` returned an empty list, and the answer step got no sections. Use structured output with a schema (OpenAI's Structured Outputs, or `with_structured_output` as in the script), or validate the reply with a Pydantic model and ask again when it fails. Log the raw reply whenever the node list comes back empty.
:::

::: check
The search picks "3 Model Architecture" for a question about the encoder, and the answer says the context holds no information. Why?

In this tree a parent's own pages live in its "(intro)" child, so the parent's `text` is empty, and `find_nodes_by_ids` returns exactly the nodes named, not their children. The answer prompt got a section header with nothing under it. Expand a chosen parent into its leaves before building the context (the first practice task), or tell the search prompt to choose the most specific sections.
:::

::: check
How would you evaluate this pipeline against the vector RAG app of lesson 6.8 on the same paper?

Write questions with known answers and, for each, the sections and pages that hold the answer. Score retrieval on its own: did the tree search pick those sections, and did the vector retriever return chunks from those pages? Then score the answers for correctness and for citations that point at the right place, with a model as judge and a human spot check. Add cost and latency per question. Run each pipeline more than once: the tree search's picks vary between runs.
:::

## Practice

::: practice
**Expand the model's choice.** A node list from the model can contain unknown IDs, repeats, and parents whose text sits in their children. Write `expand_selection(tree, node_list)` that reports unknown IDs, replaces each chosen node by its leaves (itself, if it has no subsections), and returns each leaf once, in reading order. Try it on `["0006", "0009", "0042", "0009"]`.

```python title="Notebook cell"
def expand_selection(tree, node_list):
    by_id = {}

    def index(nodes):
        for node in nodes:
            by_id[node["node_id"]] = node
            index(node.get("nodes", []))

    def leaves(node):
        if not node.get("nodes"):
            return [node]
        return [leaf for child in node["nodes"] for leaf in leaves(child)]

    index(tree)
    chosen = {}
    for node_id in node_list:
        if node_id not in by_id:
            print(f"unknown node ID: {node_id}")
            continue
        for leaf in leaves(by_id[node_id]):
            chosen[leaf["node_id"]] = leaf
    return [chosen[node_id] for node_id in sorted(chosen)]   # IDs follow reading order


for node in expand_selection(pageindex_tree, ["0006", "0009", "0042", "0009"]):
    print(node["node_id"], node["title"], len(node["text"]), "characters")
```

```output real
unknown node ID: 0042
0007 3.2 Attention (intro) 4307 characters
0008 3.2.1 Scaled Dot-Product Attention 2481 characters
0009 3.2.2 Multi-Head Attention 5650 characters
0010 3.2.3 Applications of Attention in our Model 3169 characters
```

A dict keyed by node ID drops the repeats, and sorting the IDs restores reading order, because PageIndex numbers nodes in the order they appear. "3.2 Attention", empty on its own, became its four leaves, which hold the text.
:::

::: practice
**Fill a context budget.** Write `build_context(nodes, budget)` that adds sections to the answer's context in order, skips a section whose text is already in (sections that share a page), stops before the total would pass `budget` characters, and reports what it did. Try it on the training section and its subsections with two budgets.

```python title="Notebook cell"
def build_context(nodes, budget):
    parts, seen, used = [], set(), 0
    for node in nodes:
        text = node.get("text", "")
        if not text or text in seen:
            print(f"skip {node['node_id']} {node['title']}: nothing new")
            continue
        if used + len(text) > budget:
            print(f"stop at {node['node_id']} {node['title']}: over the budget")
            break
        seen.add(text)
        used += len(text)
        parts.append(f"[Section: '{node['title']}' | Page {node['start_index']}]\n{text}")
    print(f"kept {len(parts)} of {len(nodes)} sections, {used} characters")
    return "\n\n---\n\n".join(parts)


training = find_nodes_by_ids(pageindex_tree, ["0015", "0016", "0017", "0018", "0019"])
context = build_context(training, budget=12_000)
context = build_context(training, budget=6_000)
```

```output real
skip 0016 5.1 Training Data and Batching: nothing new
skip 0017 5.2 Hardware and Schedule: nothing new
skip 0018 5.3 Optimizer: nothing new
kept 2 of 5 sections, 9759 characters
skip 0016 5.1 Training Data and Batching: nothing new
skip 0017 5.2 Hardware and Schedule: nothing new
skip 0018 5.3 Optimizer: nothing new
stop at 0019 5.4 Regularization: over the budget
kept 1 of 5 sections, 3305 characters
```

All five sections start on page 7, and four of them hold exactly that page, so the context needs one copy. 5.4 still repeats page 7 inside pages 7 and 8; removing that overlap needs the text page by page, which `pi_client.get_page_content(doc_id, "7-8")` returns from the index. A budget keeps the answer prompt's size, and its cost, under control when the search picks generously.
:::
