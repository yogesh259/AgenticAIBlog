+++
number = "10.3"
title = "A chatbot graph"
lede = "Put a chat model inside a node: the conversation lives in the state, a reducer appends each new message, and the whole chatbot fits in one short script."
summary = "Messages in the state, reducers and add_messages, MessagesState, a chat model inside a node, invoking and streaming the graph, why it forgets between runs, how it compares with create_agent, the chatbot in one script with Gemini, interview questions and three practice tasks."
type = "concept"
status = "published"
source = "10 Intro to LangGraph: 2-chatbot.ipynb (cells 1-12; model changed, the user's name replaced, builder and graph renamed); 3 Intro to LangGraph.pdf (slide 2, the specific workflow); reducers in depth, memory, the comparison with create_agent, the one-script chatbot with Gemini, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

The graph of [lesson 10.2](lesson:10.2) carried one string. A chatbot carries a conversation: a list of messages that grows with every turn. This lesson builds the simplest graph with a model in it, input → `START` → chatbot → `END`, where one node sends the conversation to a chat model and adds the reply. Two ideas are new: messages in the state, and a reducer that adds to a value instead of replacing it.

## Messages in the state

```python title="Notebook cell"
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

## Reducers
from typing import Annotated  # attaches extra information, here a reducer, to a type hint
from langgraph.graph.message import add_messages  # merges new messages into the list


class State(TypedDict):
    messages: Annotated[list, add_messages]
```

In [lesson 10.2](lesson:10.2) each update replaced `graph_info`. Done that way here, the chatbot node's reply would wipe out the conversation. A *reducer* changes how one key takes an update: LangGraph calls it with the current value and the update, and stores what it returns. `Annotated[list, add_messages]` reads "a list, merged with `add_messages`": `Annotated` attaches the function to the hint, and LangGraph looks for it there ([lesson 5.2](lesson:5.2), section 3, does the same in plain Python).

`add_messages` is an ordinary function, so it can be tried on its own:

```python title="Notebook cell"
from langchain_core.messages import AIMessage, HumanMessage

history = [HumanMessage("Hi, my name is Alice", id="1"), AIMessage("Hello Alice!", id="2")]

appended = add_messages(history, "I like cricket")
replaced = add_messages(history, AIMessage("Hello, Alice! Nice to meet you.", id="2"))
for messages in (appended, replaced):
    print([(m.type, m.content) for m in messages])
```

```output real
[('human', 'Hi, my name is Alice'), ('ai', 'Hello Alice!'), ('human', 'I like cricket')]
[('human', 'Hi, my name is Alice'), ('ai', 'Hello, Alice! Nice to meet you.')]
```

It does three things. New messages are appended. A string, a `("user", text)` tuple or a role and content dict becomes a message object, here a `HumanMessage`. And a message whose ID is already in the list replaces that message in place. Every message gets an ID when it is added, which is what later lets a person correct one message of a saved conversation, or a summary take the place of old ones ([lesson 9.6](lesson:9.6)); a `RemoveMessage(id=...)` in an update deletes one.

::: visual replace-or-append | Figure | Replace or append
What happens to a key when a node returns an update, without a reducer and with add_messages.
:::

A state with only a `messages` key is so common that LangGraph ships it: `MessagesState`, imported from `langgraph.graph`, is the class above, and graphs that need more keys subclass it ([lesson 14.1](lesson:14.1) uses it).

## Create the model

Load the keys from `.env` ([lesson 0.3](lesson:0.3)), then pick a provider. The node below works with any of them.

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

:::: tabs
::: tab Groq
```python title="Notebook cell" norun
from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-120b")
llm.invoke("Hey I am Alice and i like to play cricket")
```

```output illustrative note="from a run with Qwen 2.5 32B, since retired; metadata trimmed; answers vary per run"
AIMessage(content="Hello Alice! That's great to hear that you enjoy playing cricket. Cricket is a fantastic sport that requires skill, strategy, and teamwork. Whether you play as a batsman, bowler, or fielder, each role offers unique challenges and excitement.\n\nIf you have any questions about cricket, tips on how to improve your game, or anything else cricket-related, feel free to ask!", response_metadata={'model_name': 'qwen-2.5-32b', 'finish_reason': 'stop', ...}, usage_metadata={'input_tokens': 39, 'output_tokens': 79, 'total_tokens': 118})
```

