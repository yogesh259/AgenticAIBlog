+++
number = "16.1"
title = "How vectorless RAG works"
lede = "Vector RAG finds the chunks that look most like a question. Vectorless RAG keeps a document's structure as a tree, a table of contents with page numbers and summaries, and lets a model reason its way to the sections that answer the question, the way an expert reads a long report."
summary = "Why similarity isn't relevance, the tree index and how it is built, retrieval as a search with a loop that follows cross-references, vector and vectorless RAG compared, costs and failure modes, when to use which and hybrid designs, interview questions and two practice tasks in plain Python."
type = "concept"
status = "published"
source = "16 Vectorless RAG: VectorLessRAG vs Tranditional.md (the three figures and the trade-offs table); PageIndex_Vectorless_RAG_CrashCourse.ipynb (cells 1, 7, 10, 14, 17, 23, 39); the paper example, benchmarks, costs, failure modes, hybrid designs, interview questions and practice added"
chips = [["i-layers", "Concept"]]
+++

The RAG pipeline of [lesson 6.3](lesson:6.3) splits documents into chunks, embeds them, and answers each question from the chunks nearest to it. That works well for many short, varied documents. Long professional documents are harder. An annual report, a contract, a regulation, a technical manual or a research paper runs to dozens or hundreds of pages written for a reader who navigates: the answer to a question sits in one section while the question's words appear in many, a chunk that holds a number has lost the heading that says what the number measures, and a sentence such as "see Note 7" points at text the chunk doesn't contain. An expert doesn't read such a document by similarity. They open the table of contents, turn to the section that should hold the answer, read it, follow its references, and quote the page.

Vectorless RAG does the same. The index is a tree of the document's sections, with titles, page ranges and short summaries, kept in a JSON file; retrieval is a model reading that tree and deciding which sections to open. There are no embeddings, no chunks and no vector database. The approach is also called reasoning-based or tree-based retrieval. PageIndex, an open-source library with a cloud service, is its best-known implementation, and lessons [16.2](lesson:16.2) and [16.3](lesson:16.3) use it on "Attention Is All You Need", the paper [lesson 6.8](lesson:6.8) searched with vectors.

## Similarity is not relevance

The phrase sums up the case for vectorless RAG. Vector search returns the chunks whose embeddings lie nearest the question's ([lesson 6.6](lesson:6.6)): a stand-in for what you want, the passages that answer it. On long, structured documents the stand-in fails in four ways.

| How it fails | What happens |
|---|---|
| Similar, not relevant | A chunk that shares the question's words outranks the section that answers it: in an annual report, a passage about market conditions can beat the management discussion for a question about EBITDA risks |
| Relevant, not similar | The answer sits in a passage that shares little with the question, such as a definition, a table or a footnote elsewhere in the document |
| Context cut away | A chunk loses its heading and its section: in the paper, "step time was 1.0 seconds" means something only next to "For our big models", which a split can put in another chunk |
| References lost | "as described in Section 3.2.2" points at text the chunk doesn't hold, and nearest-neighbour search has no way to follow it |

Inside vector RAG, better chunking, hybrid search, metadata filters and rerankers soften these problems ([lesson 6.3](lesson:6.3)). Vectorless RAG removes the chunks instead and lets a model judge relevance, the step similarity only approximates.

## The tree index

The index is the document's own outline as a tree. Each node is one section:

```json title="One node of the paper's tree"
{
  "title": "3.2.2 Multi-Head Attention",
  "node_id": "0009",
  "start_index": 4,
  "end_index": 5,
  "summary": "Runs attention h = 8 times in parallel on smaller projections and joins the results.",
  "nodes": []
}
```

`node_id` is the handle the search returns, numbered in reading order; `start_index` and `end_index` are the first and last page, which make citations possible; `summary` is a few sentences a model writes at indexing time (this one was written for the example); `nodes` holds the subsections. A node can also carry its `text`, or the code fetches the text of its pages when the search picks it.

Building the tree follows the document, not a token count:

