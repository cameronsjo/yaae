# Prose Highlighting — A Design Brief for Color Tokens

> **Audience:** the Artificer design system, for authoring color tokens.
> **Scope:** describe-only — facts and constraints, not color recommendations.
> Companion docs: [`ia-writer-feature.md`](./ia-writer-feature.md) (editorial rationale),
> [`implementation.md`](./implementation.md) (technical architecture).

## What it is, in one breath

Prose highlighting color-codes the words of a document by their **grammatical role** —
nouns one color, verbs another, and so on — so a writer can *see* the structure of their
own prose at a glance. It's directly inspired by iA Writer's "syntax highlighting"
feature. The words themselves change color; nothing else changes (no backgrounds, no
underlines, no boxes).

It is an **editing lens**, not decoration. A writer flips it on to inspect a passage,
reads what the colors reveal, and flips it back off. It is **off by default**.

---

## Why it exists — the editorial purpose

This is the part that matters most for choosing colors, because each color is tied to a
specific *editing question*. The colors aren't arbitrary categories — each one is a
diagnostic a writer is actively looking for:

- **Adjectives & adverbs — the "filler" check.** The classic writing advice (Strunk &
  White: *"Write with nouns and verbs, not with adjectives and adverbs"*) is that
  unnecessary modifiers weaken prose. Lighting them up makes overuse instantly visible —
  a paragraph drowning in adjectives lights up like a switchboard.
- **Verbs — the "weak writing" check.** Highlighting every verb makes it obvious when a
  passage is dominated by limp forms of *to be* ("is", "was", "has been") instead of
  active, concrete verbs. A wall of same-colored weak verbs is a smell.
- **Nouns — the "structure & repetition" check.** Good writing reuses its key nouns
  deliberately. Coloring them reveals the backbone of a passage and surfaces *unwanted*
  repetition.
- **Conjunctions — the "run-on" check.** Little joining words ("and", "but", "or", "so")
  look harmless but can mask run-on sentences or illogical connections. Coloring them
  exposes overuse.

The through-line: **the writer is hunting for patterns of overuse.** The colors succeed
when a reader can instantly tell *how much* of a given category is present and *where it
clusters*. That's a different job than status colors (success/error) — there's no
good/bad ranking among the five. They are **five equal peers**, a categorical palette,
not a scale.

---

## What gets colored — the five categories (plus user lists)

| # | Category | What it marks | The writer's question |
|---|----------|---------------|----------------------|
| 1 | **Adjectives** | Describing words ("red", "enormous", "quiet") | "Am I leaning on description instead of precision?" |
| 2 | **Nouns** | People, places, things, concepts | "What's my structure — and what am I repeating?" |
| 3 | **Adverbs** | Words modifying verbs/adjectives ("quickly", "very") | "Am I propping up weak verbs?" |
| 4 | **Verbs** | Actions and states ("run", "is", "became") | "Are my verbs active or limp?" |
| 5 | **Conjunctions** | Joining words ("and", "but", "or", "so") | "Are my sentences running on?" |

Plus a sixth, open-ended kind:

- **Custom word lists.** The writer can define their own lists of words or phrases (e.g.
  corporate jargon, weasel-words, or character names) and assign **each list its own
  color**. These are arbitrary and unbounded — a writer might have zero, or might have
  six. They sit alongside the five grammatical colors and can override them where they
  overlap.

---

## How it works — conceptually

1. A small **grammar engine** reads the text and labels each word's part of speech. It's
   rule-based (not AI), runs **locally and instantly** as you type, and handles English.
   The writer never configures it; it just knows that "quiet" is an adjective and "ran"
   is a verb.
2. Each label is mapped to a color, and the matching words are painted that color.
   **That's the entire visual treatment** — colored text on the normal page background.
3. Things that aren't prose are **left untouched**: code blocks, inline code, the
   document's frontmatter/metadata, math, and table headers all keep their normal color.
   So the colors only ever appear on actual sentences.

---

## When & where it shows up

- **Off by default.** It's an opt-in lens, enabled in settings or via a "Toggle prose
  highlighting" command.
