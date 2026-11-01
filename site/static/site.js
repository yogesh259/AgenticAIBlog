/* Site behaviour: copy buttons, on-this-page highlight, search (Pagefind). No dependencies.
   Copy and on-this-page come from design/style-board.js unchanged. */
(() => {
  'use strict';

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

  /* ---------- Sidebar: clicking the open module's header collapses or expands its lessons ----------
     A click with a modifier key (new tab or window) still follows the link to the module page. The sidebar keeps
     its scroll position: near the end of the list, collapsing would leave too little below to scroll to and the
     browser would pull the whole list down, so a blank spacer at the bottom stands in until the reader scrolls up. */
  document.querySelectorAll('.sidebar .mod[aria-controls]').forEach((mod) => {
    const list = document.getElementById(mod.getAttribute('aria-controls'));
    const sidebar = mod.closest('.sidebar');
    if (!list) return;
    const spacer = document.createElement('div');
    spacer.setAttribute('aria-hidden', 'true');
    sidebar.append(spacer);
    let extra = 0;
    const fit = (top) => {   // just enough blank space at the bottom for scroll position `top` to stay valid
      const natural = sidebar.scrollHeight - extra;
      extra = top > 0 ? Math.max(0, top + sidebar.clientHeight - natural) : 0;
      spacer.style.height = extra + 'px';
    };
    sidebar.addEventListener('scroll', () => { if (extra) fit(sidebar.scrollTop); }, { passive: true });
    mod.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const top = sidebar.scrollTop;
      const open = mod.getAttribute('aria-expanded') !== 'true';
      mod.setAttribute('aria-expanded', String(open));
      list.hidden = !open;
      fit(top);
      sidebar.scrollTop = top;
    });
  });

  /* ---------- Tabs: [data-tabs] groups built by `:::: tabs` ----------
     Picking a title selects it in every group on the page that has it, and is remembered for the next page. */
  const tabGroups = [...document.querySelectorAll('[data-tabs]')];
  const tabsOf = (group) => [...group.querySelectorAll(':scope > .tab-list > [role="tab"]')];
  const selectTab = (group, title) => {
    const tabs = tabsOf(group);
    const match = tabs.find((tab) => tab.dataset.tabTitle === title);
    if (!match) return;
    tabs.forEach((tab) => {
      const on = tab === match;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
  };
  let savedTab = null;
  try { savedTab = localStorage.getItem('tab-choice'); } catch (error) { /* storage blocked */ }
  tabGroups.forEach((group) => {
    if (savedTab) selectTab(group, savedTab);
    const list = group.querySelector(':scope > .tab-list');
    list.addEventListener('click', (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (!tab) return;
      const before = tab.getBoundingClientRect().top;
      tabGroups.forEach((g) => selectTab(g, tab.dataset.tabTitle));
      window.scrollBy(0, tab.getBoundingClientRect().top - before); // keep the clicked tab where it was
      try { localStorage.setItem('tab-choice', tab.dataset.tabTitle); } catch (error) { /* storage blocked */ }
    });
    list.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const tabs = tabsOf(group);
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = tabs[(i + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });
  });

  /* ---------- Explain: a code cell marked `explain` and the `::: walkthrough` after it ----------
     The walkthrough moves into the cell, each code chunk is grouped with the notes after it, and the
     cell's Explain button swaps the plain script for that view. */
  document.querySelectorAll('[data-explain-toggle]').forEach((button) => {
    const cell = button.closest('.code-cell');
    const walk = cell.nextElementSibling;
    if (!walk || !walk.matches('[data-walkthrough]')) { button.hidden = true; return; }
    const intro = document.createElement('div');
    intro.className = 'wt-intro';
    const steps = [];
    let note = null;
    [...walk.children].forEach((child) => {
      if (child.matches('.code-cell')) {
        const step = document.createElement('section');
        step.className = 'wt-step';
        note = document.createElement('div');
        note.className = 'wt-note';
        step.append(child, note);
        steps.push(step);
      } else if (note) {
        note.append(child);
      } else {
        intro.append(child);
      }
    });
    walk.replaceChildren(...(intro.childElementCount ? [intro] : []), ...steps);
    cell.append(walk);
    const label = button.querySelector('span');
    button.addEventListener('click', () => {
      const on = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(on));
      cell.classList.toggle('is-explaining', on);
      walk.hidden = !on;
      label.textContent = on ? 'Script only' : 'Explain';
    });
  });

  /* ---------- Step player: shared engine for every run player ----------
     Markup follows the style board's .demo card: [data-act="prev|play|next|reset"] buttons,
     [data-out="key"] readouts (+ optional [data-out-card="key"] for a role colour), [data-caption],
     [data-badge] and a code cell <pre data-code> whose .line spans get highlighted.
     config = { steps: [{ caption, lines: [1-based line numbers] }], intro,
                paint(count, phase, animateNew) -> { readouts, roles }  // draw the state after `count` steps
                animate(stepNumber, isCurrent) -> Promise }            // optional motion, skipped for reduced motion */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  window.StepPlayer = function StepPlayer(root, config) {
    const $ = (selector) => root.querySelector(selector);
    const steps = config.steps;
    const ui = {
      caption: $('[data-caption]'), badge: $('[data-badge]'), code: $('[data-code]'),
      play: $('[data-act="play"]'), prev: $('[data-act="prev"]'),
      next: $('[data-act="next"]'), reset: $('[data-act="reset"]'),
    };
    const playLabel = ui.play.querySelector('span');
    const playIcon = ui.play.querySelector('use');
    const codeLines = ui.code ? [...ui.code.querySelectorAll('.line')] : [];
    let idx = 0;          // steps started so far
    let session = 0;      // bumped by reset / prev to cancel in-flight animations
    let playToken = 0;    // bumped by pause to stop the autoplay loop
    let inFlight = null;  // session id of the step currently animating
    let playing = false;

    function scrollCodeTo(lines) {
      if (!lines.length || !ui.code || ui.code.scrollHeight <= ui.code.clientHeight) return;
      const first = codeLines[Math.min(...lines) - 1];
      const last = codeLines[Math.max(...lines) - 1];
      const span = last.offsetTop + last.offsetHeight - first.offsetTop;
      const room = ui.code.clientHeight;
      const top = span < room - 24 ? first.offsetTop - (room - span) / 2 : first.offsetTop - 12;
      ui.code.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    function syncButtons() {
      const done = idx >= steps.length;
      ui.prev.disabled = playing || idx === 0;
      ui.next.disabled = playing || done;
      playLabel.textContent = playing ? 'Pause' : done ? 'Replay' : 'Play';
      playIcon.setAttribute('href', playing ? '#i-pause' : done ? '#i-reset' : '#i-play');
      playIcon.closest('svg').classList.toggle('icon--fill', playing || !done);
    }

    // phase 'pending': step idx has started (its motion is running); 'done': step idx has finished
    function paint(phase = 'done', animateNew = false) {
      const step = steps[idx - 1] || null;
      const view = config.paint(idx, phase, animateNew) || {};
      const readouts = { step: `${idx} / ${steps.length}`, ...(view.readouts || {}) };
      Object.entries(readouts).forEach(([key, value]) => {
        const out = root.querySelector(`[data-out="${key}"]`);
        if (out) out.textContent = value;
      });
      root.querySelectorAll('[data-out-card]').forEach((card) => {
        card.dataset.role = (view.roles && view.roles[card.dataset.outCard]) || '';
      });
      ui.badge.textContent = step ? `Step ${idx}` : 'Ready';
      ui.caption.innerHTML = step ? step.caption : config.intro; // static strings from the visual's own script
      const lines = step ? step.lines || [] : [];
      codeLines.forEach((line, i) => line.classList.toggle('is-hl', lines.includes(i + 1)));
      scrollCodeTo(lines);
      syncButtons();
    }

    async function forward() {
      if (inFlight !== null || idx >= steps.length) return;
      const mine = session;
      inFlight = mine;
      idx += 1;
      paint('pending');
      if (!reduceMotion && config.animate) await config.animate(idx, () => mine === session);
      if (inFlight === mine) inFlight = null;
      if (mine !== session) return;
      paint('done', true);
    }

    function cancel() {
      session += 1;
      playToken += 1;
      inFlight = null;
      playing = false;
    }

    async function play() {
      if (idx >= steps.length) {
        cancel();
        idx = 0;
        paint();
      }
      const token = ++playToken;
      playing = true;
      syncButtons();
      while (token === playToken && idx < steps.length) {
        if (inFlight !== null) { await wait(60); continue; }
        await forward();
        if (token !== playToken) break;
        if (idx < steps.length) await wait(reduceMotion ? 1500 : 900);
      }
      if (token === playToken) {
        playing = false;
        syncButtons();
      }
    }

    ui.play.addEventListener('click', () => {
      if (playing) { playToken += 1; playing = false; syncButtons(); } else { play(); }
    });
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
    paint();
  };

  /* ---------- Search (Pagefind index in <site root>/pagefind/) ---------- */
  const wrap = document.querySelector('[data-search]');
  if (!wrap) return;
  const  input = wrap.querySelector('[data-search-input]');
  const box = wrap.querySelector('[data-search-results]');
  const kbd = wrap.querySelector('[data-search-kbd]');
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  if (kbd) kbd.textContent = isMac ? '⌘ K' : 'Ctrl K';

  const siteRoot = new URL(document.documentElement.dataset.root || './', location.href);
  let loading = null;
  let latest = '';

  function loadPagefind() {
    if (!loading) {
      loading = import(new URL('pagefind/pagefind.js', siteRoot).href).then(async (pagefind) => {
        await pagefind.options({ baseUrl: siteRoot.pathname });
        return pagefind;
      });
      loading.catch(() => { loading = null; });
    }
    return loading;
  }

  function message(text) {
    const p = document.createElement('p');
    p.className = 'sr-empty';
    p.textContent = text;
    box.replaceChildren(p);
    box.hidden = false;
  }

  function resultItem(data) {
    const link = document.createElement('a');
    link.className = 'sr-item';
    link.href = data.url;
    const title = document.createElement('b');
    title.textContent = (data.meta && data.meta.title) || data.url;
    const excerpt = document.createElement('span');
    excerpt.innerHTML = data.excerpt; // Pagefind escapes the page text and only adds <mark>
    link.append(title, excerpt);
    return link;
  }

  async function search(query) {
    latest = query;
    if (!query.trim()) { box.hidden = true; return; }
    let pagefind;
    try {
      pagefind = await loadPagefind();
    } catch {
      message('Search needs the built site served over http: run tools/build_site.py --serve.');
      return;
    }
    const found = await pagefind.debouncedSearch(query, {}, 150);
    if (found === null || query !== latest) return; // a newer query replaced this one
    if (!found.results.length) { message('No matches.'); return; }
    const items = await Promise.all(found.results.slice(0, 8).map((r) => r.data()));
    if (query !== latest) return;
    box.replaceChildren(...items.map(resultItem));
    box.hidden = false;
  }

  const items = () => [...box.querySelectorAll('.sr-item')];

  input.addEventListener('input', () => { search(input.value); });
  input.addEventListener('focus', () => {
    loadPagefind().catch(() => {});
    if (input.value.trim() && box.childElementCount) box.hidden = false;
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && items().length) {
      event.preventDefault();
      items()[0].focus();
    } else if (event.key === 'Enter' && items().length) {
      event.preventDefault();
      items()[0].click();
    } else if (event.key === 'Escape') {
      input.value = '';
      box.hidden = true;
      input.blur();
    }
  });
  box.addEventListener('keydown', (event) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && i < list.length - 1) { event.preventDefault(); list[i + 1].focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); (i > 0 ? list[i - 1] : input).focus(); }
    if (event.key === 'Escape') { box.hidden = true; input.focus(); }
  });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target)) box.hidden = true;
  });
})();
