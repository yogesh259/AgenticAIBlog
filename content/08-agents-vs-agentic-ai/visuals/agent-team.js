/* A software team of agents (lesson 8.2): one requirement planned, built in parallel, tested, reviewed and approved.
   A story, not captured code: the task board is the state the agents share. */
(() => {
  'use strict';
  const STEPS = [
    { caption: '<b>Requirement.</b> A product manager asks for one feature: <i>add password reset to the web app</i>. In a human team, a business analyst and a product manager would refine it and the team would plan a sprint.' },
    { caption: '<b>Plan.</b> A planner agent, a model with a planning prompt, splits the requirement into three tasks and writes them on the task board. The board is the shared state: every agent reads its work from it and writes its results back.' },
    { caption: '<b>Build.</b> Three developer agents take one task each and work at the same time. Each is a model with a developer\'s prompt and tools to read and edit the repository and run the tests.' },
    { caption: '<b>Test.</b> A tester agent runs the test suite. T2 fails: the reset link expires the moment it is sent. The tester files a bug, and T2 goes back to developer 2.' },
    { caption: '<b>Fix.</b> Developer 2 reads the bug report and fixes the expiry time, and the tests pass. Builder and checker go back and forth until the check passes or a round limit is reached.' },
    { caption: '<b>Review.</b> A code reviewer agent reads every change. T3\'s page tells a visitor whether an email address has an account, which reveals who the shop\'s users are. The reviewer requests a change from developer 3.' },
    { caption: '<b>Revise.</b> Developer 3 shows the same message whether or not the account exists, and the reviewer approves all three tasks.' },
    { caption: '<b>Approve.</b> A person reads the changes and the review, then approves the merge. The agents did the work; the decision to ship stays with someone accountable for it.' },
    { caption: '<b>Ship.</b> The feature is merged. No agent saw everything: the planner split the work, the developers built it, the tester and the reviewer sent it back twice, and a person signed off.' },
  ];
  const TASKS = [
    ['T1', 'Reset endpoint', 'Developer 1'],
    ['T2', 'Reset email', 'Developer 2'],
    ['T3', 'Reset page', 'Developer 3'],
  ];
  const DEVS = ['dev1', 'dev2', 'dev3'];
  const all = (status, kind = '') => TASKS.map(() => [status, kind]);
  // One view per number of steps done: lit parts, parts in play, task statuses, changed rows, flags on agents.
  const VIEWS = [
    { hot: [], seen: [], tasks: null, note: '', ship: '' },
    { hot: ['req'], seen: ['req'], tasks: null, note: 'empty' },
    { hot: ['planner'], seen: ['req', 'planner'], tasks: all('to do'), changed: [0, 1, 2], note: '3 tasks' },
    { hot: DEVS, seen: ['req', 'planner', ...DEVS], tasks: all('building'), changed: [0, 1, 2], note: '3 in progress' },
    {
      hot: ['tester'], seen: ['req', 'planner', ...DEVS, 'tester'],
      tasks: [['tests pass'], ['bug: link expires at once', 'bad'], ['tests pass']], changed: [0, 1, 2],
      flags: { dev2: 'bug report' }, note: '1 bug',
    },
    {
      hot: ['dev2'], seen: ['req', 'planner', ...DEVS, 'tester'],
      tasks: [['tests pass'], ['fixed, tests pass'], ['tests pass']], changed: [1], note: 'all tests pass',
    },
    {
      hot: ['reviewer'], seen: ['req', 'planner', ...DEVS, 'tester', 'reviewer'],
      tasks: [['approved'], ['approved'], ['change requested: reveals accounts', 'bad']], changed: [0, 1, 2],
      flags: { dev3: 'change request' }, note: '1 change requested',
    },
    {
      hot: ['dev3', 'reviewer'], seen: ['req', 'planner', ...DEVS, 'tester', 'reviewer'],
      tasks: [['approved'], ['approved'], ['revised, approved']], changed: [2], note: 'all approved by review',
    },
    {
      hot: ['person'], seen: ['req', 'planner', ...DEVS, 'tester', 'reviewer', 'person'],
      tasks: all('approved'), note: 'merge approved by a person',
    },
    {
      hot: [], seen: ['req', 'planner', ...DEVS, 'tester', 'reviewer', 'person'],
      tasks: all('merged'), changed: [0, 1, 2], note: 'merged', ship: 'Password reset is live.',
    },
  ];

  document.querySelectorAll('[data-agent-team]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const parts = [...root.querySelectorAll('[data-part]')];
    const flags = [...root.querySelectorAll('[data-flag]')];
    const make = (tag, cls, text) => {
      const node = document.createElement(tag);
      node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    };

    function draw(n) {
      const view = VIEWS[n];
      parts.forEach((part) => {
        const name = part.dataset.part;
        part.classList.toggle('is-hot', view.hot.includes(name));
        part.classList.toggle('is-off', n > 0 && !view.seen.includes(name));
      });
      flags.forEach((flag) => {
        const text = (view.flags || {})[flag.dataset.flag] || '';
        flag.textContent = text;
        flag.hidden = !text;
      });
      const list = el('tasks');
      list.replaceChildren();
      if (!view.tasks) {
        list.append(make('li', 'at-empty', 'No tasks yet.'));
      } else {
        view.tasks.forEach(([status, kind], i) => {
          const [id, title, owner] = TASKS[i];
          const row = make('li', 'at-task');
          row.classList.toggle('is-changed', (view.changed || []).includes(i));
          const name = make('span', 'at-name', title);
          name.append(make('small', '', owner));
          const chip = make('span', 'at-status', status);
          chip.dataset.kind = kind || '';
          row.append(make('span', 'at-id', id), name, chip);
          list.append(row);
        });
      }
      el('note').textContent = view.note;
      el('ship').classList.toggle('is-empty', !view.ship);
      el('stext').textContent = view.ship || 'Not shipped yet.';
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to follow one requirement through the team.',
      paint(n) {
        draw(n);
        return {};
      },
    });
  });
})();
