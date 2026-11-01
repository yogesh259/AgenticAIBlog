+++
number = "9.7"
title = "Human approval with middleware"
lede = "Make an agent stop before a risky tool call, show the call to a person, and carry on with their decision: approve it, edit its arguments or reject it."
summary = "HumanInTheLoopMiddleware: gating a tool, the interrupt the agent returns, resuming with Command to approve, edit or reject, what the model is told in each case, the respond decision, conditional gates and per-call mode, designing approval steps, interview questions and a practice task."
type = "concept"
status = "published"
source = "9 LangChain Updated: 6-middleware.ipynb (cells 12-30; repeated agent cells merged, printouts shortened, emojis removed); the current messages, newer options, design advice and interview questions added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
keys = ["OPENAI_API_KEY"]
+++

Some tool calls must not happen on the model's word alone: sending an email, paying an invoice, deleting a record, writing to a production database. Compliance rules may require a person to sign off, and a model can get a recipient or an amount wrong. `HumanInTheLoopMiddleware` puts that person in the loop. When the model asks for a gated tool, the agent stops before the tool runs and returns the request. Your application shows it to someone, and the agent continues with their decision, now or days later. The pause is saved by the checkpointer of [lesson 9.4](lesson:9.4), so the middleware needs one. [Lesson 14.3](lesson:14.3) builds the same kind of pause by hand in LangGraph.

## Gate a tool

Two mock email tools: reading is harmless, sending is not.

```python title="Notebook cell" norun
from dotenv import load_dotenv
load_dotenv()
```

```python title="Notebook cell"
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import InMemorySaver

def read_email_tool(email_id: str) -> str:
    """Mock function to read an email by its ID."""
    return f"Email content for ID: {email_id}"

def send_email_tool(recipient: str, subject: str, body: str) -> str:
    """Mock function to send an email."""
    return f"Email sent to {recipient} with subject '{subject}'"
```

```python title="Notebook cell"
agent = create_agent(
    model="gpt-4o",
    tools=[read_email_tool, send_email_tool],
    checkpointer=InMemorySaver(),
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                "send_email_tool": {
                    "allowed_decisions": ["approve", "edit", "reject"]
                },
                "read_email_tool": False,
            }
        )
    ]
)
```

OpenAI retires `gpt-4o` on 14 January 2027 and names `gpt-6-luna` as its replacement. `interrupt_on` maps tool names to what a reviewer may do: a dictionary of allowed decisions, `True` for all of them, or `False` for no pause. Tools left out never pause. The middleware adds one node to the graph, after the model:

```python title="Notebook cell"
list(agent.get_graph().nodes)
```

```output real
['__start__',
 'model',
 'tools',
 'HumanInTheLoopMiddleware.after_model',
 '__end__']
```

## The agent pauses

```python title="Notebook cell" norun
config = {"configurable": {"thread_id": "test-approve"}}
# Step 1: Request
result = agent.invoke(
    {"messages": [HumanMessage(content="Send email to john@test.com with subject 'Hello' and body 'How are you?'")]},
    config=config
)
result
```

```output saved note="message metadata and IDs trimmed"
{'messages': [HumanMessage(content="Send email to john@test.com with subject 'Hello' and body 'How are you?'", ...),
  AIMessage(content='', ..., tool_calls=[{'name': 'send_email_tool', 'args': {'recipient': 'john@test.com', 'subject': 'Hello', 'body': 'How are you?'}, 'id': 'call_A8s4sBnakCq3LfGKISYrcQ7u', 'type': 'tool_call'}], ...)],
 '__interrupt__': [Interrupt(value={'action_requests': [{'name': 'send_email_tool', 'args': {'recipient': 'john@test.com', 'subject': 'Hello', 'body': 'How are you?'}, 'description': "Tool execution requires approval\n\nTool: send_email_tool\nArgs: {'recipient': 'john@test.com', 'subject': 'Hello', 'body': 'How are you?'}"}], 'review_configs': [{'action_name': 'send_email_tool', 'allowed_decisions': ['approve', 'edit', 'reject']}]}, id='e7f5e4e99613d6cfded08e269d4ff89f')]}
```

`invoke` returned instead of running the tool. The result has the messages so far, ending with the model's tool call, and an `__interrupt__` key. Its value lists one `action_request` per gated call (tool, arguments and a description to show the reviewer) and a `review_config` with the decisions allowed. The state is saved under the thread ID, waiting at the middleware's node; `agent.get_state(config).next` names it. To continue, invoke again on the same thread with a `Command` whose `resume` value holds one decision per action request, in the same order:

