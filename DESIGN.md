---
name: Amar Shohor
description: A warm public ledger for a city's broken things — bottle green on cool paper, ruled and annotated.
colors:
  ground: "#f5f6f4"
  surface: "#ffffff"
  surface-2: "#eef1ee"
  surface-3: "#e4e9e5"
  line: "#dfe4e0"
  line-2: "#c6cfc9"
  ink: "#16211c"
  ink-2: "#4a5a52"
  ink-3: "#74847b"
  ink-4: "#9aa8a0"
  accent: "#00694c"
  accent-hover: "#005440"
  accent-ink: "#ffffff"
  accent-wash: "#e4efea"
  accent-line: "#a9cfc0"
  ok: "#157f4a"
  ok-wash: "#e7f5ed"
  ok-line: "#a8d9bf"
  wait: "#8a5a0c"
  wait-wash: "#fdf3e2"
  wait-line: "#eed6a8"
  bad: "#b3261e"
  bad-wash: "#fdecea"
  bad-line: "#f0bfbb"
  info: "#3d5a73"
  info-wash: "#e7edf3"
  info-line: "#bdcedd"
  band-critical: "#a8321f"
  band-high: "#b5721a"
  band-medium: "#4a7a4e"
  band-low: "#6b7d86"
  series-reported: "#c2620f"
  series-resolved: "#2563a8"
  grid: "#e6eae7"
typography:
  display:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "27px"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "25px"
    fontWeight: 650
    lineHeight: 1.18
    letterSpacing: "-0.016em"
  title:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.016em"
  body:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-bengali:
    fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  label:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SF Mono', Consolas, monospace"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.1em"
  figure:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SF Mono', Consolas, monospace"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.06em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "20px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.accent-ink}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.bad-wash}"
    textColor: "{colors.bad}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
    height: "40px"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    width: "34px"
    height: "34px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  card-head:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    padding: "11px 16px"
  stat-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "42px"
  pill:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  pill-ok:
    backgroundColor: "{colors.ok-wash}"
    textColor: "{colors.ok}"
    rounded: "{rounded.pill}"
  pill-wait:
    backgroundColor: "{colors.wait-wash}"
    textColor: "{colors.wait}"
    rounded: "{rounded.pill}"
  pill-bad:
    backgroundColor: "{colors.bad-wash}"
    textColor: "{colors.bad}"
    rounded: "{rounded.pill}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  choice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  choice-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  nav-item-active:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  camera-fab:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "18px"
    width: "56px"
    height: "56px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "22px"
    padding: "11px 16px"
---

# Design System: Amar Shohor

## Overview

**Creative North Star: "The Public Ledger"**

This is a record book for a city's broken things, and it is meant to be read by the neighbour who
filed the entry. Every screen is an entry in a shared account: what was reported, how many people
reported it, what it scored and why, who took it, what changed and when. The monospace labels are
index tabs. The figures line up in columns because a column of numbers that does not line up is a
number nobody checks. The lifecycle timeline looks append-only because it *is* append-only — the
public record and the audit log are the same rows.

But a ledger does not have to be cold, and this one is not. The ink is a bottle green with warmth
in it, the paper is a cool off-white that carries a faint green bias toward the accent, and the
Bengali face is set with real leading rather than squeezed into a Latin scale. Warmth here comes
from plainness and care — a thumb-sized camera button, a face that respects the reader's script, a
resolved problem that stops shouting — not from ornament, illustration, or a friendly mascot
standing between the citizen and the record. The tone is a neighbourhood noticeboard kept
scrupulously, not a municipal counter with a glass window.

The confirmed anti-reference is the **government portal**: seals and crests, three shades of
institutional blue, table soup, PDF-shaped pages, Times New Roman doing the talking. This system
holds the opposite position — a public record can be exact *and* welcoming, and the way it earns
trust is by being legible to the person it is about.

**Key Characteristics:**

- One token layer drives light, dark and system; the map basemap swaps with the theme, so dark is
  a peer state rather than an option bolted on.
- Structure comes from 1px ruled borders and a three-step surface ramp. Three shadows exist in the
  whole application.