Groq has retired the Qwen models older examples use here (`qwen-2.5-32b`, `qwen-qwq-32b`, `qwen/qwen3-32b`); `openai/gpt-oss-120b` is the replacement it names ([lesson 9.1](lesson:9.1)). The answers in this lesson came from Qwen 2.5 32B.
:::
::: tab Gemini
```python title="Notebook cell" norun
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
```
:::
::: tab OpenAI
```python title="Notebook cell" norun
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o")
llm.invoke("Hello")
```

```output saved note="metadata trimmed"
AIMessage(content='Hello! How can I assist you today?', additional_kwargs={'refusal': None}, response_metadata={'token_usage': {'completion_tokens': 10, 'prompt_tokens': 8, 'total_tokens': 18, ...}, 'model_name': 'gpt-4o-2024-08-06', 'finish_reason': 'stop', ...}, id='run-902c91c5-ea3a-4466-a6c3-fea75daf2ca0-0', usage_metadata={'input_tokens': 8, 'output_tokens': 10, 'total_tokens': 18, ...})
```

OpenAI retires `gpt-4o` on 14 January 2027 and names `gpt-6-luna` as its replacement: change the name then.
:::
::: tab Ollama
```python title="Notebook cell" norun
from langchain_ollama import ChatOllama

llm = ChatOllama(model="qwen3.5")
```
:::
::::

## Write the chatbot node

```python title="Notebook cell"
def superbot(state: State):
    return {"messages": [llm.invoke(state["messages"])]}
```

The node sends the whole conversation to the model and returns the reply in a one-item list; `add_messages` appends it to the state. The model sees exactly the messages in the state and nothing else: no earlier conversation unless the state holds it, no instructions unless one of the messages is a system message.

## Build and run the graph

```python title="Notebook cell" norun
builder = StateGraph(State)

## node
builder.add_node("SuperBot", superbot)
## Edges
builder.add_edge(START, "SuperBot")
builder.add_edge("SuperBot", END)

graph = builder.compile()

## Display
from IPython.display import Image, display
display(Image(graph.get_graph().draw_mermaid_png()))
```

The drawing shows three boxes in a line: `__start__`, `SuperBot`, `__end__` ([lesson 10.2](lesson:10.2) explains the drawing and its web service).

```python title="Notebook cell" norun
## Invocation
graph.invoke({"messages": "Hi, my name is Alice and I like cricket"})
```

```output illustrative note="from a run with Qwen 2.5 32B, since retired; metadata trimmed; answers vary per run"
{'messages': [HumanMessage(content='Hi, my name is Alice and I like cricket', id='a28ca34c-eada-478e-8ed8-ef3759447093'),
  AIMessage(content="Hello Alice! Nice to meet you. Cricket is a fantastic sport, isn't it? Do you enjoy playing cricket or are you more into watching the matches? Who is your favorite cricket player? Feel free to share more about what you like about the sport!", response_metadata={'model_name': 'qwen-2.5-32b', 'finish_reason': 'stop', ...}, id='run-a20669ad-74bd-440e-96f1-e368a5a9cdce-0', usage_metadata={'input_tokens': 39, 'output_tokens': 53, 'total_tokens': 92})]}
```

`add_messages` turned the string into a `HumanMessage` with an ID, the node appended the reply, and `invoke` returned the final state: both messages. The reply on its own is `result["messages"][-1].text`, where `result` is what `invoke` returned; `.text` works for every provider, including Gemini, whose `content` can be a list of blocks ([lesson 6.1](lesson:6.1)).

## Stream the steps

```python title="Notebook cell" norun
for event in graph.stream({"messages": "Hello, my name is Alice"}):
    print(event)
```