::: visual hitl-resume | Run player | Pause, decide, resume
The three saved runs step by step: what is saved at the pause, what each decision sends, and what the model is told.
:::

:::: tabs
::: tab Approve
```python title="Notebook cell" norun
from langgraph.types import Command
# Step 2: Approve
if "__interrupt__" in result:
    print("Paused! Approving...")

    result = agent.invoke(
        Command(
            resume={
                "decisions": [
                    {"type": "approve"}
                ]
            }
        ),
        config=config
    )

    print(f"Result: {result['messages'][-1].content}")
```

```output saved note="emojis removed from the printout"
Paused! Approving...
Result: The email has been sent to john@test.com with the subject "Hello".
```

The tool ran with the model's arguments; its result, "Email sent to john@test.com with subject 'Hello'", went to the model, which wrote the answer.
:::
::: tab Reject
```python title="Notebook cell" norun
config = {"configurable": {"thread_id": "test-reject"}}
# Step 1: Request
result = agent.invoke(
    {"messages": [HumanMessage(content="Send email to john@test.com with subject 'Hello' and body 'How are you?'")]},
    config=config)

# Step 2: Reject
if "__interrupt__" in result:
    print("Paused! Rejecting...")

    result = agent.invoke(
        Command(
            resume={
                "decisions": [
                    {"type": "reject"}
                ]
            }
        ),
        config=config
    )

    print(f"Result: {result['messages'][-1].content}")
```

```output saved note="emojis removed; the label said Approving in the original run"
Paused! Rejecting...
Result: It seems there was an issue with sending the email. Could you please provide more information or try again later?
```

The tool did not run. In its place the model received an error `ToolMessage` (`status='error'`): "User rejected the tool call for `send_email_tool` with id call_Ja2ShKBMId9s2fin9JHbcZpc". Told only that, it guessed at a technical problem. Since LangChain 1.4 the message goes on: "The tool was not executed. Do not retry this tool call unless the user explicitly requests it." Add a reason, `{"type": "reject", "message": "Wrong recipient"}`, and the model reads "User rejected the tool call for `send_email_tool` with reason: Wrong recipient", which it can pass on or act on.
:::
::: tab Edit
```python title="Notebook cell" norun
config = {"configurable": {"thread_id": "test-edit"}}

# Step 1: Request (with wrong info)
result = agent.invoke(
    {"messages": [HumanMessage(content="Send email to wrong@email.com with subject 'Test' and body 'Hello'")]},
    config=config
)

# Step 2: Edit and approve
if "__interrupt__" in result:
    print("Paused! Editing...")

    result = agent.invoke(
        Command(
            resume={
                "decisions": [
                    {
                        "type": "edit",
                        "edited_action": {
                            "name": "send_email_tool",  # Tool name
                            "args": {                   # New arguments
                                "recipient": "correct@email.com",
                                "subject": "Corrected Subject",
                                "body": "This was edited by human before sending"
                            }
                        }
                    }
                ]
            }
        ),
        config=config
    )

    print(f"Result: {result['messages'][-1].content}")
```

```output saved note="emojis removed from the printout"
Paused! Editing...
Result: The email has been successfully sent.
```

The tool ran with the reviewer's arguments: "Email sent to correct@email.com with subject 'Corrected Subject'". In the saved run the model's tool call in the history was replaced by the edited one, so the model never knew. Since LangChain 1.4 the history keeps the call the model made, and the tool result starts with a note: "Note: a human reviewer replaced this tool call before it ran. ... Executed instead: send_email_tool with arguments {...}", so the model doesn't repeat its original call.
:::
::::

The three tabs use one agent; each thread is a separate conversation with its own pause.

## More options

| Option | What it does |
|---|---|
| `"respond"` decision | `{"type": "respond", "message": "..."}`: the tool doesn't run and your text becomes its successful result. Meant for "ask the user" tools whose real answer is a person's; to refuse a call, use `reject`, or the model reads the refusal as a success |
| `"description"` | A text, or a function of the call, shown to the reviewer instead of the default "Tool execution requires approval" |
| `"when"` | A function of the call that decides whether to pause: `when=lambda req: not req.tool_call["args"]["recipient"].endswith("@example.com")` lets internal emails through. It runs again on resume, so it must give the same answer for the same call |
| `interrupt_mode="per_call"` | One interrupt per gated call instead of one per model reply, each answered with a single decision keyed by the interrupt's ID and checked against the allowed decisions and the tool's arguments. Planned to become the default in LangChain 2.0 |
| `invoke(..., version="v2")` | Returns an object whose `.interrupts` holds the pending interrupts, instead of the `__interrupt__` key |

