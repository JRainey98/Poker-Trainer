globalThis.runFilterTests = async function () {
  'use strict';
  let assertions = 0;
  function assert(value, message) { assertions++; if (!value) throw new Error(message); }
  function cards(text) {
    return text.split(' ').map(label => {
      const rank = ({ A: 14, K: 13, Q: 12, J: 11, T: 10 })[label[0]] || Number(label[0]);
      return { rank, suit: label[1], id: `${rank}${label[1]}` };
    });
  }
  function types(hole, flop) { return Poker.drawTypes(cards(hole), cards(flop)); }
  function has(hole, flop, type) { return types(hole, flop).includes(type); }
  assert(has('8s 9h', '6c 7d Ks', 'open-ended'), '8-9 on 6-7-K is open-ended');
  assert(!has('8s 9h', '6c 7d Ks', 'gutshot'), 'Open-ended is not classified as gutshot');
  assert(has('As 2h', '3c 4d Ks', 'gutshot'), 'A234 only draws to 5');
  assert(has('Js Qh', 'Kc Ad 2s', 'gutshot'), 'JQKA only draws to 10');
  assert(has('2s 3h', '4c 5d Ks', 'open-ended'), '2345 draws to ace or 6');
  assert(has('Ts Jh', 'Qc Kd 2s', 'open-ended'), 'TJQK draws to 9 or ace');
  assert(has('Js 9h', '8c 7d 5s', 'double-gutshot'), '5789J draws to 6 or 10');
  assert(!has('Js 9h', '8c 7d 5s', 'open-ended'), 'Double gutshot is not open-ended');
  assert(has('Ah Kh', 'Qh 7h 2c', 'flush'), 'Four suited cards is a flush draw');
  assert(!has('Ah Kh', 'Qh 7c 2d', 'flush'), 'Backdoor flush is not a direct flush draw');
  assert(!has('Ah Kh', 'Qh 7h 2h', 'flush'), 'Made flush is not a flush draw');
  assert(has('As Kh', 'Qc 7d 2s', 'overcards'), 'Two overcards qualify');
  assert(has('As 5h', 'Qc 7d 2s', 'overcards'), 'One overcard qualifies');
  assert(!has('Js 5h', 'Qc 7d 2s', 'overcards'), 'No overcard below board high rank');
  assert(!has('As Ah', 'Qc 7d 2s', 'overcards'), 'A made overpair is not unpaired overcards');
  assert(!has('Ah Kh', 'Qh 7h 2h', 'overcards'), 'Made flush has no direct pair-improvement outs');
  assert(has('As Ah', 'Kc 7d 2s', 'pocket-pair'), 'AA on dry flop has set draw');
  assert(!has('As Ah', 'Ac 7d 2s', 'pocket-pair'), 'Made set belongs to full house/quads');
  assert(has('As Kh', 'Ac 7d 2s', 'pair'), 'Paired hole card can draw to trips or two pair');
  assert(has('As Kh', '7c 7d 2s', 'pair'), 'Board pair can improve to two pair with hole rank');
  assert(has('As Kh', 'Ac Kd 2s', 'full-house'), 'Two pair has full house draw');
  assert(has('As Ah', 'Ac 7d 2s', 'full-house'), 'Set has full house/quads draw');
  assert(has('As Ah', 'Ac 7d 7s', 'full-house'), 'Full house has quads draw');
  assert(!has('As Ah', 'Kc Kd Ks', 'full-house'), 'Board trips with pocket pair has no hole-card quads out');
  assert(has('Js 5h', 'Qc 7d 2s', 'low-pair'), 'Undercards have pair draws');
  assert(has('As 5h', 'Qc 7d 2s', 'low-pair'), 'An overcard and an undercard can share a hand');
  assert(has('As Ks', 'Qs Js Ts', 'other'), 'Unclassified made hands are covered');
  const combo = types('8h 9h', '6h 7h Ks');
  assert(combo.includes('open-ended') && combo.includes('flush'), 'Combination hands match multiple criteria');

  let rejected = false;
  try { await Poker.dealMatching([]); } catch (_) { rejected = true; }
  assert(rejected, 'Empty selections are rejected instead of looping forever');
  rejected = false;
  try { await Poker.dealMatching(['unknown']); } catch (_) { rejected = true; }
  assert(rejected, 'Invalid selections are rejected');

  // Exercise the actual random-deal rejection loop, including rare selections.
  for (const option of Poker.drawOptions) {
    for (let trial = 0; trial < 8; trial++) {
      const hand = await Poker.dealMatching([option.id]);
      assert(Poker.drawTypes(hand.hole, hand.flop).includes(option.id), `Only ${option.id}: every dealt hand matches`);
      assert(new Set([...hand.hole, ...hand.flop].map(card => card.id)).size === 5, 'Filtered cards stay distinct');
    }
  }
  const seen = new Set();
  for (let trial = 0; trial < 40; trial++) {
    const hand = await Poker.dealMatching(['flush', 'overcards']);
    const matched = Poker.drawTypes(hand.hole, hand.flop);
    assert(matched.includes('flush') || matched.includes('overcards'), 'Multiple selections use OR');
    if (matched.includes('flush') && !matched.includes('overcards')) seen.add('flush-only');
    if (matched.includes('overcards') && !matched.includes('flush')) seen.add('overcards-only');
  }
  assert(seen.has('flush-only') && seen.has('overcards-only'), 'Either selected type can qualify independently');
  return `${assertions} draw-filter assertions passed.`;
};