- Two type voices: Archivo carries reading and headings, IBM Plex Mono carries labels, references,
  counts and figures. Hind Siliguri carries Bengali at looser leading.
- State is carried in form as well as colour — the priority dot grows with the band, the severity
  scale looks like a scale, the score ring *is* the score.
- Three separate colour vocabularies that never borrow from each other: structural accent, issue
  lifecycle, priority band.

## Colors

A cool green-biased paper under a bottle-green ink, with three strictly separated colour
vocabularies laid over it and a deliberately non-status categorical pair for charts.

### Primary

- **Bottle Green** (`#00694c`, brightening to **Signal Mint** `#43c29a` in dark): the structural
  accent. Navigation active state, links, focus rings, the primary action, the camera button, the
  map cluster bubble, the ward boundary overlay. It marks *the way through the product*, never a
  status and never a decoration.
- **Bottle Green Deep** (`#005440`): the pressed and hovered state of a primary action only.
- **Green Wash** (`#e4efea`) and **Green Rule** (`#a9cfc0`): the accent at low volume — a selected
  chip, an active nav row, an issue row under the cursor, the focus glow on a field. Text on a wash
  is always the accent itself, never white.

### Secondary

The four lifecycle tones. These carry the issue's state and nothing else; using one because a
colour would look nice there is the single easiest way to break this system.

- **Settled Green** (`#157f4a`) with wash `#e7f5ed` and rule `#a8d9bf`: resolved, confirmed, done.
  Deliberately a different green from the accent — the accent means *go here*, this means *this is
  finished*.
- **Waiting Amber** (`#8a5a0c`) with wash `#fdf3e2` and rule `#eed6a8`: assigned, in progress, an
  SLA clock running down.
- **Refused Red** (`#b3261e`) with wash `#fdecea` and rule `#f0bfbb`: rejected, disputed, an error
  the citizen must see.
- **Record Blue** (`#3d5a73`) with wash `#e7edf3` and rule `#bdcedd`: neutral informational notes
  and the device's own location dot.

### Tertiary

The priority band ramp — a third vocabulary, because a problem can be *critical* and *resolved* at
the same moment and one colour cannot say both.

- **Band Critical** (`#a8321f`), **Band High** (`#b5721a`), **Band Medium** (`#4a7a4e`),
  **Band Low** (`#6b7d86`): the priority tag, the score ring's arc, the meter fill, the map pin's
  body.
- **Series Reported** (`#c2620f`) and **Series Resolved** (`#2563a8`): chart series only. These
  carry identity, not state, which is why they come from a categorical orange/blue pair.

### Neutral

- **Cool Paper** (`#f5f6f4`): the page ground. Faintly green-biased toward the accent so it reads
  as chosen rather than inherited from a framework default.
- **Surface** (`#ffffff`), **Surface Raised** (`#eef1ee`), **Surface Sunken** (`#e4e9e5`): the
  three-step ramp. Cards and sheets sit on Surface; card heads, table heads, hover states and the
  skeleton base take Surface Raised; segmented-control troughs, meter tracks and nav counters take
  Surface Sunken.
- **Rule** (`#dfe4e0`) and **Rule Strong** (`#c6cfc9`): the 1px lines that do the structural work.
  Rule divides; Rule Strong bounds an interactive control.
- **Deep Forest Ink** (`#16211c`), **Slate Ink** (`#4a5a52`), **Muted Ink** (`#74847b`),
  **Faint Ink** (`#9aa8a0`): body text, secondary prose, metadata and labels, and inert icons.

### Named Rules

**The Three Vocabularies Rule.** The accent is structural, the four lifecycle tones are semantic,
and the priority bands are a separate ramp. No token crosses. An accent-coloured status pill, or a
band colour used to mark a link, is a defect — not a variation.

**The Never-Only-In-The-Dark Rule.** No colour may have its only definition inside a
`prefers-color-scheme` block or a `[data-theme]` block. Every token is declared in full on bare
`:root` first; the dark blocks *redefine*, never introduce. A component styles through tokens and
never names a colour inside a theme query. This is the rule that keeps a screen from being
unreadable in one of the three theme states.

