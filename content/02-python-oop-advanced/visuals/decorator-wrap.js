/* What @my_decorator does (lesson 2.8): a run player on the shared StepPlayer engine (site.js).
   Printed lines and __name__ values match the lesson's cells as run with tools/run_outputs.py. */
(() => {
  'use strict';
  if (!window.StepPlayer) return;

  const STEPS = [
    { caption: 'A decorator is an ordinary function that takes a function. Defining it runs nothing inside it.', lines: [1] },
    { caption: 'Python builds your function first, and the name <code>say_hello</code> points at it.', lines: [9, 10] },
    { caption: 'Then it runs <code>say_hello = my_decorator(say_hello)</code>: the decorator builds <code>wrapper</code> and returns it. The name now points at the wrapper, which keeps your function in <code>func</code>.', lines: [8, 2, 6] },
    { caption: 'Calling <code>say_hello()</code> runs the wrapper. Its first line prints.', lines: [12, 3] },
    { caption: 'The wrapper calls your function through <code>func</code>: <code>Hello!</code>', lines: [4, 10] },
    { caption: 'Back in the wrapper, its last line runs. One call, three lines of output.', lines: [5] },
  ];
  const LINES = [
    'Something is happening before the function is called.',
    'Hello!',
    'Something is happening after the function is called.',
  ];
  const FROM = {
    'name-deco': 1, 'fn-deco': 1, 'arrow-deco': 1,
    'name-say': 2, 'fn-orig': 2,
    'fn-wrap': 3, 'arrow-func': 3,
  };
  const ACTIVE = {
    1: ['fn-deco', 'arrow-deco'], 2: ['fn-orig', 'arrow-say-orig'], 3: ['fn-wrap', 'arrow-say-wrap', 'arrow-func'],
    4: ['fn-wrap', 'row-1', 'arrow-say-wrap'], 5: ['fn-orig', 'row-2', 'arrow-func'], 6: ['fn-wrap', 'row-3'],
  };

  document.querySelectorAll('[data-deco-wrap]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const out = el('out');

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to define, decorate and call the function.',
      paint(n) {
        Object.entries(FROM).forEach(([name, from]) => el(name).classList.toggle('is-hidden', n < from));
        el('arrow-say-orig').classList.toggle('is-hidden', n !== 2);
        el('arrow-say-wrap').classList.toggle('is-hidden', n < 3);
        root.querySelectorAll('.is-active').forEach((node) => node.classList.remove('is-active'));
        (ACTIVE[n] || []).forEach((name) => el(name).classList.add('is-active'));

        const printed = Math.max(0, n - 3);
        if (printed === 0) {
          out.innerHTML = '<span class="dw-out-empty">Output appears here when say_hello() runs.</span>';
        } else {
          out.replaceChildren(...LINES.slice(0, printed).map((text, i) => {
            const line = document.createElement('span');
            line.className = i === printed - 1 ? 'dw-out-line is-new' : 'dw-out-line';
            line.textContent = text;
            return line;
          }));
        }
        return {
          readouts: {
            target: n >= 3 ? 'wrapper' : n === 2 ? 'original' : '-',
            name: n >= 3 ? "'wrapper'" : n === 2 ? "'say_hello'" : '-',
            printed: n >= 4 ? String(printed) : '-',
          },
          roles: { target: n === 3 ? 'out' : '', name: n === 3 ? 'out' : '', printed: n >= 4 ? 'out' : '' },
        };
      },
    });
  });
})();
