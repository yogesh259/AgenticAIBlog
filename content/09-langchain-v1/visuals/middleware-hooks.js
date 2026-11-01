/* Where middleware runs (lesson 9.6). Nodes and edges captured from create_agent(...).get_graph()
   with langchain 1.4.7, for an agent with one tool. Nothing runs in the page. */
(() => {
  'use strict';
  const S = 'SummarizationMiddleware.before_model';
  const H = 'HumanInTheLoopMiddleware.after_model';
  const PRESETS = {
    agent: {
      code: 'create_agent(model, tools=[...])',
      slots: {},
      edges: [
        ['__start__', 'model'],
        ['model', '__end__ | tools'],
        ['tools', 'model'],
      ],
      caption: 'Four nodes. The model either ends the run or hands over to the tools, which always hand back to the model.',
    },
    hooks: {
      code: 'class MyMiddleware(AgentMiddleware): ...  # any of the six hooks',
      slots: {
        before_agent: ['hook', 'before_agent', 'once, at the start of a run'],
        before_model: ['hook', 'before_model', 'before every model call'],
        after_model: ['hook', 'after_model', 'after every model reply'],
        after_agent: ['hook', 'after_agent', 'once, at the end of a run'],
      },
      wraps: true,
      edges: null,
      caption: 'Where each hook runs. The four node hooks become nodes of their own, named after the middleware and the hook. The two wrap hooks add no node: they run inside the model and tools nodes, around the call itself.',
    },
    summ: {
      code: 'middleware=[SummarizationMiddleware(...)]',
      slots: { before_model: ['node', S, 'checks the history'] },
      edges: [
        ['__start__', S],
        [S, 'model'],
        ['model', '__end__ | tools'],
        ['tools', S],
      ],
      caption: 'One before_model node. Both ways into the model, from __start__ and back from the tools, now pass through it.',
    },
    hitl: {
      code: 'middleware=[HumanInTheLoopMiddleware(...)]',
      slots: { after_model: ['node', H, 'may pause the run'] },
      edges: [
        ['__start__', 'model'],
        ['model', H],
        [H, '__end__ | model | tools'],
        ['tools', 'model'],
      ],
      caption: 'One after_model node between the model and its choices. It pauses before gated tool calls; after the decision the run goes on to the tools, ends, or goes back to the model.',
    },
    both: {
      code: 'middleware=[SummarizationMiddleware(...), HumanInTheLoopMiddleware(...)]',
      slots: {
        before_model: ['node', S, 'checks the history'],
        after_model: ['node', H, 'may pause the run'],
      },
      edges: [
        ['__start__', S],
        [S, 'model'],
        ['model', H],
        [H, `__end__ | ${S} | tools`],
        ['tools', S],
      ],
      caption: 'Both nodes, each in its hook\'s place: every way into the model passes the summary check, every reply passes the approval check.',
    },
  };

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\./g, '.<wbr>');

  document.querySelectorAll('[data-middleware-hooks]').forEach((root) => {
    const buttons = Array.from(root.querySelectorAll('[data-preset]'));
    const slots = Array.from(root.querySelectorAll('.mh-slot'));
    const wraps = Array.from(root.querySelectorAll('[data-wrap]'));
    const edges = root.querySelector('[data-edges]');

    function show(name) {
      const p = PRESETS[name];
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
      root.querySelector('[data-code]').textContent = p.code;
      slots.forEach((li) => {
        const fill = p.slots[li.dataset.slot];
        li.hidden = !fill;
        li.classList.toggle('is-hook', Boolean(fill) && fill[0] === 'hook');
        li.classList.toggle('is-node', Boolean(fill) && fill[0] === 'node');
        li.querySelector('code').innerHTML = fill ? esc(fill[1]) : '';
        li.querySelector('small').textContent = fill ? fill[2] : '';
      });
      wraps.forEach((w) => { w.hidden = !p.wraps; });
      root.querySelectorAll('.mh-model, .mh-tool').forEach((n) => n.classList.toggle('is-wrapped', Boolean(p.wraps)));
      edges.innerHTML = p.edges
        ? p.edges.map(([a, b]) => `<li><code>${esc(a)}</code> &rarr; <code>${esc(b)}</code></li>`).join('')
        : '<li>Hook nodes sit on the edges into and out of the model; wrap hooks have no node.</li>';
      root.querySelector('[data-caption]').textContent = p.caption;
    }

    buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.preset)));
    show('agent');
  });
})();
