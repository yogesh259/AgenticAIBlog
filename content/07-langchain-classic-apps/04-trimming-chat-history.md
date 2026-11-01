+++
number = "7.4"
title = "Trimming the conversation"
lede = "A history grows with every turn, but a model reads a limited number of tokens and every token costs time and money. Trim what each call sends with `trim_messages`, and see exactly what the model stops seeing."
summary = "Ways to keep a chat history small (trim, summarise, retrieve, remember facts), trim_messages and its parameters, how tokens are counted, a trimmer inside a chain and inside the history wrapper, why the store keeps everything while the model sees a window, and where to trim."
type = "concept"
status = "published"
source = "7 AI agent with history using langchain: 1-chatbots.ipynb (cells 29-35); the cells replayed with the same token counts to explain their answers; strategies and token counters added"
chips = [["i-layers", "Concept + code"], ["i-code", "Python 3.12"]]
+++

Every turn adds two messages to a chat history, and the wrapper of [lesson 7.3](lesson:7.3) sends all of them with every call. Sooner or later the history outgrows the model's context window and the call fails; long before that, each call gets slower and more expensive, and models use what sits in the middle of a long prompt less reliably **VERIFY**. So a chatbot decides, for each call, which past messages to send. This lesson uses the simplest way, trimming, and shows what the model stops seeing.

## Ways to keep a history small

| Strategy | How | Keeps | Costs | Where |
|---|---|---|---|---|
| Trim | Send the system message and the newest messages that fit a budget | Recent turns, word for word | Older turns are gone for the model | `trim_messages`, this lesson |
| Summarise | Replace older turns with a summary a model writes | The gist of the whole conversation | An extra model call; details get lost | `SummarizationMiddleware` ([lesson 9.6](lesson:9.6)) |
| Retrieve | Embed past turns; send only those related to the new message | Relevant details from long ago | A search per call; it can miss | A vector store ([lesson 6.7](lesson:6.7)) |
| Remember facts | Extract facts such as the user's name into a profile kept across sessions | Key facts, even in a new conversation | Deciding what to extract and when | LangGraph's long-term memory ([lesson 11.5](lesson:11.5)) |

They combine: many chatbots send the newest turns word for word plus a summary of everything before them.

## Set up

The cells continue the notebook of [lesson 7.3](lesson:7.3). In a new notebook, run this first; any chat model works in place of Groq's:

```python title="Notebook cell"
import os

from dotenv import load_dotenv
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_groq import ChatGroq

load_dotenv()
model = ChatGroq(model="openai/gpt-oss-20b", groq_api_key=os.getenv("GROQ_API_KEY"))

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a helpful assistant. Answer all questions to the best of your ability in {language}.",
        ),
        MessagesPlaceholder(variable_name="messages"),
    ]
)

store = {}


def get_session_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]
```

```output real
DeprecationWarning: `langchain-community` is being sunset and is no longer actively maintained. See https://github.com/langchain-ai/langchain-community/issues/674 for details and migration guidance toward standalone integration packages.
```

## Trim a list of messages

```python title="Notebook cell"
from langchain_core.messages import SystemMessage, trim_messages

trimmer = trim_messages(
    max_tokens=45,
    strategy="last",
    token_counter=model,
    include_system=True,
    allow_partial=False,
    start_on="human",
)
```

```python title="Notebook cell"
messages = [
    SystemMessage(content="you're a good assistant"),
    HumanMessage(content="hi! I'm bob"),
    AIMessage(content="hi!"),
    HumanMessage(content="I like vanilla ice cream"),
    AIMessage(content="nice"),
    HumanMessage(content="whats 2 + 2"),
    AIMessage(content="4"),
    HumanMessage(content="thanks"),
    AIMessage(content="no problem!"),
    HumanMessage(content="having fun?"),
    AIMessage(content="yes!"),
]
```

```python title="Notebook cell" norun
trimmer.invoke(messages)
```

```output saved note="current versions print the GPT-2 warning described below first"
[SystemMessage(content="you're a good assistant"),
 HumanMessage(content='I like vanilla ice cream'),
 AIMessage(content='nice'),
 HumanMessage(content='whats 2 + 2'),
 AIMessage(content='4'),
 HumanMessage(content='thanks'),
 AIMessage(content='no problem!'),
 HumanMessage(content='having fun?'),
 AIMessage(content='yes!')]
```

Called without messages, `trim_messages` returns a runnable that trims whatever it is given, so it can sit in a chain. Its parameters:

