globalThis.runUITests = async function () {
  'use strict';
  let assertions = 0;
  function assert(value, message) { assertions++; if (!value) throw new Error(message); }
  if (typeof require === 'function') {
    const fs = require('node:fs');
    globalThis.__appSource = fs.readFileSync(`${__dirname}/../app.js`, 'utf8');
    globalThis.__htmlSource = fs.readFileSync(`${__dirname}/../index.html`, 'utf8');
  }
  class Element {
    constructor() { this.hidden = false; this.attributes = {}; this.listeners = {}; this.children = []; this.textContent = ''; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    replaceChildren(...children) { this.children = children; }
    appendChild(child) { this.children.push(child); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    focus() { document.focused = this; }
    click() { if (!this.disabled) return this.listeners.click(); }
  }
  const elements = {};
  for (const match of __htmlSource.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const element = new Element();
    element.hidden = /\bhidden\b/.test(match[0]);
    const expanded = match[0].match(/aria-expanded="([^"]+)"/);
    if (expanded) element.setAttribute('aria-expanded', expanded[1]);
    elements[match[1]] = element;
  }
  const details = new Element();
  globalThis.document = {
    getElementById(id) { if (!elements[id]) throw new Error(`Missing HTML element: ${id}`); return elements[id]; },
    createElement() { return new Element(); },
    querySelector(selector) { if (selector !== '.out-details') throw new Error(`Unexpected selector: ${selector}`); return details; }
  };
  if (!globalThis.crypto) globalThis.crypto = {};
  if (!globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues = array => { for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 0x100000000); return array; };
  }
  (0, eval)(__appSource);
  const $ = id => elements[id];
  const inputs = $('draw-checkboxes').children.map(label => label.children[0]);
  assert(!$('draw-settings').hidden && $('training').hidden, 'Draw selection appears before training');
  assert(inputs.length === Poker.drawOptions.length && inputs.every(input => input.checked), 'Every draw option starts checked');
  assert($('hole-cards').children.length === 0, 'No hand is dealt before starting');
  $('reveal').click();
  assert($('answer').hidden, 'Cannot reveal before starting');
  for (const input of inputs) input.checked = false;
  inputs[0].listeners.change();
  assert($('start-training').disabled, 'Cannot start with no draw types selected');
  await $('start-training').click();
  assert($('training').hidden, 'Empty selection does not start training');
  for (const input of inputs) input.checked = true;
  inputs[0].listeners.change();
  await $('start-training').click();
  assert($('draw-settings').hidden && !$('training').hidden, 'Start opens training');
  assert($('answer').hidden && !$('question').hidden, 'Initial answer is hidden');
  assert($('hole-cards').children.length === 2 && $('flop-cards').children.length === 3, 'Five cards render');
  assert($('hole-cards').children.every(card => card.getAttribute('aria-label')), 'Cards have accessible names');
  $('incorrect').click();
  assert($('hand-number').textContent === 'HAND 001', 'Cannot grade before revealing');
  $('reveal').click();
  assert(!$('answer').hidden && $('question').hidden, 'Reveal shows answer and hides question');
  assert(/^≈ \d+%$/.test($('turn').textContent) && /^≈ \d+%$/.test($('river').textContent), 'Percentages render');
  assert($('out-cards').children.length === Number($('outs').textContent), 'Every out renders');
  assert(document.focused === $('correct'), 'Keyboard focus moves to grading');
  details.open = true;
  await $('correct').click();
  assert($('answered').textContent === 1 && $('accuracy').textContent === '100%', 'Correct answer updates score');
  assert($('hand-number').textContent === 'HAND 002', 'Correct answer immediately advances');
  assert($('answer').hidden && !$('question').hidden && !details.open, 'Next answer and expanded details are hidden');
  assert(document.focused === $('reveal'), 'Next hand restores keyboard focus');
  $('correct').click();
  assert($('answered').textContent === 1, 'Repeated grading does not double-count');
  $('reveal').click();
  await $('incorrect').click();
  assert($('answered').textContent === 2 && $('accuracy').textContent === '50%', 'Incorrect answer updates accuracy');
  assert($('hand-number').textContent === 'HAND 003', 'Incorrect answer immediately advances');
  $('rules-toggle').click();
  assert(!$('rules').hidden && $('rules-toggle').getAttribute('aria-expanded') === 'true', 'Rules expand');
  $('rules-toggle').click();
  assert($('rules').hidden && $('rules-toggle').getAttribute('aria-expanded') === 'false', 'Rules collapse');
  const actualDealMatching = Poker.dealMatching;
  const dealt = [];
  Poker.dealMatching = async selected => {
    const hand = await actualDealMatching(selected);
    dealt.push({ hand, selected: [...selected] });
    return hand;
  };
  $('edit-settings').click();
  assert(!$('draw-settings').hidden && $('training').hidden, 'Settings can reopen during practice');
  for (const input of inputs) input.checked = input.value === 'flush';
  inputs[0].listeners.change();
  $('cancel-settings').click();
  assert(!$('training').hidden && $('draw-settings').hidden && dealt.length === 0, 'Cancel keeps the current hand');
  $('edit-settings').click();
  assert(inputs.every(input => input.checked), 'Cancel discards selection changes');
  for (const input of inputs) input.checked = input.value === 'flush';
  inputs[0].listeners.change();
  const pending = $('start-training').click();
  assert($('start-training').disabled && $('draw-options').disabled, 'Controls disable while finding a match');
  await pending;
  assert(dealt.length === 1 && dealt[0].selected.join(',') === 'flush', 'Apply sends only selected criteria to dealer');
  assert(Poker.drawTypes(dealt[0].hand.hole, dealt[0].hand.flop).includes('flush'), 'Applied filter produces a matching hand');
  assert($('answered').textContent === 2 && $('accuracy').textContent === '50%', 'Changing draw settings preserves score');
  $('reveal').click();
  await $('correct').click();
  assert(dealt.length === 2 && dealt[1].selected.join(',') === 'flush', 'Automatic next hand keeps chosen criteria');
  assert(Poker.drawTypes(dealt[1].hand.hole, dealt[1].hand.flop).includes('flush'), 'Automatic next hand also matches');
  assert($('draw-settings').hidden && !$('training').hidden, 'Practice continues after grading');
  Poker.dealMatching = actualDealMatching;
  return `${assertions} interaction assertions passed.`;
};
