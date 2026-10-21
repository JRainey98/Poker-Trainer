(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { hand: null, revealed: false, answered: 0, correct: 0, selected: Poker.drawOptions.map(option => option.id), dealing: false };
  const drawInputs = Poker.drawOptions.map(option => {
    const label = document.createElement('label');
    label.className = 'draw-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = option.id;
    input.checked = true;
    input.addEventListener('change', updateSelection);
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = option.name;
    const description = document.createElement('span');
    description.textContent = option.description;
    copy.replaceChildren(title, description);
    label.replaceChildren(input, copy);
    $('draw-checkboxes').appendChild(label);
    return input;
  });

  function updateSelection() {
    const count = drawInputs.filter(input => input.checked).length;
    $('start-training').disabled = state.dealing || count === 0;
    $('selection-message').textContent = count ? `${count} of ${Poker.drawOptions.length} draw types selected` : 'Select at least one draw type to begin.';
  }

  function showSettings() {
    if (state.dealing) return;
    for (const input of drawInputs) input.checked = state.selected.includes(input.value);
    $('training').hidden = true;
    $('draw-settings').hidden = false;
    $('cancel-settings').hidden = !state.hand;
    $('start-training').textContent = state.hand ? 'Apply & deal next hand' : 'Start training →';
    updateSelection();
    $('settings-title').focus({ preventScroll: true });
  }

  async function startTraining() {
    if (state.dealing) return;
    const selected = drawInputs.filter(input => input.checked).map(input => input.value);
    if (!selected.length) return;
    state.selected = selected;
    await nextHand(true);
  }

  function renderCard(card) {
    const element = document.createElement('div');
    element.className = `card${['d', 'h'].includes(card.suit) ? ' red' : ''}`;
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', Poker.accessibleLabel(card));
    // Card values come only from the local standard deck.
    const corner = `<span>${Poker.rankLabel(card.rank)}</span><span class="small-suit">${Poker.symbols[card.suit]}</span>`;
    element.innerHTML = `<span class="card-corner" aria-hidden="true">${corner}</span><span class="card-center" aria-hidden="true">${Poker.symbols[card.suit]}</span><span class="card-corner bottom" aria-hidden="true">${corner}</span>`;
    return element;
  }

  async function nextHand(focus) {
    if (state.dealing) return;
    state.dealing = true;
    state.revealed = false;
    $('draw-options').disabled = true;
    for (const id of ['start-training', 'cancel-settings', 'edit-settings', 'reveal', 'correct', 'incorrect']) $(id).disabled = true;
    $('selection-message').textContent = 'Finding a matching hand…';
    try {
      state.hand = await Poker.dealMatching(state.selected);
    } catch (error) {
      $('training').hidden = true;
      $('draw-settings').hidden = false;
      $('selection-message').textContent = `Couldn’t deal a hand: ${error.message}`;
      return;
    } finally {
      state.dealing = false;
      $('draw-options').disabled = false;
      for (const id of ['start-training', 'cancel-settings', 'edit-settings', 'reveal', 'correct', 'incorrect']) $(id).disabled = false;
    }
    $('hole-cards').replaceChildren(...state.hand.hole.map(renderCard));
    $('flop-cards').replaceChildren(...state.hand.flop.map(renderCard));
    $('hand-number').textContent = `HAND ${String(state.answered + 1).padStart(3, '0')}`;
    $('answer').hidden = true;
    $('question').hidden = false;
    $('draw-settings').hidden = true;
    $('training').hidden = false;
    $('active-draws').textContent = state.selected.length === Poker.drawOptions.length ? 'Practicing all draw types' : `Practicing ${state.selected.length} of ${Poker.drawOptions.length} draw types`;
    document.querySelector('.out-details').open = false;
    if (focus) $('reveal').focus({ preventScroll: true });
  }

  function reveal() {
    if (!state.hand || state.dealing || state.revealed) return;
    const answer = Poker.analyze(state.hand.hole, state.hand.flop);
    state.revealed = true;
    $('made-hand').textContent = `You have: ${answer.madeHand.toLowerCase()}`;
    $('outs').textContent = answer.count;
    $('turn').textContent = `≈ ${answer.turn}%`;
    $('river').textContent = `≈ ${answer.river}%`;
    $('draw-summary').textContent = answer.count
      ? answer.groups.map(group => `${group.name}: ${group.count} ${group.count === 1 ? 'out' : 'outs'}`).join(' · ') + '. Each card counts once.'
      : 'No direct outs to a higher hand category under these counting rules. Backdoor draws and kicker improvements are excluded.';
    $('out-cards').replaceChildren(...answer.outs.map(card => {
      const chip = document.createElement('span');
      chip.className = `out-chip${['d', 'h'].includes(card.suit) ? ' red' : ''}`;
      chip.textContent = Poker.cardLabel(card);
      chip.setAttribute('aria-label', Poker.accessibleLabel(card));
      return chip;
    }));
    $('exact').textContent = `Exact chance of hitting one of these ${answer.count} outs: turn ${answer.exactTurn.toFixed(1)}%; by the river ${answer.exactRiver.toFixed(1)}%. Uses 47 unseen cards, then 46. New draws and later board changes aren’t included.`;
    $('question').hidden = true;
    $('answer').hidden = false;
    $('correct').focus({ preventScroll: true });
  }

  function grade(correct) {
    if (state.dealing || !state.revealed) return;
    state.answered++;
    if (correct) state.correct++;
    $('answered').textContent = state.answered;
    $('accuracy').textContent = `${Math.round(state.correct / state.answered * 100)}%`;
    $('session-message').textContent = `${state.correct} correct · ${state.answered - state.correct} incorrect. New hand dealt.`;
    return nextHand(true);
  }

  $('reveal').addEventListener('click', reveal);
  $('correct').addEventListener('click', () => grade(true));
  $('incorrect').addEventListener('click', () => grade(false));
  $('start-training').addEventListener('click', startTraining);
  $('edit-settings').addEventListener('click', showSettings);
  $('cancel-settings').addEventListener('click', () => {
    if (state.dealing || !state.hand) return;
    $('draw-settings').hidden = true;
    $('training').hidden = false;
    $('edit-settings').focus({ preventScroll: true });
  });
  $('rules-toggle').addEventListener('click', () => {
    const expanded = $('rules-toggle').getAttribute('aria-expanded') !== 'true';
    $('rules-toggle').setAttribute('aria-expanded', String(expanded));
    $('rules').hidden = !expanded;
  });
  updateSelection();
})();
