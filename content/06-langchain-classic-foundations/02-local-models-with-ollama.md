+++
number = "6.2"
title = "Local models with Ollama"
lede = "Ollama downloads open models and runs them on your own computer: no key, no cost per call, and your data stays on your machine. Pull a model, chat with it in the terminal, then call it from Python."
summary = "Install Ollama, choose and pull models (general, coding, reasoning, embeddings), run them in the terminal, call them from LangChain with ChatOllama, and stream the answer."
type = "build"
status = "published"
source = "4 Langchain: 4-Embeddings/4.4-ollamaQwen.ipynb (cells 1-3), ModelFile, 1.2-ollama/app.py (gemma:2b); model table added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Hosted models such as Gemini or GPT run on the provider's servers and bill per token. Open models (Llama, Gemma, Qwen and many more) can be downloaded and run locally instead, and Ollama makes that one command. It is the simplest way to experiment without a key, to keep private data off the internet, or to work offline.

## How Ollama works

Ollama is an app that downloads model files and serves them from a local server at `http://localhost:11434`; the terminal commands and LangChain both talk to that server. A model's file is loaded into memory when used, so the model must fit: the download size is a good guide to the memory it needs, and a graphics card or an Apple Silicon Mac (whose CPU and GPU share one pool of memory) makes answers much faster **VERIFY**. Models of 1 to 4 billion parameters run on any recent laptop; 7 to 9 billion want about 8 GB of free memory; larger ones need more.

## Install it and pull a model

Download Ollama from ollama.com, install it and start it. Then, in a terminal:

```zsh title="Terminal" norun
ollama pull gemma:2b
ollama list
```

```output illustrative note="the ID and date differ"
NAME        ID              SIZE      MODIFIED
gemma:2b    b50d6c999e59    1.7 GB    5 seconds ago
```

`ollama pull` downloads a model once. A name has two parts, `model:tag`: the tag picks the size (`2b` = 2 billion parameters) or the variant, and without one Ollama takes the model's default, `latest`.

## Choose a model

| Use | Models to try | Download |
|---|---|---|
| General chat, small and fast | `gemma3:1b`, `llama3.2:3b`, `gemma:2b` | 1 to 2 GB |
| General chat, better answers | `llama3.1:8b`, `qwen3:8b`, `gemma3:12b` | 5 to 8 GB |
| Writing and explaining code | `qwen2.5-coder:7b`, `qwen3-coder`, `deepseek-coder-v2` | 5 to 19 GB |
| Reasoning, thinks before answering | `deepseek-r1:8b`, `qwen3:8b` | about 5 GB |
| Embeddings, for search ([lesson 6.6](lesson:6.6)) | `nomic-embed-text`, `mxbai-embed-large` | under 1 GB |

New versions appear every few months, so take this as a starting list and check the model's page on ollama.com/library for its current tags and sizes **VERIFY**. Coding models are trained on much more source code, so they write and fix code better than general models of the same size.

## Chat in the terminal

```zsh title="Terminal" norun
ollama run qwen2.5-coder:7b
```

```output illustrative note="answers vary per run"
>>> Write a Python function that reverses a string.
def reverse_string(s: str) -> str:
    return s[::-1]
>>> /bye
```

`ollama run` pulls the model if needed and opens a chat; `/bye` ends it. The other commands you will use:

| Command | Does |
|---|---|
| `ollama list` | The models you have, with their sizes |
| `ollama ps` | The models loaded in memory right now |
| `ollama show qwen2.5-coder:7b` | A model's details: parameters, context length, licence |
| `ollama rm gemma:2b` | Deletes a model to free disk space |
| `ollama serve` | Starts the server, when the desktop app isn't running |

## Call it from Python

```python title="Notebook cell" norun
from langchain_ollama import ChatOllama

llm = ChatOllama(model="qwen3.5", temperature=0)
response = llm.invoke("What is unified memory?")
print(response.content)
```

`ChatOllama` is a chat model like the ones of [lesson 6.1](lesson:6.1): messages in, `AIMessage` out, so prompts, parsers and chains work with it unchanged. `model` is any name that `ollama list` shows; `qwen3.5` was created from a model file (last section). `temperature=0` makes answers vary less between runs. Older code uses `Ollama` from `langchain_community.llms`, a deprecated text-completion class; use `ChatOllama`.

A 9-billion-parameter model on a laptop can take a minute for a long answer, and `invoke` shows nothing until the end. `stream` yields the answer in pieces as the model writes them:

```python title="Notebook cell" norun
# Stream the response chunk by chunk so you can see it working
for chunk in llm.stream("What is unified memory?"):
    print(chunk.content, end="", flush=True)
```

```output saved note="trimmed; answers vary per run"
**Unified Memory** is a computer architecture design where the Central Processing Unit (CPU) and the Graphics Processing Unit (GPU) share a single, common pool of memory (RAM) rather than having separate memory pools.

In simpler terms: Instead of the CPU having its own "desk" (System RAM) and the GPU having its own "desk" (VRAM), they both sit at one big shared desk.
[...]
```

Each `chunk` holds a few words. `end=""` keeps them on one line and `flush=True` prints each at once ([lesson 2.7](lesson:2.7) covers generators, which is what `stream` returns). Chains stream the same way: `chain.stream({...})`.

## Import a model file

Ollama can also run a model file you already have, for example one downloaded by LM Studio. Local model files use the GGUF format; `Q4_K_M` in a name means the weights are stored in about 4 to 5 bits each, which makes a 9-billion-parameter model fit in roughly 6 GB. A one-line file named `Modelfile` points to it:

```text title="Modelfile"
FROM ./Qwen3.5-9B-Q4_K_M.gguf
```

```zsh title="Terminal" norun
ollama create qwen3.5 -f Modelfile
ollama run qwen3.5
```

`ollama create` registers the file under a name of your choice; library models need no Modelfile, only `ollama pull`.

| Problem | Fix |
|---|---|
| Connection refused, or "failed to connect" | Ollama isn't running: start the app, or run `ollama serve` |
| "model not found" | Pull it first, or check the exact name with `ollama list` |
| Very slow answers | Use a smaller model, or close apps that use the memory |
