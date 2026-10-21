# Outs — Texas Hold’em Drawing Trainer

A local, offline drawing-equity trainer for your Mac. No installation, account, server, or internet connection is required.

## Run on a Mac mini

Double-click **Launch Trainer.command**, or open **index.html** in Safari, Chrome, or Firefox. Keep `index.html`, `styles.css`, `poker.js`, and `app.js` together in this folder.

1. Choose the draw types you want to practice. All options start checked; uncheck any you want to exclude, then click **Start training**.
2. Look at your two hole cards and the random flop.
3. Mentally count outs and estimate the drawing percentages.
4. Click **Reveal answer**.
5. Click **Correct** or **Incorrect**. A new matching random hand appears immediately.

Your score lasts for the current page session. Reloading starts a new session.

## Draw selection

The menu offers open-ended straight draws, gutshots, double gutshots, flush draws, overcards, pocket pairs drawing to sets, pairs drawing to two pair/trips, full house/quads draws, other unpaired hole cards, and other hands. Select at least one option. **Draw settings** reopens the menu during practice; applying a new selection deals a new hand and keeps your score. Cancel keeps your existing hand and selection.

The code repeatedly shuffles and deals random two-hole-card/flop combinations, discarding them behind the scenes until a hand matches **at least one** selected criterion. It yields between batches to keep the interface responsive for rare draws. Hands may match several options. Selecting a type does not remove other outs from the answer: for example, a flush-draw hand may also have pair outs, and both are counted.

“Overcards” requires at least one unpaired hole card above every flop rank, with outs to pair it. A pocket overpair belongs under pocket pair to a set. A–2–3–4 and J–Q–K–A count as gutshots (one completing rank); 2–3–4–5 counts as open-ended (ace or six). Double gutshots have two different inside completing ranks. Already-made straights/flushes do not qualify as draws to that same category. **Other hands** covers hands outside the named draw types, preserving unrestricted random practice when everything is selected.

## Calculation rules

The main answer uses the **rule of 2 and 4**:

- **Turn:** outs × 2%.
- **By the river:** outs × 4%, counting both upcoming cards after the flop.
- Both estimates are capped at 100%. These shortcuts become less accurate with many outs.

An out is an unseen card that improves the current five-card hand to a **higher hand category** using at least one hole card. Categories are high card, pair, two pair, trips, straight, flush, full house, quads, and straight flush. Cards that improve multiple draws count only once. For pair, two-pair, trips, and quads improvements, the new card must match a hole-card rank. This excludes improvements caused solely by the board pairing. A full house, straight, or flush must use at least one hole card.

Examples:

- A♠ A♥ on K♣ 7♦ 2♠: **2 outs**, turn **≈ 4%**, by the river **≈ 8%**.
- A♠ K♥ on Q♣ 7♦ 2♠: **6 outs** to a pair, turn **≈ 12%**, by the river **≈ 24%**.
- 8♠ 9♥ on 6♣ 7♦ K♠: **14 outs** (8 straight outs and 6 pair outs), turn **≈ 28%**, by the river **≈ 56%**.

This first version includes pair improvements as well as straight and flush draws. It does **not** estimate winning equity against an opponent, discount losing outs, count better kickers or stronger hands within the same category, or include backdoor draws needing two specific cards.

The expandable answer shows every out and the exact probability of hitting at least one of those **currently identified cards**:

```
Turn = outs / 47
By the river = 1 − ((47 − outs) / 47) × ((46 − outs) / 46)
```

Those exact figures describe hitting the current out set, not every possible improvement after two cards: new draws, changing board texture, and subsequent redraws are outside this exercise.

Each deal uses a fresh 52-card deck shuffled with the browser’s cryptographic random generator. No cards repeat within a hand; repeats across hands are allowed.

## Developer checks

On macOS, run `python3 tests/run.py`. This uses the system JavaScriptCore framework with no third-party packages. If Node.js is installed, `node tests/run.js` also works. Tests cover hand categories, outs, overlap, percentages, shuffling, draw classification, dealing under individual/combined filters, and the selection → reveal → grade → next-hand flow with a small DOM stand-in. They are not a visual browser test.
