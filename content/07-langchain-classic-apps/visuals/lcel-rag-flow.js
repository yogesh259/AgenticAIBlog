/* One question through an LCEL chain (lesson 7.1): the dict step forks the question into a retrieval branch and a
   passthrough, then the prompt, model and parser run in a row. The chunks are real text from attention.pdf (pages 4, 4,
   5 and 2); which chunks a retriever returns and the answer are illustrative. No code runs here. */
(() => {
  'use strict';
  const Q = 'What is multi-head attention?';
  const ANSWER = 'Multi-head attention runs several attention functions in parallel, each on its own learned projection of the queries, keys and values, and concatenates their outputs.';
  const CONTEXT = '3.2.2 Multi-Head Attention\nInstead of performing a single attention function with dmodel-dimensional keys, values and queries, ...\n\n'
    + 'Scaled Dot-Product Attention\n Multi-Head Attention\nFigure 2: (left) Scaled Dot-Product Attention. (right) Multi-Head Attention consists of several attention layers running in parallel. ...\n\n'
    + 'output values. These are concatenated and once again projected, ... Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. ...\n\n'
    + '... an effect we counteract with Multi-Head Attention as described in section 3.2. ...';
  const STEPS = [
    { lines: [7], caption: '<code>invoke</code> receives a plain string, the question. The chain\'s first step is the dict, so the dict receives it.' },
    { lines: [2], caption: 'A dict in a chain is a <code>RunnableParallel</code>: it hands the same string to each of its values and runs them at the same time.' },
    { lines: [2], caption: '<b>Context branch.</b> The retriever embeds the question and returns the 4 nearest chunks from the vector store, as <code>Document</code>s with their metadata.' },
    { lines: [2], caption: '<code>format_docs</code>, a plain function that became a <code>RunnableLambda</code>, joins the chunks\' text with blank lines: one string for the prompt.' },
    { lines: [2], caption: '<b>Input branch.</b> <code>RunnablePassthrough()</code> returns the question unchanged. Without it, the prompt\'s <code>{input}</code> would have no value.' },
    { lines: [2], caption: 'Both branches are done. Their results form a dict under the dict\'s keys, <code>context</code> and <code>input</code>: exactly the prompt\'s two variables.' },
    { lines: [3], caption: 'The prompt fills <code>{context}</code> and <code>{input}</code> and returns one human message with the instructions, the chunks and the question.' },
    { lines: [4], caption: 'The model answers from the chunks, in an <code>AIMessage</code>. This is the only step that calls a provider.' },
    { lines: [5], caption: 'The parser keeps the text, and <code>invoke</code> returns it. The documents are not in the result, unlike the dict that <code>create_retrieval_chain</code> returns.' },
  ];
  // What each step shows: the glowing nodes and the value passed along (index = steps done).
  const VIEWS = [
    { active: [], label: 'waiting for invoke', body: '' },
    { active: ['question'], label: 'str, the input', body: `"${Q}"` },
    { active: ['fork', 'retriever', 'pass'], label: 'the same str, to both branches', body: `"context" branch <- "${Q}"\n"input" branch   <- "${Q}"` },
    {
      active: ['retriever'],
      label: 'list[Document], 4 chunks',
      body: "[Document(page_content='3.2.2 Multi-Head Attention\\nInstead of performing a single ...', metadata={'page_label': '4', ...}),\n"
        + " Document(page_content='Scaled Dot-Product Attention\\n Multi-Head Attention\\nFigure 2: ...', metadata={'page_label': '4', ...}),\n"
        + " Document(page_content='output values. These are concatenated and once again ...', metadata={'page_label': '5', ...}),\n"
        + " Document(page_content='... an effect we counteract with Multi-Head Attention ...', metadata={'page_label': '2', ...})]",
    },
    { active: ['format'], label: 'str, the context', body: `"${CONTEXT}"` },
    { active: ['pass'], label: 'str, the question again', body: `"${Q}"` },
    { active: ['fork'], label: 'dict, the two results', body: `{"context": "3.2.2 Multi-Head Attention\\nInstead of performing a single ...",\n "input": "${Q}"}` },
    {
      active: ['prompt'],
      label: 'ChatPromptValue, one message',
      body: 'HumanMessage(content="Answer the question using only the context below.\nIf the context does not contain the answer, say you don\'t know.\n\n<context>\n3.2.2 Multi-Head Attention\nInstead of performing a single ...\n</context>\n\n'
        + `Question: ${Q}")`,
    },
    { active: ['model'], label: 'AIMessage, the reply', body: `AIMessage(content="${ANSWER}", usage_metadata={...})` },
    { active: ['parser'], label: 'str, the result', body: `"${ANSWER}"` },
  ];
  // The step after which each node counts as finished (dimmed once a later step runs).
  const DONE_AFTER = { question: 1, retriever: 3, format: 4, pass: 5, fork: 6, prompt: 7, model: 8, parser: 9 };

  document.querySelectorAll('[data-lcel-rag]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const nodes = [...root.querySelectorAll('[data-node]')];

    function draw(n) {
      const view = VIEWS[n];
      nodes.forEach((node) => {
        const name = node.dataset.node;
        const active = view.active.includes(name);
        node.classList.toggle('is-active', active);
        node.classList.toggle('is-done', !active && n > DONE_AFTER[name] && name !== 'fork');
      });
      el('value').classList.toggle('is-empty', n === 0);
      el('vtype').textContent = view.label;
      el('vbody').textContent = view.body;
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to send one question through the chain.',
      paint(n) {
        draw(n);
        return {};
      },
    });
  });
})();
