/* Set operations (lesson 1.10): which region of two overlapping sets each method keeps.
   Results are the lesson's real outputs, including the order Python printed. */
(() => {
  'use strict';
  const OPS = {
    union: { regions: ['a', 'ab', 'b'], code: 'set1.union(set2)', result: '{1, 2, 3, 4, 5, 6, 7, 8, 9}',
      caption: 'Union: every item that is in either set.' },
    intersection: { regions: ['ab'], code: 'set1.intersection(set2)', result: '{4, 5, 6}',
      caption: 'Intersection: only the items that are in both sets.' },
    diff12: { regions: ['a'], code: 'set1.difference(set2)', result: '{1, 2, 3}',
      caption: 'Difference: the items of set1 that are not in set2.' },
    diff21: { regions: ['b'], code: 'set2.difference(set1)', result: '{8, 9, 7}',
      caption: 'Difference the other way: the items of set2 that are not in set1. Python printed them as {8, 9, 7}: a set keeps no order.' },
    sym: { regions: ['a', 'b'], code: 'set1.symmetric_difference(set2)', result: '{1, 2, 3, 7, 8, 9}',
      caption: 'Symmetric difference: the items in exactly one of the two sets, never in both.' },
  };

  document.querySelectorAll('[data-set-ops]').forEach((root) => {
    const buttons = [...root.querySelectorAll('[data-op]')];
    function select(name) {
      const op = OPS[name];
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.op === name)));
      root.querySelectorAll('[data-reg]').forEach((r) => r.classList.toggle('is-on', op.regions.includes(r.dataset.reg)));
      root.querySelectorAll('[data-num]').forEach((n) => n.classList.toggle('is-on', op.regions.includes(n.dataset.num)));
      root.querySelector('[data-expr]').textContent = op.code;
      root.querySelector('[data-result]').textContent = op.result;
      root.querySelector('[data-caption]').textContent = op.caption;
    }
    buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.op)));
    select('union');
  });
})();
