/* Slicing a 2-D array (lesson 3.1): NumPy's [rows, columns] rules on arr = [[1..4], [5..8], [9..12]]. */
(() => {
  'use strict';
  const ARR = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]];
  const ROWS = ARR.length;
  const COLS = ARR[0].length;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Python's slice rules for a step of 1: negative values count from the end, out-of-range values are clamped.
  function sliceRange(len, start, stop) {
    const fix = (v, missing) => {
      if (v === null) return missing;
      if (v < 0) return Math.max(v + len, 0);
      return Math.min(v, len);
    };
    const a = fix(start, 0);
    const b = fix(stop, len);
    const picked = [];
    for (let i = a; i < b; i += 1) picked.push(i);
    return picked;
  }

  function pick(part, len) {
    if (part.kind === 'int') {
      const i = part.i < 0 ? part.i + len : part.i;
      return i >= 0 && i < len ? [i] : null; // null: IndexError
    }
    return sliceRange(len, part.start, part.stop);
  }

  // Format like NumPy's print(): every value padded to the widest one.
  function format(values, rowsKeep, colsKeep) {
    if (!rowsKeep && !colsKeep) return String(values[0][0]);
    const flat = values.flat();
    const width = Math.max(1, ...flat.map((v) => String(v).length));
    const row = (vals) => `[${vals.map((v) => String(v).padStart(width)).join(' ')}]`;
    if (rowsKeep && colsKeep) {
      if (!values.length || !values[0].length) return '[]';
      return `[${values.map(row).join('\n ')}]`;
    }
    const line = rowsKeep ? values.map((r) => r[0]) : values[0];
    return line.length ? row(line) : '[]';
  }

  const parse = (text) => {
    const t = text.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isInteger(n) ? n : NaN;
  };
  const show = (v) => (v === null ? '' : String(v));
  const list = (ids) => (ids.length ? ids.join(', ') : 'none');

  function describePart(part, picked, noun, plural, len) {
    if (part.kind === 'int') return `${noun} ${part.i} only`;
    if (!picked.length) return `no ${plural}`;
    if (picked.length === len) return `all ${plural}`;
    const num = (v) => (v < 0 ? `${v} (= ${Math.max(v + len, 0)})` : String(v));
    const from = part.start === null ? 'the first' : num(part.start);
    const stop = part.stop === null ? len : part.stop < 0 ? Math.max(part.stop + len, 0) : part.stop;
    const to = stop >= len ? 'the end' : `${num(part.stop)}, not ${stop} itself`;
    return `${plural} ${from} up to ${to}`;
  }

  document.querySelectorAll('[data-slice-2d]').forEach((root) => {
    const $ = (sel) => root.querySelector(sel);
    const grid = $('[data-grid]');
    const inputs = ['r0', 'r1', 'c0', 'c1'].map((k) => $(`[data-in="${k}"]`));
    const presets = [...root.querySelectorAll('[data-preset]')];
    const out = (key, text) => { $(`[data-out="${key}"]`).textContent = text; };

    // Header row of column numbers, then each row: its number and its cells.
    const corner = document.createElement('span');
    corner.className = 's2-head';
    grid.append(corner);
    const colHeads = [];
    for (let c = 0; c < COLS; c += 1) {
      const head = document.createElement('span');
      head.className = 's2-head';
      head.textContent = c;
      grid.append(head);
      colHeads.push(head);
    }
    const rowHeads = [];
    const cells = [];
    ARR.forEach((values, r) => {
      const head = document.createElement('span');
      head.className = 's2-head';
      head.textContent = r;
      grid.append(head);
      rowHeads.push(head);
      cells.push(values.map((v) => {
        const cell = document.createElement('span');
        cell.className = 's2-cell';
        cell.textContent = v;
        grid.append(cell);
        return cell;
      }));
    });

    let run = 0;
    async function render(spec, exprText) {
      const mine = ++run;
      cells.flat().forEach((c) => c.classList.remove('is-picked'));
      [...rowHeads, ...colHeads].forEach((h) => h.classList.remove('is-on'));
      $('[data-expr]').textContent = exprText;
      const bad = [spec.rows, spec.cols].some((p) => (p.kind === 'int' ? Number.isNaN(p.i)
        : Number.isNaN(p.start) || Number.isNaN(p.stop)));
      if (bad) {
        $('[data-result]').textContent = '?';
        $('[data-caption]').textContent = 'Slices take whole numbers only.';
        ['rows', 'cols', 'shape', 'count'].forEach((k) => out(k, '-'));
        return;
      }
      const rows = pick(spec.rows, ROWS);
      const cols = pick(spec.cols, COLS);
      if (rows === null || cols === null) {
        $('[data-result]').textContent = 'IndexError';
        $('[data-caption]').textContent = 'A single index must exist: arr has rows 0 to 2 and columns 0 to 3.';
        ['rows', 'cols', 'shape', 'count'].forEach((k) => out(k, '-'));
        return;
      }
      const rowsKeep = spec.rows.kind === 'slice';
      const colsKeep = spec.cols.kind === 'slice';
      const values = rows.map((r) => cols.map((c) => ARR[r][c]));
      const shape = [rowsKeep ? rows.length : null, colsKeep ? cols.length : null].filter((n) => n !== null);
      $('[data-result]').textContent = format(values, rowsKeep, colsKeep);
      out('rows', list(rows));
      out('cols', list(cols));
      out('shape', shape.length === 1 ? `(${shape[0]},)` : `(${shape.join(', ')})`);
      out('count', String(rows.length * cols.length));
      const rowText = describePart(spec.rows, rows, 'Row', 'rows', ROWS);
      const colText = describePart(spec.cols, cols, 'column', 'columns', COLS);
      const dropped = (rowsKeep ? 0 : 1) + (colsKeep ? 0 : 1);
      const tail = dropped === 2 ? ' Two single numbers drop both axes: the result is one value.'
        : dropped === 1 ? ' The single number drops its axis, so the result has one axis.' : '';
      $('[data-caption]').textContent = `${rowText.charAt(0).toUpperCase()}${rowText.slice(1)}, ${colText}.${tail}`;
      rows.forEach((r) => rowHeads[r].classList.add('is-on'));
      cols.forEach((c) => colHeads[c].classList.add('is-on'));
      for (const r of rows) {
        for (const c of cols) {
          if (mine !== run) return;
          cells[r][c].classList.add('is-picked');
          if (!reduceMotion) await wait(70);
        }
      }
    }

    function fromInputs() {
      const [r0, r1, c0, c1] = inputs.map((i) => parse(i.value));
      const spec = { rows: { kind: 'slice', start: r0, stop: r1 }, cols: { kind: 'slice', start: c0, stop: c1 } };
      render(spec, `arr[${show(r0)}:${show(r1)}, ${show(c0)}:${show(c1)}]`);
    }

    function applyPreset(button) {
      presets.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      const code = button.dataset.preset;
      if (code.startsWith('#')) {
        const [r, c] = code.slice(1).split(',');
        inputs.forEach((i) => { i.value = ''; });
        const rows = r === ':' ? { kind: 'slice', start: null, stop: null } : { kind: 'int', i: Number(r) };
        const cols = c === ':' ? { kind: 'slice', start: null, stop: null } : { kind: 'int', i: Number(c) };
        render({ rows, cols }, button.textContent);
        return;
      }
      const parts = code.split('|');
      inputs.forEach((input, i) => { input.value = parts[i]; });
      const [r0, r1, c0, c1] = parts.map((p) => (p === '' ? null : Number(p)));
      render({ rows: { kind: 'slice', start: r0, stop: r1 }, cols: { kind: 'slice', start: c0, stop: c1 } },
        button.textContent);
    }

    presets.forEach((button) => button.addEventListener('click', () => applyPreset(button)));
    inputs.forEach((input) => input.addEventListener('input', () => {
      presets.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      fromInputs();
    }));
    applyPreset(presets[0]);
  });
})();