| Step | What happens |
|---|---|
| 1. Look for a table of contents | Scan the first pages for one (PageIndex checks the first 20 by default) |
| 2. Read the structure | Parse the table of contents when there is one; otherwise a model reads the pages and infers the headings |
| 3. Split by section | Cut at section boundaries; a section over a limit (10 pages or 20,000 tokens by default) is split further |
| 4. Summarise | A model writes a short summary of each node |
| 5. Assemble | Nest the nodes, parent to child to grandchild, number them, and save the tree as JSON |

PageIndex Flash, the default local indexer since August 2026, takes the structure from the layout instead: font sizes, section numbers and the PDF's bookmarks, with no model involved. A model then only writes the summaries and tidies the tree. Indexing runs once per document. PageIndex reports about $0.001 per page with a small model on your own machine; its cloud charges $0.01 per page to index and $0.001 per page and month to keep the index (September 2026 prices).

The tree is small compared with the text. The paper's 26 nodes, sent as IDs, titles, first pages and a 150-character excerpt each, take about 1,800 tokens; the paper itself is about 10,000. That ratio is what makes the approach work on long documents: a report of several hundred pages still has a tree a model can read in one prompt **VERIFY**.

## Retrieval is a search

A question is answered in a loop:

1. **Read the tree.** The question and the tree (titles, pages, summaries) go to the model in one prompt.
2. **Pick sections.** The model writes its reasoning and returns the node IDs it wants, as JSON.
3. **Read their pages.** Code fetches the text of those nodes.
4. **Enough to answer?** If not, the model follows a reference in what it read, or picks more sections, and the loop goes back to step 2.
5. **Answer.** The model answers from what it read and cites each section's title and page.

::: visual tree-search | Figure | A tree search
The loop, and one question about the paper that needs two rounds.
:::

The loop makes retrieval agentic in the sense of [lesson 8.1](lesson:8.1): the model decides where to look next and when it has read enough. PageIndex's own chat runs it as an agent with tools that read the structure and fetch pages; its authors cite AlphaGo's tree search as the inspiration. The code in [lesson 16.3](lesson:16.3) makes one pass, steps 1, 2, 3 and 5, which is enough when the first pick holds the answer.

Two properties come with reasoning that similarity can't give:

- **Traceable answers.** The model's reasoning and the sections it chose are part of the result, so an answer can cite "6.2 Model Variations, page 8" and a reader can check it. Documents can disagree with themselves: the paper's abstract and its Table 2 report 41.8 BLEU for English to French, the text of section 6.1 says 41.0. A citation shows which one the answer used.
- **Domain knowledge in the prompt.** Rules such as "EBITDA and profitability questions: look in the management discussion" or "risk questions: Part I, Item 1A" go into the search prompt and steer the choice at once. The usual way to teach a vector pipeline the same knowledge is to fine-tune the embedding model, which is slow and costly; metadata filters, query rewriting and rerankers are cheaper levers it also has.

## Two pipelines side by side

::: visual two-pipelines | Figure | Two ways to retrieve
The same document and question through vector RAG and through vectorless RAG.
:::

| | Vector RAG | Vectorless RAG |
|---|---|---|
| Preparing the document | Split into chunks of a fixed size | Build a tree that follows its sections |
| Index | One embedding per chunk | Title, pages and summary per section |
| Storage | A vector database: FAISS, Chroma, Pinecone | A JSON file |
| Finding passages | Embed the question, search for the nearest vectors (approximate nearest neighbours) | A model reads the tree and picks sections |
| What comes back | Anonymous chunks | Named sections with page numbers |
| Why these passages | A similarity score | The model's stated reasoning |
| Adding domain knowledge | Fine-tune the embeddings; filters, rewriting, rerankers | Rules in the prompt |
| Time to retrieve | Milliseconds | Seconds: one or more model calls before the answer |
| Scale | Millions of chunks across many documents | One document, or a handful, per search |
| Best for | Many short, varied documents; fast lookups; chatbots | Long structured documents: filings, contracts, manuals, papers |

