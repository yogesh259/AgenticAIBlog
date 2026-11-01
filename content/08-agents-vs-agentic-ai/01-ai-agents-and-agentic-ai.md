+++
number = "8.1"
title = "AI agents and agentic AI"
lede = "An AI agent is a program in which a language model decides the next step: it asks for tools, reads their results and repeats until the task is done. Agentic AI is the larger system in which several agents split a goal, share their work and adapt as they go."
summary = "What an agent adds to a chat model, the loop of perception, reasoning, action and learning, who runs a tool and when an agent stops, AI agents and agentic AI compared on examples, agent or tool, workflows versus agents, levels of autonomy, interview questions and two practice tasks in plain Python."
type = "concept"
status = "published"
source = "8 AgenticAI vs AI Agent: 1 AI agents vs agentic AI.pdf (slides 1-2); the agent loop, workflows vs agents and levels of autonomy added from Anthropic's and LangChain's definitions; practice tasks added"
chips = [["i-layers", "Concept"]]
+++

A chat model turns text into text. It can describe a shop's delivery policy in general terms, but it can't look up order 1042, and it can't issue a refund. Most applications worth building need both, so developers give the model tools, functions it can ask the application to run, and a loop that feeds each result back until the task is done: an AI agent. When several agents divide a larger goal between them, pass on what they find and check one another's work, the system as a whole is called agentic AI. Both terms are used loosely, so this lesson pins them down, shows the loop every agent runs, and adds the question behind most design decisions: how much of the control flow should the model own? The modules that follow build the answers, from fixed chains to agents with tools to graphs of cooperating steps.

## What an agent adds to a model

The chatbot of [lesson 7.3](lesson:7.3) can talk but not act: it knows its training data and the conversation, nothing more. An agent puts the model inside a program with four more parts:

| Part | What it does | In an order-support agent |
|---|---|---|
| Model | Reads everything sent so far and decides the next step: answer, or call a tool with arguments. Often called the agent's brain | A chat model |
| Instructions | The system prompt: role, goal, rules, and when to use which tool | "You are a support assistant. Look orders up before answering." |
| Tools | Functions the model may ask the application to run, each described to it by a name, a description and a JSON schema of its arguments ([lesson 4.3](lesson:4.3)) | `get_order(order_id)` over the orders database, `search_policy(topic)` over the shop's policies |
| Memory | What the agent keeps: the messages of the current task (short-term, [lesson 7.3](lesson:7.3)) and facts kept across conversations (long-term, [lesson 11.5](lesson:11.5)) | This conversation; the customer's past orders |
| Loop | The application code that calls the model, runs the tools it asks for, sends back the results and decides when to stop | About ten lines, below |

The model never runs a tool itself. It returns a tool call, a structured request that names a tool and its arguments, and the application decides what happens next: it can check the arguments, refuse, ask a person, or run the function and send the result back as a new message. Every action passes through that code, so the application, not the model, is where permissions, limits and logs belong.

## The agent loop

Every agent, from a support bot to a coding assistant, repeats one cycle: the model reads the messages and picks a step, the application carries it out, and the result joins the messages for the next turn. Here is one customer's question, turn by turn:

::: visual agent-loop | Run player | One request through an agent
The model chooses two tools, then answers; the application runs what it asks for.
:::

Each turn has the four parts that describe any agent:

| Capability | Meaning | In an LLM agent |
|---|---|---|
| Perception | Gather data from the surroundings | Whatever enters the model's context: the user's message, tool results, retrieved documents, readings from sensors or APIs |
| Reasoning | Understand what is going on and decide | One model call: answer now, or call which tool with which arguments |
| Action | Do something specific | A tool call the application runs: a query, an API request, a file edit, a payment |
| Learning | Improve and adapt over time | Memory and feedback, kept outside the model |

Learning is the part most often oversold. The model's weights don't change while an agent runs. A deployed agent improves because it keeps memory (the conversation, facts about a user, notes from earlier tasks) and because people turn its runs and ratings into better prompts, better tools and test cases; occasionally a model is fine-tuned offline on that data **VERIFY**.

### When the loop stops

