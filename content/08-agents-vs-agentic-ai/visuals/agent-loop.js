/* One request through an agent (lesson 8.1): a support agent with two tools answers one question, turn by turn.
   The messages are the real output of the lesson's first practice task, where a script plays the model. */
(() => {
  'use strict';
  const QUESTION = 'Where is my order 1042?';
  const ANSWER = 'Order 1042 is delayed and should arrive on Friday. Your next order ships free.';
  const MSG = {
    q0: ['user', QUESTION],
    sys: ['system', 'You are a support assistant. Look orders up before answering.'],
    q: ['user', QUESTION],
    c1: ['assistant', 'tool call: get_order(order_id="1042")'],
    r1: ['tool', "{'status': 'delayed', 'eta': 'Friday'}"],
    c2: ['assistant', 'tool call: search_policy(topic="late delivery")'],
    r2: ['tool', 'Orders more than two days late get free shipping on the next order.'],
    a: ['assistant', ANSWER],
  };
  const STEPS = [
    { lines: [], caption: '<b>The model alone.</b> Sent straight to a chat model, the question gets an apology or a guess: the model has never seen this shop\'s orders and has no way to look them up.' },
    { lines: [1], caption: '<b>Perceive.</b> The application builds what the model will read: the instructions and the customer\'s question, with a description of each tool (name, purpose, arguments) sent alongside. Everything the agent perceives reaches the model this way.' },
    { lines: [2, 3, 4], caption: '<b>Reason.</b> The model reads the messages and decides it needs data. Its reply holds no text, only a tool call: <code>get_order</code> with <code>order_id="1042"</code>. The model asks; it doesn\'t run anything.' },
    { lines: [5, 7, 8, 9], caption: '<b>Act, then observe.</b> The reply is not an answer, so the loop goes on. The application runs <code>get_order</code> against the orders database and appends the result as a tool message: delayed, due Friday.' },
    { lines: [3, 4, 7, 8, 9], caption: '<b>Second turn.</b> The order is late, so the model asks for the shop\'s policy on late deliveries, and the application runs <code>search_policy</code>. No code said "check the policy when an order is late": the model chose this step.' },
    { lines: [3, 4, 5, 6], caption: '<b>Answer.</b> With the order and the policy in front of it, the model replies with text instead of a tool call, and the loop stops: three model calls, two tool calls.' },
    { lines: [10], caption: '<b>Learn.</b> The application saves the conversation, so a follow-up such as "Can I change the address?" has context, and logs the run with the customer\'s rating for the developers\' tests. The model itself is unchanged.' },
  ];
  const ALL = ['sys', 'q', 'c1', 'r1', 'c2', 'r2', 'a'];
  const AGENT = ['user', 'app', 'model', 'get_order', 'search_policy'];
  // One view per number of steps done: the message rows, the new ones, the parts that are lit and those not yet in play.
  const VIEWS = [
    { rows: [], fresh: [], hot: [], seen: [], count: '', answer: '' },
    { rows: ['q0'], fresh: ['q0'], hot: ['user', 'model'], seen: ['user', 'model'], count: 'one model call, no tools', guess: true },
    { rows: ['sys', 'q'], fresh: ['sys', 'q'], hot: ['app'], seen: AGENT, count: '2 messages' },
    { rows: ALL.slice(0, 3), fresh: ['c1'], hot: ['model'], seen: AGENT, count: '1 model call' },
    { rows: ALL.slice(0, 4), fresh: ['r1'], hot: ['app', 'get_order'], seen: AGENT, count: '1 model call, 1 tool call' },
    { rows: ALL.slice(0, 6), fresh: ['c2', 'r2'], hot: ['model', 'search_policy'], seen: AGENT, count: '2 model calls, 2 tool calls' },
    { rows: ALL, fresh: ['a'], hot: ['model'], seen: AGENT, count: '3 model calls, 2 tool calls', answer: ANSWER },
    { rows: ALL, fresh: [], hot: ['memory'], seen: [...AGENT, 'memory'], count: 'saved with the rating', answer: ANSWER },
  ];

  document.querySelectorAll('[data-agent-loop]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const parts = [...root.querySelectorAll('[data-part]')];
    const make = (tag, cls, text) => {
      const node = document.createElement(tag);
      node.className = cls;
      node.textContent = text;
      return node;
    };

    function draw(n) {
      const view = VIEWS[n];
      parts.forEach((part) => {
        const name = part.dataset.part;
        part.classList.toggle('is-hot', view.hot.includes(name));
        part.classList.toggle('is-off', n > 0 && !view.seen.includes(name));
      });
      const list = el('rows');
      list.replaceChildren();
      if (!view.rows.length) list.append(make('li', 'al-empty', 'No messages yet.'));
      view.rows.forEach((id) => {
        const [role, text] = MSG[id];
        const row = make('li', 'al-row', '');
        row.classList.toggle('is-new', view.fresh.includes(id));
        row.append(make('span', 'al-role', role), make('span', 'al-text', text));
        list.append(row);
      });
      el('count').textContent = view.count;
      const answer = el('answer');
      answer.classList.toggle('is-guess', Boolean(view.guess));
      answer.classList.toggle('is-empty', !view.answer && !view.guess);
      el('atext').textContent = view.guess
        ? 'An apology or a guess: no access to orders.'
        : view.answer || 'No answer yet.';
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to send one customer question to a support agent.',
      paint(n) {
        draw(n);
        return {};
      },
    });
  });
})();
