/* A generator pauses at yield (lesson 2.7): a run player on the shared StepPlayer engine (site.js).
   Values match the lesson's cell as run with tools/run_outputs.py: 0, 1, 4, then StopIteration. */
(() => {
  'use strict';
  if (!window.StepPlayer) return;

  const STEPS = [
    { caption: 'Calling a generator function builds a generator. None of its body has run yet.', lines: [5] },
    { caption: '<code>next()</code> runs the body up to the first <code>yield</code>, hands out <code>0</code> and pauses right there.', lines: [6, 2, 3] },
    { caption: 'The next call resumes just after the <code>yield</code>, with <code>i</code> still in memory, and hands out <code>1</code>.', lines: [7, 2, 3] },
    { caption: 'Each call produces exactly one value: <code>4</code>.', lines: [8, 2, 3] },
    { caption: 'The loop ends, and so does the body: <code>next()</code> raises <code>StopIteration</code>. A <code>for</code> loop makes these calls for you and stops quietly here.', lines: [9, 2] },
  ];
  const CALL = ['-', 'gen = square(3)', 'next(gen)', 'next(gen)', 'next(gen)', 'next(gen)'];
  const GOT = ['-', 'a generator', '0', '1', '4', 'StopIteration'];
  const STATE = ['-', 'new', 'paused', 'paused', 'paused', 'done'];
  const I = ['-', '-', '0', '1', '2', '-'];
  const VALUES = ['-', '-', '0', '0, 1', '0, 1, 4', '0, 1, 4'];
  const LINE_Y = { 2: 0, 3: 24 };                       // highlight offset from line 2, in SVG units
  const HL_LINE = [null, null, 3, 3, 3, 2];

  document.querySelectorAll('[data-gen-pause]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const arrows = { call: el('arrow-call'), back: el('arrow-back') };

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to make the calls one at a time.',
      paint(n) {
        el('call').textContent = CALL[n];
        el('got').textContent = GOT[n];
        el('got').classList.toggle('is-error', n === 5);
        el('state').textContent = STATE[n];
        el('local-i').textContent = `i = ${I[n]}`;
        el('gen').classList.toggle('is-hidden', n === 0);
        el('gen').classList.toggle('is-active', n >= 1);
        el('flag').classList.toggle('is-hidden', !(n >= 2 && n <= 4));
        const line = HL_LINE[n];
        el('hl').classList.toggle('is-hidden', line === null);
        if (line !== null) el('hl').style.transform = `translateY(${LINE_Y[line]}px)`;
        arrows.call.classList.toggle('is-active', n >= 1);
        arrows.back.classList.toggle('is-active', n >= 1);
        arrows.back.classList.toggle('is-error', n === 5);
        arrows.call.setAttribute('marker-end', `url(#${n >= 1 ? 'gp-arrow-on' : 'gp-arrow'})`);
        arrows.back.setAttribute('marker-end', `url(#${n === 5 ? 'gp-arrow-out' : n >= 1 ? 'gp-arrow-on' : 'gp-arrow'})`);
        return {
          readouts: { state: STATE[n], i: I[n], values: VALUES[n] },
          roles: { values: n >= 2 && n <= 4 ? 'out' : '', state: n === 5 ? 'out' : '' },
        };
      },
    });
  });
})();
