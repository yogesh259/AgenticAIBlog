/* From loop to comprehension (lesson 1.8): pointing at a part lights up its twin in the other pane. */
(() => {
  'use strict';
  document.querySelectorAll('[data-loop-comp]').forEach((root) => {
    const parts = [...root.querySelectorAll('[data-part]')];
    const light = (name) => parts.forEach((p) => p.classList.toggle('is-on', p.dataset.part === name));
    const clear = () => parts.forEach((p) => p.classList.remove('is-on'));
    parts.forEach((p) => {
      p.addEventListener('mouseenter', () => light(p.dataset.part));
      p.addEventListener('mouseleave', clear);
      p.addEventListener('focus', () => light(p.dataset.part));
      p.addEventListener('blur', clear);
    });
  });
})();
