/* Two questions through the adaptive graph (lesson 15.4). Replays the two saved runs of the lesson: the printed
   lines, the questions and the answers are the lesson's saved outputs; the model-call count follows from them
   (one route, one grade per chunk, one answer, two checks). Nothing runs in the page. */
(() => {
  'use strict';
  const ROUTE = ['---ROUTE QUESTION---'];
  const CHECKS = [
    '---CHECK HALLUCINATIONS---',
    '---DECISION: GENERATION IS GROUNDED IN DOCUMENTS---',
    '---GRADE GENERATION vs QUESTION---',
    '---DECISION: GENERATION ADDRESSES QUESTION---',
  ];
  const RUNS = {
    web: {
      question: 'What is machine learning',
      answer: 'Machine learning (ML) is a subfield of artificial intelligence (AI) that enables machines to learn from data and past experiences to identify patterns and make predictions with minimal human intervention. It allows computers to perform tasks autonomously without explicit programming, improving their performance over time as they are exposed to more data. Essentially, ML focuses on developing algorithms that can learn and generalize from data to perform various tasks.',
      steps: (answer) => [
        {
          move: 'start-web', at: 'web_search', lines: [11, 12, 13, 15], calls: 1,
          print: [...ROUTE, '---ROUTE QUESTION TO WEB SEARCH---'],
          caption: '<b>The router decides first.</b> <code>invoke</code> puts the question in the state, and the conditional edge out of <code>START</code> calls <code>route_question</code>. Machine learning is not one of the index\'s three topics, so the router model returns <code>datasource=\'web_search\'</code> and the path map sends the run to the <code>web_search</code> node.',
        },
        {
          run: 'web_search', at: 'web_search', lines: [4], calls: 1, print: ['---WEB SEARCH---'],
          set: { documents: 'One Document, the web results joined: "What Is Machine Learning? Machine learning (ML) is a discipline of artificial intelligence (AI) that provides machines with the ability to automatically learn from data and past experiences [...]"' },
          caption: '<b>web_search runs.</b> Tavily returns a few pages, and the node joins their text into one <code>Document</code> in <code>documents</code>. A search is a tool call, not a model call.',
        },
        {
          move: 'web-generate', at: 'generate', lines: [19], calls: 1, print: [],
          caption: '<b>A fixed edge.</b> Web results always go straight to <code>generate</code>: nothing grades them on this path.',
        },
        {
          run: 'generate', at: 'generate', lines: [7], calls: 2, print: ['---GENERATE---'],
          set: { generation: answer },
          caption: '<b>generate runs.</b> The RAG chain answers the question from the web text, and the answer goes into <code>generation</code>.',
        },
        {
          move: 'generate-end', at: 'end', lines: [30, 31, 32, 35], calls: 4, print: CHECKS, done: true,
          caption: '<b>Two checks on the edge.</b> <code>grade_generation_v_documents_and_question</code> asks the hallucination grader (grounded: yes), then the answer grader (resolves the question: yes), and returns <code>"useful"</code>, which the path map sends to <code>END</code>. <code>invoke</code> returns the final state: four model calls and one search.',
        },
      ],
    },
    index: {
      question: 'What is agent memory',
      answer: 'Agent memory refers to the mechanisms by which an autonomous agent retains and recalls information. It includes short-term memory, which utilizes in-context learning, and long-term memory, which allows for the retention of information over extended periods through external storage systems. This memory structure enables agents to improve their performance by learning from past experiences and interactions.',
      steps: (answer) => [
        {
          move: 'start-retrieve', at: 'retrieve', lines: [11, 12, 13, 16], calls: 1,
          print: [...ROUTE, '---ROUTE QUESTION TO RAG---'],
          caption: '<b>The router decides first.</b> Agent memory is one of the index\'s topics, so the router model returns <code>datasource=\'vectorstore\'</code>, and the path map turns that label into the node name <code>retrieve</code>.',
        },
        {
          run: 'retrieve', at: 'retrieve', lines: [5], calls: 1, print: ['---RETRIEVE---'],
          set: { documents: 'Four chunks of "LLM Powered Autonomous Agents"' },
          caption: '<b>retrieve runs.</b> The vector store returns the four chunks nearest to the question, all from the post on LLM agents.',
        },
        {
          move: 'retrieve-grade', at: 'grade_documents', lines: [20], calls: 1, print: [],
          caption: '<b>A fixed edge</b> to grading: on this path every retrieval is checked.',
        },
        {
          run: 'grade_documents', at: 'grade_documents', lines: [6], calls: 5,
          print: ['---CHECK DOCUMENT RELEVANCE TO QUESTION---', ...Array(4).fill('---GRADE: DOCUMENT RELEVANT---')],
          set: { documents: 'Four chunks of "LLM Powered Autonomous Agents", all four graded relevant' },
          caption: '<b>grade_documents runs.</b> One grader call per chunk, one after another: four calls, four "relevant" verdicts, and all four chunks stay in <code>documents</code>.',
        },
        {
          move: 'grade-generate', at: 'generate', lines: [21, 22, 23, 26], calls: 5,
          print: ['---ASSESS GRADED DOCUMENTS---', '---DECISION: GENERATE---'],
          caption: '<b>decide_to_generate</b> is plain code: chunks are left, so it returns <code>"generate"</code>. With none left it would have returned <code>"transform_query"</code>, and the run would have gone round to <code>retrieve</code> again.',
        },
        {
          run: 'generate', at: 'generate', lines: [7], calls: 6, print: ['---GENERATE---'],
          set: { generation: answer },
          caption: '<b>generate runs</b> on the four chunks, and the answer goes into <code>generation</code>.',
        },
        {
          move: 'generate-end', at: 'end', lines: [30, 31, 32, 35], calls: 8, print: CHECKS, done: true,
          caption: '<b>Both checks pass</b> and the run ends after eight model calls. A failing check would have sent it back to <code>generate</code> ("not supported") or to <code>transform_query</code> ("not useful"), with no limit on either.',
        },
      ],
    },
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  document.querySelectorAll('[data-adaptive-run]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const svg = root.querySelector('.graph-box svg');
    const packet = svg.querySelector('.packet');
    const nodes = Object.fromEntries([...svg.querySelectorAll('[data-node]')].map((n) => [n.dataset.node, n]));
    const edges = Object.fromEntries([...svg.querySelectorAll('[data-edge]')].map((e) => [e.dataset.edge, e]));
    const presets = [...root.querySelectorAll('[data-preset]')];
    const STEPS = [];
    let run = RUNS.web;

    // Each step's view of the state: the keys set so far, the printed lines so far, the calls so far.
    function views() {
      const state = { documents: null, generation: null };
      const printed = [];
      return STEPS.map((step) => {
        Object.assign(state, step.set || {});
        printed.push(...step.print);
        return { ...state, printed: [...printed], calls: step.calls, fresh: Object.keys(step.set || {}) };
      });
    }
    let VIEWS = [];

    function choose(name) {
      run = RUNS[name];
      STEPS.splice(0, STEPS.length, ...run.steps(run.answer));
      VIEWS = views();
      el('q').textContent = `"${run.question}"`;
      presets.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
    }

    function show(name, value, fresh) {
      const out = el(name);
      out.textContent = value === null ? 'not set yet' : value;
      out.classList.toggle('is-empty', value === null);
      out.classList.toggle('is-new', fresh);
    }

    // phase 'pending': step n has started (its edge or node is lit, the state not yet updated); 'done': finished.
    function draw(n, phase) {
      const step = STEPS[n - 1] || null;
      const shownIndex = phase === 'pending' ? n - 2 : n - 1;
      const view = VIEWS[shownIndex] || null;
      const moving = phase === 'pending' && step && step.move;
      Object.values(nodes).forEach((node) => node.classList.remove('is-active', 'is-running'));
      Object.values(edges).forEach((edge) => edge.classList.remove('is-active'));
      if (step && step.move) edges[step.move].classList.add('is-active');
      const at = !step ? 'start' : moving ? null : step.at;
      if (at) nodes[at].classList.add('is-active');

      const justDone = phase === 'done' && view && shownIndex === n - 1;
      show('question', step ? `"${run.question}"` : null, false);
      show('documents', view ? view.documents : null, Boolean(justDone && view.fresh.includes('documents')));
      show('generation', view ? view.generation : null, Boolean(justDone && view.fresh.includes('generation')));
      el('calls').textContent = view ? String(view.calls) : '0';
      el('printed').textContent = view ? view.printed.join('\n') : '';
    }

    function travel(edge, ms, isCurrent) {
      const length = edge.getTotalLength();
      return new Promise((resolve) => {
        const t0 = performance.now();
        packet.style.opacity = '1';
        const frame = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          const point = edge.getPointAtLength(eased * length);
          packet.setAttribute('cx', point.x);
          packet.setAttribute('cy', point.y);
          if (t < 1 && isCurrent()) {
            requestAnimationFrame(frame);
          } else {
            packet.style.opacity = '0';
            resolve();
          }
        };
        requestAnimationFrame(frame);
      });
    }

    async function animate(n, isCurrent) {
      const step = STEPS[n - 1];
      if (step.move) {
        await travel(edges[step.move], 800, isCurrent);
      } else {
        nodes[step.run].classList.add('is-running');
        await wait(900);
        nodes[step.run].classList.remove('is-running');
      }
    }

    choose('web');
    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Pick a question and press <b>Play</b>: the graph is invoked with it, as in the lesson.',
      paint(n, phase) {
        draw(n, phase);
        return {};
      },
      animate: reduceMotion ? null : animate,
    });
    const reset = root.querySelector('[data-act="reset"]');
    presets.forEach((b) => b.addEventListener('click', () => {
      choose(b.dataset.preset);
      reset.click();
    }));
  });
})();
