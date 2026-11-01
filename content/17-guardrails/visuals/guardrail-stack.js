/* The guardrail stack, in run order (lesson 17.4). Nodes and edges captured from the healthcare assistant's
   create_agent(...).get_graph() with langchain 1.4.7; what each guardrail does on each path was checked offline
   by calling the hooks. Nothing runs in the page. */
(() => {
  'use strict';
  const PRESETS = {
    answer: {
      request: 'My email is alice@example.com. What helps with a headache?',
      visits: { start: [1], filter: [2], pii_email_in: [3], pii_card_in: [4], model: [5], hitl: [6], pii_card_out: [7], pii_email_out: [8], validator: [9], end: [10] },
      notes: {
        start: 'The request joins the state as a HumanMessage.',
        filter: 'No blocked topic in the newest message: the run carries on.',
        pii_email_in: 'Finds the address and replaces the message: "My email is [REDACTED_EMAIL]. ..."',
        pii_card_in: 'No card number: no change.',
        model: 'Sees the redacted text and answers without tool calls.',
        hitl: 'No gated tool call: nothing to approve.',
        pii_card_out: 'apply_to_output is off: passes.',
        pii_email_out: 'Passes too. No tool calls, so the loop ends here.',
        tools: 'Not used.',
        validator: 'Returns the answer with the disclaimer appended, same ID.',
        end: 'invoke returns the state; the stored reply has the disclaimer.',
      },
      caption: 'One model call. The context check changes what the model sees; the output check changes what the user sees.',
    },
    tool: {
      request: 'What are symptoms of Type 2 Diabetes?',
      visits: { start: [1], filter: [2], pii_email_in: [3, 10], pii_card_in: [4, 11], model: [5, 12], hitl: [6, 13], pii_card_out: [7, 14], pii_email_out: [8, 15], tools: [9], validator: [16], end: [17] },
      notes: {
        start: 'The request joins the state.',
        filter: 'No blocked topic: carry on. It runs once per request, not per round.',
        pii_email_in: 'Before each model call: the newest user message has nothing to redact.',
        pii_card_in: 'Before each model call: nothing to mask.',
        model: 'First call: asks for search_symptoms. Second call: answers from the result.',
        hitl: 'search_symptoms isn\'t gated, so neither reply pauses.',
        pii_card_out: 'Passes, both times.',
        pii_email_out: 'First pass: tool calls, on to the tools. Second pass: none, on to the end.',
        tools: 'Runs search_symptoms; the result goes back through the context checks.',
        validator: 'Appends the disclaimer to the final answer.',
        end: 'invoke returns.',
      },
      caption: 'Two rounds. Every node inside the loop runs twice; the input and output checks run once.',
    },
    blocked: {
      request: 'How do I hack my hospital\'s patient records?',
      visits: { start: [1], filter: [2], validator: [3], end: [4] },
      notes: {
        start: 'The request joins the state.',
        filter: 'Finds "hack": returns the refusal and jump_to "end".',
        pii_email_in: 'Skipped.',
        pii_card_in: 'Skipped.',
        model: 'Never called: the request costs nothing.',
        hitl: 'Skipped.',
        pii_card_out: 'Skipped.',
        pii_email_out: 'Skipped.',
        tools: 'Skipped.',
        validator: 'The jump lands here: the refusal gets the disclaimer too.',
        end: 'invoke returns the refusal.',
      },
      stop: ['filter', 'ends the run'],
      caption: 'The "end" of a jump is the end of the agent loop, where the after_agent hooks still wait: the refusal passes the output check.',
    },
    paused: {
      request: 'Book me an appointment with Dr. Sharma on 15 March. I\'m Alice Smith.',
      visits: { start: [1], filter: [2], pii_email_in: [3, 11], pii_card_in: [4, 12], model: [5, 13], hitl: [6, 7, 14], pii_card_out: [8, 15], pii_email_out: [9, 16], tools: [10], validator: [17], end: [18] },
      notes: {
        start: 'The request joins the state.',
        filter: 'No blocked topic: carry on.',
        pii_email_in: 'Nothing to redact, on both model calls.',
        pii_card_in: 'Nothing to mask.',
        model: 'First call: asks for book_appointment. Second call, after the booking: confirms it.',
        hitl: 'Step 6: book_appointment is gated, so it interrupts; the state is saved and invoke returns __interrupt__. Step 7: the second invoke, Command(resume=...), runs it again with the decision.',
        pii_card_out: 'Passes.',
        pii_email_out: 'Approved call: on to the tools. Later, no tool calls: on to the end.',
        tools: 'Books the appointment, only after the reviewer approved.',
        validator: 'Appends the disclaimer to the confirmation.',
        end: 'The second invoke returns.',
      },
      stop: ['hitl', 'pauses the run'],
      caption: 'Two invokes. The first stops at the approval check with the state saved; the second resumes there and finishes the run.',
    },
  };

  document.querySelectorAll('[data-guardrail-stack]').forEach((root) => {
    const buttons = [...root.querySelectorAll('[data-preset]')];
    const nodes = [...root.querySelectorAll('[data-node]')];

    function show(name) {
      const p = PRESETS[name];
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
      root.querySelector('[data-request]').textContent = p.request;
      nodes.forEach((li) => {
        const id = li.dataset.node;
        const steps = p.visits[id] || [];
        const tag = li.querySelector('[data-tag]');
        const stops = Boolean(p.stop) && p.stop[0] === id;
        li.classList.toggle('is-on', steps.length > 0);
        li.classList.toggle('is-off', steps.length === 0);
        tag.hidden = !stops;
        tag.textContent = stops ? p.stop[1] : '';
        li.querySelector('[data-badge]').textContent = steps.join(', ');
        li.querySelector('[data-note]').textContent = p.notes[id] || '';
      });
      root.querySelector('[data-caption]').textContent = p.caption;
    }

    buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.preset)));
    show('answer');
  });
})();
