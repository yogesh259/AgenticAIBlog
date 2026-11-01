+++
number = "14.5"
title = "An approval agent in one script"
lede = "The module in one Python file: a calculator agent on Gemini that stops before every tool call for your approve, edit or reject, and lets you list its checkpoints and undo your last question. Read it to revise; press Explain on it for every step."
summary = "A complete human-in-the-loop graph in one script: tools, model, a review node that pauses with interrupt, the graph and its checkpointer, a terminal review, the current branch of checkpoints, undo, and a chat loop that resumes with Command; how to run it, which piece to swap for each alternative, and two practice tasks."
type = "build"
status = "published"
source = "Summary of this module: 14 Human in the loop: 1-Humanintheloop.ipynb (the arithmetic agent and its system message) with Gemini; the review node, the terminal review, history and undo added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["GOOGLE_API_KEY"]
+++

Lessons 14.1 to 14.4 paused a graph, edited its state, asked a person with `interrupt` and travelled back through its checkpoints. This script puts the pieces together around the arithmetic agent of [lesson 14.1](lesson:14.1): the model may only use a tool after you have seen the call and approved, edited or rejected it, `/history` lists the conversation's checkpoints, and `/undo` takes back your last question. It is the graph-level counterpart of [lesson 9.8](lesson:9.8)'s email assistant, which gets its pause from middleware.

## Before you run it

- `GOOGLE_API_KEY` in your `.env` file, created in Google AI Studio ([lesson 6.1](lesson:6.1)).
- The packages of [lesson 6.1](lesson:6.1)'s `requirements.txt` plus `langgraph` ([lesson 10.2](lesson:10.2)).

## The script

```python title="approval_agent.py" explain
"""A calculator agent that asks before every tool call, with history and undo. Gemini decides."""
import json
import uuid
from typing import Literal

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.types import Command, interrupt

load_dotenv()  # GOOGLE_API_KEY from .env


# 1. Tools: three plain functions; names, hints and docstrings become their schemas
def add(a: int, b: int) -> int:
    """Adds a and b."""
    return a + b


def multiply(a: int, b: int) -> int:
    """Multiply a and b."""
    return a * b


def divide(a: int, b: int) -> float:
    """Divide a by b."""
    return a / b


tools = [add, multiply, divide]

# 2. Model, with the tools' schemas attached to every request
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
llm_with_tools = llm.bind_tools(tools)
sys_msg = SystemMessage(content="You are a helpful assistant tasked with performing arithmetic on a set of inputs.")


# 3. Nodes: the model, and a review that pauses before any tool runs
def assistant(state: MessagesState) -> dict:
    return {"messages": [llm_with_tools.invoke([sys_msg] + state["messages"])]}


def review(state: MessagesState) -> Command[Literal["tools", "assistant"]]:
    request = state["messages"][-1]
    decision = interrupt({"tool_calls": request.tool_calls})
    if decision["type"] == "approve":
        return Command(goto="tools")
    if decision["type"] == "edit":
        edited = request.model_copy(update={"tool_calls": decision["tool_calls"]})
        return Command(goto="tools", update={"messages": [edited]})
    refusals = [ToolMessage(content=f"Not run: {decision['reason']}", tool_call_id=call["id"], status="error")
                for call in request.tool_calls]
    return Command(goto="assistant", update={"messages": refusals})


# 4. Graph: assistant -> review -> tools -> assistant ... until the model answers
builder = StateGraph(MessagesState)
builder.add_node("assistant", assistant)
builder.add_node("review", review)
builder.add_node("tools", ToolNode(tools, handle_tool_errors=True))
builder.add_edge(START, "assistant")
builder.add_conditional_edges("assistant", tools_condition, {"tools": "review", END: END})
builder.add_edge("tools", "assistant")
graph = builder.compile(checkpointer=MemorySaver())


# 5. The person's side: one decision for the tool calls of one model reply
def read_args(call: dict) -> dict:
    while True:
        text = input(f"  New arguments for {call['name']}, as JSON: ")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            print('  Not JSON. Example: {"a": 2, "b": 3}')


def ask(tool_calls: list[dict]) -> dict:
    for call in tool_calls:
        print(f"  ? {call['name']}({call['args']})")
    choice = input("Run it? (y)es, (e)dit, (n)o: ").strip().lower()
    if choice == "y":
        return {"type": "approve"}
    if choice == "e":
        return {"type": "edit", "tool_calls": [{**call, "args": read_args(call)} for call in tool_calls]}
    return {"type": "reject", "reason": input("Why not? ")}


# 6. Time travel: the current branch of checkpoints, newest first, and undo
def branch(config: dict):
    snapshot = graph.get_state(config)
    while snapshot.metadata:
        yield snapshot
        if snapshot.parent_config is None:
            break
        snapshot = graph.get_state(snapshot.parent_config)


def show_history(config: dict) -> None:
    for snapshot in branch(config):
        meta = snapshot.metadata
        count = len(snapshot.values.get("messages", []))
        print(f"  step {meta['step']:>2}  {meta['source']:<6} next={str(snapshot.next):<15} messages={count}")


def undo(config: dict) -> bool:
    last_input = next((s for s in branch(config) if s.metadata["source"] == "input"), None)
    if last_input is None or last_input.parent_config is None:
        return False
    graph.update_state(last_input.parent_config, None)
    return True


def main() -> None:
    # 7. Chat loop: run each question, answer every pause, print the answer
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}
    print("Ask for some arithmetic. Commands: /history, /undo, /quit.")
    while True:
        text = input("You: ").strip()
        if text == "/quit":
            break
        if text == "/history":
            show_history(config)
            continue
        if text == "/undo":
            print("Back to before your last question." if undo(config) else "Nothing to undo.")
            continue
        if not text:
            continue
        result = graph.invoke({"messages": text}, config)
        while "__interrupt__" in result:
            decision = ask(result["__interrupt__"][0].value["tool_calls"])
            result = graph.invoke(Command(resume=decision), config)
        print(f"Bot: {result['messages'][-1].text}")


if __name__ == "__main__":
    main()
```

