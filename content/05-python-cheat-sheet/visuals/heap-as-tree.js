/* A heap is a list (lesson 5.1): a run player on the shared StepPlayer engine (site.js).
   States match the section's real outputs: [1, 3, 8, 5] after the pushes, [3, 5, 8] after the pop. */
(() => {
  'use strict';
  if (!window.StepPlayer) return;

  // before: the list while the step is running (shown only with motion); swap: the pair about to swap.
  const STEPS = [
    { call: 'push 5', lines: [4], after: [5], glow: [0], swaps: 0,
      caption: 'The first item becomes the root: index 0 in the list, the top of the tree.' },
    { call: 'push 1', lines: [5], before: [5, 1], swap: [1, 0], after: [1, 5], glow: [0, 1], swaps: 1,
      caption: 'A new item goes at the end of the list, then swaps up while it is smaller than its parent: 1 swaps with 5.' },
    { call: 'push 8', lines: [6], after: [1, 5, 8], glow: [2], swaps: 0,
      caption: 'Index 2 is the root\u2019s right child. 8 is larger than its parent, so it stays.' },
    { call: 'push 3', lines: [7], before: [1, 5, 8, 3], swap: [3, 1], after: [1, 3, 8, 5], glow: [1, 3], swaps: 1,
      caption: 'Index 3 hangs under index 1. 3 is smaller than 5, so they swap; 3 is larger than 1, so it stops. The list is now in heap order, not sorted order.' },
    { call: 'heap[0]', lines: [8], after: [1, 3, 8, 5], glow: [0], swaps: 0,
      caption: 'Every parent is smaller than its children, so the smallest item is always at index 0. The cell prints <code>1 [1, 3, 8, 5]</code>.' },
    { call: 'pop: 1', lines: [9], after: [5, 3, 8], glow: [0], swaps: 0,
      caption: '<code>heappop()</code> returns the root, 1, and moves the last item, 5, into its place.' },
    { call: 'sift down', lines: [9], before: [5, 3, 8], swap: [0, 1], after: [3, 5, 8], glow: [0, 1], swaps: 1,
      caption: '5 is larger than its smaller child, 3, so they swap. Now every parent is smaller than its children again.' },
    { call: 'done', lines: [9], after: [3, 5, 8], glow: [], swaps: 0,
      caption: 'The cell prints <code>1 [3, 5, 8]</code>: the popped item, then the heap that is left.' },
  ];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  document.querySelectorAll('[data-heap-tree]').forEach((root) => {
    const cells = [...root.querySelectorAll('[data-cell]')];
    const nodes = [...root.querySelectorAll('[data-node]')];
    const edges = [...root.querySelectorAll('[data-edge]')];

    function draw(list, swap, glow) {
      [cells, nodes].forEach((group) => group.forEach((g, i) => {
        const present = i < list.length;
        g.classList.toggle('is-hidden', !present);
        g.querySelector('.v').textContent = present ? list[i] : '';
        g.classList.toggle('is-swap', swap.includes(i));
        g.classList.toggle('is-glow', glow.includes(i) && !swap.includes(i));
      }));
      edges.forEach((e) => {
        const child = Number(e.dataset.edge);
        e.classList.toggle('is-hidden', child >= list.length);
        e.classList.toggle('is-active', swap.length === 2 && Math.max(...swap) === child);
      });
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to push four numbers and pop one.',
      paint(n, phase) {
        const step = STEPS[n - 1];
        if (!step) {
          draw([], [], []);
          return { readouts: { top: '-', call: '-', swaps: '-' } };
        }
        const running = phase === 'pending' && step.before;
        const list = running ? step.before : step.after;
        draw(list, running ? step.swap : [], running ? [] : step.glow);
        return {
          readouts: { top: String(list[0]), call: step.call, swaps: String(step.swaps) },
          roles: { swaps: step.swaps ? 'out' : '' },
        };
      },
      async animate(stepNumber, isCurrent) {
        if (STEPS[stepNumber - 1].before && isCurrent()) await wait(900);
      },
    });
  });
})();
