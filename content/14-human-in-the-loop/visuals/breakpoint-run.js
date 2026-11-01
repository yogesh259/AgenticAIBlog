/* Pause, look, resume (lesson 14.1). Replays the saved run of the lesson's agent compiled with
   interrupt_before=["assistant"]: three calls on thread "123", the messages of the lesson's outputs (the final answer
   without the model's tags), and the checkpoints LangGraph 1.2 saves for such a run, steps -1 to 3, checked offline
   with a stand-in node. Nothing runs in the page. */
(() => {
  'use strict';
  const MSGS = [
    { role: 'human', text: 'Multiply 2 and 3' },
    { role: 'ai', call: true, text: 'multiply(a=2, b=3)' },
    { role: 'tool', text: '6' },
    { role: 'ai', text: 'The result of multiplying 2 and 3 is 6.' },
  ];
  const CPS = [
    { step: -1, source: 'input', next: "('__start__',)" },
    { step: 0, source: 'loop', next: "('assistant',)" },
    { step: 1, source: 'loop', next: "('tools',)" },
    { step: 2, source: 'loop', next: "('assistant',)" },
    { step: 3, source: 'loop', next: '()' },
  ];

  // travel: edges the packet follows before `run` runs; after: edges it follows afterwards; lit: edge lit when done;
  // active: node lit when done; count: messages afterwards; cps: checkpoints saved afterwards;
  // status: the thread's state afterwards; read: get_state reads the latest checkpoint; mark: the breakpoint glows.
  const STEPS = [
    {
      travel: ['start'], lit: 'start', count: 1, cps: 2, status: 'paused', mark: true, lines: [1, 2],
      caption: '<b>Call 1.</b> <code>stream</code> saves the input (step -1), then step 0, whose next node is <code>assistant</code>. A breakpoint is set before it, so the run stops: the stream yields the question and ends. The model hasn\'t been called.',
    },
    {
      lit: 'start', count: 1, cps: 2, status: 'paused', mark: true, read: true, lines: [3],
      caption: '<b>Where it stopped.</b> <code>get_state</code> reads the thread\'s latest checkpoint, step 0: one message, and <code>next = (\'assistant\',)</code>. The older checkpoints are what <code>get_state_history</code> lists.',
    },
    {
      run: 'assistant', active: 'assistant', count: 2, cps: 3, status: 'running', lines: [4],
      caption: '<b>Call 2, with <code>None</code>.</b> No new input: the run loads step 0 and runs what it named. <code>assistant</code> sends the question to the model, which asks for <code>multiply(2, 3)</code>. Step 1 is saved with <code>next = (\'tools\',)</code>.',
    },
    {
      travel: ['tools'], run: 'tools', after: ['back'], lit: 'back', active: 'tools', count: 3, cps: 4, status: 'paused', mark: true, lines: [4],
      caption: '<b>Act, then the breakpoint again.</b> <code>tools_condition</code> routes to <code>tools</code>, which returns 6, and step 2 is saved. The edge back leads to <code>assistant</code>, so the breakpoint fires a second time and the stream ends.',
    },
    {
      lit: 'back', count: 3, cps: 4, status: 'paused', mark: true, read: true, lines: [5],
      caption: '<b>Paused again.</b> <code>get_state(thread).next</code> is <code>(\'assistant\',)</code> once more. A breakpoint fires every time its node is about to run, so a loop pauses on every round.',
    },
    {
      run: 'assistant', active: 'assistant', count: 4, cps: 5, status: 'running', lines: [6],
      caption: '<b>Call 3.</b> The run resumes from step 2. The model reads the tool\'s result and answers in text, and step 3 is saved with <code>next = ()</code>.',
    },
    {
      travel: ['end'], lit: 'end', active: 'end', count: 4, cps: 5, status: 'done', lines: [6],
      caption: '<b>Finished.</b> No tool calls in the answer, so <code>tools_condition</code> routes to <code>END</code>. Three calls, two pauses, five checkpoints, and <code>next</code> is empty.',
    },
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const LABEL = { human: 'Human', ai: 'AI', tool: 'Tool' };
  const STATUS = {
    paused: (cp) => `Paused \u00b7 next ${cp.next}`,
    running: (cp) => `Running \u00b7 next ${cp.next}`,
    done: (cp) => `Finished \u00b7 next ${cp.next}`,
  };

  document.querySelectorAll('[data-breakpoint-run]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const svg = root.querySelector('.graph-box svg');
    const packet = svg.querySelector('.packet');
    const nodes = Object.fromEntries([...svg.querySelectorAll('[data-node]')].map((n) => [n.dataset.node, n]));
    const edges = Object.fromEntries([...svg.querySelectorAll('[data-edge]')].map((e) => [e.dataset.edge, e]));
    const mark = el('mark');
    const msgList = el('msgs');
    const cpList = el('cps');
    const status = el('status');

    function drawMessages(count, fresh) {
      msgList.replaceChildren(...MSGS.slice(0, count).map((m, i) => {
        const item = document.createElement('li');
        item.className = `bpr-msg bpr-${m.role}${fresh && i === count - 1 ? ' is-new' : ''}`;
        const tag = document.createElement('b');
        tag.textContent = LABEL[m.role];
        const text = document.createElement('span');
        text.textContent = m.call ? `tool call: ${m.text}` : m.text;
        item.append(tag, text);
        return item;
      }));
      if (!count) {
        const empty = document.createElement('li');
        empty.className = 'bpr-empty';
        empty.textContent = 'Nothing has run yet.';
        msgList.append(empty);
      }
    }

    function drawCheckpoints(count, read, freshFrom) {
      const shown = CPS.slice(0, count).reverse(); // newest first, as get_state_history lists them
      const head = document.createElement('li');
      head.className = 'bpr-cp bpr-cp-head';
      ['step', 'source', 'next'].forEach((label) => {
        const cell = document.createElement('span');
        cell.textContent = label;
        head.append(cell);
      });
      cpList.replaceChildren(head, ...shown.map((cp, i) => {
        const item = document.createElement('li');
        const latest = i === 0;
        item.className = `bpr-cp${latest ? ' is-latest' : ''}${latest && read ? ' is-read' : ''}${CPS.indexOf(cp) >= freshFrom ? ' is-new' : ''}`;
        if (latest) item.title = 'The latest checkpoint: what get_state returns';
        [String(cp.step), cp.source, cp.next].forEach((text, k) => {
          const cell = document.createElement('span');
          if (k === 1) cell.className = 'bpr-src';
          cell.textContent = text;
          item.append(cell);
        });
        return item;
      }));
      if (!count) {
        const empty = document.createElement('li');
        empty.className = 'bpr-empty';
        empty.textContent = 'No checkpoints yet.';
        cpList.replaceChildren(empty);
      }
    }

    // phase 'pending': step n has started (its motion runs, the state not yet changed); 'done': step n finished.
    function draw(n, phase, animateNew) {
      const step = STEPS[n - 1] || null;
      const before = STEPS[n - 2] || null;
      const pending = phase === 'pending' && step;
      const shown = pending ? before : step;
      Object.values(nodes).forEach((node) => node.classList.remove('is-active', 'is-running'));
      Object.values(edges).forEach((edge) => edge.classList.remove('is-active'));
      if (!step) nodes.start.classList.add('is-active');
      if (shown && !pending) {
        if (shown.lit) edges[shown.lit].classList.add('is-active');
        if (shown.active) nodes[shown.active].classList.add('is-active');
      }
      if (pending && step.travel) edges[step.travel[0]].classList.add('is-active');
      mark.classList.toggle('is-active', Boolean(shown && shown.mark && !pending));

      const grew = Boolean(step && !pending && (!before || step.count > before.count));
      drawMessages(shown ? shown.count : 0, Boolean(animateNew && grew));
      const freshFrom = animateNew && step && !pending && before ? before.cps : Infinity;
      drawCheckpoints(shown ? shown.cps : 0, Boolean(shown && shown.read && !pending), freshFrom);
      const latest = shown ? CPS[shown.cps - 1] : null;
      status.textContent = shown ? STATUS[shown.status](latest) : '';
      status.className = `bpr-status${shown && shown.status === 'paused' ? ' is-paused' : ''}${shown && shown.status === 'done' ? ' is-done' : ''}`;
    }

    function travel(edge, ms, isCurrent) {
      const length = edge.getTotalLength();
      edge.classList.add('is-active');
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
      for (const name of step.travel || []) {
        if (!isCurrent()) return;
        await travel(edges[name], 700, isCurrent);
      }
      if (step.run && isCurrent()) {
        Object.values(edges).forEach((edge) => edge.classList.remove('is-active'));
        nodes[step.run].classList.add('is-running');
        await wait(800);
        nodes[step.run].classList.remove('is-running');
      }
      for (const name of step.after || []) {
        if (!isCurrent()) return;
        await travel(edges[name], 700, isCurrent);
      }
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b>: the agent compiled with <code>interrupt_before=["assistant"]</code>, asked "Multiply 2 and 3" on thread <code>"123"</code>.',
      paint(n, phase, animateNew) {
        draw(n, phase, animateNew);
        return {};
      },
      animate: reduceMotion ? null : animate,
    });
  });
})();
