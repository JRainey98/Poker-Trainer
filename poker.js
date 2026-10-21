/* No opponent model: outs improve hand category under the rules below. */
(function (root) {
  'use strict';
  const SUITS = ['c', 'd', 'h', 's'];
  const SYMBOLS = { c: '♣', d: '♦', h: '♥', s: '♠' };
  const SUIT_NAMES = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
  const NAMES = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
  const RANK_NAMES = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
  const DRAW_TYPES = [
    { id: 'open-ended', name: 'Open-ended straight draw', description: 'Four consecutive ranks with a straight available at either end.' },
    { id: 'gutshot', name: 'Gutshot straight draw', description: 'One missing rank completes a straight, including A–2–3–4 or J–Q–K–A.' },
    { id: 'double-gutshot', name: 'Double gutshot', description: 'Two different inside ranks can complete a straight.' },
    { id: 'flush', name: 'Flush draw', description: 'Four cards of one suit, including at least one hole card.' },
    { id: 'overcards', name: 'Overcards', description: 'One or both unpaired hole cards rank above the entire flop and can pair.' },
    { id: 'pocket-pair', name: 'Pocket pair to a set', description: 'A pocket pair with two outs to three of a kind.' },
    { id: 'pair', name: 'Pair to two pair or trips', description: 'One pair, with hole-card outs to two pair or three of a kind.' },
    { id: 'full-house', name: 'Full house or quads draw', description: 'Two pair, trips, or a full house with outs to a full house or quads.' },
    { id: 'low-pair', name: 'Other unpaired hole cards', description: 'An unpaired hole card below the highest flop card can make a pair.' },
    { id: 'other', name: 'Other hands', description: 'Hands outside these draw types, including made hands with no direct outs.' }
  ];

  function deck() {
    return SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ rank: i + 2, suit, id: `${i + 2}${suit}` })));
  }
  function rankLabel(rank) { return ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[rank] || String(rank); }
  function cardLabel(card) { return `${rankLabel(card.rank)}${SYMBOLS[card.suit]}`; }
  function accessibleLabel(card) { return `${RANK_NAMES[card.rank] || card.rank} of ${SUIT_NAMES[card.suit]}`; }

  function randomIndex(size) {
    // Rejection sampling avoids modulo bias when shuffling the deck.
    const limit = Math.floor(0x100000000 / size) * size;
    const buffer = new Uint32Array(1);
    do { root.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
    return buffer[0] % size;
  }
  function deal() {
    const cards = deck();
    for (let i = cards.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1);
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return { hole: cards.slice(0, 2), flop: cards.slice(2, 5) };
  }

  function fiveCardCategory(cards) {
    const counts = new Map();
    for (const card of cards) counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
    const groups = [...counts.values()].sort((a, b) => b - a);
    const ranks = [...counts.keys()].sort((a, b) => a - b);
    const flush = cards.every(card => card.suit === cards[0].suit);
    const straight = ranks.length === 5 && (ranks[4] - ranks[0] === 4 || ranks.join(',') === '2,3,4,5,14');
    if (straight && flush) return 8;
    if (groups[0] === 4) return 7;
    if (groups[0] === 3 && groups[1] === 2) return 6;
    if (flush) return 5;
    if (straight) return 4;
    if (groups[0] === 3) return 3;
    if (groups[0] === 2 && groups[1] === 2) return 2;
    if (groups[0] === 2) return 1;
    return 0;
  }

  function drawTypes(hole, flop) {
    const known = [...hole, ...flop];
    const category = fiveCardCategory(known);
    const ranks = new Set(known.map(card => card.rank));
    const types = [];
    if (category < 4) {
      const missingRanks = new Set();
      for (let start = 1; start <= 10; start++) {
        const window = Array.from({ length: 5 }, (_, index) => start + index === 1 ? 14 : start + index);
        const missing = window.filter(rank => !ranks.has(rank));
        if (missing.length === 1) missingRanks.add(missing[0]);
      }
      if (missingRanks.size === 1) types.push('gutshot');
      if (missingRanks.size >= 2) {
        // A234 and JQKA have only one legal end. 2345 has A and 6.
        const openEnded = Array.from({ length: 9 }, (_, index) => index + 2).some(start =>
          [start, start + 1, start + 2, start + 3].every(rank => ranks.has(rank)) &&
          missingRanks.has(start === 2 ? 14 : start - 1) && missingRanks.has(start + 4));
        types.push(openEnded ? 'open-ended' : 'double-gutshot');
      }
    }
    if (category < 5 && SUITS.some(suit => known.filter(card => card.suit === suit).length === 4)) types.push('flush');
    const highestFlop = Math.max(...flop.map(card => card.rank));
    const pocketPair = hole[0].rank === hole[1].rank;
    if (category <= 1 && !pocketPair && hole.some(card => card.rank > highestFlop)) types.push('overcards');
    if (category === 1) types.push(pocketPair ? 'pocket-pair' : 'pair');
    const holeInTrips = hole.some(card => known.filter(item => item.rank === card.rank).length === 3);
    if ([2, 3].includes(category) || (category === 6 && holeInTrips)) types.push('full-house');
    if (category === 0 && hole.some(card => card.rank < highestFlop)) types.push('low-pair');
    return types.length ? types : ['other'];
  }

  async function dealMatching(selected) {
    const allowed = new Set(selected);
    if (!allowed.size || [...allowed].some(id => !DRAW_TYPES.some(type => type.id === id))) {
      throw new Error('Select at least one valid draw type.');
    }
    // Rejection sampling preserves random deals conditioned on ANY selected type.
    // Yield between batches so even a rare selection keeps the menu responsive.
    for (;;) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const hand = deal();
        if (drawTypes(hand.hole, hand.flop).some(type => allowed.has(type))) return hand;
      }
      await new Promise(resolve => root.setTimeout(resolve, 0));
    }
  }

  function combinations(cards, size) {
    const result = [];
    function pick(start, selected) {
      if (selected.length === size) { result.push(selected); return; }
      for (let i = start; i <= cards.length - (size - selected.length); i++) pick(i + 1, [...selected, cards[i]]);
    }
    pick(0, []);
    return result;
  }

  function analyze(hole, flop) {
    const known = [...hole, ...flop];
    const ids = new Set(known.map(card => card.id));
    if (hole.length !== 2 || flop.length !== 3 || ids.size !== 5 || known.some(card => !SUITS.includes(card.suit) || !Number.isInteger(card.rank) || card.rank < 2 || card.rank > 14 || card.id !== `${card.rank}${card.suit}`)) {
      throw new Error('Expected two hole cards and three distinct flop cards from a standard deck.');
    }
    const current = fiveCardCategory(known);
    const holeIds = new Set(hole.map(card => card.id));
    const holeRanks = new Set(hole.map(card => card.rank));
    const outs = [];
    for (const card of deck()) {
      if (ids.has(card.id)) continue;
      let improved = current;
      for (const hand of combinations([...known, card], 5)) {
        if (!hand.some(item => holeIds.has(item.id))) continue;
        const category = fiveCardCategory(hand);
        if (category <= improved) continue;
        // Board pairing/trips/quads alone aren't hole-card drawing outs.
        // Full houses, straights and flushes use their complete five cards.
        if ([1, 2, 3, 7].includes(category) && !holeRanks.has(card.rank)) continue;
        improved = category;
      }
      if (improved > current) outs.push({ ...card, category: improved });
    }
    const count = outs.length;
    const groups = new Map();
    for (const card of outs) groups.set(card.category, (groups.get(card.category) || 0) + 1);
    return {
      current, madeHand: NAMES[current], outs, count,
      turn: Math.min(100, count * 2), river: Math.min(100, count * 4),
      exactTurn: count / 47 * 100,
      exactRiver: (1 - (47 - count) * (46 - count) / (47 * 46)) * 100,
      groups: [...groups].sort((a, b) => b[0] - a[0]).map(([category, count]) => ({ name: NAMES[category], count }))
    };
  }

  root.Poker = { deck, deal, dealMatching, drawTypes, drawOptions: DRAW_TYPES, analyze, fiveCardCategory, cardLabel, accessibleLabel, rankLabel, symbols: SYMBOLS };
})(globalThis);
