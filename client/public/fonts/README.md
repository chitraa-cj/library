# Self-hosted fonts

Google-hosted fonts (Noto Serif, Libre Franklin, Amita, Tiro Devanagari Hindi)
are loaded from the `<link>` in `client/index.html`. The **page-heading** font
"Sallenas Grandes" is a commercial font, so it is self-hosted here.

## Add "Sallenas Grandes"

Drop the Regular (weight 400) font file(s) into this folder using **exactly**
these names — the `@font-face` in `client/src/index.css` references them:

- `SallenasGrandes-Regular.woff2`  (preferred)
- `SallenasGrandes-Regular.woff`   (optional fallback)
- `SallenasGrandes-Regular.ttf`    (optional fallback)

At least the `.woff2` is recommended. Until a file is present, page headings
fall back to Noto Serif automatically (no visual breakage).