**The Blue-And-Orange Rule.** Chart series never reuse the lifecycle colours. The obvious
green/amber pair failed deuteranopia separation under the palette validator, which is why the trend
chart is orange and blue. Any new series must pass the same check in both themes before it ships.

**The Wash Carries Its Own Ink Rule.** A tinted background always pairs with the matching tone as
its text colour (`--ok-wash` with `--ok`), never with white and never with `--ink`. Card *bodies*
stay neutral so text contrast is never at the mercy of a wash.

## Typography

**Display / Body Font:** Archivo (with `system-ui`, `-apple-system`, `Segoe UI`, `sans-serif`)
**Bengali Font:** Hind Siliguri (with `Noto Sans Bengali`, `system-ui`, `sans-serif`)
**Label / Figure Font:** IBM Plex Mono (with `ui-monospace`, `SF Mono`, `Consolas`, `monospace`)

**Character:** Archivo is a grotesque with slightly narrow, worked proportions — it sets dense
civic information at 15px without feeling like a spreadsheet, and tightens convincingly at heading
sizes with negative tracking. IBM Plex Mono is the ledger's hand: it appears only where precision
is the point, so its presence is itself a signal that what you are reading is a measurement, a
reference or a count. Hind Siliguri carries Bengali as a first-class script at its own leading,
never as Latin type with a fallback face swapped in.

### Hierarchy

- **Display** (650, 27px, 1.05 line-height, −0.03em, tabular): the stat tile's single figure. The
  largest type in the product is always a number, which is the whole posture of the system.
- **Headline** (650, 25px, 1.18, −0.016em, balanced wrap): page titles. One per screen.
- **Title** (600, 17px / 14px in a card head, −0.016em): section and card headings.
- **Body** (400, 15px, 1.55): all reading text. Page intro prose caps at 68ch; empty-state prose at
  44ch.
- **Body (Bengali)** (400, 15px, **1.72**): the same scale at looser leading, applied by
  `:root[lang='bn']` and the `data-bn` attribute.
- **Label** (600, 10.5px, 0.1em, uppercase, mono): the eyebrow, the stat key, the table head. The
  index tab of the ledger.
- **Figure** (600, 11.5–13px, 0.06em, mono, tabular): the priority band tag, factor points,
  reference codes, pin and cluster counts, table numerics.

### Named Rules

**The Tabular Column Rule.** Any digit that appears in a column, or that a reader might compare
against the digit above it, gets `font-variant-numeric: tabular-nums`. Stat values, factor points,
table numerics, bar values and pin counts all take it. A misaligned column is a number nobody
checks.

**The Mono Is A Signal Rule.** IBM Plex Mono is never used for reading. It is reserved for labels,
references, counts and measurements — and because it is reserved, its appearance tells the reader
what kind of thing they are looking at before they read it.

**The Bengali Leading Rule.** Bengali sets at 1.72 against the Latin 1.55. Never set the two scripts
at one line-height; the conjuncts and the matra line need the room.

## Layout

The desktop shell is a CSS grid: a 244px navigation column and a fluid content column under a 56px
sticky top bar, with content capped at 1180px and padded on a 24/24/48 rhythm. Pages that own their
whole viewport — the map — opt out with a flush modifier and manage their own height against
`calc(100vh - var(--top-h))`. The map page itself splits into a fixed 384px list rail and a fluid
canvas, so the list and the map are peers rather than a panel over a picture.

Spacing is a set, not a slider: a strict 8px rhythm (8 / 16 / 24 / 32 / 48) with two half-steps
(4 / 12) for tight internal gaps. Every gap in the product is one of those seven values.

Content grids are 2-, 3- and 4-column, collapsing to 2 columns at 1080px and to a single column at
620px. The priority-factor row drops its meter entirely below 560px rather than crushing it — the
label and the points are what matter on a phone. The category picker is an `auto-fill` grid on a
148px minimum, so it reflows without a breakpoint.

### Named Rules

**The Two Shapes Rule.** At 900px the product does not shrink, it changes shape. The sidebar is
removed outright and replaced by a fixed bottom tab bar (62px, plus
`env(safe-area-inset-bottom)`) with a 56px camera button floating above it at the thumb's natural
reach. The desktop shell squeezed onto a phone would be the wrong product for the person standing
in the street; this is the citizen's shape and the sidebar is the desk's.

