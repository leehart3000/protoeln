# Brand

ProtoELN is a companion to [ProtoLIMS](https://github.com/leehart3000/protolims). The two
brands share a structure (a "P" on a 4 × 4 grid with a gold final cell, the Manrope wordmark,
the neutral colours and the interface fonts) but differ in the mark's picture and the primary
colour.

## Mark

A square of green graph paper: fine lines every half cell, slightly darker lines every cell,
all the same thickness. Inked squares spell a "P", and the bottom-right square is gold.

| File | Use |
| --- | --- |
| `frontend/public/brand/protoeln-mark.svg` | Light backgrounds |
| `frontend/public/brand/protoeln-mark-dark.svg` | Dark backgrounds |
| `frontend/public/favicon.svg` | Browser tab; switches colours in dark mode |

Below 32 px, use `favicon.svg`. The grid lines disappear at small sizes, so the favicon drops
them: it shows the inked squares, with the empty cells as faint squares instead.

### Geometry

On a 64 × 64 canvas:

- Grid lines are 0.75 wide. Their outer edges sit on the canvas edge, so all 16 cells are the
  same size (15.8125 square).
- Fine lines (every half cell) are the primary colour at 35% opacity; cell lines at 70%.
- Each inked square sits 2.25 inside its cell's lines on every side, so it is exactly centred.

## Wordmark

The wordmark is live text, not an image: "Proto" in Manrope Regular (400), then "ELN" in
Manrope Bold (700) in the primary colour.

```css
font-family: Manrope, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

Always write the name as **ProtoELN**.

## Colours

| Name | Hex | Use |
| --- | --- | --- |
| Ink | `#0E1B33` | Dark text (shared with ProtoLIMS) |
| Graph green | `#2D7A3E` | Primary: buttons, links, the mark |
| Grass | `#6CCF7F` | Primary on dark backgrounds: graph green's hue, brighter and more saturated |
| Deep teal | `#0D1C22` | Dark-mode page background |
| Gold | `#F2B33D` | Accent square and highlights only; never text on light backgrounds |
| Haze | `#E1E3EE` | Borders, dividers |
| Snow | `#FAFAFC` | Page background |

Graph green on white has a contrast of 5.3:1, and Grass on the dark-mode panel colour 8.0:1, so
both pass WCAG AA for normal text. Deep teal text on a Grass button is 9.0:1.

### Role colours in the app

Pages use role-based colours, so the same page works in light and dark mode. They are defined
in `frontend/src/index.css`. In light mode, apart from `link` and `primary`, they match ProtoLIMS. In
dark mode, ProtoELN uses deep teal surfaces instead of ProtoLIMS's navy, which clashed with the
green.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `page` | `#FAFAFC` | `#0D1C22` | Page background |
| `panel` | `#FFFFFF` | `#13272F` | Header, cards |
| `fg` | `#24304A` | `#D8E4E8` | Main text |
| `muted` | `#4A5468` | `#AEC1C8` | Secondary text |
| `line` | `#E1E3EE` | `#28414B` | Borders, dividers |
| `link` | `#2D7A3E` | `#6CCF7F` | Links (always underlined) |
| `primary` | `#2D7A3E` | `#6CCF7F` | Headings, "ELN" in the wordmark, buttons |
| `primary-fg` | `#FFFFFF` | `#0D1C22` | Text on a `primary` background |
| `danger` | `#A4262C` | `#F5B5BA` | Error text and highlighted fields |
| `danger-bg` | `#FDEEEE` | `#3B1A24` | Error message background |
| `danger-line` | `#F1B5B8` | `#7D3340` | Error message border |

Dark mode follows the visitor's system setting until they use the toggle in the header; their
choice is then remembered in the browser (`frontend/public/theme.js`, `frontend/src/theme.ts`).

## Type

| Role | Font |
| --- | --- |
| Wordmark | Manrope |
| Headings, interface and notebook entries | IBM Plex Sans |
| Identifiers (entry IDs, revisions, lot numbers) | Source Code Pro |

All three fonts are under the SIL Open Font License and are self-hosted through Fontsource.

## Icons

Icons come from [Lucide](https://lucide.dev) (ISC licence), in its default line style, as in
ProtoLIMS: they mark actions, appear with words on buttons, and are hidden from screen readers.