::: walkthrough

The script builds the graph once and then runs a chat loop around it. Steps 1 to 4 are the graph: tools, model, a model node and a review node, wired so that no tool runs unseen. Step 5 is your side of each pause, step 6 reads and rewinds the checkpoints, and step 7 is the conversation.

```python title="Setup" norun
import json
import uuid
from typing import Literal

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.types import Command, interrupt

load_dotenv()  # GOOGLE_API_KEY from .env
```

**Setup.** `json` reads edited arguments, `uuid` names the thread, `Literal` types the review node's possible targets. Messages come from `langchain_core`, the model from its provider's package. From LangGraph: the in-memory checkpointer, the graph builder with `MessagesState`, the prebuilt tools node and router, and from `langgraph.types` the two pieces of this module, `interrupt` to pause inside a node and `Command` to resume and to route. `load_dotenv()` puts `GOOGLE_API_KEY` from `.env` into the environment, where the Gemini class finds it.

```python title="Step 1 · Tools" norun
def add(a: int, b: int) -> int:
    """Adds a and b."""
    return a + b


def multiply(a: int, b: int) -> int:
    """Multiply a and b."""
    return a * b


def divide(a: int, b: int) -> float:
    """Divide a by b."""
    return a / b


tools = [add, multiply, divide]
```

**1. Tools.** Three plain functions. Their names, type hints and docstrings are all the model ever sees of them: they become the tool schemas. One list serves both the model and the tools node.

```python title="Step 2 · Model" norun
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")
llm_with_tools = llm.bind_tools(tools)
sys_msg = SystemMessage(content="You are a helpful assistant tasked with performing arithmetic on a set of inputs.")
```

