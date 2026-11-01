/* From class to JSON schema (lesson 4.3): pointing at a part lights its twins in the same row;
   a legend key lights that kind of part in every row. A tap keeps the light on until the next one. */
(() => {
  'use strict';
  document.querySelectorAll('[data-class-schema]').forEach((root) => {
    const parts = [...root.querySelectorAll('.cs-part[data-part]')];
    const keys = [...root.querySelectorAll('.cs-key[data-part]')];
    const clear = () => [...parts, ...keys].forEach((el) => el.classList.remove('is-on'));
    const light = (kind, row) => {
      parts.forEach((p) => p.classList.toggle('is-on', p.dataset.part === kind && (!row || p.closest('.cs-row') === row)));
      keys.forEach((k) => k.classList.toggle('is-on', k.dataset.part === kind));
    };
    parts.forEach((p) => {
      const row = p.closest('.cs-row');
      p.addEventListener('pointerenter', () => light(p.dataset.part, row));
      p.addEventListener('pointerleave', clear);
      p.addEventListener('click', () => light(p.dataset.part, row));
    });
    keys.forEach((k) => {
      k.addEventListener('pointerenter', () => light(k.dataset.part));
      k.addEventListener('pointerleave', clear);
      k.addEventListener('focus', () => light(k.dataset.part));
      k.addEventListener('blur', clear);
      k.addEventListener('click', () => light(k.dataset.part));
    });
  });
})();