The loop ends when the model answers instead of asking for a tool. Nothing forces a model to get there, so real agents add their own stops: a maximum number of steps, a token or cost budget, a time limit, and a person who can pause the run ([lesson 14.3](lesson:14.3)). LangGraph, which LangChain's agents run on, ends a run that goes past its `recursion_limit` with a `GraphRecursionError`. Its default allows thousands of steps (10,007 in version 1.2), so set a lower limit for agents that call paid models.

## AI agents and agentic AI

The two terms describe different scopes.

An **AI agent** is an individual program built for a specific task, with some autonomy inside it. A customer-service chatbot that answers common questions and looks up orders is one; so is a banking bot that handles balance inquiries and transfers. Its processes are clearly defined: the goal, the tools and the allowed actions are fixed in advance, and the model only chooses among them.

**Agentic AI** describes a whole system in which several agents, each with its own role, work toward a larger goal. They split the goal into tasks, pass results to one another, check each other's work and change the plan when something happens at run time. The focus moves from one agent's answer to the behaviour of the system.

| | AI agent | Agentic AI |
|---|---|---|
| Scope | One specific task | A larger goal made of many tasks |
| Structure | A single agent with a focused purpose | Several agents plus the code that coordinates them |
| Autonomy | Limited: picks tools within a fixed process | Higher: plans, splits and re-plans the work |
| Decisions | Within predefined rules and actions | From real-time data and circumstances, so the path differs from run to run |
| Memory | The current task or conversation | State shared by the agents, often kept across tasks |
| Adapting | Changes when its developers change it | Adjusts its plan to results and feedback while it runs |
| Typical uses | Support chat, scheduling, summaries, routine transactions | Software delivery, research, coordinating devices, decision support |
| Main risks | A wrong answer or a wrong tool call | Errors that compound across agents, runaway cost, agents that contradict each other, harder testing |

| Example | Kind | Why |
|---|---|---|
| A customer-service chatbot that answers basic questions | AI agent | One task, a small set of answers and lookups |
| A banking bot for balance inquiries and transfers | AI agent | Clearly defined, auditable processes |
| A chatbot that hands order lookups to a retriever agent working on the order database | Agentic AI, in its smallest form | Two agents cooperate on one request |
| A smart home whose lights, thermostat and appliances share one goal: use less electricity | Agentic AI | Several systems coordinate from live data such as prices, occupancy and weather |
| A health assistant that combines a patient's history, real-time readings and lifestyle, and adapts to new research and the patient's feedback | Agentic AI | Many sources, an open-ended goal and a plan that changes over time; clinicians still decide |

Both are built from the same parts, a model that decides with tools and databases around it. They differ in how many agents there are, how much those agents may decide, and how they are coordinated.

### Agent or tool?

In the order example, the retriever is an agent only if it decides something: rewriting the query, choosing which source to search, searching again when the results are poor. A retriever that runs one fixed query is a tool. The same component can be either, and turning it from one into the other is the step from basic RAG to agentic RAG ([lesson 6.3](lesson:6.3), [lesson 15.1](lesson:15.1)).

## Workflows, agents and levels of autonomy

Engineers usually draw the line by control flow rather than by the number of agents. Anthropic calls everything in this lesson an agentic system and separates two kinds: **workflows**, where models and tools follow paths fixed in code, and **agents**, where the model directs its own steps and tool use. LangChain defines an agent as a system that uses a model to decide the control flow, and describes autonomy as a scale, judged by three decisions: who decides a step's output, which step comes next, and which steps exist.

::: visual autonomy-ladder | Figure | Who decides the next step
Six levels, from plain code to an agent that writes its own tools.
:::

Two separate questions hide inside the words "agent" and "agentic": how much the model decides (autonomy), and how many agents share the work (structure). A single agent can be highly autonomous, while a system of several model calls can follow a fixed workflow, like the report writer in [lesson 13.4](lesson:13.4), whose planner and writers always run in the same order.

