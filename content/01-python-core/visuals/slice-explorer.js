/* Slice explorer (lesson 1.7): Python's slice rules on numbers = [1..10]. */
(() => {
  'use strict';
  const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Same rules as Python's slice.indices(len): clamp start/stop, fill in the defaults for the step's direction.
  function sliceIndices(len, start, stop, step) {
    if (step === null) step = 1;
    const lower = step < 0 ? -1 : 0;
    const upper = step < 0 ? len - 1 : len;
    const fix = (value, missing) => {
      if (value === null) return missing;
      if (value < 0) return Math.max(value + len, lower);
      return Math.min(value, upper);
    };
    start = fix(start, step < 0 ? upper : lower);
    stop = fix(stop, step < 0 ? lower : upper);
    const picked = [];
    if (step > 0) for (let i = start; i < stop; i += step) picked.push(i);
    else for (let i = start; i > stop; i += step) picked.push(i);
    return { start, stop, step, picked };
  }

  const parse = (text) => {
    const t = text.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isInteger(n) ? n : NaN;
  };
  const show = (v) => (v === null ? '' : String(v));

  function describe(r, raw) {
    const len = NUMBERS.length;
    const from = raw.start !== null && raw.start < 0
      ? `index ${r.start} (${raw.start} counts from the end)` : `index ${r.start}`;
    if (!r.picked.length) return 'The walk would end before it starts, so the result is empty.';
    if (r.step > 0) {
      const every = r.step === 1 ? 'every item' : `every ${r.step}${r.step === 2 ? 'nd' : r.step === 3 ? 'rd' : 'th'} item`;
      const end = r.stop >= len ? 'and run to the end' : `and stop before index ${r.stop}`;
      return `Start at ${from}, take ${every}, ${end}.`;
    }
    const by = r.step === -1 ? '' : ` ${-r.step} at a time`;
    const end = r.stop < 0 ? 'until the beginning' : `and stop before index ${r.stop}`;
    return `A negative step walks backwards: start at ${from}, move left${by}, ${end}.`;
  }

  document.querySelectorAll('[data-slice-explorer]').forEach((root) => {
    const $ = (sel) => root.querySelector(sel);
    const strip = $('[data-strip]');
    const inputs = ['start', 'stop', 'step'].map((k) => $(`[data-in="${k}"]`));
    const presets = [...root.querySelectorAll('[data-preset]')];
    const out = (key, text) => { $(`[data-out="${key}"]`).textContent = text; };

    // Columns for positions -1 .. len: the two ends are empty slots where a stop can land.
    const cols = [];
    for (let pos = -1; pos <= NUMBERS.length; pos += 1) {
      const real = pos >= 0 && pos < NUMBERS.length;
      const col = document.createElement('div');
      col.className = real ? 'sx-col' : 'sx-col is-end';
      col.innerHTML = real
        ? `<span class="sx-i">${pos}</span><span class="sx-cell">${NUMBERS[pos]}</span><span class="sx-n">${pos - NUMBERS.length}</span>`
        : '<span class="sx-i"></span><span class="sx-cell"></span><span class="sx-n"></span>';
      strip.append(col);
      cols.push(col);
    }
    const colAt = (pos) => cols[pos + 1];

    let run = 0;
    async function render() {
      const mine = ++run;
      const raw = { start: parse(inputs[0].value), stop: parse(inputs[1].value), step: parse(inputs[2].value) };
      $('[data-expr]').textContent = `numbers[${show(raw.start)}:${show(raw.stop)}${raw.step === null ? '' : ':' + raw.step}]`;
      cols.forEach((c) => c.classList.remove('is-picked', 'is-cursor', 'is-stop'));
      if ([raw.start, raw.stop, raw.step].some(Number.isNaN)) {
        $('[data-result]').textContent = '?';
        $('[data-caption]').textContent = 'Slices take whole numbers only.';
        ['start', 'stop', 'step', 'count'].forEach((k) => out(k, '-'));
        return;
      }
      if (raw.step === 0) {
        $('[data-result]').textContent = 'ValueError';
        $('[data-caption]').textContent = 'A step of 0 would never move, so Python raises ValueError: slice step cannot be zero.';
        ['start', 'stop', 'step', 'count'].forEach((k) => out(k, '-'));
        return;
      }
      const r = sliceIndices(NUMBERS.length, raw.start, raw.stop, raw.step);
      $('[data-result]').textContent = `[${r.picked.map((i) => NUMBERS[i]).join(', ')}]`;
      $('[data-caption]').textContent = describe(r, raw);
      out('start', r.picked.length ? String(r.start) : '-');
      out('stop', r.stop >= NUMBERS.length ? 'end' : r.stop < 0 ? 'before 0' : String(r.stop));
      out('step', String(r.step));
      out('count', String(r.picked.length));
      colAt(r.stop).classList.add('is-stop');
      if (reduceMotion) {
        r.picked.forEach((i) => colAt(i).classList.add('is-picked'));
        return;
      }
      for (const i of r.picked) {
        if (mine !== run) return;
        const col = colAt(i);
        col.classList.add('is-cursor', 'is-picked');
        await wait(240);
        col.classList.remove('is-cursor');
      }
    }

    presets.forEach((button) => {
      button.addEventListener('click', () => {
        const parts = button.dataset.preset.split('|');
        inputs.forEach((input, i) => { input.value = parts[i]; });
        presets.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        render();
      });
    });
    inputs.forEach((input) => {
      input.addEventListener('input', () => {
        presets.forEach((b) => b.setAttribute('aria-pressed', 'false'));
        render();
      });
    });

    const first = presets[0].dataset.preset.split('|');
    inputs.forEach((input, i) => { input.value = first[i]; });
    render();
  });
})();