| Parameter | Here | Meaning |
|---|---|---|
| `max_tokens` | `45` | The budget for the messages kept |
| `strategy` | `"last"` | Keep the newest messages; `"first"` keeps the oldest |
| `token_counter` | `model` | How to count: the model's own counter, `len` (each message counts 1, so the budget becomes a number of messages), or `"approximate"` (about 4 characters per token, no tokenizer needed) |
| `include_system` | `True` | Always keep a leading system message |
| `allow_partial` | `False` | Never cut a message in two |
| `start_on` | `"human"` | Drop kept messages from the oldest end until a human message comes first, so the history begins validly |

The trimmer keeps the system message, then walks back from the newest message, keeping each one while the total stays within the budget. Counted with the role in front (`Human: hi! I'm bob`), the messages take:

| Message | Tokens | Running total from the newest |
|---|---|---|
| System: you're a good assistant | 7 | 7, kept first |
| AI: yes! | 4 | 11 |
| Human: having fun? | 5 | 16 |
| AI: no problem! | 5 | 21 |
| Human: thanks | 3 | 24 |
| AI: 4 | 3 | 27 |
| Human: whats 2 + 2 | 6 | 33 |
| AI: nice | 3 | 36 |
| Human: I like vanilla ice cream | 7 | 43 |
| AI: hi! | 4 | 47: over 45, stop |
| Human: hi! I'm bob | 7 | not kept |

Nine messages and 43 tokens survive; the user's name is gone.

### How tokens are counted

`token_counter=model` asks the model's integration to count. `ChatOpenAI` counts with OpenAI's own tokenizer. `ChatGroq` and `ChatOllama` have no tokenizer in LangChain, so the count falls back to GPT-2's, an old OpenAI tokenizer, with a warning: `UserWarning: Using fallback GPT-2 tokenizer for token counting. Token counts may be inaccurate for non-GPT-2 models.` That fallback needs the `transformers` package (installed with `sentence-transformers`, [lesson 6.1](lesson:6.1)) and downloads the tokenizer from Hugging Face the first time. `ChatGoogleGenerativeAI` asks Google's API, one request per message. For a budget that only needs to be about right, `token_counter="approximate"` counts locally and instantly.

## Trim inside the chain

`RunnablePassthrough.assign` ([lesson 7.1](lesson:7.1)) replaces the `messages` key with its trimmed version before the prompt sees it:

```python title="Notebook cell"
from operator import itemgetter

from langchain_core.runnables import RunnablePassthrough

chain = (
    RunnablePassthrough.assign(messages=itemgetter("messages") | trimmer)
    | prompt
    | model
)
```

```python title="Notebook cell" norun
response = chain.invoke(
    {
        "messages": messages + [HumanMessage(content="What ice cream do i like")],
        "language": "English",
    }
)
response.content
```

```output saved note="emoji removed; answers vary per run"
"As an AI, I don't have access to your personal preferences like your favorite ice cream flavor.  \n\nWhat's your favorite ice cream? \n"
```

`itemgetter("messages") | trimmer` takes the list out of the input dict and trims it; `language` passes through untouched. The answer looks like a failure of the model, but the model never saw the ice cream: the new question (8 tokens) took room at the newest end, so the walk back stopped before "I like vanilla ice cream", and `start_on="human"` then dropped "nice". The model received the prompt's system message, the history's system message, and six messages from "whats 2 + 2" on, plus the question: 41 tokens of history.

```python title="Notebook cell" norun
response = chain.invoke(
    {
        "messages": messages + [HumanMessage(content="what math problem did i ask")],
        "language": "English",
    }
)
response.content
```

```output saved note="emoji removed; answers vary per run"
'You asked "whats 2 + 2"   \n\n\n\n'
```

Same window, different question: "whats 2 + 2" is inside it.

## Trim with a history

```python title="Notebook cell"
## Lets wrap this in the Message History
with_message_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="messages",
)
config = {"configurable": {"session_id": "chat5"}}
```

```output real
LangChainDeprecationWarning: RunnableWithMessageHistory is deprecated. Use LangGraph's built-in persistence instead.
```

```python title="Notebook cell" norun
response = with_message_history.invoke(
    {
        "messages": messages + [HumanMessage(content="whats my name?")],
        "language": "English",
    },
    config=config,
)

response.content
```

```output saved note="emoji removed; answers vary per run"
"As a large language model, I don't have access to past conversations or any personal information about you, including your name.  \n\nIf you'd like to tell me your name, I'd be happy to know!   \n\n"
```

```python title="Notebook cell" norun
response = with_message_history.invoke(
    {
        "messages": [HumanMessage(content="what math problem did i ask?")],
        "language": "English",
    },
    config=config,
)

response.content
```

