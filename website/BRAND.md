# ttsc Brand

The visual identity for the ttsc toolchain. Technical, minimal, monospace-leaning, dark-first.

## 1. Palette

The brand is dark-mode-only. Use these tokens; do not introduce new ones without updating this document.

| Token         | Value                  | Where it appears                                       |
| ------------- | ---------------------- | ------------------------------------------------------ |
| Canvas        | `#0a0a0a` (`neutral-950`) | Page background, OG card background                   |
| Foreground    | `#ffffff`              | Wordmark, body copy on dark                            |
| Accent        | `#22d3ee` (cyan-400)   | Mark strokes, accent rule on OG, tagline highlight     |
| Muted text    | `#a3a3a3` (neutral-400)| Secondary tagline                                      |
| Subtle text   | `#525252` (neutral-600)| URL footer, low-weight metadata                        |
| Grid line     | `#1a1a1a` (neutral-900)| OG background grid                                     |

The cyan accent is deliberate: it sits next to TypeScript's blue without competing with it, and reads as terminal / compiler / fast. Do not swap it for TypeScript blue.

## 2. Mark Anatomy

The mark is a chevron with a checkmark inside.

- The **chevron** (`>`) reads as "forward" and "compile."
- The **checkmark** sits in the chevron's mouth and reads as "type-checked."
- Together: TypeScript that compiles, checked.

Construction:

- 256×256 grid, 40-unit corner radius on the optional border.
- Chevron path: `M70 64 L150 128 L70 192`, stroke 22.
- Check path: `M118 138 L150 170 L206 102`, stroke 22.
- All strokes `round`-capped and `round`-joined.
- The bounding rounded square is rendered at 18% opacity to anchor the mark in a card without becoming a hard frame.

Files:

- `public/logo-mark.svg` — 256×256, the canonical mark.
- `public/favicon.svg` — 32×32, simplified for tiny sizes (heavier strokes, no border).
- `public/logo.svg` — full lockup (mark + monospace wordmark).
- `public/og.svg` — 1200×630 Open Graph card.

The mark uses `currentColor` where reasonable so it inherits the surrounding text color when no fill is overridden; the accent cyan is applied via inline `stroke` so it stays on-brand by default.

## 3. Wordmark

The wordmark is the four lowercase letters **ttsc** set in a monospace stack:

```
ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace
```

- Weight: 700 in the navbar lockup, 800 on the OG card.
- Tracking: slightly tight (`letter-spacing: -1.2` at 40px; `-6` at 156px).
- Always lowercase. Never `TTSC`, never `Ttsc`.

## 4. Clear Space and Sizing

- Minimum mark size: **16px** (favicon). Below that, prefer the favicon SVG which has bolder strokes.
- Navbar lockup target height: **28px**.
- Maintain clear space equal to the chevron's stroke width on all sides.

## 5. Do

- Place the mark on the dark canvas (`#0a0a0a`) or any dark surface.
- Use the cyan accent for the strokes; pair it with white or neutral text.
- Use the monospace wordmark in the lockup; the mark may also stand alone.
- Use the favicon SVG below ~40px; use `logo-mark.svg` above that.

## 6. Don't

- Don't recolor the mark to TypeScript blue. The brand intentionally diverges.
- Don't put the mark on a light background without testing contrast first; the brand is dark-first.
- Don't compress the chevron or check independently — they share a stroke weight and must scale together.
- Don't add gradients, glows, or shadows. The mark is flat by design.
- Don't pair the wordmark with a serif or humanist sans. Monospace is part of the identity.
- Don't introduce a tagline inside the lockup; the tagline belongs on the OG card and on long-form surfaces only.
