---
name: add-coffee-note
description: >-
  Add a personal tasting note to a coffee on the Espresso page (espresso.html).
  Use this whenever the user says "add a note", "add a tasting note", wants to
  jot down an impression of the coffee they're drinking right now, or record a
  thought/observation about a recent coffee. The flow: show the 5 most recent
  coffees, let the user pick one, then insert their note into that card. Trigger
  even when they don't mention "espresso", the roaster, or a coffee name — in
  this repo, "add a note" means a coffee tasting note.
---

# Add a coffee tasting note

A quick-add flow for dropping a personal tasting note onto a coffee on the
Espresso page. The user is usually drinking the coffee *now* and wants to
capture a thought without hunting for the entry themselves — so the whole point
is to make picking the coffee and adding the note effortless.

This skill is the note-*adding* companion to the `coffee-research` skill. That
skill is the source of truth for the full card schema; this one only touches the
personal `.notes` and the `.expand` wrapper. When in doubt about card markup,
read `.claude/skills/coffee-research/SKILL.md`.

## The flow

### 1. Show the 5 most recent coffees

"Most recent" is just document order: `espresso.html` lists the newest year
first and, within a year, the newest coffee at the top. So the 5 most recent are
the **first 5 `.card.coffee` entries in the file** — no date parsing needed.

Read the coffee names (the `.coffee-name` span) and the roaster (the `<a>` right
after it) for the first five cards, and present them as a short numbered list so
the user can pick with a single number:

```
Which coffee is the note for?
1. Kirinyaga AA, Kenya — Sterling Coffee Roasters
2. Finca La Unica, Honduras — Alma Coffee
3. Kenya Mihuti — Tony's Coffee
4. Mexico Chiapas — Tony's Coffee
5. West Guji, Ethiopia — Naomi Joe
```

If the user already named the coffee in their opening message ("add a note to
the Kenya Mihuti…"), skip the list and go straight to that card — don't make
them pick from a list they didn't need. Likewise, if they already gave the note
text in the same breath, skip step 2's question and add it.

### 2. Get the note

If they haven't already provided it, ask for the note text. Add it in the user's
own voice — this is their tasting journal, not marketing copy. Preserve their
wording and phrasing; only fix an obvious typo. Don't invent or embellish
flavors they didn't mention.

### 3. Insert the note

A note lives in a `<div class="notes">…</div>`. How you add it depends on
whether the card already has personal notes:

**Case A — the card has no notes yet.** Its `.coffee-details` is a direct child
of the card (the CSS `.coffee > .coffee-details` drops the bottom border for
this case). You need to wrap the details in an `.expand` container and add the
note inside it. Match the surrounding tab indentation exactly.

Before:
```html
	<div class="coffee-details" id="details-17"><div>Origin: Kirinyaga, Kenya</div>
	<div>Process: Washed</div>
	<div>Roaster's notes: Grapefruit, plum</div></div>
	</div>
```
After:
```html
	<div class="expand">
	<div class="coffee-details" id="details-17"><div>Origin: Kirinyaga, Kenya</div>
	<div>Process: Washed</div>
	<div>Roaster's notes: Grapefruit, plum</div></div>

	<div class="notes">Tasting grapefruit tartness. Pulled a 1:2.5 shot and getting a bit more sweetness and body</div>
	</div>
	</div>
```
The `.expand` wrapper opens before `.coffee-details`, the note goes after it with
a blank line between, and a new closing `</div>` for `.expand` sits just inside
the card's own closing `</div>`.

**Case B — the card already has notes.** It already has an `.expand` wrapper with
one or more `.notes` divs. Just append another `.notes` div immediately after the
last existing one (still inside `.expand`). The CSS `.notes + .notes` handles the
spacing between stacked notes automatically, so no extra blank line is needed
between them.

```html
	<div class="notes">Existing note…</div>
	<div class="notes">The new note you're adding</div>
	</div>
```

Never put a note inside `.coffee-details` (that block is the factual, toggleable
research data and is hidden by default) — notes always sit *outside* it.

### 4. Verify and confirm

The details block is hidden until the page's **Details** toggle is on, but a
`.notes` div is always visible in List view. If you want to confirm the render,
note that the Espresso page **defaults to Map view**, which hides the card list —
switch to List view first (the top-right view toggle) before checking that the
note shows. A quick read-back of the edited card is usually enough.

Tell the user which coffee got the note and show the text you added, so they can
catch any wording they'd change.

### 5. Committing

The user has been keeping this site's changes on `main` (the live site deploys
from it). After adding a note, offer to commit and push, or just do it if
they've made that standing preference clear — mirror how they've been working
rather than assuming. Keep the commit message about the note that was added.
