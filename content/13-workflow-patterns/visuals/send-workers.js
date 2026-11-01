/* One worker per section (lesson 13.4). Replays the lesson's real run with stand-in workers: the plan, three
   sends, the workers' finish order and printed lines, the reducer's list and the report. Nothing runs in the page. */
(() => {
  'use strict';
  const SECTIONS = ['Introduction', 'History', 'Current trends'];
  const TEXTS = ['## Introduction\\nWhat agentic AI systems are.', '## History\\nFrom chatbots to agents.',
    '## Current trends\\nWhat teams build with agents today.'];
  const FINISH_ORDER = [1, 2, 0]; // workers in the order they finished: History (0.1 s), Current trends (0.2 s), Introduction (0.3 s)
  const ORDINAL = ['finished 3rd', 'finished 1st', 'finished 2nd']; // per worker, in plan order
  const wrote = (name) => `wrote '${name}'; the worker received ['section']`;
  const PRINTED_WORKERS = FINISH_ORDER.map((i) => wrote(SECTIONS[i]));
  const REPORT_LINES = [
    '## Introduction', 'What agentic AI systems are.', '', '---', '',
    '## History', 'From chatbots to agents.', '', '---', '',
    '## Current trends', 'What teams build with agents today.',
  ];
  const sectionsValue = `[Section(name='Introduction', ...), Section(name='History', ...), Section(name='Current trends', ...)]`;
  const completedValue = `[${TEXTS.map((t) => `'${t}'`).join(', ')}]`;
  const reportValue = `'${TEXTS.join('\\n\\n---\\n\\n')}'`;

  const STEPS = [
    {
      move: ['start'], at: 'orchestrator', lines: [18],
      caption: '<b>invoke.</b> The input <code>{"topic": "Agentic AI systems"}</code> becomes the state, and <code>START</code> hands it to the orchestrator.',
      view: {},
    },
    {
      run: ['orchestrator'], lines: [1, 2],
      caption: '<b>The plan.</b> The stand-in returns three sections; in the lesson\'s graph the planner\'s model call writes them. <code>sections</code> now holds three <code>Section</code> objects.',
      view: { sections: true, fresh: 'sections' },
    },
    {
      move: ['send-0', 'send-1', 'send-2'], lines: [4, 5],
      caption: '<b>Three sends.</b> <code>assign_workers</code>, the conditional edge function, returns three <code>Send("llm_call", {"section": s})</code> objects: three runs of one node, each with a dict holding one section as its whole input.',
      view: { sections: true, inputs: true },
    },
    {
      run: ['w0', 'w1', 'w2'], lines: [7, 8, 9, 10, 11],
      caption: '<b>Super-step 2.</b> The three runs work in parallel. History finishes first (0.1 s), Introduction last (0.3 s), and each prints what it received: only <code>[\'section\']</code>, not the topic or the plan.',
      view: { sections: true, inputs: true, finished: true, printed: PRINTED_WORKERS },
    },
    {
      lines: [11], reduce: true,
      caption: '<b>The reducer.</b> When the last worker finishes, the step ends and <code>operator.add</code> joins the three one-item lists into <code>completed_sections</code>: in plan order here, not the finish order.',
      view: { sections: true, inputs: true, finished: true, completed: true, fresh: 'completed', printed: PRINTED_WORKERS },
    },
    {
      move: ['join-0', 'join-1', 'join-2'], at: 'synthesizer', lines: [13],
      caption: '<b>Fan-in.</b> All three runs belong to one step, so their edges schedule the synthesizer once.',
      view: { sections: true, inputs: true, finished: true, completed: true, printed: PRINTED_WORKERS },
    },
    {
      run: ['synthesizer'], lines: [14, 15, 16],
      caption: '<b>Super-step 3.</b> The synthesizer joins the sections with <code>---</code> rules. Plain code: no model call.',
      view: { sections: true, inputs: true, finished: true, completed: true, report: true, fresh: 'report', printed: PRINTED_WORKERS },
    },
    {
      move: ['end'], at: 'end', lines: [18], done: true,
      caption: '<b>END.</b> <code>invoke</code> returns the final state. Three workers of 0.3, 0.1 and 0.2 seconds took 0.3 seconds, and the report follows the plan.',
      view: { sections: true, inputs: true, finished: true, completed: true, report: true, printed: [...PRINTED_WORKERS, 'took 0.3s', ...REPORT_LINES] },
    },
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  document.querySelectorAll('[data-send-workers]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const svg = root.querySelector('.graph-box svg');
    const packets = [...svg.querySelectorAll('[data-packet]')];
    const nodes = Object.fromEntries([...svg.querySelectorAll('[data-node]')].map((n) => [n.dataset.node, n]));
    const edges = Object.fromEntries([...svg.querySelectorAll('[data-edge]')].map((e) => [e.dataset.edge, e]));
    const kv = Object.fromEntries([...root.querySelectorAll('[data-key]')].map((k) => [k.dataset.key, k]));

    // phase 'pending': step n has started (its edges or nodes are lit, the state not yet updated); 'done': finished.
    function draw(n, phase) {
      const step = STEPS[n - 1] || null;
      const shown = phase === 'pending' ? STEPS[n - 2] || null : step;
      const view = shown ? shown.view : {};
      Object.values(nodes).forEach((node) => node.classList.remove('is-active', 'is-running'));
      Object.values(edges).forEach((edge) => edge.classList.remove('is-active'));
      if (step && step.move) step.move.forEach((id) => edges[id].classList.add('is-active'));
      if (step && step.run) step.run.forEach((id) => nodes[id].classList.add('is-active'));
      if (!step) nodes.start.classList.add('is-active');
      if (step && step.at && phase === 'done') nodes[step.at].classList.add('is-active');

      SECTIONS.forEach((name, i) => {
        el(`in-${i}`).textContent = view.inputs ? name : '';
        el(`done-${i}`).textContent = view.finished ? ORDINAL[i] : '';
        nodes[`w${i}`].classList.toggle('is-idle', !view.inputs && !(step && step.move && step.move[0] === 'send-0'));
      });
      el('sections').textContent = view.sections ? sectionsValue : 'not set yet';
      el('completed').textContent = view.completed ? completedValue : (view.sections ? '[]' : 'not set yet');
      el('report').textContent = view.report ? reportValue : 'not set yet';
      Object.entries(kv).forEach(([key, box]) => {
        box.classList.toggle('is-new', phase === 'done' && view.fresh === key);
        box.classList.toggle('is-empty', !view[key]);
      });
      el('printed').textContent = (view.printed || []).join('\n');
      kv.report.classList.toggle('is-final', Boolean(shown && shown.done));
    }

    function travel(ids, ms, isCurrent) {
      const paths = ids.map((id) => edges[id]);
      const lengths = paths.map((path) => path.getTotalLength());
      return new Promise((resolve) => {
        const t0 = performance.now();
        paths.forEach((_, i) => { packets[i].style.opacity = '1'; });
        const frame = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          paths.forEach((path, i) => {
            const point = path.getPointAtLength(eased * lengths[i]);
            packets[i].setAttribute('cx', point.x);
            packets[i].setAttribute('cy', point.y);
          });
          if (t < 1 && isCurrent()) {
            requestAnimationFrame(frame);
          } else {
            packets.forEach((packet) => { packet.style.opacity = '0'; });
            resolve();
          }
        };
        requestAnimationFrame(frame);
      });
    }

    async function animate(n, isCurrent) {
      const step = STEPS[n - 1];
      if (step.move) {
        await travel(step.move, 800, isCurrent);
      } else if (step.run && step.run.length === 3) {
        // the workers finish one by one, in the order of the real run
        step.run.forEach((id) => nodes[id].classList.add('is-running'));
        for (let k = 0; k < FINISH_ORDER.length; k += 1) {
          await wait(500);
          if (!isCurrent()) return;
          const i = FINISH_ORDER[k];
          nodes[`w${i}`].classList.remove('is-running');
          el(`done-${i}`).textContent = ORDINAL[i];
          el('printed').textContent = PRINTED_WORKERS.slice(0, k + 1).join('\n');
        }
        await wait(300);
      } else if (step.run) {
        step.run.forEach((id) => nodes[id].classList.add('is-running'));
        await wait(900);
        step.run.forEach((id) => nodes[id].classList.remove('is-running'));
      } else {
        kv.completed.classList.add('is-busy');
        await wait(700);
        kv.completed.classList.remove('is-busy');
      }
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b>: the graph runs with <code>{"topic": "Agentic AI systems"}</code>.',
      paint(n, phase) {
        draw(n, phase);
        return {};
      },
      animate: reduceMotion ? null : animate,
    });
  });
})();
