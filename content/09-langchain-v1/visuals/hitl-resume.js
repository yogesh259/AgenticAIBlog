/* Pause, decide, resume (lesson 9.7). Replays the three saved runs of the email agent: approve, reject and edit.
   Message texts and IDs are from the saved runs (LangChain 1.1); the captions note what 1.4 changed. Nothing runs here. */
(() => {
  'use strict';
  const RUNS = {
    approve: {
      thread: '"test-approve"',
      decision: '{"type": "approve"}',
      request: "Send email to john@test.com with subject 'Hello' and body 'How are you?'",
      call: "send_email_tool(recipient='john@test.com', subject='Hello', body='How are you?')",
      toolRole: 'tool',
      tool: "Email sent to john@test.com with subject 'Hello'",
      answer: 'The email has been sent to john@test.com with the subject "Hello".',
      decide: '<b>Approve.</b> Your code resumes the same thread with <code>Command(resume={"decisions": [{"type": "approve"}]})</code>: one decision per paused call, in order.',
      run: '<b>The tool runs</b> with the model\'s own arguments, and its result is added as a <code>ToolMessage</code>.',
      reply: '<b>The model answers</b> from the tool\'s result. No tool calls remain, so the run ends.',
    },
    reject: {
      thread: '"test-reject"',
      decision: '{"type": "reject"}',
      request: "Send email to john@test.com with subject 'Hello' and body 'How are you?'",
      call: "send_email_tool(recipient='john@test.com', subject='Hello', body='How are you?')",
      toolRole: 'tool, error',
      tool: 'User rejected the tool call for `send_email_tool` with id call_Ja2ShKBMId9s2fin9JHbcZpc',
      answer: 'It seems there was an issue with sending the email. Could you please provide more information or try again later?',
      decide: '<b>Reject.</b> The decision is <code>{"type": "reject"}</code>, with no reason given. Adding <code>"message": "..."</code> would pass a reason to the model.',
      run: '<b>The tool does not run.</b> In its place the model gets an error <code>ToolMessage</code> saying the call was rejected. Since LangChain 1.4 it adds that the tool was not executed and must not be retried unless the user asks.',
      reply: '<b>The model answers</b> with what it knows: a failed send. Told no reason, it guessed at a technical problem.',
    },
    edit: {
      thread: '"test-edit"',
      decision: '{"type": "edit", "edited_action": {...}}',
      request: "Send email to wrong@email.com with subject 'Test' and body 'Hello'",
      call: "send_email_tool(recipient='wrong@email.com', subject='Test', body='Hello')",
      edited: "send_email_tool(recipient='correct@email.com', subject='Corrected Subject', body='This was edited by human before sending')",
      toolRole: 'tool',
      tool: "Email sent to correct@email.com with subject 'Corrected Subject'",
      answer: 'The email has been successfully sent.',
      decide: '<b>Edit.</b> The decision carries an <code>edited_action</code>: the same tool name with new arguments, a corrected recipient, subject and body.',
      run: '<b>The tool runs with the edited arguments.</b> In this saved run the model\'s call in the history was replaced too. Since LangChain 1.4 the history keeps the model\'s call, and the tool result starts with a note naming the call that ran instead.',
      reply: '<b>The model answers</b> from the tool\'s result. It confirms the send without mentioning the change.',
    },
  };

  const STEPS = [
    { lines: [1, 2], caption: '' },
    { lines: [2], caption: '' },
    { lines: [2, 3], caption: '' },
    { lines: [4, 5, 6, 7], caption: '' },
    { lines: [4, 5, 6, 7], caption: '' },
    { lines: [4, 5, 6, 7], caption: '' },
    { lines: [8], caption: '' },
  ];

  function captions(r) {
    return [
      `<b>Request.</b> A new thread, ${r.thread.replace(/"/g, '')}. The question becomes a <code>HumanMessage</code> and the graph starts at the model node.`,
      '<b>The model asks to send.</b> Its reply is a tool call to <code>send_email_tool</code>, not an answer. Without middleware the tools node would run it next.',
      '<b>The middleware pauses the run.</b> Its <code>after_model</code> node sees a gated tool, raises an interrupt, and the checkpointer saves the state. <code>invoke</code> returns: the messages so far, and <code>__interrupt__</code> with the action request and the decisions allowed.',
      r.decide,
      r.run,
      r.reply,
      '<b>Printed.</b> The last message is the model\'s answer; your code prints it.',
    ];
  }

  // What each step shows: message rows, the new row, lit parts, the interrupt and the saver line.
  function view(r, n) {
    const rows = [];
    if (n >= 1) rows.push(['human', r.request]);
    if (n >= 2) rows.push(['ai', `tool call: ${n >= 5 && r.edited ? r.edited : r.call}`]);
    if (n >= 5) rows.push([r.toolRole, r.tool]);
    if (n >= 6) rows.push(['ai', r.answer]);
    const hot = [[], ['model'], ['model'], ['hitl', 'saver'], ['reviewer', 'hitl'], r.toolRole === 'tool' ? ['tools'] : ['hitl'], ['model'], []][n];
    return {
      rows,
      fresh: n === 5 && r.edited ? [1, 2] : n >= 1 && n <= 6 && n !== 3 && n !== 4 ? [rows.length - 1] : [],
      hot,
      interrupt: n === 3 || n === 4,
      saver: n >= 3 && n <= 4 ? `paused at after_model, ${r.thread.replace(/"/g, '')}` : 'state per thread',
      answer: n >= 7 ? r.answer : '',
      count: rows.length ? `${rows.length} message${rows.length > 1 ? 's' : ''}` : '',
    };
  }

  document.querySelectorAll('[data-hitl-resume]').forEach((root) => {
    const el = (name) => root.querySelector(`[data-el="${name}"]`);
    const parts = [...root.querySelectorAll('[data-part]')];
    const presets = [...root.querySelectorAll('[data-preset]')];
    let run = RUNS.approve;
    const make = (tag, cls, text) => {
      const node = document.createElement(tag);
      node.className = cls;
      node.textContent = text;
      return node;
    };

    function choose(name) {
      run = RUNS[name];
      captions(run).forEach((text, i) => { STEPS[i].caption = text; });
      presets.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
      el('thread').textContent = run.thread;
      el('decision').textContent = run.decision;
    }

    function draw(n) {
      const v = view(run, n);
      parts.forEach((part) => part.classList.toggle('is-hot', v.hot.includes(part.dataset.part)));
      const list = el('rows');
      list.replaceChildren();
      if (!v.rows.length) list.append(make('li', 'hr-empty', 'No messages yet.'));
      v.rows.forEach(([role, text], i) => {
        const row = make('li', 'hr-row', '');
        row.classList.toggle('is-new', v.fresh.includes(i));
        row.classList.toggle('is-error', role === 'tool, error');
        row.append(make('span', 'hr-role', role), make('span', 'hr-text', text));
        list.append(row);
      });
      el('count').textContent = v.count;
      el('saver').textContent = v.saver;
      const box = el('interrupt');
      box.classList.toggle('is-empty', !v.interrupt);
      el('itext').textContent = v.interrupt
        ? `action_requests: ${run.call}; allowed_decisions: approve, edit, reject`
        : 'None: the run is not paused.';
      el('answer').classList.toggle('is-empty', !v.answer);
      el('atext').textContent = v.answer || 'Nothing yet.';
    }

    choose('approve');
    window.StepPlayer(root, {
      steps: STEPS,
      intro: 'Pick a decision and press <b>Play</b>: the agent is asked to send an email.',
      paint(n) {
        draw(n);
        return {};
      },
    });
    const reset = root.querySelector('[data-act="reset"]');
    presets.forEach((b) => b.addEventListener('click', () => {
      choose(b.dataset.preset);
      reset.click();
    }));
  });
})();
