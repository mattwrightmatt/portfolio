# mattwright.design

Matt Wright's personal site. **Static, hand-authored HTML — no build step, no
framework.** Deploys to `mattwright.design` via GitHub Pages from `main` (the
`CNAME` file sets the domain). Three pages today: `index.html` (home/about),
`espresso.html` (the coffee page), `system.html` (the design system).

This file is the **shared context** every session should start from. Page- and
concern-specific detail lives in `.claude/streams/<name>/` — read a stream's
`context.md` before working in it.

---

## Two rules for every agent, every stream

**1. Update memory in the same commit as the work.** When you change something in
a stream, update that stream's `.claude/streams/<name>/memory.md` in the *same
commit*. Stale memory is worse than none. And **if a fact is true for more than
one page, it belongs in this file or in the design-system stream — never copied
into each page's docs.** Duplicated facts drift out of sync; put shared truth in
one place and let the streams point at it.

**2. The design system is the source of truth, and changes propagate globally.**
Components and tokens live in `css/index.css` (shared by every page) and are
demoed on `system.html`. Because the CSS is shared, **a change to a component or
token changes every page at once** — so evaluate any visual/component decision at
the *whole-site* scale, not just the page in front of you ("does this read right
everywhere it's used?"). When you add or change a component or token:
  - make the change in `css/index.css` (and its behavior JS if any),
  - update its demo on `system.html`,
  - update the `design-system` stream docs,
  - and sanity-check the other pages that use it.
Keep the design system prominent in your thinking whenever you touch anything
visual — surface the system-wide implications to the user rather than making a
one-off tweak that quietly diverges. If a change *should* be page-local, say so
explicitly and keep it out of the shared layer.

---

## Site-wide conventions

- **Deploy:** push to `main` → Pages rebuilds. There is no staging server (for a
  shareable preview, bundle a page into a self-contained Artifact — see the
  espresso stream for how the map/deps get inlined).
- **Cache-busting:** shared assets are referenced as `css/index.css?v=N`,
  `js/theme.js?v=N`, etc. **Bump `N` on every page that references an asset you
  changed**, or returning visitors get stale copies. (Currently at `v=7`.)
- **Verify visual changes in a browser before committing** — don't eyeball from
  the source. Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  and Playwright is global (`/opt/node22/lib/node_modules/playwright`); serve the
  repo with `python3 -m http.server` and drive it. Emulate `reducedMotion:
  'reduce'` to freeze the favorite marquee for deterministic screenshots. For
  "don't change anything visually" work, compare full-page screenshot hashes
  before/after.
- **Dark mode is automatic** via `prefers-color-scheme`; only the two color
  tokens (`--color-primary`, `--color-subdued`) flip and everything derives from
  them. Check both.
- **Font** is system `serif` (a Crimson Text phase was tried and dropped).
- **Match the surrounding code** — the files use tabs; follow existing patterns.
- **Commit + push to `main`** when work is done (that's how it ships). Branch
  first only for larger in-progress efforts.

## Work streams

Each has a brief (`context.md`) + a state log (`memory.md`) under
`.claude/streams/<name>/`. Read the context before working; update the memory in
the same commit (see rule 1).

| Stream | What | Key files |
|---|---|---|
| **espresso** | Coffee page: filterable list + interactive map, cards, dataset | `espresso.html`, `js/{map,coffee-card}.js`, `js/{d3,topojson}*`, `data/`, coffee skills |
| **design-system** | Shared tokens + components (the source of truth) | `css/index.css`, `system.html` |
| **site-chrome** | Home/about page + the site-wide theme toggle | `index.html`, `js/{theme,randoma11y}.js`, `CNAME`, favicon |

## Skills vs streams

`.claude/skills/` holds reusable **procedures** (how to add a coffee, add a
tasting note, research a lot). Streams hold **project state and decisions** (what
espresso is, what's done, what's next). A skill does the work; the stream
remembers the context. When a stream gains a repeatable data-entry task, consider
capturing it as a skill.
