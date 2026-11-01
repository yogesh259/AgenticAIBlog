# Agentic AI — From Foundations to Autonomous Multi-Agent Systems

[![Python](https://img.shields.io/badge/Python-3.12%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg?logo=vercel&logoColor=white)](https://vercel.com/)
[![Search](https://img.shields.io/badge/Search-Pagefind-orange.svg)](https://pagefind.app/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A comprehensive, code-first tutorial and static knowledge base on building production-ready AI agents and agentic systems. Covers the full progression from modern Python fundamentals and Pydantic validation to LangChain v1, LangGraph architectures, advanced RAG patterns, human-in-the-loop workflows, and production guardrails.

---

## 🌟 Key Highlights

- **19 In-Depth Modules & 113+ Lessons**: Structured step-by-step curriculum with progressive difficulty.
- **Code-First Explanations**: Real-world scripts, practical patterns, state schemas, and runnable code blocks.
- **Interactive Visual Walkthroughs**: Visual architectural diagrams, state machine flows, and execution traces.
- **Instant Client-Side Search**: Fully indexed offline full-text search powered by [Pagefind](https://pagefind.app/).
- **Zero-Runtime Overhead**: Statically compiled HTML/CSS/JS with zero client framework bloat, optimized for instant load times.

---

## 📚 Curriculum Roadmap

The curriculum is structured into four progressive stages:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│ 1. Foundations  │ ──> │  2. LangChain   │ ──> │  3. LangGraph   │ ──> │ 4. RAG & Production │
│ Python, OOP,    │     │ Classic & v1,   │     │ State, Nodes,   │     │ Adaptive RAG,       │
│ Pydantic        │     │ Tools, Memory   │     │ HITL, Workflows │     │ Gateways, Safety    │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────────┘
```

### Part 1: Foundations
| Module | Title | Topics Covered |
|:---:|---|---|
| **00** | **Project Setup** | Python environment management (`uv`, `venv`), VS Code, `.env` security |
| **01** | **Python Core** | Syntax, control flow, functions, modules, data structures, and exceptions |
| **02** | **Python: OOP & Advanced** | Classes, magic methods, generators, decorators, memory, and concurrency |
| **03** | **Python for Data & Apps** | NumPy, Pandas, SQLite, structured logging, Flask & Streamlit UI |
| **04** | **Pydantic Essentials** | Data validation, typed schemas, serialization, and structured outputs |
| **05** | **Python Cheat Sheet** | Syntax references, algorithmic patterns, and agentic AI utilities |

### Part 2: LangChain Foundations & v1
| Module | Title | Topics Covered |
|:---:|---|---|
| **06** | **LangChain Classic** | Chat models, document loaders, chunking strategies, vector stores (FAISS, Chroma) |
| **07** | **LCEL & Chat History** | LangChain Expression Language, runnables, message histories, trimming |
| **08** | **Agents vs Agentic AI** | Conceptual distinction, autonomous loops, delegation, and multi-agent systems |
| **09** | **LangChain v1** | `create_agent`, modern model bindings, tools, middleware, structured output |

### Part 3: LangGraph & Workflow Patterns
| Module | Title | Topics Covered |
|:---:|---|---|
| **10** | **LangGraph Fundamentals** | State definition, nodes, conditional edges, and cyclical graphs |
| **11** | **LangGraph Components** | State schemas, ReAct agent pattern, memory checkpointers, streaming modes |
| **12** | **Debugging & Observability** | Tracing runs with LangSmith, interactive stepping in LangGraph Studio |
| **13** | **Workflow Patterns** | Prompt chaining, routing, parallelization, orchestrator-worker, evaluator-optimizer |
| **14** | **Human-in-the-Loop** | Breakpoints, state inspection, dynamic human intervention, time-travel debugging |

### Part 4: Production Systems & Safety
| Module | Title | Topics Covered |
|:---:|---|---|
| **15** | **RAG with LangGraph** | Corrective RAG (CRAG), Self-RAG, and Adaptive RAG architectures |
| **16** | **Vectorless RAG** | Tree-based document indexing and hierarchical search with PageIndex |
| **17** | **Guardrails** | Input/output validation, PII redaction, content moderation, layered safety |
| **18** | **LLM Gateway** | LiteLLM routing, load balancing, caching, fallbacks, and cost tracking |

---

## 🛠️ Architecture & Tech Stack

- **Site Generator**: Custom Python static site builder using [Jinja2](https://jinja.palletsprojects.com/) and [Markdown-It-Py](https://markdown-it-py.readthedocs.io/).
- **Syntax Highlighting**: [Pygments](https://pygments.org/) with tailored dark/light theme tokens.
- **Search Engine**: [Pagefind](https://pagefind.app/) static search index builder.
- **Styling**: Vanilla CSS design system with custom CSS custom properties (tokens), responsive layout, and dark mode.
- **Hosting**: [Vercel](https://vercel.com/) (configured via `vercel.json` for automated builds).

---

## 🚀 Local Development

### Prerequisites
- Python 3.12 or newer
- [`uv`](https://github.com/astral-sh/uv) (recommended) or standard `pip`

### 1. Clone the Repository
```zsh
git clone https://github.com/yogesh259/AgenticAIBlog.git
cd AgenticAIBlog
```

### 2. Set Up Virtual Environment & Dependencies
Using `uv`:
```zsh
uv venv --python 3.12
uv pip install -r requirements.txt
```

Or using standard `python3`:
```zsh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Build & Preview Locally
Run the static site builder with live preview:
```zsh
.venv/bin/python tools/build_site.py --serve
```

Open [http://localhost:8000](http://localhost:8000) in your browser. The local server enables full client-side search and live navigation.

---

## 📂 Repository Structure

```text
├── content/              # Markdown lesson content, diagrams, assets, and modules.toml
│   ├── 00-project-setup/
│   ├── ...
│   ├── 18-llm-gateway/
│   └── modules.toml      # Master curriculum configuration & module order
├── design/               # Theme CSS variables, design tokens, and style board
├── site/                 # Jinja2 templates, icons, CSS, and client-side JavaScript
│   ├── static/           # Static styles, favicon, and scripts
│   └── templates/        # Page layout templates (base, module, lesson, chips)
├── tools/
│   ├── build_site.py     # Main build script (compiles content/ -> dist/)
│   └── requirements-site.txt
├── requirements.txt      # Build dependencies (Jinja2, markdown-it, pygments, pagefind)
├── vercel.json           # Vercel deployment & build configuration
└── README.md             # Project documentation
```

---

## ☁️ Deployment

The repository is configured for automated deployment on **Vercel**:

1. Import the repository in the Vercel dashboard.
2. Ensure **Framework Preset** is set to **Other**.
3. Leave build settings default (`vercel.json` handles the environment setup, compilation into `dist/`, and Pagefind indexing).
4. Every push to the `master` branch triggers an automated build and deployment.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