**2. Model.** `bind_tools` attaches the three schemas to every request, so the model can reply with tool calls instead of text. The system message is the one of [lesson 14.1](lesson:14.1), kept out of the state and sent first on every call. The model name is Google's at the time of writing; check Google's model list **VERIFY**, since Google retires older models.

```python title="Step 3 · Nodes" norun
def assistant(state: MessagesState) -> dict:
    return {"messages": [llm_with_tools.invoke([sys_msg] + state["messages"])]}


def review(state: MessagesState) -> Command[Literal["tools", "assistant"]]:
    request = state["messages"][-1]
    decision = interrupt({"tool_calls": request.tool_calls})
    if decision["type"] == "approve":
        return Command(goto="tools")
    if decision["type"] == "edit":
        edited = request.model_copy(update={"tool_calls": decision["tool_calls"]})
        return Command(goto="tools", update={"messages": [edited]})
    refusals = [ToolMessage(content=f"Not run: {decision['reason']}", tool_call_id=call["id"], status="error")
                for call in request.tool_calls]
    return Command(goto="assistant", update={"messages": refusals})
```

**3. Nodes.** `assistant` is the model's turn: it reads the conversation and replies with text or with tool calls. `review` runs only when the reply has tool calls. It pauses with `interrupt`, handing the calls to the caller, and receives the decision as `interrupt`'s return value when the run resumes ([lesson 14.3](lesson:14.3)). Nothing comes before the `interrupt` call except reading the state, so the node is safe to run twice, which it does on every resume. Approve goes to `tools`. Edit replaces the model's message with a copy that carries the new arguments; the copy keeps the message's ID, so `add_messages` swaps it in ([lesson 14.2](lesson:14.2)), and its provider data, which Gemini expects to see again on the next call. Reject runs nothing: every call gets an error `ToolMessage` with the reason, and the run goes back to the model, which must answer or try something else. The return hint lists where the node may go, which is how LangGraph draws and checks the graph without edges out of `review`.

```python title="Step 4 · Graph" norun
builder = StateGraph(MessagesState)
builder.add_node("assistant", assistant)
builder.add_node("review", review)
builder.add_node("tools", ToolNode(tools, handle_tool_errors=True))
builder.add_edge(START, "assistant")
builder.add_conditional_edges("assistant", tools_condition, {"tools": "review", END: END})
builder.add_edge("tools", "assistant")
graph = builder.compile(checkpointer=MemorySaver())
```

**4. Graph.** The ReAct loop of [lesson 11.4](lesson:11.4) with one detour. `tools_condition` returns `"tools"` when the model asks for tools, and the path map sends that route to `review` instead; a reply without tool calls ends the run. `handle_tool_errors=True` turns a tool that raises, such as a division by zero, into an error message for the model instead of a crash. The checkpointer is what makes the pauses possible: each one is a saved checkpoint the next call resumes from. In memory, it lasts as long as the script.

```python title="Step 5 · Your decision" norun
def read_args(call: dict) -> dict:
    while True:
        text = input(f"  New arguments for {call['name']}, as JSON: ")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            print('  Not JSON. Example: {"a": 2, "b": 3}')


def ask(tool_calls: list[dict]) -> dict:
    for call in tool_calls:
        print(f"  ? {call['name']}({call['args']})")
    choice = input("Run it? (y)es, (e)dit, (n)o: ").strip().lower()
    if choice == "y":
        return {"type": "approve"}
    if choice == "e":
        return {"type": "edit", "tool_calls": [{**call, "args": read_args(call)} for call in tool_calls]}
    return {"type": "reject", "reason": input("Why not? ")}
```

**5. Your decision.** `ask` shows every call of one model reply and returns one decision for all of them, in the shape `review` expects. An edit asks for new arguments per call and keeps each call's name and ID, so the tool result still matches its call. `read_args` asks again until the text is valid JSON: a typo shouldn't end the session and lose the thread, which lives only in memory.