```output illustrative note="from a run with Qwen 2.5 32B, since retired; metadata trimmed; answers vary per run"
{'SuperBot': {'messages': [AIMessage(content="Hello Alice! It's nice to meet you. How can I assist you today? Is there anything specific you would like to talk about or any questions you have?", response_metadata={'model_name': 'qwen-2.5-32b', 'finish_reason': 'stop', ...}, id='run-cb7964d1-a9df-477e-b016-539ee446c375-0', usage_metadata={'input_tokens': 35, 'output_tokens': 34, 'total_tokens': 69})]}}
```

`stream` yields after each node: a dict keyed by the node's name, holding the update it returned, here the reply alone. One node gives one event; a graph with five nodes gives five, so an app can show progress while a run goes on. `stream_mode="values"` yields the whole state after each step instead, and `stream_mode="messages"` the model's tokens as they are written ([lesson 11.6](lesson:11.6)).

## Why it forgets

Each `invoke` starts from an empty state: the conversation lives for one run only. Ask "What is my name?" in a second call and the model sees that one message. There are two fixes:

- **Pass the conversation back in.** Keep `result["messages"]`, add the next `HumanMessage`, and send the whole list to the next `invoke`. `add_messages` keeps the IDs straight, so nothing is duplicated. The script below works this way.
- **Let LangGraph keep it.** Compile with a checkpointer and pass a `thread_id` in each call's config: the state is saved after each run and loaded for the next call on the same thread ([lesson 11.5](lesson:11.5)), as `create_agent` did in [lesson 9.4](lesson:9.4).

This graph is the first half of an agent. `create_agent` builds the same messages state and model node, then adds a tools node and a conditional edge that loops back to the model while it asks for tools ([lesson 9.4](lesson:9.4) draws that graph); [lesson 11.4](lesson:11.4) builds the loop by hand.

## The chatbot in one script

The lesson as one terminal program, with Gemini as the model: read it to revise, press **Explain** on it for every step. It needs `GOOGLE_API_KEY` in `.env` ([lesson 6.1](lesson:6.1)) and the packages of [lesson 6.1](lesson:6.1)'s `requirements.txt` plus `langgraph` ([lesson 10.2](lesson:10.2)).

```python title="chatbot.py" explain
"""A terminal chatbot as a LangGraph graph: the conversation lives in the state; Gemini answers."""
from typing import Annotated

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

load_dotenv()  # GOOGLE_API_KEY from .env


# 1. State: the conversation, merged with add_messages
class State(TypedDict):
    messages: Annotated[list, add_messages]


# 2. Model
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")


# 3. Node: send the conversation, return the reply as an update
def chatbot(state: State) -> dict:
    return {"messages": [llm.invoke(state["messages"])]}


# 4. Graph: START -> chatbot -> END
builder = StateGraph(State)
builder.add_node("chatbot", chatbot)
builder.add_edge(START, "chatbot")
builder.add_edge("chatbot", END)
graph = builder.compile()


def main() -> None:
    # 5. Memory: the graph keeps nothing between runs, so the loop keeps the conversation
    messages = [SystemMessage(content="You are a friendly assistant. Answer in at most three sentences.")]
    print("Type /quit to stop.")
    while True:
        text = input("You: ").strip()
        if text == "/quit":
            break
        if not text:
            continue
        result = graph.invoke({"messages": messages + [HumanMessage(content=text)]})
        messages = result["messages"]
        print(f"Bot: {messages[-1].text}")


if __name__ == "__main__":
    main()
```

::: walkthrough

The script has two halves. Steps 1 to 4 build a graph that answers from a list of messages; `main` is the chat loop that carries the conversation from one run of the graph to the next.

```python title="Setup" norun
from typing import Annotated

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

load_dotenv()  # GOOGLE_API_KEY from .env
```

**Setup.** The graph classes come from `langgraph`, the message classes from `langchain_core`, and the model from its provider's package, `langchain_google_genai`. `Annotated` and `TypedDict` describe the state. `load_dotenv()` copies `GOOGLE_API_KEY` from the `.env` file into the environment, where the Gemini class finds it, so the key never appears in the code.

```python title="Step 1 · State" norun
class State(TypedDict):
    messages: Annotated[list, add_messages]
```