**The Reading Measure Rule.** Prose is bounded: 68ch for page intros, 44ch for empty states. A
full-width paragraph across a 1180px container is not a layout, it is an oversight.

## Elevation & Depth

**Border-led, shadow as a whisper.** Depth here is ruled, not stacked. Structure comes from 1px
lines and the three-step surface ramp — a card is a bounded region because it has an edge and a
tinted head, not because it floats. The two ambient shadows exist only to stop a white card from
dissolving into a near-white ground; at `0.05` and `0.04` alpha they are almost subliminal in light
mode, and in dark mode they deepen to `0.4`/`0.3` because a dark card needs real separation from a
dark ground.

The one place depth is used as a statement is the bottom sheet, which casts upward.

### Shadow Vocabulary

- **Resting** (`box-shadow: 0 1px 2px rgba(22,33,28,0.05), 0 1px 3px rgba(22,33,28,0.04)`): cards,
  stat tiles, the segmented control's active thumb, map-floating chips and the legend. Separation,
  not elevation.
- **Lift** (`box-shadow: 0 4px 14px rgba(22,33,28,0.1)`): the camera button, the toast, the map
  popup. Things genuinely above the page.
- **Sheet** (`box-shadow: 0 -8px 32px rgba(22,33,28,0.14)`): the bottom sheet only, cast upward
  against the page it covers.

### Named Rules

**The Three Shadows Rule.** The application has exactly three shadow values, and dark mode
redefines the same three rather than adding any. A fourth shadow is a defect, not an extension. If
something needs to separate, give it an edge.

**The Ruled-Not-Stacked Rule.** When a new region needs definition, reach for `1px solid var(--line)`
and a step on the surface ramp before reaching for a shadow. A ledger is ruled.

## Shapes

A tight radius family — 6px for controls, 10px for containers, 14px for the sheet, 20px for pills —
which keeps the product rectilinear and record-like rather than soft. Nothing is a squircle and
nothing is fully rounded except the genuinely circular: status dots, timeline nodes, cluster
bubbles, the score ring.

Borders are the primary form-making device and they are always 1px. `--line` divides; `--line-2`
bounds an interactive control, which is why an input reads as typeable before it is focused. Cards
clip their children (`overflow: hidden`) so a tinted head meets the corner cleanly.

Two silhouettes are deliberately not rectangles. The map pin is a 30px teardrop
(`border-radius: 50% 50% 50% 4px`, rotated −45°) with its glyph counter-rotated upright and its
report count riding the shoulder. The score ring is a conic gradient with a punched centre — the
arc's length is the score, so the shape is the datum.

### Named Rules

**The Tinted Head Rule.** Status tint lives on a card's head and border, never on its body. The
body stays `--surface` so body text contrast is never at the mercy of a wash colour. Four tints
exist (ok, wait, bad, accent) and they correspond to the vocabularies above.

**The Shape-Too Rule.** Anything encoded in colour is also encoded in form, so it survives
greyscale, a bad screen, and colour-vision difference. The priority band's leading dot gains a halo
and grows from 6px to 8px as the band rises; the severity picker is a five-segment bar that looks
like a scale; the verification bar is two abutting fills, not one colour with a caption; a resolved
pin drops to 72% opacity so it stays on the map without shouting.

## Components

### Buttons

- **Shape:** Small radius (6px), 40px minimum height, 7px icon gap, never full-width unless the
  layout is a form on a phone.
- **Primary:** Bottle Green ground with white ink (`--accent` / `--accent-ink`), 9px/16px padding.
  One per view — the action the screen exists for.
- **Secondary (default):** Surface ground, `--line-2` edge, `--ink` text. The workhorse.
- **Ghost:** Transparent with `--ink-2` text; takes a Surface Raised ground on hover. For toolbar
  and dismissal actions.
- **Danger:** `--bad-wash` ground, `--bad-line` edge, `--bad` text. Never a solid red button —
  destructive actions in a civic tool should be legible, not theatrical.
- **Hover / Active:** Ground and border shift over 0.12s; the whole button translates `1px`
  downward on press over 0.06s. Disabled drops to 0.45 opacity with `cursor: not-allowed`.