How large is the difference in accuracy? PageIndex reports 98.7% on FinanceBench, a set of questions about public companies' filings, for Mafin 2.5, a financial question-answering system built on it. The FinanceBench paper itself found that GPT-4 Turbo with a vector retriever answered 81% of a 150-question sample wrongly or not at all. PageIndex's own chart sets 50% for vector RAG beside its 98.7%. The results come from different systems, models and years, so read them as a sign of how hard filings are for chunk retrieval, not as a controlled comparison. Comparison tables that give vector RAG about 80% on FinanceBench match neither source.

## Costs and failure modes

| Problem | Why it happens | What helps |
|---|---|---|
| A wrong or flat tree | Scanned pages with no text, documents without headings (emails, chat logs, FAQs), bookmarks that don't match the headings | OCR first (PageIndex's cloud runs it); print the tree before trusting it ([lesson 16.2](lesson:16.2) shows one built wrongly); use vector RAG for flat text |
| The tree doesn't fit the prompt | Thousands of nodes in a very long document or a whole library | Search level by level: the top level first, then only the children of the chosen nodes; shortlist documents before searching their trees |
| Invented or wrong node IDs | The model misreads the tree or makes an ID up | Check every ID against the tree, ask again, use a stronger model for the search |
| Different picks on each run | The search is a model's judgement | Temperature 0, expert rules, and an evaluation set to measure retrieval: two runs of almost the same question picked 12 and then 7 sections of one syllabus |
| Slow, costly questions | At least two model calls per question, with the tree in the prompt | Cache trees and frequent answers, a smaller model for simple documents, vector search for quick lookups |
| Too much text, or the same text twice | A chosen parent drags in all its pages; sections that share a page bring it twice | Prefer leaves, read each page once, cap the context ([lesson 16.3](lesson:16.3)) |

A short document needs neither approach. The paper's 10,000 tokens fit in any current model's context window, so for one paper you could send it whole. PageIndex's own measurements make the same point from the other side: sending the full PDF with each question costs about twice as much as a tree search at 52 pages and 16 times as much at 420, and at 805 pages it no longer fits.

## When to use which

- **Vector RAG:** many short, varied documents such as FAQs, product descriptions or support tickets; questions worded differently from the text; sub-second search over millions of chunks.
- **Vectorless RAG:** long, professionally structured documents such as filings, reports, contracts, manuals, regulations and papers; answers that must cite a section and a page; domain rules that should guide the search; no vector database to run.
- **Both:** shortlist documents with vector or keyword search, then search the tree inside each one; or store each chunk's place in the tree (its section path and pages) as metadata, so vector hits keep their context. An agent can hold a vector retriever and a tree search as two tools and choose per question, the agentic RAG of [lesson 15.2](lesson:15.2).

## Interview questions

::: check
Your RAG app over annual reports quotes plausible numbers that turn out to come from the wrong year or the wrong segment. Would vectorless retrieval help, and what would you check first?

