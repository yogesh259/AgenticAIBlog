/* One call through a chain (lesson 6.1): prompt | llm | StrOutputParser, one value per step.
   The values are what each block returns, with the model's answer shortened; no code runs here. */
(() => {
  'use strict';
  const STEPS = [
    {
      lines: [6],
      caption: '<code>chain.invoke</code> receives a dict. Its keys must match the template\'s placeholders, here the one called <code>input</code>.',
    },
    {
      lines: [1, 2, 3, 4],
      caption: 'The prompt template fills <code>{input}</code> and returns the finished messages: a system message with the instructions, a human message with the question. No model has been called yet.',
    },
    {
      lines: [5],
      caption: 'The chat model sends the messages to the provider in one network request and wraps the reply in an <code>AIMessage</code>: the text in <code>content</code>, the token counts in <code>usage_metadata</code>.',
    },
    {
      lines: [5],
      caption: 'The output parser takes the <code>AIMessage</code> and returns its text, a plain <code>str</code>. <code>chain.invoke</code> returns whatever the last block returns.',
    },
  ];
  const ANSWER = 'LangSmith is a platform for tracing, testing and monitoring LLM applications.';
  const VALUES = [
    { block: '-', type: '-', label: 'waiting for invoke', body: '' },
    { block: '-', type: 'dict', label: 'dict, the input', body: '{"input": "What is LangSmith?"}' },
    {
      block: 'prompt',
      type: 'ChatPromptValue',
      label: 'ChatPromptValue, two messages',
      body: 'SystemMessage(content="You are an expert AI Engineer.")\nHumanMessage(content="What is LangSmith?")',
    },
    {
      block: 'llm',
      type: 'AIMessage',
      label: 'AIMessage, the reply',
      body: `AIMessage(\n  content="${ANSWER}",\n  usage_metadata={"input_tokens": 24, "output_tokens": 18, ...},\n)`,
    },
    { block: 'parser', type: 'str', label: 'str, the result', body: `"${ANSWER}"` },
  ];
  const ORDER = ['prompt', 'llm', 'parser'];

  document.querySelectorAll('[data-chain-flow]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const blocks = Object.fromEntries(ORDER.map((name) => [name, root.querySelector(`[data-block="${name}"]`)]));

    function draw(n) {
      const v = VALUES[n];
      ORDER.forEach((name, i) => {
        blocks[name].classList.toggle('is-active', v.block === name);
        blocks[name].classList.toggle('is-done', n >= i + 2 && v.block !== name);
      });
      el('value').classList.toggle('is-empty', n === 0);
      el('vtype').textContent = v.label;
      el('vbody').textContent = v.body;
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to call the chain with one question.',
      paint(n) {
        draw(n);
        return {};
      },
    });
  });
})();
