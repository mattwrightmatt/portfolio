---
name: add-coffee-note
description: >-
  Add a personal tasting note to a coffee on the Espresso page (espresso.html).
  Use this whenever the user says "add a note", "add a tasting note", wants to
  jot down an impression of the coffee they're drinking right now, or record a
  thought/observation about a recent coffee. The flow: show the 5 most recent
  coffees, let the user pick one, then unhide that card's next note slot and drop
  in their text. Trigger even when they don't mention "espresso", the roaster, or
  a coffee name — in this repo, "add a note" means a coffee tasting note.
---

# Add a coffee tasting note

A quick-add flow for dropping a personal tasting note onto a coffee. The user is
usually drinking the coffee *now* and wants to capture a thought without hunting
for the entry — so the whole point is to make picking the coffee and adding the
note effortless.

Every coffee card is the shared **coffee card component** (documented on the
design-system page, `system.html`, styles in `css/index.css`). The part that
matters here: each card already contains **seven `.notes` slots** — the ones in
use are visible, the rest sit `hidden` with placeholder text "Notes". Adding a
note is therefore just *unhiding the next slot and replacing its text*. There's
no wrapping, nesting, or new markup to author — that structure is what keeps this
safe and simple (an earlier hand-nested approach once swallowed a whole year's
cards into one; the component exists so that can't happen again).

## The flow

### 1. Show the 5 most recent coffees

"Most recent" is just document order: `espresso.html` lists the newest year
first and the newest coffee at the top of each year. So the 5 most recent are the
**first 5 `.card.coffee` entries in the file** — no date parsing needed.

Read the coffee names (`.coffee-name`) and roaster (`.coffee-roaster` link) for
the first five cards and present a short numbered list so the user can pick with
one number:

```
Which coffee is the note for?
1. Kirinyaga AA, Kenya — Sterling Coffee Roasters
2. Finca La Unica, Honduras — Alma Coffee
3. Kenya Mihuti — Tony's Coffee
4. Mexico Chiapas — Tony's Coffee
5. West Guji, Ethiopia — Naomi Joe
```

If the user already named the coffee ("add a note to the Kenya Mihuti…"), skip
the list and go straight to that card. If they gave the note text in the same
breath, skip the next step too and just add it.

### 2. Get the note

If they haven't provided it, ask for the note text. Add it in the user's own
voice — this is their tasting journal, not marketing copy. Preserve their wording;
only fix an obvious typo. Don't invent or embellish flavors they didn't mention.

### 3. Unhide the next note slot

In the chosen card, find the **first** slot of the form:

```html
			<div class="notes" hidden>Notes</div>
```

Unhide it and replace its placeholder with the note — a single edit that changes
nothing structural:

```html
			<div class="notes">Tasting cherry and a bit of black tea today.</div>
```

Because that exact `hidden` slot line repeats (across this card and others), anchor
your edit on the **line just above the first hidden slot** so the match is unique
to this card. That preceding line is either the card's last *visible* note or, if
the card has none yet, its `Roaster's notes:` row (each carries text unique to the
coffee). For example, adding the first note to a card that has none:

Before:
```html
			<div class="cd-line cd-roaster-notes">Roaster's notes: Stone fruit, blueberry, nougat</div></div>

			<div class="notes" hidden>Notes</div>
```
After:
```html
			<div class="cd-line cd-roaster-notes">Roaster's notes: Stone fruit, blueberry, nougat</div></div>

			<div class="notes">Bright and juicy — really nice as a light roast.</div>
```

Leave the remaining `hidden` slots as they are. The CSS handles everything else:
the first visible note makes the details grow its dividing rule, and note spacing
is automatic. (In the rare case a card has already filled all seven slots — only
the busiest coffee is close — add one more `<div class="notes">…</div>` right after
the last visible note, still inside the `.expand` wrapper.)

### 4. Confirm

A `.notes` div is visible in List view (the Espresso page opens in Map view, so
switch views if you want to eyeball it). Tell the user which coffee got the note
and show the text you added, so they can catch any wording they'd change.

### 5. Committing

The user keeps this site's changes on `main` (the live site deploys from it).
After adding a note, offer to commit and push, or just do it if they've made that
preference clear — mirror how they've been working. Keep the commit message about
the note that was added.
