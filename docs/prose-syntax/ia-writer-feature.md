# iA Writer — Syntax Highlight & Style Check

iA Writer's two headline editing features — **Syntax Highlight** and **Style Check** —
treat prose the way an IDE treats code. Neither feature modifies content; they are
visual-only aids that disappear in Preview, export, and print.

## Syntax Highlight

Introduced in 2013 as "Syntax Control" (renamed "Syntax Highlight" in later versions),
this feature color-codes words by their grammatical part of speech so you can spot
structural patterns at a glance.

### Parts of Speech & Colors

| Part of Speech | Default Color | Hex | What It Reveals |
|---------------|--------------|-----|-----------------|
| Adjectives | Amber/Brown | `#b97a0a` | Bloated descriptions, purple prose |
| Nouns | Red | `#ce4924` | Repetition, nominal style |
| Adverbs | Purple | `#c333a7` | Weak modifiers, telling-not-showing |
| Verbs | Blue | `#177eB8` | Weak verbs ("to be"), passive voice |
| Conjunctions | Green | `#01934e` | Illogical connections, run-on sentences |

Users can toggle each part of speech independently. Showing only adverbs hunts for
filler; showing only verbs surfaces passive voice. The feature does not highlight
pronouns, prepositions, determiners, or interjections.

### Why Each Category Matters

**Adjectives & adverbs** — Strunk & White: "Write with nouns and verbs, not with
adjectives and adverbs. The adjective hasn't been built that can pull a weak or
inaccurate noun out of a tight place." iA's position is not that adjectives are
inherently bad, but that *unnecessary* ones are. Master writers use adjectives that
carry meaning; amateurs spray them for decoration.

**Verbs** — Weak verbs ("is", "was", "has been") often signal passive voice or
nominal style. Highlighting all verbs in blue makes it immediately obvious when a
passage is dominated by forms of "to be" rather than active, concrete verbs.

**Nouns** — Coherent writing naturally reuses key nouns. Highlighting them reveals the
nominal structure of a passage and surfaces unwanted repetition.

**Conjunctions** — Coordinating conjunctions ("but", "and", "or", "yet", "so") join
clauses. They seem harmless but can ruin a text when they create illogical connections
or mask run-on sentences.

### Language Support

Syntax Highlight supports English, French, German, Italian, and Spanish.
On Windows, only English is supported.

---

## Style Check

A companion feature to Syntax Highlight that flags stylistic weaknesses. Where Syntax
Highlight colors parts of speech, Style Check *grays out and strikes through* suspect
words and phrases.

### Visual Presentation

- Flagged text is **grayed out** and shown with a **strikethrough**
- Double-click/tap a flagged phrase to select it for easy removal
- Suggestions are visual only — they do not appear in Preview, export, or print
- No text is deleted automatically; the writer decides what to keep

### Three Categories

#### 1. Filler Words
Unnecessary words that pad sentences without adding meaning. Examples include
"really", "very", "just", "basically", "actually", "literally", "quite", "rather",
"somewhat". Multi-word fillers like "as well as" are also flagged. iA's position:
sometimes you need fillers for rhythm, but most of the time they weaken your writing.

#### 2. Redundancies
Phrases where one word's meaning already includes the other:
- "completely finished" → "finished"
- "added bonus" → "bonus"
- "end result" → "result"
- "free gift" → "gift"
- "past history" → "history"

#### 3. Clichés
Overused expressions that weaken writing. Orwell: "Never use a metaphor, simile, or
other figure of speech which you are used to seeing in print." Examples:
- "at the end of the day"
- "think outside the box"
- "low-hanging fruit"
- "move the needle"

iA's position: unlike fillers, there are rarely good reasons to keep clichés.

### Custom Patterns

Users can create exceptions or new rules via Settings → Style Check → Custom Patterns.
A subset of regex is supported (limited to avoid slowing down editing). This lets
writers adapt Style Check to their voice.

### Language Support

Style Check supports English, French, Spanish, and German on Mac/iOS.
On Windows: English, French, and German. On Android: English, French, and German.

---

## Technical Implementation (How iA Does It)

### The NLP Pipeline

On Apple platforms, Syntax Highlight is built on **`NSLinguisticTagger`** (now
`NLTagger` in Apple's Natural Language framework):

1. **Text input** → editor text is passed to Apple's on-device NLP framework
2. **Tokenization** → text is split into word tokens
3. **POS tagging** → each token is classified (noun, verb, adjective, etc.) using
   on-device ML models (Hidden Markov Models, CRFs, or neural models)
4. **Color mapping** → iA Writer maps POS tags to colors and renders inline

All processing runs on-device (no network calls). Apple's NLP framework supports the
`lexicalClass` tag scheme which classifies tokens by part of speech, punctuation type,
and whitespace type.

### History & The Patent Controversy

In December 2013, iA launched "Writer Pro" with Syntax Control and attempted to patent
the feature. Developers quickly pointed out the feature was a thin wrapper around
Apple's `NSLinguisticTagger` API (available since iOS 5 / OS X 10.7) and could be
reproduced in ~80 lines of code. iA dropped the patent application in January 2014.

The innovation was never the NLP — it was the *editorial application*: the insight that
code-style syntax highlighting could be applied to natural prose as a writing aid.

### Known Limitations

- POS tagging is not perfect. "Open" might be tagged as a noun when it's clearly a
  verb (context-dependent ambiguity).
- Works best in English; accuracy varies by language.
- Style Check's word lists are built into the app and not publicly documented.

---

## Sources

- [Syntax Highlight — iA Support](https://ia.net/writer/support/editor/syntax-highlight)
- [She's a Rainbow — iA Writer 3.1 blog post](https://ia.net/topics/ia-writer-3-1-comes-in-colors)
- [Using Parts of Speech to Improve Your Writing — iA](https://ia.net/topics/parts-of-speech)
- [Style Check — iA Support](https://ia.net/writer/support/editor/style-check)
- [The Power of Style Check — iA blog](https://ia.net/topics/introducing-style-check)
- [Style Check on Android — iA blog](https://ia.net/topics/style-check-on-android)
- [NSLinguisticTagger — Apple Developer](https://developer.apple.com/documentation/foundation/nslinguistictagger)
- [Natural Language Framework — Apple Developer](https://developer.apple.com/documentation/naturallanguage)
- [LinguisticTaggerDemo — Travis Jeffery (80 LOC reproduction)](https://github.com/travisjeffery/LingusticTaggerDemo)
- [iA Drops Syntax Control Patent — Marco.org](https://marco.org/2014/01/03/ia-drops-patent-internet-silent)
- [How I Use iA Writer Pro Syntax Control — Sayz Lim](https://sayzlim.net/editing-ia-writer-pro-syntax-control/)