Choose the lowest level that solves the problem. Each step up buys flexibility with latency, cost and behaviour that is harder to predict and test. A single model call with retrieval answers most questions about documents ([module 06](module:06)); a workflow suits tasks whose steps are known in advance; an agent suits open-ended tasks whose steps can't be predicted; several agents pay off when one agent has too many tools or too much context, or when work can run in parallel ([lesson 8.2](lesson:8.2)).

## Interview questions

::: check
A product manager asks for "an AI agent" that answers employees' questions about the HR handbook. What do you build?

Most likely not an agent. Questions over a fixed set of documents need one retrieval and one model call: a RAG pipeline ([lesson 6.3](lesson:6.3)), whose fixed path is cheaper, faster and easier to test. An agent becomes worth it when the assistant must act, such as booking leave or checking a balance in the HR system, or when one question needs several lookups that depend on each other. Start with the pipeline, measure, and add tools for the questions it fails.
:::

::: check
Your support agent can look up orders and issue refunds. Which decisions belong to the model, and which to code?

The model interprets the request, chooses which lookups to make and writes the reply. Code enforces everything that must always hold: who the customer is and which orders they may see, the refund limit, the validation of every tool argument, a person's approval above a threshold, and a log of each action. The model proposes; the application checks and executes.
:::

::: check
What happens between the model returning a tool call and the tool running?

The model's reply holds a structured tool call: a tool name, arguments and an ID. The application finds the function with that name, validates the arguments against its schema, checks permissions, runs it, catches errors, and appends the result as a tool message carrying the same ID. Then it calls the model again with the longer message list. The model only ever sees text: the tool descriptions on the way in, the results on the way back.
:::

::: check
An agent keeps calling the same search tool and never answers. What could cause it, and what do you change?

The results never contain what the model is looking for, the tool's description promises more than the tool delivers, errors come back as unclear text, or the instructions never say when to give up. Cap the steps and the spend, return clear results such as "no order found with ID 1042", improve the tool's description, detect repeated identical calls, and tell the model to answer with what it has, or hand over to a person, when a search fails twice.
:::

::: check
How does an agent learn from experience?

Not by changing its model while it runs. It stores memory, such as the conversation, facts about the user and the outcomes of earlier tasks, and retrieves it when relevant. Its developers learn from it too: traces and user ratings become test cases, better prompts and better tools, and sometimes data to fine-tune a model offline.
:::

::: check
Is a system of several agents always more agentic than a single agent?

No. Autonomy (how much the model decides) and structure (how many agents) are separate. Many multi-agent systems are fixed workflows of specialised model calls, while a single agent with tools may decide every step. Agentic AI in the full sense is high on both: several agents that also plan and re-plan.
:::

## Practice

::: practice
**Make the loop run.** Write the order agent in plain Python with a stand-in for the model: `get_order` and `search_policy` as dictionary lookups, a `tools` dict mapping their names to them, and a `model(messages)` function that returns three scripted replies in turn (a call to `get_order`, a call to `search_policy`, then an answer). Run the loop for "Where is my order 1042?" and print every message. No model needed.

```python title="Notebook cell"
ORDERS = {"1042": {"status": "delayed", "eta": "Friday"}}
POLICIES = {"late delivery": "Orders more than two days late get free shipping on the next order."}


def get_order(order_id: str) -> dict:
    """Look up an order by its ID."""
    return ORDERS.get(order_id, {"error": f"no order with ID {order_id}"})


def search_policy(topic: str) -> str:
    """Find the shop's policy on a topic."""
    return POLICIES.get(topic, "no policy found")


tools = {"get_order": get_order, "search_policy": search_policy}


def tool_call(call_id: str, name: str, **args) -> dict:
    return {"role": "assistant", "tool_calls": [{"id": call_id, "name": name, "args": args}]}


script = iter([                                   # the replies a model might give, in order
    tool_call("call_1", "get_order", order_id="1042"),
    tool_call("call_2", "search_policy", topic="late delivery"),
    {"role": "assistant",
     "content": "Order 1042 is delayed and should arrive on Friday. Your next order ships free."},
])


def model(messages: list[dict]) -> dict:
    return next(script)                           # a real model reads the messages and decides


messages = [
    {"role": "system", "content": "You are a support assistant. Look orders up before answering."},
    {"role": "user", "content": "Where is my order 1042?"},
]
for step in range(5):
    reply = model(messages)
    messages.append(reply)
    if not reply.get("tool_calls"):               # no tool call: this is the answer
        break
    for call in reply["tool_calls"]:
        result = tools[call["name"]](**call["args"])
        messages.append({"role": "tool", "tool_call_id": call["id"], "content": str(result)})

for message in messages:
    print(f'{message["role"]:<10}{message.get("content") or message["tool_calls"]}')
print(step + 1, "model calls")
```

