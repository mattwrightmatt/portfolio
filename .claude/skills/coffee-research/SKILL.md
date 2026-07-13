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

```html
<div class="card coffee" data-fav="false" data-origin="Ethiopia"
     data-process="Natural" data-roaster="Perc Coffee" data-cat="fruit citrus floral"
     data-varietal="Heirloom">
<p><span class="coffee-name">Benti Nenka, Ethiopia</span> from <a href="URL">Perc Coffee</a><br>
Natural Process</p>

<div class="expand">                                  <!-- only when there are personal notes -->
<div class="coffee-details" id="details-103" hidden><div>Origin: Hambela Wamena · Guji, Ethiopia</div>
<div>Elevation: 1,900–2,250 MASL</div>
<div>Variety: Heirloom</div>
<div>Roaster's notes: Blueberry, super fruity</div></div>

<div class="notes">My tasting note…</div>          <!-- 0+ personal notes -->
</div>
</div>
```

- **No personal notes?** Drop the `.expand` wrapper — `.coffee-details` becomes a
  direct child of `.card` (the CSS handles the border difference).
- Favorites additionally get a `.fav-marquee` banner as the card's first child
  and `data-fav="true"` (see an existing favorite to copy the exact markup;
  banner text is `one of my favorites from <YEAR>`).
- The whole `.coffee-details` block is `hidden` by default and revealed all at
  once by the page's **Details** toggle.

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
origin / process / roaster / varietal value, add it to that chip's menu** (kept
alphabetical) or it won't be filterable.

## Detail-line schema & order

Inside `.coffee-details`, each fact is its own `<div>`. Use this order, omitting
any line you don't have:

1. `Origin: <Producer/Farm · Region, Country>` — most specific first. Use the
   middle dot `·` (U+00B7) to separate producer/region/qualifiers. If only the
   country is known, that's fine.
2. `Elevation: <N MASL>` — see formatting below.
3. `Variety: <V1, V2, …>` — comma-separated.
4. Any special one-off line already present (e.g. `Good Food Award winner`,
   `Rotating seasonal blend`) — keep it in place, before the notes.
5. `Roaster's notes: <…>` — always **last**.

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
- Give `.coffee-details` a fresh unique `id="details-N"`.
- Fill `data-origin/process/roaster/cat/varietal` and add any new chip-menu
  options. Then research elevation/variety per the workflow above.

## Handy re-sync script

If several `Variety:` lines change, re-derive every `data-varietal` and rebuild
the Varietal menu from the source of truth (the detail lines) rather than by
hand — walk each `.card.coffee`, read its `Variety:` line, rewrite its
`data-varietal`, collect the distinct set, and regenerate the menu labels
(alphabetical). Verify afterward in a browser: the page must have no console
errors, details still hidden by default, and the new chips must filter.