The `when` option needs LangChain 1.3.3 or later, `per_call` 1.4.6. Check the version you run before relying on them.

## Designing approval

- **Gate by risk.** Pause for actions that are hard to undo or affect other people: sending, paying, deleting, publishing. Reads rarely need a gate; too many pauses and reviewers start approving without reading.
- **Show enough to decide.** The reviewer sees the tool and its arguments. Write a `description` that shows what will actually happen ("Send to 1,200 customers"), not a raw dictionary.
- **Store the pause.** `InMemorySaver` loses paused runs when the process stops. A pause that waits hours for a person needs a database checkpointer, such as `SqliteSaver` or `PostgresSaver` from LangGraph's checkpoint packages.
- **Answer every call.** A model reply can hold several gated calls; in the default mode the decisions list must match them one for one, in order.
- **Log decisions.** Who approved what, and when, is often the reason the gate exists.

## Interview questions

::: check
Why does human approval need a checkpointer, and what happens if the server restarts during the pause?

The agent stops in the middle of a run, and resuming means continuing from exactly that step with the same messages and the pending tool calls. The checkpointer saves that state under the thread ID. With `InMemorySaver` a restart loses it, and the reviewer's decision has nothing to resume; production agents use a database-backed checkpointer so pauses survive restarts and can be resumed by another server.
:::

::: check
A reviewer rejects a refund and the agent immediately tries the refund again with slightly different arguments. Why, and how do you stop it?

The model was told only that the call was rejected, saw that the user's request was still unmet, and tried again. Give a reason with the rejection ("refunds over 500 need a manager"), keep the current message that says not to retry, and back it with a rule the model can't argue with: keep the gate on every retry, and cap repeated calls with `ToolCallLimitMiddleware`.
:::

::: check
Approve, edit, reject or respond: which would you allow for a tool that transfers money?

Approve and reject, with a required reason on rejection. Editing lets a reviewer change the amount or account, which turns the review into a second, unlogged way to make transfers; if corrections are needed, reject with a reason and let the agent ask again. Respond doesn't fit, since the tool's result must come from the bank, not a person.
:::

## Practice

::: practice
**Ask the reviewer.** Write `ask_decision(action)` for a terminal review: print the tool name and arguments from an `action_request`, read a choice with `input()`, and return a decision. `y` approves; `e` asks "New body: " and returns an edit with the same tool, the other arguments unchanged and the new body; anything else asks "Why not? " and returns a rejection with that reason. Test it on the saved request without a model.

```python title="Notebook cell" input="e|Thanks, see you at 3 pm."
def ask_decision(action):
    print(f"{action['name']} {action['args']}")
    choice = input("Approve (y), edit (e) or reject (n)? ").strip().lower()
    if choice == "y":
        return {"type": "approve"}
    if choice == "e":
        args = {**action["args"], "body": input("New body: ")}
        return {"type": "edit", "edited_action": {"name": action["name"], "args": args}}
    return {"type": "reject", "message": input("Why not? ")}


action = {
    "name": "send_email_tool",
    "args": {"recipient": "john@test.com", "subject": "Hello", "body": "How are you?"},
}
ask_decision(action)
```

```output real
send_email_tool {'recipient': 'john@test.com', 'subject': 'Hello', 'body': 'How are you?'}
{'type': 'edit',
 'edited_action': {'name': 'send_email_tool',
  'args': {'recipient': 'john@test.com',
   'subject': 'Hello',
   'body': 'Thanks, see you at 3 pm.'}}}
```

```python title="Notebook cell" input="n|Wrong recipient"
ask_decision(action)
```

```output real
send_email_tool {'recipient': 'john@test.com', 'subject': 'Hello', 'body': 'How are you?'}
{'type': 'reject', 'message': 'Wrong recipient'}
```

In a loop around the agent, build the resume value with one decision per request: `Command(resume={"decisions": [ask_decision(a) for a in result["__interrupt__"][0].value["action_requests"]]})`. [Lesson 9.8](lesson:9.8) does exactly that.
:::

## Further reading

- LangChain, [Human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop): decisions, per-call mode and the interrupt format.
- LangGraph, [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts): the pause-and-resume mechanism underneath.