- **Sizes:** `sm` 32px / 13px, default 40px / 14.5px, `lg` 48px / 15.5px. The 34px square icon
  button is a separate control with its own `on` state in accent wash.

### Chips

- **Style:** Fully-pilled (20px), 1px `--line-2` edge, Surface ground, `--ink-2` text at 12.5px/550.
  On the map they additionally take the Resting shadow so they read against tiles.
- **State:** Selected takes `--accent-wash` ground, `--accent-line` edge, `--accent` text and steps
  from 550 to 650 weight. Hover only strengthens the border and darkens the ink — selection is the
  only state allowed to introduce colour.
- **Status pill:** the same silhouette in the four lifecycle tones, with a 12px icon and the label,
  at 2px/9px padding (`lg`: 4px/12px).

### Cards / Containers

- **Corner Style:** 10px, with `overflow: hidden` so tinted heads clip cleanly.
- **Background:** `--surface` body on a `--ground` page; `--surface-2` head and foot.
- **Shadow Strategy:** Resting only. See Elevation & Depth.
- **Border:** 1px `--line`, replaced by the matching `*-line` token on a tinted card.
- **Internal Padding:** 16px body (12px in `tight`), 11px/16px head, 10px/16px foot. Stacked cards
  are separated by 16px.
- **Head:** a 14px/650 title on the left and controls right, on a Surface Raised ground with a 1px
  underline.

### Inputs / Fields

- **Style:** Surface ground, 1px `--line-2` edge, 6px radius, 42px minimum height, 15px text.
  Labels sit above at 13px/600 in `--ink-2`, with 5px to the control; hints at 12.5px `--ink-3` and
  errors at 12.5px `--bad` below.
- **Focus:** Border becomes `--accent` and a 3px `--accent-wash` glow rings the field; the native
  outline is suppressed *only* here, because the glow replaces it. Everywhere else focus is a 2px
  `--accent` outline at 2px offset.
- **Error / Disabled:** `aria-invalid="true"` turns the border `--bad`. The textarea is 88px
  minimum and vertical-resize only.
- **Category picker:** an `auto-fill` grid of 148px-minimum choice buttons, icon plus label,
  committing to accent wash and 650 weight when selected.
- **Severity scale:** five segments in one bar, mono numerals over a small caption, rounded only at
  the two outer ends so it reads as a continuous scale.

### Navigation

- **Desktop:** a 244px rail of 8px/10px rows at 14.5px/500 in `--ink-2`, each with a 20px inert icon
  and an optional mono count badge. Hover takes Surface Raised; the active row takes accent wash,
  accent text, 650 weight, an accent icon, and inverts its count badge to solid accent. Mono
  uppercase section labels at 10.5px separate groups.
- **Top bar:** 56px, sticky, Surface on a 1px underline. The brand mark is a 26px accent square
  with a 7px radius carrying a white pin glyph, beside a 15px/650 wordmark over a mono uppercase
  10px subtitle.
- **Mobile:** the rail is removed and replaced by a fixed bottom tab bar — equal columns, 44px
  minimum row height, 10.5px/600 labels stacked under 22px icons, `--ink-3` inert and `--accent`
  active — with the camera button floating at 56px above it.

### The Merge Proof

The product's central claim rendered as a picture rather than a sentence: the contributing report
photos as 62px squares overlapping by 18px, each ringed in a 2px Surface border so the stack reads
as a stack, then a `--ink-4` arrow, then the single resulting problem. "3 reports → 1 problem",
legible in about a second, with the overlap and the arrow doing all of the explaining. This is the
one component allowed to exist purely to make an argument.

### The Score Ring

A 62px conic-gradient ring whose arc length is the priority score and whose colour is the priority
band, with a Surface disc punched 6px inside it and the score set in 19px tabular mono at the
centre. The ring is not a decoration around a number — it is the number, drawn.

### The Priority Breakdown

Five rows, each a three-column grid of label-and-detail, a 6px band-coloured meter, and right-set
mono points against their maximum. Below 560px the meter is dropped and the grid becomes
label-plus-points. It renders exactly what the API returned and never recomputes a factor.

