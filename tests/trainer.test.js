(function () {
  'use strict';
  if (typeof require === 'function') require('../poker.js');
  let assertions = 0;
  function assert(value, message) { assertions++; if (!value) throw new Error(message); }
  function equal(actual, expected, message) { assert(actual === expected, `${message}: expected ${expected}, received ${actual}`); }
  function cards(text) {
    return text.split(' ').map(label => {
      const rank = ({ A: 14, K: 13, Q: 12, J: 11, T: 10 })[label[0]] || Number(label[0]);
      return { rank, suit: label[1], id: `${rank}${label[1]}` };
    });
  }
  function analyze(hole, flop) { return Poker.analyze(cards(hole), cards(flop)); }

  equal(Poker.deck().length, 52, '52 cards');
  equal(new Set(Poker.deck().map(card => card.id)).size, 52, 'All cards distinct');
  const categories = ['As Kh 8c 7d 2s', 'As Ah Kc 7d 2s', 'As Ah Kc Kd 2s', 'As Ah Ac Kd 2s', 'As 2h 3c 4d 5s', 'As Js 8s 4s 2s', 'As Ah Ac Kd Ks', 'As Ah Ac Ad Ks', '9s Ts Js Qs Ks'];
  categories.forEach((hand, category) => equal(Poker.fiveCardCategory(cards(hand)), category, `Category ${category}`));
  equal(Poker.fiveCardCategory(cards('As 2s 3s 4s 5s')), 8, 'Wheel straight flush');
  equal(Poker.fiveCardCategory(cards('Qs Kh Ac 2d 3s')), 0, 'Straights do not wrap around ace');

  const aces = analyze('As Ah', 'Kc 7d 2s');
  equal(aces.count, 2, 'AA has two set outs');
  equal(aces.turn, 4, 'AA turn example');
  equal(aces.river, 8, 'AA river example');
  assert(aces.outs.every(card => card.rank === 14), 'Board pairing does not count for AA');
  assert(Math.abs(aces.exactTurn - 200 / 47) < 1e-10, 'Exact turn denominator');
  assert(Math.abs(aces.exactRiver - (1 - 45 * 44 / (47 * 46)) * 100) < 1e-10, 'Exact two-card miss complement');
  equal(analyze('As Kh', 'Qc 7d 2s').count, 6, 'Two unpaired hole cards have six pair outs');
  equal(analyze('As Kh', 'Ac 7d 2s').count, 5, 'A pair has trips and two pair outs');
  equal(analyze('As Kh', 'Ac Kd 2s').count, 4, 'Two pair has full house outs');
  equal(analyze('As Ah', 'Ac Kd 2s').count, 7, 'Set has six full house outs and one quad out');
  equal(analyze('As Kh', '7c 7d 2s').count, 6, 'Board pair: hole ranks can make two pair');
  equal(analyze('As Kh', '7c 7d 7s').count, 6, 'Board trips: hole ranks can make full house; board quads excluded');
  equal(analyze('As Ah', 'Kc Kd 2s').count, 4, 'Pocket pair and board pair have full house outs');
  equal(analyze('As Ah', 'Ac Kd Ks').count, 1, 'Made full house can draw to quads');
  equal(analyze('As Ah', 'Ac Ad Ks').count, 0, 'Made quads has no higher category outs');
  equal(analyze('As Ks', 'Qs Js Ts').count, 0, 'Royal flush has no outs');
  equal(analyze('8s 9h', '6c 7d Ks').count, 14, 'Open-ended straight plus pair outs');
  equal(analyze('As 2h', '3c 4d Ks').groups.find(group => group.name === 'Straight').count, 4, 'Wheel gutshot');
  const flush = analyze('Ah Kh', 'Qh 7h 2c');
  equal(flush.count, 15, 'Nine flush outs plus six pair outs');
  equal(flush.groups.find(group => group.name === 'Flush').count, 9, 'Four to a flush has nine flush outs');
  const combo = analyze('8h 9h', '6h 7h Ks');
  equal(combo.count, 21, 'Combo draw: 9 flush + 8 straight + 6 pair - 2 overlaps');
  equal(new Set(combo.outs.map(card => card.id)).size, 21, 'Overlapping outs counted once');
  const backdoor = analyze('Ah Kh', 'Qh 7c 2d');
  assert(!backdoor.groups.some(group => group.name === 'Flush'), 'Backdoor flush is excluded');
  equal(backdoor.count, 6, 'Backdoor case only has direct pair outs');
  let rejected = false;
  try { analyze('As As', 'Kc 7d 2s'); } catch (_) { rejected = true; }
  assert(rejected, 'Duplicate input cards are rejected');

  // A deterministic random source tests shuffling without adding a dependency.
  let seed = 123456;
  if (!globalThis.crypto) globalThis.crypto = {};
  const originalRandom = globalThis.crypto.getRandomValues;
  Object.defineProperty(globalThis.crypto, 'getRandomValues', { configurable: true, value: function (array) {
    for (let i = 0; i < array.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; array[i] = seed; }
    return array;
  } });
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const hand = Poker.deal();
    equal(hand.hole.length, 2, 'Deal has two hole cards');
    equal(hand.flop.length, 3, 'Deal has three flop cards');
    const known = new Set([...hand.hole, ...hand.flop].map(card => card.id));
    equal(known.size, 5, 'Deal has no duplicate cards');
    seen.add([...known].join(','));
    const result = Poker.analyze(hand.hole, hand.flop);
    assert(result.outs.every(card => !known.has(card.id)), 'Outs are unseen cards');
    assert(result.turn >= 0 && result.turn <= 100 && result.river >= result.turn && result.river <= 100, 'Probabilities stay in bounds');
    assert(result.exactTurn >= 0 && result.exactRiver >= result.exactTurn && result.exactRiver <= 100, 'Exact probabilities stay in bounds');
  }
  assert(seen.size > 190, 'Fresh deals vary');
  if (originalRandom) Object.defineProperty(globalThis.crypto, 'getRandomValues', { configurable: true, value: originalRandom });
  globalThis.engineTestResult = `${assertions} calculation assertions passed.`;
  return globalThis.engineTestResult;
})();
