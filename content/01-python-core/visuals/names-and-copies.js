/* Two names, one dictionary (lesson 1.11): a run player on the shared StepPlayer engine (site.js).
   Values match the lesson's cells as run with tools/run_outputs.py. */
(() => {
  'use strict';
  if (!window.StepPlayer) return;

  const STEPS = [
    { caption: 'Assignment builds a dictionary and points the name <code>student</code> at it.', lines: [1] },
    { caption: 'Nothing is copied: <code>student_copy</code> is a second name for the same dictionary.', lines: [2] },
    { caption: 'Change the dictionary through one name and the other name sees it, because there is only one dictionary.', lines: [3] },
    { caption: '<code>.copy()</code> builds a new dictionary with the same keys and values.', lines: [4] },
    { caption: 'The copy keeps <code>"Bob"</code>: the two dictionaries are now independent.', lines: [5] },
    { caption: 'A shallow copy copies the outer dictionary only. The dictionary inside is shared by <code>team</code> and <code>shallow</code>.', lines: [8, 9] },
    { caption: '<code>deepcopy</code> copies everything, all the way down: <code>deep</code> gets its own inner dictionary.', lines: [7, 10] },
    { caption: 'The change shows through the shallow copy, not through the deep one.', lines: [11] },
  ];

  // Step from which each element is on the stage.
  const FROM = {
    'name-student': 1, 'box-A': 1, 'arrow-student': 1,
    'name-student_copy': 2, 'arrow-student_copy': 2,
    'name-student_copy1': 4, 'box-B': 4, 'arrow-student_copy1': 4,
    'name-team': 6, 'box-T': 6, 'box-I': 6, 'arrow-team': 6, 'arrow-T-I': 6,
    'name-shallow': 6, 'box-S': 6, 'arrow-shallow': 6, 'arrow-S-I': 6,
    'name-deep': 7, 'box-D': 7, 'box-I2': 7, 'arrow-deep': 7, 'arrow-D-I2': 7,
  };
  // Elements that glow while their step is the current one.
  const ACTIVE = {
    1: ['box-A', 'arrow-student'], 2: ['box-A', 'arrow-student_copy'], 3: ['val-A', 'arrow-student', 'arrow-student_copy'],
    4: ['box-B', 'arrow-student_copy1'], 5: ['val-A', 'box-B'], 6: ['box-I', 'arrow-T-I', 'arrow-S-I'],
    7: ['box-I2', 'arrow-D-I2'], 8: ['val-I', 'arrow-S-I'],
  };

  document.querySelectorAll('[data-names-copies]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to run the cells one line at a time.',
      paint(n) {
        Object.entries(FROM).forEach(([name, from]) => el(name).classList.toggle('is-hidden', n < from));
        el('val-A').textContent = n >= 5 ? '"Carol"' : n >= 3 ? '"Bob"' : '"Alice"';
        el('val-I').textContent = n >= 8 ? '"Zoe"' : '"Alice"';
        root.querySelectorAll('.is-active').forEach((node) => node.classList.remove('is-active'));
        (ACTIVE[n] || []).forEach((name) => el(name).classList.add('is-active'));
        const lead = n >= 8 ? '"Zoe" / "Alice"' : n >= 7 ? '"Alice" / "Alice"' : n >= 6 ? '"Alice" / -' : '-';
        return {
          readouts: { same: n >= 2 ? 'True' : '-', copy: n >= 4 ? 'False' : '-', lead },
          roles: { same: n === 2 ? 'out' : '', copy: n === 4 ? 'out' : '', lead: n === 8 ? 'out' : '' },
        };
      },
    });
  });
})();