Check retrieval first: log the chunks behind each wrong answer. If they are similar-looking passages from other sections (another year's table, the overview instead of the segment note), the problem is that chunks have lost their place, and a tree search that opens "Segment information, 2025" by its title, and cites the page, addresses exactly that. Before switching, try the cheaper fixes too: section headings and years as chunk metadata with filters, and a reranker. Compare both on a fixed set of questions with known answers.
:::

::: check
When would you not use vectorless RAG?

When documents are short or have no structure (chat logs, emails, FAQ entries): the tree is flat and a model reading it adds cost and nothing else. When latency must be milliseconds, since every question needs at least one model call before the answer. When the corpus is huge and the question could be anywhere: a tree search reads one document at a time, so something cheaper has to shortlist documents first. And when the whole document fits comfortably in the model's context and rarely changes: send it whole.
:::

::: check
How is the tree built for a PDF with no table of contents, and what can go wrong?

Without a table of contents, a model reads the pages and infers the headings and their levels (PageIndex's standard mode), or a layout analysis detects them from font sizes and numbering (PageIndex Flash). Either can go wrong: scanned pages have no text to read, decorative text can look like a heading, numbering can skip levels, and bookmarks can disagree with the headings. A wrong tree misleads every later search, so print it and spot-check a few sections against the PDF before you index thousands of documents the same way.
:::

::: check
The tree search returns node IDs that don't exist, or a different set of sections each run. How do you make it robust?

Validate the output: drop IDs that aren't in the tree and ask again if nothing valid remains; use structured output so the reply always parses ([lesson 9.5](lesson:9.5)). Lower the temperature, add expert rules for the document type, and give nodes good summaries, since the model can only choose well from what it reads. Then measure retrieval on its own, with questions whose answering sections you know, and compare models: retrieval quality depends on the model's reasoning more than anything else.
:::

::: check
A company has 50,000 contracts and wants cited answers to questions about them. Sketch a design.

Two stages. First, narrow the corpus: metadata filters (customer, date, contract type) and a document-level vector or keyword search over titles and summaries pick a few candidate contracts. Second, run a tree search inside each candidate and answer from the chosen sections, citing contract, clause and page. Index each contract once, when it arrives, and store its tree with its metadata. Evaluate both stages separately, and cache answers to frequent questions, since every tree search costs model calls.
:::

::: check
A teammate says vectorless RAG is always more accurate than vector RAG because a benchmark shows 98.7%. What do you answer?

That number is PageIndex's result for its own financial QA system on FinanceBench, filings only, with a strong model; the benchmark paper's baseline used a different model and setup, so the two figures aren't a controlled comparison. Accuracy depends on the documents, the questions, the model and the details of each pipeline. Run both on your own documents and questions, and count cost and latency as well as accuracy.
:::

## Practice

::: practice
**Headings to a tree.** A table of contents gives headings as a flat list of (number, title, first page). Build the tree a tree index stores: node IDs in reading order ("0000", "0001", ...), each node's first and last page (a section ends on the page where the next section at its own level or above begins, or on the document's last page), and subsections under `nodes`. Print it with indentation. Use the paper's numbered headings; it has 15 pages.

```python title="Notebook cell"
headings = [
    ("1", "Introduction", 2), ("2", "Background", 2), ("3", "Model Architecture", 2),
    ("3.1", "Encoder and Decoder Stacks", 3), ("3.2", "Attention", 3),
    ("3.2.1", "Scaled Dot-Product Attention", 4), ("3.2.2", "Multi-Head Attention", 4),
    ("3.2.3", "Applications of Attention in our Model", 5),
    ("3.3", "Position-wise Feed-Forward Networks", 5), ("3.4", "Embeddings and Softmax", 5),
    ("3.5", "Positional Encoding", 6), ("4", "Why Self-Attention", 6), ("5", "Training", 7),
    ("5.1", "Training Data and Batching", 7), ("5.2", "Hardware and Schedule", 7),
    ("5.3", "Optimizer", 7), ("5.4", "Regularization", 7), ("6", "Results", 8),
    ("6.1", "Machine Translation", 8), ("6.2", "Model Variations", 8),
    ("6.3", "English Constituency Parsing", 9), ("7", "Conclusion", 10),
]


def build_tree(headings, last_page):
    root = {"nodes": []}
    stack = [(0, root)]                       # the open path from the root: (level, node)
    in_order = []
    for i, (number, title, page) in enumerate(headings):
        level = number.count(".") + 1
        node = {"node_id": f"{i:04d}", "title": f"{number} {title}", "start_index": page, "nodes": []}
        while stack[-1][0] >= level:          # close sections at this level or deeper
            stack.pop()
        stack[-1][1]["nodes"].append(node)
        stack.append((level, node))
        in_order.append((level, node))
    for i, (level, node) in enumerate(in_order):
        later = (n for lv, n in in_order[i + 1:] if lv <= level)
        node["end_index"] = next((n["start_index"] for n in later), last_page)
    return root["nodes"]


def show(nodes, depth=0):
    for n in nodes:
        print(f"{'  ' * depth}{n['node_id']} {n['title']} (p.{n['start_index']}-{n['end_index']})")
        show(n["nodes"], depth + 1)


show(build_tree(headings, last_page=15))
```

```output real
0000 1 Introduction (p.2-2)
0001 2 Background (p.2-2)
0002 3 Model Architecture (p.2-6)
  0003 3.1 Encoder and Decoder Stacks (p.3-3)
  0004 3.2 Attention (p.3-5)
    0005 3.2.1 Scaled Dot-Product Attention (p.4-4)
    0006 3.2.2 Multi-Head Attention (p.4-5)
    0007 3.2.3 Applications of Attention in our Model (p.5-5)
  0008 3.3 Position-wise Feed-Forward Networks (p.5-5)
  0009 3.4 Embeddings and Softmax (p.5-6)
  0010 3.5 Positional Encoding (p.6-6)
0011 4 Why Self-Attention (p.6-7)
0012 5 Training (p.7-8)
  0013 5.1 Training Data and Batching (p.7-7)
  0014 5.2 Hardware and Schedule (p.7-7)
  0015 5.3 Optimizer (p.7-7)
  0016 5.4 Regularization (p.7-8)
0017 6 Results (p.8-10)
  0018 6.1 Machine Translation (p.8-8)
  0019 6.2 Model Variations (p.8-9)
  0020 6.3 English Constituency Parsing (p.9-10)
0021 7 Conclusion (p.10-15)
```

A stack holds the open path from the root, as when checking brackets: a heading pops every open section at its own level or deeper, then becomes a child of what remains on top. Sections share a page when one ends and the next begins on it, which is how page-based indexes count. Compare the result with the tree PageIndex builds in [lesson 16.2](lesson:16.2): the ranges match, and PageIndex adds the abstract, the references and an "(intro)" node for each parent's opening pages.
:::

::: practice
**Follow the references.** In step 4 of the loop, the search follows references in what it has read. Given short excerpts of four sections, write `follow(start, max_hops)` that reads `start`, then every section its text mentions as "Section X.Y", or as a table that lives in another section, breadth-first, each section once, for at most `max_hops` rounds. Print a line for a reference that leads nowhere.

```python title="Notebook cell"
import re

excerpts = {
    "3.2.2": "In this work we employ h = 8 parallel attention layers, or heads.",
    "6.1": "The configuration of this model is listed in the bottom line of Table 3.",
    "6.2": "In Table 3 rows (A), we vary the number of attention heads and the attention key and value "
           "dimensions, keeping the amount of computation constant, as described in Section 3.2.2.",
    "6.3": "Table 4: The Transformer generalizes well to English constituency parsing "
           "(Results are on Section 23 of WSJ)",
}
table_home = {"Table 3": "6.2", "Table 4": "6.3"}     # the section each table sits in


def references(text):
    refs = re.findall(r"Section (\d+(?:\.\d+)*)", text)
    refs += [table_home[t] for t in re.findall(r"Table \d+", text) if t in table_home]
    return refs


def follow(start, max_hops=3):
    read, frontier = [start], [start]
    for _ in range(max_hops):
        found = []
        for section in frontier:
            for ref in references(excerpts[section]):
                if ref not in excerpts:
                    print(f"  {section}: no section {ref} in this document")
                elif ref not in read:
                    read.append(ref)
                    found.append(ref)
        if not found:
            break
        frontier = found
    return read


print(follow("6.1"))
print(follow("6.1", max_hops=1))
print(follow("6.3"))
```

```output real
['6.1', '6.2', '3.2.2']
['6.1', '6.2']
  6.3: no section 23 in this document
['6.3']
```

A breadth-first search with a visited list: each round reads the sections the previous round pointed to, and the list keeps a section that two others mention from being read twice. The hop limit plays the part of the loop's limit in a real search, where every round costs a model call. The last run shows why a model, not a regular expression, should judge references: "Section 23 of WSJ" names part of a dataset, not of the paper.
:::

## Further reading

- PageIndex, [PageIndex: Next-Generation Vectorless, Reasoning-based RAG](https://pageindex.ai/blog/pageindex-intro) (2025): the idea in its authors' words.
- PageIndex on [GitHub](https://github.com/VectifyAI/PageIndex) and its [documentation](https://docs.pageindex.ai/): the open-source indexer, Flash, the SDK, the cloud and their benchmarks.
- Islam and others, [FinanceBench: A New Benchmark for Financial Question Answering](https://arxiv.org/abs/2311.11944) (2023): questions over public filings, and how often retrieval over them goes wrong.
