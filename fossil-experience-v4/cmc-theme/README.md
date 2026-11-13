# ExYoWo CMC Theme

This branch adds a lightweight CMC-inspired design layer for the ExYoWo prototype.

## Files

- `cmc-theme.css` — reusable theme tokens and components
- `index.html` — small reference/demo page

## Goal

Use Cincinnati Museum Center's visual language as the design reference without importing the museum website's full production CSS.

The theme focuses on:
- editorial display headings
- uppercase eyebrow/category labels
- high-contrast calls to action
- image-led cards
- generous spacing
- ExYoWo target prompts
- progress indicators
- archetype result views
- recommendation lists
- mobile responsiveness and accessible focus states

## Important

The current variables are CMC-inspired, not represented as an official CMC brand package. Before final client delivery, verify the exact live-site font families and color values in Chrome DevTools and update the tokens at the top of `cmc-theme.css`.

## Suggested use

Add the stylesheet to an ExYoWo page:

```html
<link rel="stylesheet" href="cmc-theme/cmc-theme.css">
```

Then use the provided `cmc-*` and `exyowo-*` classes as building blocks rather than copying the full cincymuseum.org stylesheet.
