/* Threads, processes and the clock (lesson 2.10): an interactive figure.
   The waiting mode replays multi_threading.py (measured 10.0 s); the computing modes are schematic. */
(() => {
  'use strict';
  const X0 = 120;            // x of 0 s
  const PX = 25;             // pixels per second (0 to 20 s)
  const LANES = { 1: 44, 2: 100 };
  const H = 32;
  const SVG = 'http://www.w3.org/2000/svg';

  // [lane, start s, end s, kind]: kind = run | wait | gil | start
  const steps = (lane, start, count, length, kind) =>
    Array.from({ length: count }, (_, i) => [lane, start + i * length, start + (i + 1) * length, kind]);
  const turns = () => {
    const bars = [];
    for (let s = 0; s < 20; s += 1) {
      const runner = s % 2 === 0 ? 1 : 2;
      bars.push([runner, s, s + 1, 'run'], [runner === 1 ? 2 : 1, s, s + 1, 'gil']);
    }
    return bars;
  };

  const MODES = {
    one: {
      bars: [...steps(1, 0, 5, 2, 'wait'), ...steps(1, 10, 5, 2, 'wait')],
      end: 20, total: '20 s', note: 'one after the other', overlap: 'nothing',
      caption: 'One worker runs task A, then task B. It spends almost all of the 20 seconds waiting.',
      desc: 'Worker 1 runs task A and then task B, 20 seconds in total; worker 2 is idle.',
    },
    wait: {
      bars: [...steps(1, 0, 5, 2, 'wait'), ...steps(2, 0, 5, 2, 'wait')],
      end: 10, total: '10 s', note: 'measured: 10.0 s', overlap: 'the waits',
      caption: 'Two threads, as in <code>multi_threading.py</code>: while one sleeps the other can run, so the waits overlap and the run takes 10 seconds.',
      desc: 'Both workers wait at the same time, from 0 to 10 seconds.',
    },
    gil: {
      bars: turns(),
      end: 20, total: 'about 20 s', note: 'schematic', overlap: 'nothing',
      caption: 'Two threads that compute: the GIL lets only one of them run Python code at a time, so they take turns and finish no sooner than one thread would.',
      desc: 'The workers take turns: in each second one runs while the other waits for the GIL, until 20 seconds.',
    },
    proc: {
      bars: [[1, 0, 0.6, 'start'], [1, 0.6, 10.6, 'run'], [2, 0, 0.6, 'start'], [2, 0.6, 10.6, 'run']],
      end: 10.6, total: 'about 10.6 s', note: 'schematic', overlap: 'the computing',
      caption: 'Two processes: each has its own interpreter and GIL, and runs on its own core. After a short start-up, both compute at once.',
      desc: 'Both workers start up for about half a second, then compute at the same time until about 10.6 seconds.',
    },
  };

  document.querySelectorAll('[data-threads-timeline]').forEach((root) => {
    const buttons = [...root.querySelectorAll('[data-mode]')];
    const layer = root.querySelector('[data-bars]');
    const end = root.querySelector('[data-end]');
    const out = (key) => root.querySelector(`[data-out="${key}"]`);

    function select(name) {
      const mode = MODES[name];
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === name)));
      layer.replaceChildren(...mode.bars.map(([lane, from, to, kind]) => {
        const rect = document.createElementNS(SVG, 'rect');
        rect.setAttribute('class', `tt-bar tt-bar--${kind}`);
        rect.setAttribute('x', String(X0 + from * PX + 1));
        rect.setAttribute('y', String(LANES[lane]));
        rect.setAttribute('width', String(Math.max(2, (to - from) * PX - 2)));
        rect.setAttribute('height', String(H));
        rect.setAttribute('rx', '4');
        return rect;
      }));
      end.style.transform = `translateX(${(mode.end - 10) * PX}px)`;
      out('total').textContent = mode.total;
      out('total-note').textContent = mode.note;
      out('overlap').textContent = mode.overlap;
      root.querySelector('[data-caption]').innerHTML = mode.caption; // static strings from this script
      root.querySelector('[data-desc]').textContent = mode.desc;
    }

    buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.mode)));
    select('one');
  });
})();
