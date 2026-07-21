---
name: coffee-research
description: >-
  Research and add/enrich coffee entries on the Espresso page (espresso.html) so
  the dataset stays consistent across all years. Use when asked to add a coffee,
  fill in elevation/variety/origin details, research a roaster's coffee, or
  reconcile the filters. Covers the card schema, detail-line order, formatting
  conventions, the research workflow, and how to keep the filter chips in sync.
---

# Coffee research & data entry

The Espresso page (`espresso.html`) is a hand-maintained dataset of coffees I've
brewed, grouped by year, with client-side filters. This skill is the single
source of truth for **how to research a coffee and write it out** so every
entry — past or future — reads as one consistent dataset.

## Golden rule: never fabricate

Elevation, variety, region, and producer are **factual**. Only write a value
you found from a real source that clearly matches *this specific coffee/lot*.
If you can't confirm it, leave the field out. A sparse-but-correct entry is
always better than a full-but-wrong one. Blends legitimately have no single
elevation or variety — omit those fields for blends.

## Anatomy of a coffee card

Every card is the shared **coffee card component** (documented on `system.html`,
styles in `css/index.css`). It has one fixed skeleton — don't improvise markup:

```html
<div class="card coffee" data-fav="false" data-year="2025" data-position="4"
     data-origin="Ethiopia" data-process="Natural" data-roaster="Perc Coffee"
     data-cat="fruit citrus floral" data-varietal="Heirloom">
<p><span class="coffee-name">Benti Nenka, Ethiopia</span><span class="coffee-roaster"><br>
<a href="URL">Perc Coffee</a></span></p>

<div class="expand">
<div class="coffee-details" id="details-103"><div class="cd-line cd-origin">Origin: Hambela Wamena · Guji, Ethiopia</div>
<div class="cd-line cd-process">Process: Natural</div>
<div class="cd-line cd-elevation">Elevation: 1,900–2,250 MASL</div>
<div class="cd-line cd-variety">Variety: Heirloom</div>
<div class="cd-line cd-special" hidden>Special</div>
<div class="cd-line cd-roaster-notes">Roaster's notes: Blueberry, super fruity</div></div>

<div class="notes">My tasting note…</div>
<div class="notes" hidden>Notes</div>
<!-- …seven .notes slots in total; unused ones stay hidden with the "Notes" text -->
</div>
</div>
```

- **Every card has all six detail rows** in this fixed order — `cd-origin`,
  `cd-process`, `cd-elevation`, `cd-variety`, `cd-special`, `cd-roaster-notes` —
  and **seven `.notes` slots**. Fill the rows this coffee has; leave the rest
  `hidden` (keep their placeholder text). Don't reorder, rename, or delete slots.
- `cd-special` is for a rare one-off line (e.g. `Rotating seasonal blend`,
  `Good Food Award winner`) — normally hidden.
- **Adding a personal note** = unhide the next `.notes` slot and replace its
  "Notes" text. The `add-coffee-note` skill does exactly this.
- **Favorites** are just `data-fav="true"` — don't paste any banner markup.
  `js/coffee-card.js` injects the `.fav-marquee` ribbon on load and stamps it with
  the card's `data-year` (`one of my favorites from <YEAR>`).
- **`data-year` + `data-position`** are on every card. `data-position` is the
  coffee's index within its year, **1 = newest (top)**. Together they record the
  current newest-to-oldest order for future sorting — set them when adding a
  coffee (see below). They aren't displayed.
- Detail rows show inline; empty rows are hidden individually via `hidden`.

## Filter attributes (on the card `<div>`)

| Attribute       | Meaning                    | Separator | Notes |
|-----------------|----------------------------|-----------|-------|
| `data-fav`      | `"true"` / `"false"`       | —         | favorites |
| `data-origin`   | country/countries          | `\|`      | blends list each, e.g. `Ethiopia\|Colombia` |
| `data-process`  | one process                | —         | must match a Process chip value |
| `data-roaster`  | exact roaster name         | —         | must match a Roaster chip value |
| `data-cat`      | tasting-note buckets       | space     | keywords: `choc fruit citrus floral nutty sweet spice` |
| `data-varietal` | variety/varieties          | `\|`      | must mirror the `Variety:` detail line |

