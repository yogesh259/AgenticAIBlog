/* Style board behaviour: copy buttons, on-this-page highlight, agent-loop player. No dependencies. */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ---------- Copy buttons (code only: no line numbers, no annotation markers) ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  document.querySelectorAll('[data-copy]').forEach((button) => {
    const label = button.querySelector('span');
    button.addEventListener('click', async () => {
      const code = button.closest('.code-cell').querySelector('pre code').cloneNode(true);
      code.querySelectorAll('.annot-ref').forEach((el) => el.remove());
      try {
        await copyText(code.textContent);
        label.textContent = 'Copied';
      } catch {
        label.textContent = 'Copy failed';
      }
      setTimeout(() => { label.textContent = 'Copy'; }, 1600);
    });
  });

  /* ---------- On this page: highlight the section being read ---------- */
  const tocLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
  const targets = tocLinks.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (targets.length) {
    let queued = false;
    const update = () => {
      queued = false;
      // current = last section whose top has scrolled past the top bar
      let current = targets[0];
      targets.forEach((t) => { if (t.getBoundingClientRect().top <= 160) current = t; });
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = targets[targets.length - 1];
      tocLinks.forEach((a) => a.classList.toggle('is-current', a.hash === '#' + current.id));
    };
    window.addEventListener('scroll', () => {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- Agent loop player ---------- */
  const root = document.querySelector('[data-player]');
  if (!root) return;

  const $ = (selector) => root.querySelector(selector);
  const svg = $('.graph-box svg');
  const packet = svg.querySelector('.packet');
  const nodes = {
    start: svg.querySelector('#n-start'),
    agent: svg.querySelector('#n-agent'),
    tools: svg.querySelector('#n-tools'),
    end: svg.querySelector('#n-end'),
  };
  const edges = {
    start: svg.querySelector('#e-start'),
    toTools: svg.querySelector('#e-to-tools'),
    back: svg.querySelector('#e-back'),
    toEnd: svg.querySelector('#e-to-end'),
  };
  const ROLE = { start: '', agent: 'model', tools: 'tool', end: 'out' };
  const NAME = { start: 'START', agent: 'agent', tools: 'tools', end: 'END' };

  const ui = {
    msgs: $('[data-msgs]'),
    caption: $('[data-caption]'),
    badge: $('[data-badge]'),
    step: $('[data-out="step"]'),
    node: $('[data-out="node"]'),
    nodeCard: $('[data-out-card="node"]'),
    count: $('[data-out="msgs"]'),
    calls: $('[data-out="calls"]'),
    code: $('[data-code]'),
    question: $('[data-question]'),
    play: $('[data-act="play"]'),
    prev: $('[data-act="prev"]'),
    next: $('[data-act="next"]'),
    reset: $('[data-act="reset"]'),
    presets: [...root.querySelectorAll('[data-preset]')],
  };
  ui.playLabel = ui.play.querySelector('span');
  ui.playIcon = ui.play.querySelector('use');
  const codeLines = [...ui.code.querySelectorAll('.line')];

  // 1-based line numbers in react_agent.py
  const LINES = { input: [18, 23], agent: [11, 12, 13], route: [19], tools: [5, 6, 7, 17], back: [20] };
  const INTRO = 'The graph is compiled and waiting at <code>START</code>. Press <b>Play</b> or <b>Next</b> to send the question in.';
  const INPUT_CAPTION = '<code>graph.invoke()</code> puts the question into state as a <b>HumanMessage</b>, and the edge from START hands it to <code>agent</code>.';

  const PRESETS = {
    tool: {
      question: "What's the weather in Paris?",
      steps: [
        { move: 'start', at: 'agent', lines: LINES.input,
          add: { role: 'human', text: "What's the weather in Paris?" },
          caption: INPUT_CAPTION },
        { run: 'agent', at: 'agent', lines: LINES.agent, calls: 1,
          add: { role: 'ai', call: 'get_weather(city="Paris")' },
          caption: '<code>call_model</code> sends every message to the LLM. Instead of answering, the LLM replies with a <b>tool call</b>.' },
        { move: 'toTools', at: 'tools', lines: LINES.route,
          caption: '<code>tools_condition</code> reads the last message. It has <code>tool_calls</code>, so the graph routes to <code>tools</code>.' },
        { run: 'tools', at: 'tools', lines: LINES.tools,
          add: { role: 'tool', text: 'It is 18°C and sunny in Paris.' },
          caption: '<code>ToolNode</code> runs <code>get_weather("Paris")</code> and appends the result as a <b>ToolMessage</b>.' },
        { move: 'back', at: 'agent', lines: LINES.back,
          caption: 'A normal edge always leads back to <code>agent</code> after the tools run. This edge is what makes it a loop.' },
        { run: 'agent', at: 'agent', lines: LINES.agent,
          add: { role: 'ai', text: "It's 18°C and sunny in Paris right now." },
          caption: 'The LLM now sees the question <i>and</i> the tool result, so it answers in plain text with no tool calls.' },
        { move: 'toEnd', at: 'end', lines: LINES.route,
          caption: 'No tool calls this time, so <code>tools_condition</code> returns <code>END</code>. The run finishes with four messages in state.' },
      ],
    },
    direct: {
      question: 'Say hello in French.',
      steps: [
        { move: 'start', at: 'agent', lines: LINES.input,
          add: { role: 'human', text: 'Say hello in French.' },
          caption: INPUT_CAPTION },
        { run: 'agent', at: 'agent', lines: LINES.agent,
          add: { role: 'ai', text: 'Bonjour!' },
          caption: 'The LLM can answer from what it already knows, so it replies with text and no tool calls.' },
        { move: 'toEnd', at: 'end', lines: LINES.route,
          caption: '<code>tools_condition</code> finds no tool calls and routes straight to <code>END</code>. The <code>tools</code> node never runs.' },
      ],
    },
  };

  let preset = 'tool';
  let idx = 0;          // steps started so far
  let session = 0;      // bumped by reset / prev / preset change to cancel in-flight animations
  let playToken = 0;    // bumped by pause to stop the autoplay loop
  let inFlight = null;  // session id of the step currently animating
  let playing = false;

  const steps = () => PRESETS[preset].steps;

  function stateAfter(count) {
    const msgs = [];
    let calls = 0;
    steps().slice(0, count).forEach((s) => {
      if (s.add) msgs.push(s.add);
      calls += s.calls || 0;
    });
    return { msgs, calls };
  }

  function messageItem(m, isNew, entering) {
    const li = document.createElement('li');
    li.className = 'msg' + (isNew ? ' is-new' : '') + (entering ? ' is-entering' : '');
    const role = document.createElement('span');
    role.className = 'msg-role ' + m.role;
    role.textContent = { human: 'HumanMessage', ai: 'AIMessage', tool: 'ToolMessage' }[m.role];
    li.append(role);
    if (m.text) {
      const text = document.createElement('div');
      text.textContent = m.text;
      li.append(text);
    }
    if (m.call) {
      const call = document.createElement('code');
      call.className = 'msg-call';
      call.textContent = 'tool_calls: ' + m.call;
      li.append(call);
    }
    return li;
  }

  function scrollCodeTo(lines) {
    if (!lines.length) return;
    const first = codeLines[Math.min(...lines) - 1];
    const last = codeLines[Math.max(...lines) - 1];
    const span = last.offsetTop + last.offsetHeight - first.offsetTop;
    const room = ui.code.clientHeight;
    const top = span < room - 24 ? first.offsetTop - (room - span) / 2 : first.offsetTop - 12;
    ui.code.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function syncButtons() {
    const done = idx >= steps().length;
    ui.prev.disabled = playing || idx === 0;
    ui.next.disabled = playing || done;
    ui.playLabel.textContent = playing ? 'Pause' : done ? 'Replay' : 'Play';
    ui.playIcon.setAttribute('href', playing ? '#i-pause' : done ? '#i-reset' : '#i-play');
    ui.playIcon.closest('svg').classList.toggle('icon--fill', playing || !done);
  }

  // phase 'pending': step idx has started (edge or node lit, its message not added yet)
  // phase 'done':    step idx has finished
  function paint(phase = 'done', animateNew = false) {
    const all = steps();
    const step = all[idx - 1] || null;
    const { msgs, calls } = stateAfter(phase === 'pending' ? idx - 1 : idx);
    const moving = phase === 'pending' && step && step.move;
    const nodeKey = !step ? 'start' : moving ? null : step.at;

    Object.values(nodes).forEach((n) => n.classList.remove('is-active', 'is-running'));
    Object.values(edges).forEach((e) => e.classList.remove('is-active'));
    if (step && step.move) edges[step.move].classList.add('is-active');
    if (nodeKey) nodes[nodeKey].classList.add('is-active');

    ui.msgs.replaceChildren();
    if (!msgs.length) {
      const empty = document.createElement('li');
      empty.className = 'msgs-empty';
      empty.textContent = 'State is empty until the question is sent in.';
      ui.msgs.append(empty);
    }
    const newest = phase === 'done' && step && step.add ? msgs.length - 1 : -1;
    msgs.forEach((m, i) => ui.msgs.append(messageItem(m, i === newest, i === newest && animateNew)));
    ui.msgs.scrollTop = ui.msgs.scrollHeight;

    ui.step.textContent = `${idx} / ${all.length}`;
    ui.node.textContent = moving ? '→ ' + NAME[step.at] : NAME[nodeKey];
    ui.nodeCard.dataset.role = nodeKey ? ROLE[nodeKey] : '';
    ui.count.textContent = msgs.length;
    ui.calls.textContent = calls;

    ui.badge.textContent = step ? `Step ${idx}` : 'Ready';
    ui.caption.innerHTML = step ? step.caption : INTRO; // static strings defined above

    const lines = step ? step.lines : [];
    codeLines.forEach((line, i) => line.classList.toggle('is-hl', lines.includes(i + 1)));
    scrollCodeTo(lines);
    syncButtons();
  }

  function travel(edge, ms, mine) {
    if (reduceMotion) return Promise.resolve();
    const length = edge.getTotalLength();
    return new Promise((resolve) => {
      const t0 = performance.now();
      packet.style.opacity = '1';
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const p = edge.getPointAtLength(eased * length);
        packet.setAttribute('cx', p.x);
        packet.setAttribute('cy', p.y);
        if (t < 1 && mine === session) {
          requestAnimationFrame(frame);
        } else {
          packet.style.opacity = '0';
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  async function runNode(node, ms) {
    if (reduceMotion) return;
    node.classList.add('is-running');
    await wait(ms);
    node.classList.remove('is-running');
  }

  async function forward() {
    if (inFlight !== null || idx >= steps().length) return;
    const mine = session;
    inFlight = mine;
    idx += 1;
    paint('pending');
    const step = steps()[idx - 1];
    if (step.move) await travel(edges[step.move], 750, mine);
    else await runNode(nodes[step.run], 1000);
    if (inFlight === mine) inFlight = null;
    if (mine !== session) return;
    paint('done', true);
  }

  async function play() {
    if (idx >= steps().length) {
      cancel();
      idx = 0;
      paint();
    }
    const token = ++playToken;
    playing = true;
    syncButtons();
    while (token === playToken && idx < steps().length) {
      if (inFlight !== null) { await wait(60); continue; }
      await forward();
      if (token !== playToken) break;
      if (idx < steps().length) await wait(reduceMotion ? 1500 : 700);
    }
    if (token === playToken) {
      playing = false;
      syncButtons();
    }
  }

  function pause() {
    playToken += 1;
    playing = false;
    syncButtons();
  }

  function cancel() {
    session += 1;
    playToken += 1;
    inFlight = null;
    playing = false;
  }

  ui.play.addEventListener('click', () => (playing ? pause() : play()));
  ui.next.addEventListener('click', () => { forward(); });
  ui.prev.addEventListener('click', () => {
    if (idx === 0) return;
    cancel();
    idx -= 1;
    paint();
  });
  ui.reset.addEventListener('click', () => {
    cancel();
    idx = 0;
    paint();
  });
  ui.presets.forEach((button) => button.addEventListener('click', () => {
    cancel();
    preset = button.dataset.preset;
    idx = 0;
    ui.presets.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    ui.question.textContent = PRESETS[preset].question;
    paint();
  }));

  paint();
})();
