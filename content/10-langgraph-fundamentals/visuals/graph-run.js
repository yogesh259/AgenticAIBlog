/* A state through a graph (lesson 10.2). Replays two real runs of the lesson's graph, one per side of the coin:
   the printed lines and the final states are the lesson's own outputs. Nothing runs in the page. */
(() => {
  'use strict';
  const INPUT = 'Hey My name is Alice';
  const PLAYING = `${INPUT} I am planning to play`;
  const RUNS = {
    cricket: { sport: 'cricket', print: 'My Cricket node has been called', end: `${PLAYING} Cricket`, route: [13, 14, 15, 16], body: [5, 6, 7] },
    badminton: { sport: 'badminton', print: 'My badminton node has been called', end: `${PLAYING} Badminton`, route: [13, 14, 15, 17, 18], body: [9, 10, 11] },
  };
  const dict = (text) => `{"graph_info": "${text}"}`;
  const pyDict = (text) => `{'graph_info': '${text}'}`;

  // One entry per step: what moves or runs, where the graph is afterwards, and what the state panel shows.
  function steps(r) {
    const other = r.sport === 'cricket' ? 'badminton' : 'cricket';
    return [
      {
        move: 'start', at: 'start_play', lines: [20],
        value: INPUT, utitle: 'input from invoke', utext: dict(INPUT), printed: [],
        caption: '<b>invoke.</b> The dict passed to <code>invoke</code> becomes the state. <code>START</code> is not a function: its edge hands the state to <code>start_play</code>.',
      },
      {
        run: 'start_play', at: 'start_play', lines: [1, 2, 3],
        value: PLAYING, utitle: 'start_play returned', utext: dict(PLAYING), fresh: true,
        printed: ['Start_Play node has been called'],
        caption: '<b>start_play runs.</b> It receives the whole state, prints a line and returns a dict with only the key it changes. <code>graph_info</code> has no reducer, so the returned string replaces the old one.',
      },
      {
        move: r.sport, at: r.sport, off: other, lines: r.route,
        value: PLAYING, utitle: 'random_play returned', utext: `"${r.sport}"`,
        printed: ['Start_Play node has been called'],
        caption: `<b>The router decides.</b> After <code>start_play</code>, LangGraph calls <code>random_play</code> with the updated state. The coin says <code>"${r.sport}"</code>, the name of the next node, so that dotted edge is taken. A router only chooses: it writes nothing to the state.`,
      },
      {
        run: r.sport, at: r.sport, off: other, lines: r.body,
        value: r.end, utitle: `${r.sport} returned`, utext: dict(r.end), fresh: true,
        printed: ['Start_Play node has been called', r.print],
        caption: `<b>${r.sport} runs.</b> The same pattern: the whole state in, one key back, and the old value replaced.`,
      },
      {
        move: `${r.sport}-end`, at: 'end', off: other, lines: [20],
        value: r.end, utitle: 'invoke returned', utext: pyDict(r.end), done: true,
        printed: ['Start_Play node has been called', r.print, pyDict(r.end)],
        caption: `<b>END.</b> The only edge out of <code>${r.sport}</code> leads to <code>END</code>, so no node is left to run. <code>invoke</code> returns the final state: the dict the notebook shows under the printed lines.`,
      },
    ];
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  document.querySelectorAll('[data-graph-run]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const svg = root.querySelector('.graph-box svg');
    const packet = svg.querySelector('.packet');
    const nodes = Object.fromEntries([...svg.querySelectorAll('[data-node]')].map((n) => [n.dataset.node, n]));
    const edges = Object.fromEntries([...svg.querySelectorAll('[data-edge]')].map((e) => [e.dataset.edge, e]));
    const presets = [...root.querySelectorAll('[data-preset]')];
    const STEPS = [];
    let run = RUNS.cricket;

    function choose(name) {
      run = RUNS[name];
      STEPS.splice(0, STEPS.length, ...steps(run));
      presets.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
    }

    // phase 'pending': step n has started (its edge or node is lit, the state not yet updated); 'done': finished.
    function draw(n, phase) {
      const step = STEPS[n - 1] || null;
      const shown = phase === 'pending' ? STEPS[n - 2] || null : step;
      const moving = phase === 'pending' && step && step.move;
      Object.values(nodes).forEach((node) => node.classList.remove('is-active', 'is-running'));
      Object.values(edges).forEach((edge) => edge.classList.remove('is-active', 'is-off'));
      if (step && step.move) edges[step.move].classList.add('is-active');
      if (step && step.off) edges[step.off].classList.add('is-off');
      const at = !step ? 'start' : moving ? null : step.at;
      if (at) nodes[at].classList.add('is-active');

      el('value').textContent = shown ? `"${shown.value}"` : 'not set yet';
      el('value').classList.toggle('is-new', Boolean(shown && shown.fresh && phase === 'done'));
      const update = el('update');
      update.classList.toggle('is-empty', !shown);
      update.classList.toggle('is-final', Boolean(shown && shown.done));
      el('utitle').textContent = shown ? shown.utitle : 'update';
      el('utext').textContent = shown ? shown.utext : 'Nothing has run yet.';
      el('printed').textContent = shown && shown.printed.length ? shown.printed.join('\n') : '';
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
      if (step.move) {
        await travel(edges[step.move], 750, isCurrent);
      } else {
        nodes[step.run].classList.add('is-running');
        await wait(900);
        nodes[step.run].classList.remove('is-running');
      }
    }

    choose('cricket');
    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Pick the coin\'s result and press <b>Play</b>: the graph is invoked with one sentence.',
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