**1. The state.** One run of the graph carries a dict with one key, `messages`: the conversation. Nodes return updates, and without a reducer an update would replace the whole list. `Annotated[list, add_messages]` attaches the reducer `add_messages`: LangGraph calls it with the current list and the update, and it appends new messages (giving each an ID), replaces a message whose ID is already in the list, and turns a plain string into a `HumanMessage`.

```python title="Step 2 · Model" norun
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
```

**2. The model.** A chat model takes a list of messages and returns an `AIMessage`. Creating it sends nothing; each call happens later, once per message you type. The model is stateless: it knows only the messages of the current call, which is why the conversation must travel in the state. The name is Google's at the time of writing; check Google's model list **VERIFY**, since Google retires older models.

```python title="Step 3 · Node" norun
def chatbot(state: State) -> dict:
    return {"messages": [llm.invoke(state["messages"])]}
```

**3. The node.** A node is a function from the state to an update. This one sends every message in the state to the model and returns the reply in a one-item list under `messages`, which the reducer appends. The node never sees the input dict itself: LangGraph has merged the input into the state before the node runs.

```python title="Step 4 · Graph" norun
builder = StateGraph(State)
builder.add_node("chatbot", chatbot)
builder.add_edge(START, "chatbot")
builder.add_edge("chatbot", END)
graph = builder.compile()
```

**4. The graph.** `StateGraph(State)` is a builder for a graph over that state. One node and two fixed edges: `START` hands the input to `chatbot`, and `chatbot` leads to `END`. `compile()` checks the structure and returns the runnable graph, whose `invoke` takes an input dict and returns the final state. No checkpointer is passed to `compile`, so the graph keeps nothing between calls.

```python title="Chat loop" norun
def main() -> None:
    # 5. Memory: the graph keeps nothing between runs, so the loop keeps the conversation
    messages = [SystemMessage(content="You are a friendly assistant. Answer in at most three sentences.")]
    print("Type /quit to stop.")
    while True:
        text = input("You: ").strip()
        if text == "/quit":
            break
        if not text:
            continue
        result = graph.invoke({"messages": messages + [HumanMessage(content=text)]})
        messages = result["messages"]
        print(f"Bot: {messages[-1].text}")


if __name__ == "__main__":
    main()
```

**Chat loop.** The loop keeps the conversation itself, in `messages`, starting with a system message that sets the bot's manner for every call. For each line you type, it sends the conversation so far plus your line as a `HumanMessage`; the messages already carry their IDs, so `add_messages` doesn't duplicate them. `invoke` returns the final state, whose `messages` hold the whole conversation with the reply last: the loop keeps that list for the next turn and prints the reply's `.text`, which works for any provider. `/quit` ends the program, and `if __name__ == "__main__":` runs the loop only when the file is run as a script. A checkpointer would let the graph keep the conversation itself, under a `thread_id` ([lesson 11.5](lesson:11.5)).

In one sentence: the state carries the conversation through one run, the reducer appends the reply, and the loop carries the conversation from one run to the next.

:::

### Run it

```zsh title="Terminal" norun
python chatbot.py
```

```output illustrative note="answers vary per run"
Type /quit to stop.
You: Hi, I'm Alice and I like cricket.
Bot: Nice to meet you, Alice! Cricket is a great game. Do you play, or mostly watch?
You: What's my name, and what do I like?
Bot: Your name is Alice, and you like cricket.
You: /quit
```

The second answer works because the second call sent four messages: the system message, your first line, the first reply and the new question.

### Swap one piece

| Piece | In the script | Alternatives |
|---|---|---|
| Model | `ChatGoogleGenerativeAI(...)` | The Groq, OpenAI and Ollama tabs above |
| Memory | The loop passes the conversation back in | A checkpointer, `builder.compile(checkpointer=InMemorySaver())`, and a `thread_id` in each call's config ([lesson 11.5](lesson:11.5), [lesson 9.4](lesson:9.4)) |
| Long conversations | Every message is sent | Trim ([lesson 7.4](lesson:7.4)) or summarise ([lesson 9.6](lesson:9.6)) before the model call |
| Showing the answer | Printed when the run ends | Token by token with `graph.stream(..., stream_mode="messages")` ([lesson 11.6](lesson:11.6)) |
| What it can do | Talk | Call tools in a loop: `create_agent` ([lesson 9.4](lesson:9.4)), or a graph with a tools node ([lesson 11.4](lesson:11.4)) |