```output real
system    You are a support assistant. Look orders up before answering.
user      Where is my order 1042?
assistant [{'id': 'call_1', 'name': 'get_order', 'args': {'order_id': '1042'}}]
tool      {'status': 'delayed', 'eta': 'Friday'}
assistant [{'id': 'call_2', 'name': 'search_policy', 'args': {'topic': 'late delivery'}}]
tool      Orders more than two days late get free shipping on the next order.
assistant Order 1042 is delayed and should arrive on Friday. Your next order ships free.
3 model calls
```

Each tool result carries the ID of the call it answers, so a model that asks for several tools at once can match the results. The loop knows nothing about orders: swap the tools and the script, and the same lines run another agent. A real model also receives each tool's name, description and argument schema with every call ([lesson 9.3](lesson:9.3)).
:::

::: practice
**Fail safely.** Real models sometimes ask for a tool that doesn't exist, and sometimes never stop. Reusing `tools`, `model` and `tool_call` from the first task, write `run_agent(question, max_steps=4)` that survives both: when a tool is unknown or raises an error, send the error back as the tool's result instead of crashing; when the model is still calling tools after `max_steps` calls, stop with a message. Test it with a script that asks for `cancel_order`, then keeps asking for `get_order` forever.

```python title="Notebook cell"
from itertools import chain, repeat

script = chain(
    [tool_call("call_1", "cancel_order", order_id="1042")],
    repeat(tool_call("call_2", "get_order", order_id="1042")),   # never answers
)


def run_agent(question: str, max_steps: int = 4) -> tuple[str, list[dict]]:
    messages = [{"role": "user", "content": question}]
    for _ in range(max_steps):
        reply = model(messages)
        messages.append(reply)
        if not reply.get("tool_calls"):
            return reply["content"], messages
        for call in reply["tool_calls"]:
            try:
                if call["name"] not in tools:
                    raise LookupError(f"unknown tool {call['name']!r}, use one of {list(tools)}")
                result = tools[call["name"]](**call["args"])
            except Exception as exc:              # unknown tool, wrong arguments, a failing API
                result = f"error: {exc}"
            messages.append({"role": "tool", "tool_call_id": call["id"], "content": str(result)})
    return f"stopped after {max_steps} model calls without an answer", messages


answer, messages = run_agent("Cancel my order 1042")
print(answer)
for message in messages[1:4]:
    print(f'{message["role"]:<10}{message.get("content") or message["tool_calls"]}')
print(len(messages), "messages")
```

```output real
stopped after 4 model calls without an answer
assistant [{'id': 'call_1', 'name': 'cancel_order', 'args': {'order_id': '1042'}}]
tool      error: unknown tool 'cancel_order', use one of ['get_order', 'search_policy']
assistant [{'id': 'call_2', 'name': 'get_order', 'args': {'order_id': '1042'}}]
9 messages
```

An error sent back as a result is information the model can act on: here it could tell the customer that orders can't be cancelled in this chat. A crash would end the run with nothing to show. The step limit turns a model that never answers into a clear failure that the application can report or hand to a person, as LangGraph's `recursion_limit` does.
:::

## Further reading

- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024): workflows and agents, the augmented model, and when not to build an agent.
- LangChain, [What is an AI agent?](https://www.langchain.com/blog/what-is-an-agent) (2026): the levels of autonomy, the parts of the agent loop, and when an agent is needed at all.
- Sapkota and others, [AI Agents vs. Agentic AI: A Conceptual Taxonomy, Applications and Challenges](https://arxiv.org/abs/2505.10468) (2025): the distinction in this lesson, with applications and failure modes on each side.
