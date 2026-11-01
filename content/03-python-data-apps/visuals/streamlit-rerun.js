/* Streamlit reruns your script (lesson 3.12): a run player on the shared StepPlayer engine (site.js).
   Three runs of the shortened widgets.py: the first run, typing "Alice", then moving the slider to 30. */
(() => {
  'use strict';
  if (!window.StepPlayer) return;

  const SCRIPT = [3, 4, 5, 6, 7, 8]; // the lines that run, top to bottom, on every run
  const STEPS = [
    { caption: '<code>streamlit run</code> runs the whole script once, top to bottom, and draws each element as its line runs. <code>name</code> is empty, so <code>if name:</code> is false.', lines: SCRIPT },
    { caption: 'You type <b>Alice</b> and press Enter. Streamlit runs the script again <b>from the first line</b>; this time <code>st.text_input</code> returns <code>"Alice"</code>, so the greeting appears.', lines: SCRIPT },
    { caption: 'You drag the slider to 30: another full run. The box still holds Alice, because widgets keep their values between runs; every line of the script runs again.', lines: SCRIPT },
  ];
  const EVENT = ['', 'first run', 'you typed Alice', 'slider moved to 30'];

  // What the page shows after `n` runs; `pre` is the moment between the user's action and the new run.
  function state(n, pre) {
    const s = { shown: n >= 1 && !(n === 1 && pre), typed: n >= 2 ? 'Alice' : '', slider: n >= 3 ? 30 : 25,
      age: n >= 3 && !pre ? 30 : 25, hello: n >= 3 || (n === 2 && !pre) };
    return s;
  }

  document.querySelectorAll('[data-st-rerun]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const codeLines = [...root.querySelectorAll('[data-code] .line')];
    const items = { 3: el('title'), 4: el('input'), 5: el('slider'), 6: el('ageline'), 8: el('hello') };
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function draw(s, n) {
      el('empty').classList.toggle('is-hidden', s.shown);
      ['title', 'input', 'slider', 'ageline'].forEach((k) => el(k).classList.toggle('is-hidden', !s.shown));
      el('hello').classList.toggle('is-hidden', !s.hello);
      el('typed').textContent = s.typed;
      el('thumb-value').textContent = String(s.slider);
      el('fill').style.width = `${s.slider}%`;
      el('thumb').style.left = `${s.slider}%`;
      el('age-shown').textContent = String(s.age);
      el('event').textContent = EVENT[n];
      el('event').classList.toggle('is-hidden', n === 0);
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to run the script, then to type a name and move the slider.',
      paint(n, phase) {
        draw(state(n, phase === 'pending'), n);
        const s = state(n, false);
        return {
          readouts: { run: String(n), name: n === 0 ? '-' : `"${s.typed}"`, age: n === 0 ? '-' : String(s.age) },
          roles: { run: n >= 1 ? 'out' : '' },
        };
      },
      async animate(n, isCurrent) {
        const before = state(n, true);
        const after = state(n, false);
        for (const line of SCRIPT) {
          if (!isCurrent()) return;
          codeLines.forEach((l, i) => l.classList.toggle('is-hl', i + 1 === line));
          const item = items[line];
          if (line === 6) el('age-shown').textContent = String(after.age);
          if (item && (line !== 8 || after.hello)) {
            if (n === 1 || (line === 8 && !before.hello)) item.classList.remove('is-hidden');
            if (n === 1 && line === 3) el('empty').classList.add('is-hidden');
            item.classList.add('is-drawn');
            setTimeout(() => item.classList.remove('is-drawn'), 420);
          }
          await wait(380);
        }
      },
    });
  });
})();
