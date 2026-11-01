+++
number = "13.3"
title = "Routing"
lede = "Classify the input first, then send it to the step built for it: a model with structured output picks story, joke or poem, and a conditional edge runs the matching node."
summary = "What routing buys, routers made of rules, a model, embeddings or a classifier, the router graph with structured output, how a wrong route fails, routing from inside a node with Command, routing compared with a tool-calling agent, interview questions and two practice tasks."
type = "concept"
status = "published"
source = "13 Different Workflow in LangGraph: 24-28+Workflows.pdf (slide 3); 3-Routing.ipynb (cells 1-4; retired Groq model replaced, the cell split so the graph builds without a key); kinds of router, misroutes, Command, interview questions and practice added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

One prompt that handles every kind of request is a compromise: instructions for jokes clutter a prompt meant for stories, and a model strong enough for the hardest request is wasted on the easiest. Routing classifies the input first and sends it to a handler built for that category, with its own prompt, model or tools. The tools router of [lesson 11.2](lesson:11.2) was one kind, steered by whether the model asked for a tool; this lesson makes the classification an explicit step whose decision is stored in the state.

## What routing buys

- **Specialised handlers.** Each route gets a prompt, model and tools tuned for one category; improving one doesn't degrade the others.
- **Lower cost.** Easy, common requests go to a small, fast model; hard ones to a large model.
- **A visible decision.** The route is a value in the state, so you can log it, test it and count it.

Typical uses: customer service that separates refunds, technical problems and general questions; model tiering by difficulty; a language or region step before the handler. Routing works when the categories are distinct and the classifier gets them right; a request that fits two categories, or none, is where it breaks.

## Who decides the route

| Router | How | Good for | Watch out for |
|---|---|---|---|
| Rules | Keywords, patterns or metadata, in the routing function | Structured input, fixed formats; free and instant | Brittle on free text: "I can't log in" doesn't contain "login" |
| A model with structured output | The model fills a schema whose field allows only the route names ([lesson 9.5](lesson:9.5)) | Free text and nuance | One more model call per request, and it can misclassify |
| Embeddings | Compare the input's embedding with example requests for each route ([lesson 6.6](lesson:6.6)) | Many routes, high volume; no model call | Needs good examples and a similarity threshold |
| A trained classifier | A small model trained on labelled requests | Very high volume | Training data and upkeep |

The router below is the second kind. Whichever you use, the graph is the same: a decision, then a conditional edge.

## The router

```python title="Notebook cell" norun
from langchain_groq import ChatGroq

llm = ChatGroq(model="openai/gpt-oss-120b")
```

Any provider of [lesson 13.1](lesson:13.1) works.

```python title="Notebook cell"
from typing_extensions import Literal
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from typing_extensions import TypedDict


# Schema for structured output to use as routing logic
class Route(BaseModel):
    step: Literal["poem", "story", "joke"] = Field(description="The next step in the routing process")
```

```python title="Notebook cell" norun
## Augment the LLM with schema for structured output
router = llm.with_structured_output(Route)
```

`with_structured_output(Route)` returns a runnable that answers with a `Route` object instead of a message ([lesson 9.5](lesson:9.5)). The `Literal` becomes an enum in the schema the model receives, so the model is told it may only answer `"poem"`, `"story"` or `"joke"`, and Pydantic rejects anything else. The field's description is part of the instructions.

## The handlers and the decision

```python title="Notebook cell"
## state
class State(TypedDict):
    input: str
    decision: str
    output: str


# Nodes
def llm_call_1(state: State):
    """Write a story"""

    result = llm.invoke(state["input"])
    return {"output": result.content}


def llm_call_2(state: State):
    """Write a joke"""

    print("LLM call 2 is called")

    result = llm.invoke(state["input"])
    return {"output": result.content}


def llm_call_3(state: State):
    """Write a poem"""

    result = llm.invoke(state["input"])
    return {"output": result.content}


def llm_call_router(state: State):
    """Route the input to the appropriate node"""

    decision = router.invoke(
        [
            SystemMessage(
                content="Route the input to story,joke or poem based on the users request"
            ),
            HumanMessage(content=state["input"])
        ]
    )
    return {"decision": decision.step}


# Conditional edge function to route to the appropriate node
def route_decision(state: State):
    # Return the node name you want to visit next
    if state["decision"] == "story":
        return "llm_call_1"
    elif state["decision"] == "joke":
        return "llm_call_2"
    elif state["decision"] == "poem":
        return "llm_call_3"
```

The work is split in two. `llm_call_router` is a node: it asks the model to classify and stores the answer in `decision`. `route_decision` is the routing function: it reads `decision` and returns a node name, without calling anything. Keeping the decision in the state makes it visible in the final state, in streams and in traces ([lesson 12.1](lesson:12.1)).

The three handlers send the raw input to the same model, which keeps the example short; the print in `llm_call_2` shows which handler ran. In a real router each handler has its own system prompt, model or tools, which is the point of routing.

