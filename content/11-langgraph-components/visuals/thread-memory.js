/* One thread, two calls (lesson 11.5). Replays the saved run of the lesson's ReAct graph with a MemorySaver:
   two invoke calls on thread "1", with the messages exactly as the lesson's output shows them. Nothing runs in
   the page. Each step lights the edge taken and the node that ran, then shows the state and what thread "1" holds. */
(() => {
  'use strict';
  const MSGS = [
    { role: 'human', text: 'Add 12 and 13.' },
    { role: 'ai', call: true, text: 'add(a=12, b=13)' },
    { role: 'tool', text: '25' },
    { role: 'ai', text: '12 plus 13 equals 25.' },
    { role: 'human', text: 'add that number to 25' },
    { role: 'ai', call: true, text: 'add(a=25, b=25)' },
    { role: 'tool', text: '50' },
    { role: 'ai', text: 'When you add 25 to 25, you get 50.' },
  ];
  const ONE = [3, 4];
  const TWO = [6, 7];

  // edge: the edge travelled first (if any); node: the node that runs or is reached; count: messages afterwards;
  // loaded: messages that came from the checkpointer at the start of the call; saved: the checkpointer's panel.
  const STEPS = [
    {
      edge: 'start', node: 'llm', count: 1, loaded: 0, lines: [1, ...ONE], saved: '1 message: the input',
      caption: '<b>First call.</b> <code>invoke</code> runs on thread <code>"1"</code>, which has no saved state, so the state starts with the one input message.',
    },
    {
      node: 'llm', run: 'llm', count: 2, loaded: 0, lines: ONE, saved: '2 messages, saved after this step',
      caption: '<b>tool_calling_llm runs.</b> The model reads one message and replies with a tool call, <code>add(a=12, b=13)</code>. The checkpointer saves the state after every step.',
    },
    {
      edge: 'tools', node: 'tools', run: 'tools', count: 3, loaded: 0, lines: ONE, saved: '3 messages',
      caption: '<b>Act.</b> <code>tools_condition</code> sees a tool call in the last message and routes to <code>tools</code>; <code>ToolNode</code> runs <code>add</code> and appends its result, <code>25</code>.',
    },
    {
      edge: 'back', node: 'llm', run: 'llm', count: 4, loaded: 0, lines: ONE, saved: '4 messages',
      caption: '<b>Observe, reason.</b> The edge back hands the result to the model, which answers in text: "12 plus 13 equals 25."',
    },
    {
      edge: 'end', node: 'end', count: 4, loaded: 0, lines: ONE, saved: '4 messages: the whole first turn', done: true,
      caption: '<b>END.</b> No tool calls in the last reply, so <code>tools_condition</code> routes to <code>END</code>. <code>invoke</code> returns four messages, and thread <code>"1"</code> keeps them.',
    },
    {
      edge: 'start', node: 'llm', count: 5, loaded: 4, lines: TWO, saved: '4 loaded, 5 with the new question',
      caption: '<b>Second call, same thread.</b> Only "add that number to 25" is sent. Before any node runs, the checkpointer loads thread <code>"1"</code>\'s four messages and <code>add_messages</code> appends the new one.',
    },
    {
      node: 'llm', run: 'llm', count: 6, loaded: 4, lines: TWO, saved: '6 messages',
      caption: '<b>The model reads all five.</b> "That number" is the 25 it computed in the first call, so it asks for <code>add(a=25, b=25)</code>.',
    },
    {
      edge: 'tools', node: 'tools', run: 'tools', count: 7, loaded: 4, lines: TWO, saved: '7 messages',
      caption: '<b>Act.</b> <code>tools</code> runs the call and appends <code>50</code>.',
    },
    {
      edge: 'back', node: 'llm', run: 'llm', count: 8, loaded: 4, lines: TWO, saved: '8 messages',
      caption: '<b>Observe, reason.</b> The model reads the result and answers: "When you add 25 to 25, you get 50."',
    },
    {
      edge: 'end', node: 'end', count: 8, loaded: 4, lines: TWO, saved: '8 messages: both turns', done: true,
      caption: '<b>END.</b> <code>invoke</code> returns all eight messages, as in the lesson\'s output; the next call on thread <code>"1"</code> will start from them.',
    },
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const LABEL = { human: 'Human', ai: 'AI', tool: 'Tool' };

  document.querySelectorAll('[data-thread-memory]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const svg = root.querySelector('.graph-box svg');
    const packet = svg.querySelector('.packet');
    const nodes = Object.fromEntries([...svg.querySelectorAll('[data-node]')].map((n) => [n.dataset.node, n]));
    const edges = Object.fromEntries([...svg.querySelectorAll('[data-edge]')].map((e) => [e.dataset.edge, e]));
    const list = el('msgs');

    function drawMessages(count, loaded, fresh) {
      list.replaceChildren(...MSGS.slice(0, count).map((m, i) => {
        const item = document.createElement('li');
        item.className = `tm-msg tm-${m.role}${i < loaded ? ' is-loaded' : ''}${fresh && i === count - 1 ? ' is-new' : ''}`;
        const tag = document.createElement('b');
        tag.textContent = LABEL[m.role];
        const text = document.createElement('span');
        text.textContent = m.call ? `tool call: ${m.text}` : m.text;
        item.append(tag, text);
        return item;
      }));
      if (!count) {
        const empty = document.createElement('li');
        empty.className = 'tm-empty';
        empty.textContent = 'Nothing has run yet.';
        list.append(empty);
      }
    }

    // phase 'pending': step n has started (its edge is lit, the state not yet changed); 'done': step n finished.
    function draw(n, phase, animateNew) {
      const step = STEPS[n - 1] || null;
      const before = STEPS[n - 2] || null;
      const pending = phase === 'pending' && step;
      Object.values(nodes).forEach((node) => node.classList.remove('is-active', 'is-running'));
      Object.values(edges).forEach((edge) => edge.classList.remove('is-active'));
      if (step && step.edge) edges[step.edge].classList.add('is-active');
      if (!step) nodes.start.classList.add('is-active');
      else if (!pending) nodes[step.node].classList.add('is-active');

      const shown = pending ? before : step;
      const grew = Boolean(step && (!before || step.count > before.count));
      // the second call's input step: while the edge is lit, the loaded messages are already in place
      if (pending && step.loaded && !before.loaded) drawMessages(step.loaded, step.loaded, false);
      else drawMessages(shown ? shown.count : 0, shown ? shown.loaded : 0, Boolean(animateNew && grew));
      el('saved').textContent = shown ? shown.saved : 'nothing saved yet';
      el('saved-box').classList.toggle('is-final', Boolean(shown && shown.done));
    }

    function travel(edge, ms, isCurrent) {
      const length = edge.getTotalLength();
      return new Promise((resolve) => {
        const t0 = performance.now();
        packet.style.opacity = '1';
        const frame = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          const point = edge.getPointAtLength(eased * length);
          packet.setAttribute('cx', point.x);
          packet.setAttribute('cy', point.y);
          if (t < 1 && isCurrent()) {
            requestAnimationFrame(frame);
          } else {
            packet.style.opacity = '0';
            resolve();
          }
        };
        requestAnimationFrame(frame);
      });
    }

    async function animate(n, isCurrent) {
      const step = STEPS[n - 1];
      if (step.edge) await travel(edges[step.edge], 700, isCurrent);
      if (step.run && isCurrent()) {
        nodes[step.run].classList.add('is-running');
        await wait(800);
        nodes[step.run].classList.remove('is-running');
      }
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b>: two calls on thread <code>"1"</code>, the second one asking about the first one\'s result.',
      paint(n, phase, animateNew) {
        draw(n, phase, animateNew);
        return {};
      },
      animate: reduceMotion ? null : animate,
    });
  });
})();
