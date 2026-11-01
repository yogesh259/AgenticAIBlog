/* What the model sees (lesson 7.4): the trimmer's input and the window it keeps, call by call, for the cells of the
   lesson. Token counts are real: GPT-2's tokenizer on "Role: text", the fallback a Groq model uses; replaying the cells
   with them reproduces the saved trimmer output and shows what each call received. The answers are the saved ones. */
(() => {
  'use strict';
  const BUDGET = 45;
  const MSG = {
    sys: ['system', "you're a good assistant", 7],
    h1: ['human', "hi! I'm bob", 7],
    a1: ['ai', 'hi!', 4],
    h2: ['human', 'I like vanilla ice cream', 7],
    a2: ['ai', 'nice', 3],
    h3: ['human', 'whats 2 + 2', 6],
    a3: ['ai', '4', 3],
    h4: ['human', 'thanks', 3],
    a4: ['ai', 'no problem!', 5],
    h5: ['human', 'having fun?', 5],
    a5: ['ai', 'yes!', 4],
    q31: ['human', 'What ice cream do i like', 8],
    q32: ['human', 'what math problem did i ask', 8],
    q34: ['human', 'whats my name?', 6],
    r34: ['ai', "As a large language model, I don't have access to past conversations or any personal information about you, including your name. ...", 52],
    q35: ['human', 'what math problem did i ask?', 9],
    r35: ['ai', "As a large language model, I have no memory of past conversations. If you'd like to ask me a math problem, ...", 45],
  };
  const BASE = ['sys', 'h1', 'a1', 'h2', 'a2', 'h3', 'a3', 'h4', 'a4', 'h5', 'a5'];
  const TAIL = ['sys', 'h3', 'a3', 'h4', 'a4', 'h5', 'a5'];
  const STEPS = [
    { lines: [1, 2, 3], caption: 'The trimmer receives the 11 messages: 54 tokens as it counts them for a Groq model, with GPT-2\'s tokenizer and the role in front (<code>Human: hi! I\'m bob</code> is 7). The budget is 45.' },
    { lines: [3], caption: '<code>include_system</code> keeps the system message (7). Walking back from the newest, each message that still fits is kept, up to "I like vanilla ice cream": 43 tokens. "hi!" would make 47, so the walk stops, and the user\'s name is gone. No model is called: <code>trimmer.invoke</code> returns these 9 messages.' },
    { lines: [5, 6], caption: 'The question (8 tokens) joins at the newest end and the window slides: "I like vanilla ice cream" no longer fits, and <code>start_on="human"</code> drops "nice", which would start the kept part with a reply. The model never sees the ice cream.' },
    { lines: [7], caption: 'Same window, another question. "whats 2 + 2" is inside it, so the answer is right.' },
    { lines: [9, 10], caption: 'With the history wrapper, session chat5 starts empty, so the trimmer gets the same list plus "whats my name?": bob is outside the window. After the call, the wrapper saves the 12 messages passed in and the 52-token reply: 13 messages in the store.' },
    { lines: [11], caption: 'Only the new question is passed in; the wrapper puts the 13 stored messages before it. Walking back, the stored reply (52 tokens) alone is bigger than the budget, so the walk stops at once: the model gets the system message and the question, 16 tokens.' },
    { lines: [9], caption: 'The store now holds 15 messages; the last call sent 2 of them. The store keeps everything, the trimmer decides what each call sends, and one reply longer than the budget hides the whole history.' },
  ];
  const ANSWERS = {
    q31: "As an AI, I don't have access to your personal preferences like your favorite ice cream flavor.",
    q32: 'You asked "whats 2 + 2"',
    q34: "As a large language model, I don't have access to past conversations or any personal information about you, including your name.",
    q35: "As a large language model, I have no memory of past conversations. If you'd like to ask me a math problem, I'm happy to help!",
  };
  // One view per number of steps done: the trimmer's input in groups, the kept ids, the new message, the tokens sent.
  const VIEWS = [
    { groups: [['messages', BASE]], kept: null, store: 'the list passed in', count: '-', answer: '' },
    { groups: [['messages', BASE]], kept: null, store: 'the list passed in', count: '54 tokens in, budget 45', fill: 54, over: true, answer: '' },
    { groups: [['messages', BASE]], kept: ['sys', 'h2', 'a2', 'h3', 'a3', 'h4', 'a4', 'h5', 'a5'], store: 'the list passed in', count: '43 of 45 tokens kept', fill: 43, answer: 'No model call: trimmer.invoke returns the 9 kept messages.' },
    { groups: [['passed in', [...BASE, 'q31']]], kept: [...TAIL, 'q31'], fresh: 'q31', store: 'the list passed in', count: "41 of 45 tokens, plus the prompt's system message", fill: 41, answer: ANSWERS.q31 },
    { groups: [['passed in', [...BASE, 'q32']]], kept: [...TAIL, 'q32'], fresh: 'q32', store: 'the list passed in', count: "41 of 45 tokens, plus the prompt's system message", fill: 41, answer: ANSWERS.q32 },
    { groups: [['passed in', [...BASE, 'q34']]], kept: [...TAIL, 'q34'], fresh: 'q34', store: 'chat5: empty, 13 messages after', count: "39 of 45 tokens, plus the prompt's system message", fill: 39, answer: ANSWERS.q34 },
    { groups: [['from the store (chat5)', [...BASE, 'q34', 'r34']], ['passed in', ['q35']]], kept: ['sys', 'q35'], fresh: 'q35', store: 'chat5: 13 stored + 1 new', count: "16 of 45 tokens, plus the prompt's system message", fill: 16, answer: ANSWERS.q35 },
    { groups: [['in the store (chat5)', [...BASE, 'q34', 'r34', 'q35', 'r35']]], kept: ['sys', 'q35'], idle: ['r35'], store: 'chat5: 15 messages', count: '16 of 45 tokens in the last call', fill: 16, answer: ANSWERS.q35 },
  ];

  document.querySelectorAll('[data-history-window]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const make = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    };

    function draw(n) {
      const view = VIEWS[n];
      const list = el('rows');
      list.replaceChildren();
      view.groups.forEach(([label, ids]) => {
        if (view.groups.length > 1 || label !== 'messages') list.append(make('li', 'hw-sep', label));
        ids.forEach((id) => {
          const [role, text, tokens] = MSG[id];
          const row = make('li', 'hw-row');
          const state = view.kept ? (view.kept.includes(id) ? 'kept' : 'cut') : 'idle';
          row.dataset.state = view.idle && view.idle.includes(id) ? 'idle' : state;
          const textCell = make('span', 'hw-text', text);
          row.append(make('span', 'hw-role', role), textCell, make('span', 'hw-tok', String(tokens)));
          if (id === view.fresh) textCell.prepend(make('span', 'hw-new', 'new'));
          list.append(row);
        });
      });
      el('store').textContent = view.store;
      el('count').textContent = view.count;
      el('fill').style.width = `${Math.min(100, ((view.fill || 0) / BUDGET) * 100)}%`;
      el('fill').parentElement.parentElement.classList.toggle('is-over', Boolean(view.over));
      el('atext').textContent = view.answer || 'No model call yet.';
      el('answer').classList.toggle('is-empty', !view.answer);
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to trim the 11 messages, then follow four calls.',
      paint(n) {
        draw(n);
        return {};
      },
    });
  });
})();
