/* RAG from first principles (lesson 6.3): each step adds one piece to the picture. A story, not captured code. */
(() => {
  'use strict';
  const STEPS = [
    { lines: [], caption: '<b>Closed book.</b> The question goes straight to the model, which answers from its training data. It has never seen your company\'s policies, so it produces a fluent, confident guess.' },
    { lines: [], caption: '<b>Open book, naively.</b> Paste the documents into the prompt and the model can read the answer. For one page that works; for 200 pages every question pays for all of them, waits longer, may not fit the context window, and the one useful paragraph is easy to miss.' },
    { lines: [], caption: '<b>Split.</b> Cut the documents into chunks of a few hundred characters, each about one thing. Now the job is to find the few chunks a question needs.' },
    { lines: [], caption: '<b>Embed.</b> Keyword search misses a chunk that says "remote" when the question says "from home". An embedding model turns each chunk into a vector, so that chunks with similar meanings get nearby vectors.' },
    { lines: [], caption: '<b>Store.</b> A vector store keeps each vector with its chunk and can find the nearest vectors fast. Split, embed and store run once, before any question: this is indexing.' },
    { lines: [], caption: '<b>Retrieve.</b> For each question, embed it with the same model and take the k nearest chunks, here 3. This search takes milliseconds and costs one embedding call.' },
    { lines: [], caption: '<b>Augment.</b> Build the prompt from instructions, the 3 chunks and the question, with one rule: answer only from the context, and say so when it holds no answer.' },
    { lines: [], caption: '<b>Generate.</b> The model reads the chunks and answers from them, and the app can show which chunks it used. The model itself never changed: RAG changed what it reads.' },
  ];
  // Which elements are visible after each step (index = number of steps done).
  const ROW1 = ['question', 'prompt', 'model', 'a-qp', 'a-pm'];
  const INDEX = ['row2', 'docs', 'chunks', 'a-dc', 'l-dc'];
  const SHOW = [
    [],
    [...ROW1, 'answer', 'a-ma'],
    [...ROW1, 'docs', 'a-paste', 'alert'],
    [...ROW1, ...INDEX],
    [...ROW1, ...INDEX, 'vectors', 'a-cv', 'l-cv'],
    [...ROW1, ...INDEX, 'vectors', 'a-cv', 'l-cv', 'store', 'a-vs', 'l-vs'],
    [...ROW1, ...INDEX, 'vectors', 'a-cv', 'l-cv', 'store', 'a-vs', 'l-vs', 'a-retrieve', 'l-retrieve'],
    [...ROW1, ...INDEX, 'vectors', 'a-cv', 'l-cv', 'store', 'a-vs', 'l-vs', 'a-retrieve', 'l-retrieve'],
    [...ROW1, ...INDEX, 'vectors', 'a-cv', 'l-cv', 'store', 'a-vs', 'l-vs', 'a-retrieve', 'l-retrieve', 'answer', 'a-ma'],
  ];
  const HOT = [[], ['model'], ['prompt'], ['chunks'], ['vectors'], ['store'], ['store'], ['prompt'], ['model']];
  const PROMPT = ['the question', 'the question', 'question + 200 pages', 'the question', 'the question', 'the question',
    'question + 3 chunks', 'rules + 3 chunks + question', 'rules + 3 chunks + question'];
  const READOUT = [
    { phase: '-', context: '-', answer: '-' },
    { phase: 'problem', context: 'nothing', answer: 'a guess' },
    { phase: 'problem', context: 'all 200 pages', answer: 'slow, costly' },
    { phase: 'indexing', context: '-', answer: '-' },
    { phase: 'indexing', context: '-', answer: '-' },
    { phase: 'indexing', context: '-', answer: '-' },
    { phase: 'per question', context: '3 chunks', answer: '-' },
    { phase: 'per question', context: '3 chunks', answer: '-' },
    { phase: 'per question', context: '3 chunks', answer: 'grounded' },
  ];
  const PICKED = ['2', '7', '9'];

  document.querySelectorAll('[data-rag-principles]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const all = [...root.querySelectorAll('.rp-el')];

    function draw(n) {
      const shown = new Set(SHOW[n]);
      all.forEach((node) => node.classList.toggle('is-hidden', !shown.has(node.dataset.el)));
      ['prompt', 'model', 'store'].forEach((name) => el(name).classList.toggle('is-hot', HOT[n].includes(name)));
      root.querySelectorAll('[data-cell]').forEach((cell) => cell.classList.toggle('is-picked', n >= 6 && PICKED.includes(cell.dataset.cell)));
      el('ptext').textContent = PROMPT[n];
      el('atext').textContent = n >= 8 ? 'from the chunks, cited' : 'a confident guess';
    }

    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Press <b>Play</b> to start from a model that has never seen your documents.',
      paint(n) {
        draw(n);
        const r = READOUT[n];
        return { readouts: r, roles: { answer: n === 8 ? 'out' : '' } };
      },
    });
  });
})();