- **In the editor** (the normal typing/writing view) whenever it's on.
- **In reading view** *only* if a **second, separate toggle** is also on. So a writer can
  have it while drafting but a clean preview, or both.
- **Each of the five categories toggles independently.** This is important for color
  design: the writer might display only verbs, only nouns, or all five at once. So the
  colors must work **alone** and **all together** — anywhere from one to five (plus any
  custom lists) appearing in the same paragraph, interleaved word by word.
- **It never reaches PDF or print.** On export the colors are deliberately stripped —
  every word returns to normal ink. This is strictly a *screen-based editing aid*, so the
  colors never have to survive on paper or in a shared document.

### One adjacent feature worth knowing about

There's a separate **"focus mode"** that dims everything except the current sentence or
paragraph, fading the rest to a faint gray. It's a *different* feature, but it **can be on
at the same time** as prose highlighting. That means the color palette has to coexist with
a "dimmed / faint" state without the dimmed words being mistaken for one of the five
highlight colors (and vice-versa).

---

## The current palette (raw material — not a recommendation)

The feature ships two variants of each color, one tuned for light backgrounds and one for
dark. The dark variants are noticeably **lighter and more saturated** (lifted to sit on a
dark page). These are the *current* values, provided as a starting point — every one is
open to redesign.

| Category | Light background | Dark background | Rough hue |
|----------|------------------|-----------------|-----------|
| Adjective | `#b97a0a` | `#f0b150` | amber / ochre |
| Noun | `#ce4924` | `#e87a5f` | red-orange / terracotta |
| Adverb | `#c333a7` | `#e07cc8` | magenta |
| Verb | `#177eb8` | `#5cb0e8` | blue |
| Conjunction | `#01934e` | `#4cc887` | green |

Two more color-bearing pieces:

- **Custom word-list default:** `#666666` (mid-gray) until the writer picks a color.
- **Focus-mode dim:** has its own light/dark override knobs, but defaults to the editor
  theme's "faint text" color rather than a value of its own.

---

## Constraints the tokens must satisfy

These are properties of the *use case* — facts the colors have to live with, regardless of
which hues the design system lands on:

1. **Foreground text color only.** No backgrounds, no underlines — the color is applied to
   the letters of body-sized words. Legibility-as-text is the bar, not
   legibility-as-a-label.
2. **Up to five appear simultaneously**, interleaved word-by-word inside a single
   paragraph. They must be **mutually distinguishable at reading speed**, not just side by
   side in a legend.
3. **No hierarchy among the five.** They're categorical peers, not a sequence or a
   good→bad scale. The palette shouldn't imply one category is "more important" or "more
   wrong" than another.
4. **Two backgrounds, always.** Every category needs a light-page variant and a dark-page
   variant. (The host design system is dark-first, so the dark variants are the primary
   case.)
5. **Must coexist with a faint/dimmed state** (focus mode) without confusion between
   "dimmed-out word" and "a real highlight color."
6. **Arbitrary extra colors are possible.** Writer-defined word lists add their own colors
   on top of the five, so the five system hues aren't guaranteed to be the only colors on
   screen.
7. **Distinguishability under color-vision deficiency is in play** — five hues on running
   text is exactly the case where red/green or similar pairs can collapse for some readers.
8. **Disposable on export.** The colors never have to render in print/PDF, so they're free
   to be screen-optimized.

---

## Reference — names, for mapping into the token system

- **Resolved color variables:** `--yaae-pos-adjective-color`, `--yaae-pos-noun-color`,
  `--yaae-pos-adverb-color`, `--yaae-pos-verb-color`, `--yaae-pos-conjunction-color`
- **Theme-author override knobs:** the same names with `-light` / `-dark` suffixes (e.g.
  `--yaae-pos-noun-color-light`, `--yaae-pos-noun-color-dark`)
- **Dim state:** `--yaae-dimmed-color` (with `-light` / `-dark` knobs)
- **CSS classes on the words:** `.yaae-pos-adjective`, `.yaae-pos-noun`,
  `.yaae-pos-adverb`, `.yaae-pos-verb`, `.yaae-pos-conjunction`, and `.yaae-list-{name}`
  for custom lists