Every chip menu in the `.filters` block is hardcoded. **If you introduce a new
origin / process / roaster / varietal value, add it to that chip's menu** or it
won't be filterable. The user is always trying new coffees, so new values are
routine — add them confidently, no need to ask. Keep each menu in its existing
order: Origin / Roaster / Varietal are alphabetical; the Process menu is loosely
grouped by family (e.g. the Natural/Honey styles sit together), so place a new
process next to its relatives rather than strictly alphabetically.

## Detail-line schema & order

Inside `.coffee-details`, each fact is a `<div class="cd-line cd-<field>">` row.
The six rows are always present in this fixed order; a coffee that lacks a fact
keeps that row but marks it `hidden` (with its placeholder label), so it
collapses. Fill the ones you have:

1. `cd-origin` — `Origin: <Producer/Farm · Region, Country>` — most specific
   first. Use the middle dot `·` (U+00B7) to separate producer/region/qualifiers.
   If only the country is known, that's fine.
2. `cd-process` — `Process: <…>`.
3. `cd-elevation` — `Elevation: <N MASL>` — see formatting below.
4. `cd-variety` — `Variety: <V1, V2, …>` — comma-separated.
5. `cd-special` — any one-off line (e.g. `Good Food Award winner`,
   `Rotating seasonal blend`); hidden when there isn't one.
6. `cd-roaster-notes` — `Roaster's notes: <…>` — always **last**.

To fill a hidden row, remove its `hidden` attribute and replace the placeholder
with the real `Label: value` text. Don't move rows out of this order.

Do **not** include a roast date. (Those were intentionally removed.)

### Formatting conventions

- Elevation: `1,400 MASL`, a range with an en dash `1,900–2,250 MASL`
  (U+2013, not a hyphen), or `~2,000 MASL` / `1,700+ MASL` when a source is
  approximate. Thousands use a comma. Occasionally a source only gives feet:
  `5,900 ft` is acceptable.
- Variety spelling is normalized: use **`Typica`** (not "Típica"), `Catuaí`
  (with the accent), `Red Bourbon`, `Ruiru 11`, `SL28`/`SL34`. Ethiopian
  landrace lots are `Heirloom`; JARC selections are written as their numbers
  (`74110, 74112`). Match an existing spelling before inventing a new chip.
- Curly quotes in roaster's-notes quotations are fine (copy the roaster's).

## Research workflow

1. **Search**, don't fetch. Most roaster sites (Shopify) return 403 to the
   fetcher, but `WebSearch` works and usually synthesizes the specs. Query:
   `"<Roaster> <Coffee name> elevation variety <process>"`.
2. **Confirm you have the right lot** before trusting numbers. The strongest
   signal is a **tasting-note match** between the search result and the card's
   existing `Roaster's notes`. Producer/region/process matches also help.
   Coffees are seasonal — a roaster reuses a name across lots, so a bare name
   match is not enough.
3. **Prefer the roaster's own data.** Cross-listers (Trade, Crema, GoCoffeeGo)
   echo it, but importer pages (Royal, Ally) and *other* roasters may describe a
   different lot — don't borrow their variety/elevation unless it's the same lot.
4. **Record only what's confirmed.** Add `Elevation`/`Variety` lines and enrich
   a bare `Origin` (e.g. `Ethiopia` → `Hambela Wamena · Guji, Ethiopia`) when
   confident. Skip when not.
5. **Sync the card + filter.** After adding a `Variety:` line, set the card's
   `data-varietal` to the same values (`|`-joined) and make sure each value
   exists in the Varietal chip menu.

## Adding a brand-new coffee

- Place it at the **top** of its year's `.year-section` (newest first). If the
  year has no section yet, add a new `<div class="year-section"><p class="year">YEAR</p>…`.
- Set `data-year` to that year and `data-position="1"` on the new card, and
  **bump every existing card in that year's `data-position` up by one** (the new
  one is now the newest). This keeps the sort order intact.
- Give `.coffee-details` a fresh unique `id="details-N"`.
- Fill `data-origin/process/roaster/cat/varietal` and add any new chip-menu
  options. Then research elevation/variety per the workflow above.
- For a favorite, just set `data-fav="true"` — the banner is injected from
  `data-year`; don't paste marquee markup.

## Handy re-sync script

If several `Variety:` lines change, re-derive every `data-varietal` and rebuild
the Varietal menu from the source of truth (the detail lines) rather than by
hand — walk each `.card.coffee`, read its `Variety:` line, rewrite its
`data-varietal`, collect the distinct set, and regenerate the menu labels
(alphabetical). Verify afterward in a browser: the page must have no console
errors, empty detail rows and unused note slots still hidden, and the new chips
must filter.