## Interview questions

::: check
Your chatbot graph forgets the user's name between `invoke` calls. Why, and what are two fixes?

A compiled graph without a checkpointer starts every `invoke` from an empty state; the state lives for one run. Either keep the messages yourself and send them all with each call (the script above does), or compile with a checkpointer and pass the same `thread_id` in the config, so LangGraph loads the saved state and appends the new message to it. Only the second survives the process, and with a database checkpointer it works across servers.
:::

::: check
Why use `add_messages` for a conversation rather than `operator.add`?

Both append, but `add_messages` also matches IDs: an update carrying an existing message's ID replaces that message, `RemoveMessage` deletes one, and strings, tuples and dicts become message objects. With a checkpointer, sending the history again duplicates it under `operator.add` (six messages instead of four after two turns, in LangGraph 1.2) while `add_messages` keeps one copy. Editing or deleting messages, for a person's correction or a summary of old turns, depends on those IDs.
:::

::: check
For this graph, what do `invoke` and `stream` give you?

`invoke` returns the final state once the run has finished: here the question and the reply. `stream` yields an update after each node, `{"SuperBot": {"messages": [reply]}}`, which in a graph with several nodes shows progress as it happens. Neither streams the reply token by token; that is `stream_mode="messages"` ([lesson 11.6](lesson:11.6)).
:::

## Practice

::: practice
**An echo bot.** Replace the model with a node that answers "You said: ..." followed by the last message, as an `AIMessage`. Invoke the graph once, then stream it, printing each node's name and the contents of its update.

```python title="Notebook cell"
def echo(state: State):
    last = state["messages"][-1]
    return {"messages": [AIMessage(content=f"You said: {last.content}")]}


builder = StateGraph(State)
builder.add_node("echo", echo)
builder.add_edge(START, "echo")
builder.add_edge("echo", END)
echo_graph = builder.compile()

result = echo_graph.invoke({"messages": "Hello"})
print([(m.type, m.content) for m in result["messages"]])
for event in echo_graph.stream({"messages": "Hello again"}):
    for node, update in event.items():
        print(node, [m.content for m in update["messages"]])
```

```output real
[('human', 'Hello'), ('ai', 'You said: Hello')]
echo ['You said: Hello again']
```

A graph doesn't care what a node does: swapping the model for a function keeps the state, the reducer and the edges. Stand-in nodes like this one make graphs testable without a key. The update in the stream holds only the reply, as it did with the model.
:::

::: practice
**Three turns.** With the echo graph, hold a three-turn conversation by passing the returned messages back in with each new `HumanMessage`, and print the number of messages and the last reply after each turn.

```python title="Notebook cell"
messages = []
for text in ["Hi, I'm Alice", "I like cricket", "What do I like?"]:
    result = echo_graph.invoke({"messages": messages + [HumanMessage(content=text)]})
    messages = result["messages"]
    print(len(messages), messages[-1].content)
```

```output real
2 You said: Hi, I'm Alice
4 You said: I like cricket
6 You said: What do I like?
```

Two messages per turn, and none duplicated: the messages passed back carry the IDs `add_messages` gave them, so it recognises them. The echo bot can't answer the last question, but a model could: it would receive all five messages, the question included.
:::

::: practice
**Start over.** Add a `/new` command to `chatbot.py` that starts a fresh conversation but keeps the system message.

```python title="chatbot.py (in the loop, before the empty-text check)" norun
        if text == "/new":
            messages = messages[:1]  # keep the system message only
            print("New conversation.")
            continue
```

The conversation is just the list the loop keeps, so starting over means cutting it back to the system message. With a checkpointer, the same command would switch to a new `thread_id` instead.
:::

## Further reading

- LangChain, [Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api): reducers, working with messages in the state, `add_messages` and `MessagesState`.
- LangChain, [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence): checkpointers and threads, the memory this chatbot keeps by hand.
