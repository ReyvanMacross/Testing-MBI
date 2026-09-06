# Map source assets

Place the two original Figma SVG exports in this directory:

- `peta-sebaran-desil-full.svg`
- `coblong-kelurahan.svg`

Run `npm run maps:extract` to generate semantic path data. The extractor
accepts only the five desil fill colors and stops unless it finds exactly 30
district paths and 6 Coblong kelurahan paths.