```python title="Notebook cell"
from langgraph.graph import StateGraph, START, END
from IPython.display import Image, display

# Build workflow
router_builder = StateGraph(State)
# Add nodes
router_builder.add_node("llm_call_1", llm_call_1)
router_builder.add_node("llm_call_2", llm_call_2)
router_builder.add_node("llm_call_3", llm_call_3)
router_builder.add_node("llm_call_router", llm_call_router)

# Add edges to connect nodes
router_builder.add_edge(START, "llm_call_router")
router_builder.add_conditional_edges(
    "llm_call_router",
    route_decision,
    {  # Name returned by route_decision : Name of next node to visit
        "llm_call_1": "llm_call_1",
        "llm_call_2": "llm_call_2",
        "llm_call_3": "llm_call_3",
    },
)
router_builder.add_edge("llm_call_1", END)
router_builder.add_edge("llm_call_2", END)
router_builder.add_edge("llm_call_3", END)

# Compile workflow
router_workflow = router_builder.compile()
```

```python title="Notebook cell" norun
# Show the workflow
display(Image(router_workflow.get_graph().draw_mermaid_png()))
```

```python title="Notebook cell"
for edge in router_workflow.get_graph().edges:
    kind = " (conditional)" if edge.conditional else ""
    print(f"{edge.source} -> {edge.target}{kind}")
```

```output real
__start__ -> llm_call_router
llm_call_router -> llm_call_1 (conditional)
llm_call_router -> llm_call_2 (conditional)
llm_call_router -> llm_call_3 (conditional)
llm_call_1 -> __end__
llm_call_2 -> __end__
llm_call_3 -> __end__
```

`route_decision` has no `Literal` return hint, so the path map is what tells LangGraph the three possible targets; without either, the drawing would show the router leading straight to `__end__` ([lesson 10.2](lesson:10.2)).

## Run it

```python title="Notebook cell" norun
state = router_workflow.invoke({"input": "Write me a joke about Agentic AI System"})
print(state["output"])
```

```output saved note="from a run with Qwen 2.5 32B, since retired; answers vary per run"
LLM call 2 is called
Sure, here's a joke for you:

Why did the Agentic AI System refuse to play hide and seek?

Because it couldn't stand the thought of being 'out of control'!
```

Two model calls: the router classified the request as `"joke"`, `route_decision` turned that into `"llm_call_2"`, and the joke handler wrote the answer. The final state also holds `decision`, so a log of runs shows how requests were routed.

## When the route is wrong

A wrong route raises no error. A story request classified as a joke gets a joke, delivered with confidence, and nothing in the run marks it as wrong. Defences:

- **Measure the router on its own.** Keep a set of labelled requests and check the router's accuracy whenever its prompt or model changes (practice 2).
- **Give it a way out.** A fallback route for "none of these", or one that asks the user to clarify, beats forcing every request into a category.
- **Watch the decisions.** The stored `decision` and the traces of [lesson 12.1](lesson:12.1) show which routes are taken and how often.

The routing function needs a way out too. `route_decision` returns nothing for a value it doesn't list, and LangGraph then fails the run with `KeyError: None`, because `None` is not in the path map. Without a path map or a `Literal` hint it is quieter still: an unknown name only logs a warning ("wrote to unknown channel branch:to:...") and the run ends after the router, with no output. The `Literal` in `Route` keeps the model's answer to the three names, but a router driven by anything else (rules, a classifier, a schema that grows a fourth route) needs a final `return` with a default.

## Route from inside a node with Command

Here a node decides and a separate routing function translates the decision. LangGraph also lets a node do both in one return value: a `Command` holds the state update and the next node. The graph then needs no conditional edge, and the return hint `Command[Literal[...]]` tells LangGraph the possible targets, as a `Literal` does for a routing function. A rule-based router shows it without a model; three stand-in nodes take the handlers' places:

```python title="Notebook cell"
from langgraph.types import Command


def keyword_router(state: State) -> Command[Literal["llm_call_1", "llm_call_2", "llm_call_3"]]:
    text = state["input"].lower()
    decision = "joke" if "joke" in text else "poem" if "poem" in text else "story"
    node = {"story": "llm_call_1", "joke": "llm_call_2", "poem": "llm_call_3"}[decision]
    return Command(update={"decision": decision}, goto=node)


builder = StateGraph(State)
builder.add_node("keyword_router", keyword_router)
for number in (1, 2, 3):
    builder.add_node(f"llm_call_{number}", lambda state, number=number: {"output": f"handled by llm_call_{number}"})
    builder.add_edge(f"llm_call_{number}", END)
builder.add_edge(START, "keyword_router")
command_router = builder.compile()

for text in ["Write me a joke about agents", "A poem about rivers, please", "Tell me about dragons"]:
    result = command_router.invoke({"input": text})
    print(result["decision"], "->", result["output"])
```

```output real
joke -> handled by llm_call_2
poem -> handled by llm_call_3
story -> handled by llm_call_1
```

Use `Command` when the node that does the work also knows where to go next, as when one agent hands a conversation to another. Keep the conditional edge when you want routing separate from the work, so each can be tested on its own. Both draw and run the same.

