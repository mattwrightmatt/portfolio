---
name: add-coffee
description: >-
  Add a brand-new coffee to the Espresso page (espresso.html) from a photo of the
  bag. Use this whenever the user shares a picture of a coffee bag, or says "add
  this coffee", "I just got a new bag", "log this coffee", "put this on the
  espresso page / the map", or otherwise wants a new coffee entry created. The
  flow: read the bag → research the roaster, origin, and specs → create a card at
  the top of the current year → make sure it gets a pin on the map. Trigger even
  if they only send a photo with little or no text — a coffee-bag photo means
  "add this coffee."
---

# Add a coffee from a bag photo

The point of this skill is to make logging a new coffee effortless: the user
snaps the bag, and you turn it into a correct, fully-researched entry that shows
up in the list, sorts into the right place, and drops a pin on the map. It ties
together three things you already have — reading the bag, the `coffee-research`
skill (the source of truth for specs, card schema, and formatting), and the map's
pin logic.

Read `.claude/skills/coffee-research/SKILL.md` first — it owns the golden rule
(**never fabricate**), the card component anatomy, the detail-line schema, and
the filter/chip rules. This skill adds the parts specific to a *new* coffee from a
photo: reading the bag, ordering it into the year, and the map pin.

## 1. Read the bag

From the photo, pull whatever the bag actually prints — don't guess:

- **Roaster** (usually the logo/brand) and the **coffee name** (often a producer,
  farm, region, or a blend name).
- Any specs on the bag: **origin** (country · region · producer), **process**,
  **variety**, **elevation**, and the roaster's **tasting notes**.
- Whether it's a **blend** (no single origin/variety) or a single origin.

If the photo is unreadable or ambiguous (glare, partial text, two coffees in
frame), say what you can and can't make out and ask the user to confirm the
roaster + name rather than guessing. A wrong identification poisons the whole
entry.

## 2. Research the specs

Follow the `coffee-research` workflow: `WebSearch` for
`"<Roaster> <Coffee name> elevation variety <process>"`, confirm you've got the
**right lot** (tasting-note / producer / region match — names get reused across
seasons), and prefer the roaster's own page. Fill only what you can confirm;
leave a field out rather than inventing it. The bag itself is a primary source —
trust what it prints, and use research to fill the gaps (e.g. elevation the bag
omits) and to enrich a bare origin (`Ethiopia` → `Hambela Wamena · Guji`).

## 3. Create the card in the right place

New coffees join the **current year**, newest at the top. Today's year is the
first `<p class="year">` in the file; its `.year-section` is where the card goes,
as the **first** `.card.coffee` in that section.

Build the card with the shared component markup (copy the anatomy from
`coffee-research`), and get these right:

- **Ordering attributes.** Set `data-year="<current year>"` and
  `data-position="1"` on the new card, then **increment `data-position` by 1 on
  every other card already in that year** — the new one is now the newest, so
  everything below it shifts down one. (These aren't shown, but they're the record
  of newest-to-oldest order for sorting, so keeping them consistent matters.)
  If the current year has no `.year-section` yet, add one (`<div
  class="year-section"><p class="year">YEAR</p>…`) above the previous year and
  start it at position 1.
- **Filter attributes.** `data-fav="false"` (unless the user calls it a
  favorite — then `data-fav="true"`, and the marquee is injected automatically
  from `data-year`, no banner markup), plus `data-origin` / `data-process` /
  `data-roaster` / `data-cat` / `data-varietal`. A brand-new roaster, origin,
  process, or variety value must also be **added to that filter's chip menu** or
  it won't be filterable — see `coffee-research`. **The user is always trying new
  coffees, so new processes/varieties/origins/roasters are expected — just add
  the chip option as a normal part of the job; it's not a decision to flag or ask
  about.** Keep each menu in its existing order (Varietal is alphabetical; Process
  is loosely grouped by family, so slot a new one next to its relatives).
- **Detail rows + notes.** Fill the six `.cd-line` rows you have (hide the rest),
  give `.coffee-details` a fresh unique `id`, and include the seven `.notes`
  slots all `hidden` — the user adds tasting notes later via `add-coffee-note`.

## 4. Put it on the map

A card only gets a pin if `coordFor()` in `js/map.js` can resolve its location.
It tries, in order:

1. **`REGIONS`** — a list of `[substring, [lng, lat]]`, matched (lowercased,
   specific-first) against the card's `Origin:` line.
2. **`COUNTRY`** — a `{ country: [lng, lat] }` fallback keyed by the first
   `data-origin` value.

So for the new coffee:

- **If its country is already in `COUNTRY`** and you don't need a precise spot,
  you're done — it'll pin (and cluster with nearby coffees at the country point).
- **For a more precise pin**, add a `REGIONS` entry using a distinctive substring
  from the `Origin:` line (a producer, farm, or region name — lowercase) with the
  region's `[lng, lat]`. Put more-specific substrings before broader ones, since
  the first match wins.
- **If the country is new** (not in `COUNTRY`), add it to `COUNTRY` with an
  approximate coffee-growing-region coordinate, or the pin won't appear at all.

Coordinates are **`[longitude, latitude]`** (note the order), roughly the growing
region's centroid — country points ~1 decimal, region points ~2. Look the region
up if unsure; a pin a bit off is better than none, but get the country/hemisphere
right.

## 5. Verify and commit

Confirm it actually worked before calling it done — this touches the list, the
filters, and the map at once:

- List view: the new card renders at the top of its year with the right details.
- Filters: any new chip option you added filters to the new card.
- Map view: switch to it and confirm a pin resolves for the coffee (the Espresso
  page opens in Map view; a coffee with no coordinate silently gets no pin, so
  check). Driving it in a browser is the reliable check.

Then tell the user what you added (roaster, name, origin, and where it pinned),
and — matching how they work — offer to commit and push to `main`, or just do it.
Keep the commit message about the coffee that was added.