```python title="Step 6 · History and undo" norun
def branch(config: dict):
    snapshot = graph.get_state(config)
    while snapshot.metadata:
        yield snapshot
        if snapshot.parent_config is None:
            break
        snapshot = graph.get_state(snapshot.parent_config)


def show_history(config: dict) -> None:
    for snapshot in branch(config):
        meta = snapshot.metadata
        count = len(snapshot.values.get("messages", []))
        print(f"  step {meta['step']:>2}  {meta['source']:<6} next={str(snapshot.next):<15} messages={count}")


def undo(config: dict) -> bool:
    last_input = next((s for s in branch(config) if s.metadata["source"] == "input"), None)
    if last_input is None or last_input.parent_config is None:
        return False
    graph.update_state(last_input.parent_config, None)
    return True
```

**6. History and undo.** `branch` walks back from the thread's latest checkpoint along `parent_config`, so it follows the current conversation only; `get_state_history` would also list branches that undo left behind ([lesson 14.4](lesson:14.4)). A fresh thread's snapshot has no metadata, which ends the walk at once. `show_history` prints one line per checkpoint: the step, the source (`input`, `loop`, `update`), what would run next, and how many messages the state held. `undo` finds the checkpoint that stored your last question and makes its parent, the end of the previous turn, the latest checkpoint again with `update_state(..., None)`: a fork that changes nothing. The first question has no previous turn, so it can't be undone.

```python title="Step 7 · Chat loop" norun
def main() -> None:
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}
    print("Ask for some arithmetic. Commands: /history, /undo, /quit.")
    while True:
        text = input("You: ").strip()
        if text == "/quit":
            break
        if text == "/history":
            show_history(config)
            continue
        if text == "/undo":
            print("Back to before your last question." if undo(config) else "Nothing to undo.")
            continue
        if not text:
            continue
        result = graph.invoke({"messages": text}, config)
        while "__interrupt__" in result:
            decision = ask(result["__interrupt__"][0].value["tool_calls"])
            result = graph.invoke(Command(resume=decision), config)
        print(f"Bot: {result['messages'][-1].text}")


if __name__ == "__main__":
    main()
```

**7. Chat loop.** One thread per run of the script, named with a fresh `uuid`. Each question goes in alone; the checkpointer supplies the rest of the conversation. The inner `while` is the driver loop of [lesson 14.3](lesson:14.3): as long as the result carries an `__interrupt__`, the run is paused at `review`, so the loop asks you and resumes the same thread with `Command(resume=decision)`. A rejection can lead to a new tool call and a new pause, which the loop handles the same way. When no interrupt is left, the last message is the model's answer, and `.text` gives its text even when Gemini returns a list of content blocks.

In one sentence: the model proposes, `review` pauses with `interrupt` until you decide, `Command` resumes the run with your decision, and the checkpoints that make the pause possible also let you list and rewind the conversation.

:::

## Run it

```zsh title="Terminal" norun
python approval_agent.py
```

```output illustrative note="answers and tool calls vary per run; history lines trimmed"
Ask for some arithmetic. Commands: /history, /undo, /quit.
You: Multiply 2 and 3
  ? multiply({'a': 2, 'b': 3})
Run it? (y)es, (e)dit, (n)o: y
Bot: 2 multiplied by 3 is 6.
You: Now divide that by 4
  ? divide({'a': 6, 'b': 4})
Run it? (y)es, (e)dit, (n)o: e
  New arguments for divide, as JSON: {"a": 6, "b": 3}
Bot: 6 divided by 3 is 2.
You: Add 10 to it
  ? add({'a': 2, 'b': 10})
Run it? (y)es, (e)dit, (n)o: n
Why not? Add 100 instead
  ? add({'a': 2, 'b': 100})
Run it? (y)es, (e)dit, (n)o: y
Bot: 2 plus 100 is 102.
You: /undo
Back to before your last question.
You: /history
  step 11  update next=()              messages=8
  step 10  loop   next=()              messages=8
  step  9  loop   next=('assistant',)  messages=7
  [...]
  step  0  loop   next=('assistant',)  messages=1
  step -1  input  next=('__start__',)  messages=0
You: Divide 5 by 0
  ? divide({'a': 5, 'b': 0})
Run it? (y)es, (e)dit, (n)o: y
Bot: I can't divide 5 by 0: division by zero is undefined.
You: /quit
```