## Routing or a tool-calling agent

A tool-calling agent routes too: the model picks a tool on every turn ([lesson 11.4](lesson:11.4)). The difference is who controls the flow. A router makes one decision up front and hands over to a fixed path, which is predictable, cheap and easy to test. An agent makes a decision at every step, which handles open-ended requests but costs more calls and is harder to predict. Many systems combine them: a router in front, sending each kind of request to its own small agent with only the tools that kind needs ([lesson 11.3](lesson:11.3) explains why fewer tools per model helps).

## Interview questions

::: check
How do you choose between a rule-based router, a model router and an embeddings router?

Rules when the input is structured or the categories have clear markers: free, instant and predictable, but brittle on free text. A model with structured output when the input is free text and the categories need judgement: accurate, but it adds a call's latency and cost to every request. Embeddings when there are many routes and lots of traffic: compare the request with example requests per route, no model call needed, but it depends on good examples and a threshold for "none of these". Often a cascade works best: rules for the obvious cases, a model for the rest.
:::

::: check
Your router sends 5% of refund requests to the general handler. How would you find out, and what would you change?

Nothing errors, so you find out by measuring: a labelled set of real requests run through the router, the stored decisions and traces of production runs, and complaints that cluster on one route. Then improve the router: clearer route descriptions and examples in its prompt, a stronger model for the router alone, or rules for the clear markers ("refund", an order number). Add a fallback for low-confidence cases, and keep the labelled set as a regression test for every later change.
:::

::: check
When would you route with `Command` rather than a conditional edge?

When the node that does the work also decides where to go, and the decision and the state update belong together: a handoff between agents, or a node that classifies and records the result in one step. A conditional edge keeps routing logic separate from work, so the routing function can be unit-tested and reused. Either way, declare the targets (`Command[Literal[...]]` or a path map) so the graph can be checked and drawn.
:::

::: check
What happens if the routing function returns a value the graph doesn't know?

With a path map, LangGraph looks the value up and fails with a `KeyError`, `KeyError: None` when the function fell through all its `if`s. Without a path map or a `Literal` hint, an unknown name is worse: LangGraph logs a warning and the run ends after the router as if it had finished. The fix is a final `return` with a default route, declared targets (a path map or a `Literal`), and a router whose output is constrained, such as a `Literal` field in a structured-output schema.
:::

## Practice

::: practice
**A support router with a fallback.** Route support messages by keywords: billing words to `billing`, technical words to `technical`, everything else to `general`. Use a routing function with a `Literal` hint straight from `START`, and stand-in nodes that record the team. Try four messages.

```python title="Notebook cell"
class Ticket(TypedDict):
    message: str
    team: str


ROUTES = {
    "billing": ["refund", "invoice", "charge"],
    "technical": ["error", "crash", "login"],
}


def route_ticket(state: Ticket) -> Literal["billing", "technical", "general"]:
    text = state["message"].lower()
    for team, words in ROUTES.items():
        if any(word in text for word in words):
            return team
    return "general"  # the fallback: every message lands somewhere


builder = StateGraph(Ticket)
for team in ["billing", "technical", "general"]:
    builder.add_node(team, lambda state, team=team: {"team": team})
    builder.add_edge(team, END)
builder.add_conditional_edges(START, route_ticket)
support = builder.compile()

for message in ["I was charged twice", "The app shows an error at login", "Do you have a dark mode?", "I can't log in"]:
    print(support.invoke({"message": message})["team"], "|", message)
```

```output real
billing | I was charged twice
technical | The app shows an error at login
general | Do you have a dark mode?
general | I can't log in
```

A conditional edge can start at `START`: a router needs no node of its own when the input alone decides. The last message shows the weakness of keywords: "I can't log in" is a technical problem without the word "login", so the fallback catches it, and the wrong team gets it.
:::

::: practice
**Measure the router.** Run `route_ticket` over a small labelled set, print every misrouted message, and report the accuracy.

```python title="Notebook cell"
labelled = [
    ("I was charged twice", "billing"),
    ("Please send the invoice for March", "billing"),
    ("My refund hasn't arrived", "billing"),
    ("The app shows an error at login", "technical"),
    ("I can't log in", "technical"),
    ("Do you have a dark mode?", "general"),
]

correct = 0
for message, expected in labelled:
    got = route_ticket({"message": message})
    correct += got == expected
    if got != expected:
        print(f"misrouted: {message!r} -> {got}, expected {expected}")
print(f"accuracy: {correct}/{len(labelled)}")
```

```output real
misrouted: "I can't log in" -> general, expected technical
accuracy: 5/6
```

The routing function is plain code, so it can be tested without the graph. The same loop works for a model router: call `router.invoke(...)` instead and compare `step` with the label. Grow the set with real requests that were misrouted, and run it before every change to the router's prompt, model or rules.
:::

## Further reading

- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024): routing, and when to combine it with other patterns.
- LangChain, [Use the graph API: Command](https://docs.langchain.com/oss/python/langgraph/use-graph-api#combine-control-flow-and-state-updates-with-command): routing and state updates in one return value.
