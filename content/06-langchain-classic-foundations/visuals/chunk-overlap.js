/* Chunks and overlap (lesson 6.5). Real splits of the first two paragraphs of speech.txt, captured with
   langchain-text-splitters 1.1.3 and add_start_index=True; spans are [start, end) character offsets.
   Nothing runs in the page: the figure only draws the captured spans. */
(() => {
  'use strict';
  const TEXT = 'The world must be made safe for democracy. Its peace must be planted upon the tested foundations of political liberty. We have no selfish ends to serve. We desire no conquest, no dominion. We seek no indemnities for ourselves, no material compensation for the sacrifices we shall freely make. We are but one of the champions of the rights of mankind. We shall be satisfied when those rights have been made as secure as the faith and the freedom of nations can make them.\n\nJust because we fight without rancor and without selfish object, seeking nothing for ourselves but what we shall wish to share with all free peoples, we shall, I feel confident, conduct our operations as belligerents without passion and ourselves observe with proud punctilio the principles of right and of fair play we profess to be fighting for.';

  const RECURSIVE_LADDER = [
    ['used', 'splits the two paragraphs'],
    ['absent', 'none in this text'],
    ['used', 'cuts each paragraph between words'],
    ['unused', 'not needed'],
  ];
  const PRESETS = {
    'r100-20': {
      code: 'RecursiveCharacterTextSplitter(chunk_size=100, chunk_overlap=20)',
      limit: 100,
      total: 49,
      spans: [[0, 99], [85, 178], [163, 259], [252, 350], [332, 428], [409, 470], [472, 570], [553, 649], [632, 731], [719, 814], [800, 819]],
      ladder: RECURSIVE_LADDER,
      caption: 'Both paragraphs are longer than 100 characters, so the splitter cuts them between words and joins words back up to 100. Each chunk then starts with the last words of the one before: the darker bands. No chunk crosses the paragraph break.',
    },
    'r100-0': {
      code: 'RecursiveCharacterTextSplitter(chunk_size=100, chunk_overlap=0)',
      limit: 100,
      total: 41,
      spans: [[0, 99], [100, 199], [200, 299], [300, 395], [396, 470], [472, 570], [571, 661], [662, 751], [752, 819]],
      ladder: RECURSIVE_LADDER,
      caption: 'The same kind of cuts, with nothing repeated: fewer chunks, but a sentence that runs across a cut is split between two chunks, and neither holds it whole. Only the space at each cut belongs to no chunk.',
    },
    'c100-20': {
      code: 'CharacterTextSplitter(separator="\\n\\n", chunk_size=100, chunk_overlap=20)',
      limit: 100,
      total: 7,
      spans: [[0, 470], [472, 819]],
      ladder: [
        ['used', 'its only separator'],
        ['off', 'not tried'],
        ['off', 'not tried'],
        ['off', 'not tried'],
      ],
      caption: 'This splitter cuts only at "\\n\\n". Each paragraph has nowhere else to be cut, so it stays whole at 470 and 347 characters, and the splitter logs "Created a chunk of size 470, which is longer than the specified 100". Overlap never applies: no small pieces were joined.',
    },
  };

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // One run of characters covered by the same chunks.
  function segments(spans) {
    const cover = Array.from(TEXT, () => []);
    spans.forEach(([a, b], i) => { for (let c = a; c < b; c += 1) cover[c].push(i); });
    const segs = [];
    for (let c = 0; c < TEXT.length; c += 1) {
      const key = cover[c].join(' ');
      const last = segs[segs.length - 1];
      if (last && last.key === key) last.text += TEXT[c];
      else segs.push({ key, chunks: cover[c], text: TEXT[c] });
    }
    return segs;
  }

  function segmentHtml(seg) {
    const kind = seg.chunks.length === 0 ? 'none' : seg.chunks.length > 1 ? 'both' : seg.chunks[0] % 2 ? 'b' : 'a';
    const body = seg.text.split('\n\n').map(esc).join('<span class="co-break">\\n\\n</span><br>');
    return `<span class="co-seg co-seg--${kind}" data-chunks="${seg.key}">${body}</span>`;
  }

  document.querySelectorAll('[data-chunk-overlap]').forEach((root) => {
    const $ = (s) => root.querySelector(s);
    const presets = Array.from(root.querySelectorAll('[data-preset]'));
    const rungs = Array.from(root.querySelectorAll('[data-sep]'));
    const textBox = $('[data-text]');
    const list = $('[data-list]');

    function light(index, on) {
      textBox.querySelectorAll('.co-seg').forEach((span) => {
        const hit = span.dataset.chunks.split(' ').includes(String(index));
        span.classList.toggle('is-hot', on && hit);
      });
      const item = list.querySelector(`[data-chunk="${index}"]`);
      if (item) item.classList.toggle('is-hot', on);
    }

    function render(key) {
      const p = PRESETS[key];
      presets.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === key)));
      $('[data-code]').textContent = p.code;
      rungs.forEach((rung, i) => {
        const [state, note] = p.ladder[i];
        rung.className = `co-rung co-rung--${state}`;
        rung.querySelector('[data-sep-note]').textContent = note;
      });
      textBox.innerHTML = segments(p.spans).map(segmentHtml).join('');
      list.innerHTML = p.spans.map(([a, b], i) => {
        const len = b - a;
        const over = len > p.limit;
        const words = TEXT.slice(a, b).split(/\s+/).slice(0, 4).join(' ');
        return `<li data-chunk="${i}" tabindex="0" class="${over ? 'is-over' : ''}">`
          + `<b>${i}</b><span class="co-len">${len}${over ? ' &gt; ' + p.limit : ''}</span>`
          + `<span class="co-words">${esc(words)}&hellip;</span></li>`;
      }).join('');
      list.querySelectorAll('li').forEach((li) => {
        const i = Number(li.dataset.chunk);
        li.addEventListener('mouseenter', () => light(i, true));
        li.addEventListener('mouseleave', () => light(i, false));
        li.addEventListener('focus', () => light(i, true));
        li.addEventListener('blur', () => light(i, false));
      });
      const lengths = p.spans.map(([a, b]) => b - a);
      const longest = Math.max(...lengths);
      let repeated = 0;
      for (let i = 1; i < p.spans.length; i += 1) repeated += Math.max(0, p.spans[i - 1][1] - p.spans[i][0]);
      $('[data-out="count"]').textContent = String(p.spans.length);
      $('[data-out="total"]').textContent = String(p.total);
      $('[data-out="longest"]').textContent = String(longest);
      $('[data-out="longest"]').closest('.stat').classList.toggle('co-stat-over', longest > p.limit);
      $('[data-out="overlap"]').textContent = String(repeated);
      $('[data-caption]').textContent = p.caption;
    }

    presets.forEach((button) => button.addEventListener('click', () => render(button.dataset.preset)));
    render(presets[0].dataset.preset);
  });
})();