- **The edit was silent.** The model found `divide(6, 3)` in the history as if it had asked for it, and answered for 3 although the question said 4. To let the model know, add a note to the tool's result, as LangChain 1.4's middleware does ([lesson 9.7](lesson:9.7)).
- **The rejection had a reason.** "Not run: Add 100 instead" reached the model as the tool's result, and it asked again with the new numbers, which paused again.
- **`/undo` took back the whole turn**, the rejection included. The branch now ends with an `update` checkpoint holding the eight messages of the first two turns, and the next question continued from there.
- **The division by zero** raised inside the tool; `handle_tool_errors=True` turned it into an error message, and the model explained it.

## Swap one piece

| Piece | In the script | Alternatives |
|---|---|---|
| Model | `ChatGoogleGenerativeAI(...)` | The Groq, OpenAI and Ollama tabs of [lesson 14.1](lesson:14.1) |
| The pause | `interrupt` in a `review` node | `interrupt_before=["tools"]` and `update_state` ([lessons 14.1](lesson:14.1), [14.2](lesson:14.2)); for `create_agent` agents, `HumanInTheLoopMiddleware` ([lesson 9.7](lesson:9.7)) |
| What pauses | Every tool call | Only some: return `Command(goto="tools")` before `interrupt` when a call is harmless (practice 1) |
| Memory | `MemorySaver`, one thread per run | `SqliteSaver` or `PostgresSaver`, so paused runs survive restarts ([lesson 11.5](lesson:11.5)) |
| Rewind | Undo the last question | Replay the last model call for another answer (practice 2), or fork with changed state ([lesson 14.4](lesson:14.4)) |
| The person's side | `input()` in a terminal | A web page or a review queue that resumes the thread by its ID; the graph doesn't change |

## Practice

::: practice
**Approve small sums automatically.** Make `review` let calls through without asking when every argument of every call is below 100.

```python title="approval_agent.py (at the top of review)" norun
    request = state["messages"][-1]
    if all(abs(value) < 100 for call in request.tool_calls for value in call["args"].values()):
        return Command(goto="tools")
    decision = interrupt({"tool_calls": request.tool_calls})
```

The check runs before `interrupt` and gives the same answer every time the node runs on the same state, so it is safe on resume. Its condition depends only on the state, never on something that can change between the pause and the resume, such as the time.
:::

::: practice
**Retry the last answer.** Add a `/retry` command that asks the model again for its last answer: find the newest checkpoint on the current branch whose `next` is `("assistant",)`, replay from it, and handle its pauses like a question.

```python title="approval_agent.py (in the loop, after /undo)" norun
        if text == "/retry":
            before = next((s for s in branch(config) if s.next == ("assistant",)), None)
            if before is None:
                print("Nothing to retry.")
                continue
            result = graph.invoke(None, before.config)
            while "__interrupt__" in result:
                decision = ask(result["__interrupt__"][0].value["tool_calls"])
                result = graph.invoke(Command(resume=decision), config)
            print(f"Bot: {result['messages'][-1].text}")
            continue
```

The replay starts a branch at that checkpoint ([lesson 14.4](lesson:14.4)): the model runs again on the same messages, and if it asks for a tool, `review` pauses again. Resuming with the plain thread `config` works because the replay's pause is now the thread's latest checkpoint. The earlier answer stays in the history, on the old branch.
:::
