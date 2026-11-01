/* Fan out, fan in (lesson 13.2). Replays the lesson's three real runs of build(shape): which nodes share a
   super-step, the log after each step and the lines combine printed. Nothing runs in the page. */
(() => {
  'use strict';
  const FAN_OUT = ['start-character', 'start-setting', 'start-premise'];
  const THREE = ['character', 'setting', 'premise'];
  const LOG1 = ['character', 'premise', 'setting']; // LangGraph's order within a step, not the finish order
  const sees = (log) => `  combine sees [${log.map((name) => `'${name}'`).join(', ')}]`;

  const fanOut = {
    move: FAN_OUT, lines: [12, 13, 27], log: [], printed: [], steps: [[1, 'character, premise, setting', 'next']],
    caption: '<b>invoke.</b> The input enters at <code>START</code>, whose three edges schedule all three nodes for the same super-step.',
  };
  const stepOne = {
    run: THREE, lines: [2, 5], log: LOG1, printed: [], steps: [[1, 'character, premise, setting']],
    caption: '<b>Super-step 1.</b> The three nodes run at the same time, each in a thread of its own. Their updates are applied together when the last one finishes; within a step the log lists them in LangGraph\'s order, not the order they finished.',
  };

  const RUNS = {
    even: {
      sub: 'after any input',
      steps: [
        fanOut,
        stepOne,
        {
          move: ['character-combine', 'setting-combine', 'premise-combine'], lines: [21, 22, 23], log: LOG1, printed: [],
          steps: [[1, 'character, premise, setting'], [2, 'combine', 'next']],
          caption: '<b>Fan-in.</b> Each of the three edges into <code>combine</code> schedules it for the next step. All three fired in step 1, so they schedule one run, not three.',
        },
        {
          run: ['combine'], lines: [3, 4, 5], log: [...LOG1, 'combine'], printed: [sees(LOG1)],
          steps: [[1, 'character, premise, setting'], [2, 'combine']],
          caption: '<b>Super-step 2.</b> <code>combine</code> runs once and sees all three parts in the state.',
        },
        {
          move: ['combine-end'], at: 'end', lines: [24], log: [...LOG1, 'combine'], printed: [sees(LOG1)], done: true,
          steps: [[1, 'character, premise, setting'], [2, 'combine']],
          caption: '<b>END.</b> Nothing else is scheduled, so <code>invoke</code> returns: two super-steps, and <code>combine</code> ran once.',
        },
      ],
    },
    uneven: {
      sub: 'after any input',
      steps: [
        fanOut,
        stepOne,
        {
          move: ['character-combine', 'setting-combine', 'premise-polish'], lines: [17, 22, 23], log: LOG1, printed: [],
          steps: [[1, 'character, premise, setting'], [2, 'combine, polish', 'next']],
          caption: '<b>Two edges fire early.</b> <code>character</code> and <code>setting</code> are done, so their edges schedule <code>combine</code>; <code>premise</code>\'s edge schedules <code>polish</code>. Both land in step 2.',
        },
        {
          run: ['polish', 'combine'], lines: [3, 4, 5], log: [...LOG1, 'combine', 'polish'], printed: [sees(LOG1)],
          steps: [[1, 'character, premise, setting'], [2, 'combine, polish']],
          caption: '<b>Super-step 2.</b> <code>combine</code> runs alongside <code>polish</code>, so it sees the premise before it is polished. With a model inside, this call is already wasted.',
        },
        {
          move: ['polish-combine'], lines: [22, 23], log: [...LOG1, 'combine', 'polish'], printed: [sees(LOG1)],
          steps: [[1, 'character, premise, setting'], [2, 'combine, polish'], [3, 'combine', 'next']],
          caption: '<b>The third edge fires.</b> <code>polish</code> finished, and its edge schedules <code>combine</code> once more.',
        },
        {
          run: ['combine'], lines: [3, 4, 5], log: [...LOG1, 'combine', 'polish', 'combine'],
          printed: [sees(LOG1), sees([...LOG1, 'combine', 'polish'])],
          steps: [[1, 'character, premise, setting'], [2, 'combine, polish'], [3, 'combine']],
          caption: '<b>Super-step 3.</b> <code>combine</code> runs a second time, now with the polished premise, and its result replaces the first: two runs for one introduction.',
        },
        {
          move: ['combine-end'], at: 'end', lines: [24], log: [...LOG1, 'combine', 'polish', 'combine'],
          printed: [sees(LOG1), sees([...LOG1, 'combine', 'polish'])], done: true,
          steps: [[1, 'character, premise, setting'], [2, 'combine, polish'], [3, 'combine']],
          caption: '<b>END.</b> Three super-steps, and <code>combine</code> ran twice. The fix is the next graph: one edge from a list.',
        },
      ],
    },
    waiting: {
      sub: 'waits for all',
      steps: [
        fanOut,
        stepOne,
        {
          move: ['premise-polish'], wait: ['character-combine', 'setting-combine'], lines: [17, 20], log: LOG1, printed: [],
          steps: [[1, 'character, premise, setting'], [2, 'polish', 'next']],
          caption: '<b>A waiting edge.</b> <code>add_edge(last, "combine")</code> is one edge from three sources. <code>character</code> and <code>setting</code> are done, <code>polish</code> hasn\'t run, so only <code>polish</code> is scheduled.',
        },
        {
          run: ['polish'], wait: ['character-combine', 'setting-combine'], lines: [2, 5], log: [...LOG1, 'polish'], printed: [],
          steps: [[1, 'character, premise, setting'], [2, 'polish']],
          caption: '<b>Super-step 2.</b> Only <code>polish</code> runs. <code>combine</code> keeps waiting.',
        },
        {
          move: ['polish-combine'], lit: ['character-combine', 'setting-combine'], lines: [20], log: [...LOG1, 'polish'], printed: [],
          steps: [[1, 'character, premise, setting'], [2, 'polish'], [3, 'combine', 'next']],
          caption: '<b>All three sources have run.</b> The waiting edge fires and schedules <code>combine</code> for step 3.',
        },
        {
          run: ['combine'], lines: [3, 4, 5], log: [...LOG1, 'polish', 'combine'], printed: [sees([...LOG1, 'polish'])],
          steps: [[1, 'character, premise, setting'], [2, 'polish'], [3, 'combine']],
          caption: '<b>Super-step 3.</b> <code>combine</code> runs once, with the polished premise.',
        },
        {
          move: ['combine-end'], at: 'end', lines: [24], log: [...LOG1, 'polish', 'combine'],
          printed: [sees([...LOG1, 'polish'])], done: true,
          steps: [[1, 'character, premise, setting'], [2, 'polish'], [3, 'combine']],
          caption: '<b>END.</b> Three super-steps and one run of <code>combine</code>. <code>defer=True</code> on the node gives the same result, and also works when a router skips a branch.',
        },
      ],
    },
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  document.querySelectorAll('[data-parallel-steps]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const svg = root.querySelector('.graph-box svg');
    const packets = [...svg.querySelectorAll('[data-packet]')];
    const nodes = Object.fromEntries([...svg.querySelectorAll('[data-node]')].map((n) => [n.dataset.node, n]));
    const edges = Object.fromEntries([...svg.querySelectorAll('[data-edge]')].map((e) => [e.dataset.edge, e]));
    const shaped = [...svg.querySelectorAll('[data-shape]')];
    const presets = [...root.querySelectorAll('[data-preset]')];
    const STEPS = [];

    function choose(name) {
      const run = RUNS[name];
      STEPS.splice(0, STEPS.length, ...run.steps);
      shaped.forEach((item) => { item.style.display = item.dataset.shape.split(' ').includes(name) ? '' : 'none'; });
      el('combine-sub').textContent = run.sub;
      presets.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
    }

    // phase 'pending': step n has started (its edges or nodes are lit, the run panel not yet updated); 'done': finished.
    function draw(n, phase) {
      const step = STEPS[n - 1] || null;
      const shown = phase === 'pending' ? STEPS[n - 2] || null : step;
      Object.values(nodes).forEach((node) => node.classList.remove('is-active', 'is-running'));
      Object.values(edges).forEach((edge) => edge.classList.remove('is-active', 'is-wait'));
      if (step && step.move) step.move.forEach((id) => edges[id].classList.add('is-active'));
      if (step && step.lit) step.lit.forEach((id) => edges[id].classList.add('is-active'));
      if (step && step.wait) step.wait.forEach((id) => edges[id].classList.add('is-wait'));
      if (!step) nodes.start.classList.add('is-active');
      if (step && step.run) step.run.forEach((id) => nodes[id].classList.add('is-active'));
      if (step && step.at && phase === 'done') nodes[step.at].classList.add('is-active');

      el('log').textContent = shown ? `[${shown.log.map((name) => `'${name}'`).join(', ')}]` : '[]';
      el('log').classList.toggle('is-new', Boolean(shown && step && step.run && phase === 'done'));
      el('printed').textContent = shown ? shown.printed.join('\n') : '';
      const list = el('steps');
      list.replaceChildren(...(shown ? shown.steps : []).map(([number, names, next]) => {
        const item = document.createElement('li');
        item.className = next ? 'is-next' : '';
        item.innerHTML = `<b>${number}</b><span>${names}</span>${next ? '<em>scheduled</em>' : ''}`;
        return item;
      }));
      root.classList.toggle('is-done', Boolean(shown && shown.done));
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
      } else {
        step.run.forEach((id) => nodes[id].classList.add('is-running'));
        await wait(1000);
        step.run.forEach((id) => nodes[id].classList.remove('is-running'));
      }
    }

    choose('even');
    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Pick a graph and press <b>Play</b>: the graph runs with <code>{"log": []}</code>.',
      paint(n, phase) {
        draw(n, phase);
        return {};
      },
      animate: reduceMotion ? null : animate,
    });
    const reset = root.querySelector('[data-act="reset"]');
    presets.forEach((b) => b.addEventListener('click', () => {
      choose(b.dataset.preset);
      reset.click();
    }));
  });
})();