### The Lifecycle Timeline

A list whose 24px circular nodes are joined by a 2px `--line` spine drawn from each node's bottom to
the next, suppressed on the last item. Each node takes the lifecycle tone of the stage it records
(wash ground, matching rule border, matching ink) with a 14px/600 title, 12.5px muted timestamp and
actor, and an optional note. It looks append-only because the data is.

### Feedback

- **Empty state:** a 44px rounded-12px Surface Raised icon tile above a 15px/600 title and 13.5px
  muted prose capped at 44ch, centred in 32px/16px padding.
- **Skeleton:** a three-stop Surface Raised → Surface Sunken → Surface Raised gradient at 200%
  width, shimmering over 1.4s linear infinite, at the small radius.
- **Banner:** a 1px-bounded 11px/16px strip with an icon top-aligned at 2px, in the neutral pair or
  any of the four tone pairs.
- **Toast:** an inverted pill — `--ink` ground, `--ground` text, 22px radius, Lift shadow — fixed
  above the tab bar, centre-anchored, capped at `100vw - 32px`.

### Iconography

One set, one spec: a 24px grid, 1.7 stroke, round caps and joins, `currentColor`, drawn as outlines.
Never a glyph font and never emoji, so every icon inherits its text colour and stays legible at 14px
in both themes. Eight category icons, roughly thirty for navigation, actions and status.

## Do's and Don'ts

### Do:

- **Do** declare every new colour in full on bare `:root` first, then redefine it in both the
  `prefers-color-scheme: dark` block (guarded `:root:not([data-theme='light'])`) and the
  `:root[data-theme='dark']` block. All three states, every time.
- **Do** pick spacing from the seven-step set (4 / 8 / 12 / 16 / 24 / 32 / 48). A 20px gap means
  the layout is wrong, not that the scale is short.
- **Do** reach for `1px solid var(--line)` and a step on the surface ramp before reaching for a
  shadow.
- **Do** set `font-variant-numeric: tabular-nums` on any digit a reader might compare against
  another.
- **Do** encode state in form as well as colour — a growing dot, a segment count, a bar's two
  fills, an opacity drop.
- **Do** pair every tinted background with its own matching ink token, and keep card bodies neutral.
- **Do** give Bengali its own face and its own 1.72 leading.
- **Do** keep interactive targets at 40px minimum (44px on the mobile tab bar), and keep the
  primary mobile action inside the thumb arc above the tab bar.
- **Do** restyle third-party chrome through the same tokens — Leaflet's controls, popups and
  attribution all take Surface, Rule and Ink, and the basemap swaps with the theme.
- **Do** state an absent capability in the interface. A sentence saying a forecast needs a full
  monsoon of history is worth more than a convincing invented number.

### Don't:

- **Don't** define a colour whose only declaration lives inside a media query or a `[data-theme]`
  block, and don't name a raw colour inside a component. Both produce a screen that is unreadable
  in one of the three theme states.
- **Don't** cross the three colour vocabularies. The accent never marks a status, a lifecycle tone
  never marks navigation, and a priority band never marks a link.
- **Don't** build a chart series from the lifecycle colours, and don't ship a new series without
  running the colour-vision check in both themes. Green and amber together already failed it.
- **Don't** add a fourth shadow value.
- **Don't** use IBM Plex Mono for anything anyone has to read as prose.
- **Don't** put a solid red button in front of a citizen. Destructive and refusal actions use the
  washed treatment.
- **Don't** let a paragraph run the full width of the 1180px container; 68ch is the measure.
- **Don't** squeeze the desktop shell onto a phone. Below 900px the sidebar is removed and replaced,
  not compressed.
- **Don't** reach for a glyph font, an icon package, or emoji. The set is drawn to one spec and
  inherits `currentColor`.
- **Don't** let the map become a bright rectangle punched through a dark page — tiles, markers,
  clusters and popups all take their colour from these tokens.
- **Don't** dress this as a government portal: no crests, no institutional blue, no Times New Roman,
  no PDF-shaped page. And don't overcorrect into a consumer toy — no gradients, no glassmorphism,
  no mascot, no badges or streaks.