```output saved note="emoji removed; answers vary per run"
"As a large language model, I have no memory of past conversations. If you'd like to ask me a math problem, I'm happy to help!   Just let me know what it is. \n\n"
```

The last answer is the surprising one: "whats 2 + 2" is in the history, yet the model saw none of it. Step through the calls to see why:

::: visual history-window | Run player | What the model sees
The trimmer's input on the left, what it sends on the right, call by call.
:::

The store and the window are different things. The wrapper saves every message in the store; the trimmer decides, call by call, which of them the model receives. One reply longer than the whole budget (52 tokens against 45) was enough to hide all the rest. Here the cause is a tiny teaching budget, but the same happens in production when a budget of a few thousand tokens meets a pasted document or a long tool result.

## Where to trim

| Trim | Effect |
|---|---|
| In the chain, before the prompt (this lesson) | The store keeps everything: it can be summarised, searched or audited later, but it grows without limit |
| In the store, after each turn | Storage stays small, but what is cut is gone for good |
| Both | Keep the full log for records; send a window, with a summary of the rest |

Two details from the cells above: the budget covers only the history, not the prompt's own system message, any retrieved context or the reply, so the request is larger than `max_tokens`. And two system messages reached the model, the prompt's and the history's. Groq accepts that; some providers allow a single system message, first in the list **VERIFY**.

## Interview questions

::: check
After about 20 turns, your chatbot forgets the user's name, which they gave in their first message. Why, and what are your options?

A budget-based trimmer keeps the newest messages, so the first ones drop out once the history exceeds the budget. Options: a larger budget, if the context window and cost allow it; summarising older turns into a running summary that keeps such facts; extracting key facts (the name, preferences) into a profile that is always sent; or retrieving relevant older turns per question. In practice, newest turns plus a summary plus a small profile.
:::

::: check
Trimming or summarising: how do you choose?

Trimming is free, instant and exact for recent turns but forgets older ones completely; it suits short tasks and conversations where only the latest turns matter. Summarising keeps the gist of everything at the cost of an extra model call and some lost detail; it suits long conversations where early facts still matter. Many systems trim the summary's input and keep the newest turns word for word.
:::

::: check
Why `include_system=True` and `start_on="human"`?

The system message holds the instructions; trimming it away would silently change the bot's behaviour, so it is kept whatever the budget. A history that starts with an AI message, or with a tool result separated from the AI message that requested it, is invalid for many models; `start_on="human"` drops messages from the old end until the kept part starts with a user message.
:::

::: check
The trimmer's budget is 4,000 tokens, yet some requests still exceed the context window. What could be wrong?

The budget covers only the trimmed messages: the system prompt, retrieved documents, tool definitions and the room reserved for the reply come on top. The counter may also be wrong for the model: the GPT-2 fallback or an approximate count can be well off from the model's tokenizer, especially for code or non-English text. And `allow_partial=False` can't help with a single message that is larger than everything else; cap the size of pasted inputs and tool results too.
:::

## Practice

::: practice
**Trim by count.** Keep the system message and at most four messages in total, counting messages instead of tokens (`token_counter=len`). Predict the result before you run it. No model needed.

```python title="Notebook cell"
trim_messages(
    messages,
    max_tokens=4,
    strategy="last",
    token_counter=len,
    include_system=True,
    start_on="human",
)
```

```output real
[SystemMessage(content="you're a good assistant", additional_kwargs={}, response_metadata={}),
 HumanMessage(content='having fun?', additional_kwargs={}, response_metadata={}),
 AIMessage(content='yes!', additional_kwargs={}, response_metadata={}, tool_calls=[], invalid_tool_calls=[])]
```

Three, not four: the budget fits the system message plus "no problem!", "having fun?" and "yes!", and `start_on="human"` then drops "no problem!" because a history must not start with the model's reply.
:::

::: practice
**Find the budget that keeps a fact.** With `token_counter="approximate"`, find the smallest `max_tokens` for which the trimmed history still contains "I like vanilla ice cream". No model needed.

```python title="Notebook cell"
for budget in range(20, 100):
    kept = trim_messages(
        messages,
        max_tokens=budget,
        strategy="last",
        token_counter="approximate",
        include_system=True,
        start_on="human",
    )
    if any(message.content == "I like vanilla ice cream" for message in kept):
        print(budget, len(kept))
        break
```

```output real
69 9
```

A message survives only when everything newer fits too, so the budget must cover the whole tail of the conversation from that message on. The approximate counter gives larger numbers than the GPT-2 counts above (about 4 characters per token plus 3 per message), which is why 45 would not be enough here.
:::
