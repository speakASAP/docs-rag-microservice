# Self-hosted fonts (for `css/self-hosted-fonts.css`)

This directory should contain the font files referenced by `../css/self-hosted-fonts.css`. Nginx 404s for missing fonts are logged in `/var/log/nginx/error.log`.

## Status

| Font family | Subdir | Status | Notes |
| --- | --- | --- | --- |
| Roboto | `roboto/` | Present | All weights in repo |
| Open Sans | `open-sans/` | **Missing** | Add woff2 + woff for 300, 300italic (latin_cyrillic) |
| Open Sans Condensed | `open-sans-condensed/` | Present | Run `./scripts/download-self-hosted-fonts.sh` to refresh (latin + cyrillic 300) |
| Inter | `inter/` | **Missing** | Add woff2 + woff for 400, 600, 700 (latin) |
| Poppins | `poppins/` | **Missing** | Add woff2 + woff for 400, 600, 700 (latin) |
| Manrope | (Google @import) | Loaded from Google | Local Manrope 404s are from old cached CSS |

## Adding missing fonts

**Open Sans Condensed:** Run from project root: `./scripts/download-self-hosted-fonts.sh` — downloads latin + cyrillic 300 from Google Fonts into `open-sans-condensed/`.

For other families, download from [google-webfonts-helper](https://gwfh.mranftl.com/) (or equivalent):

- **Open Sans:** <https://gwfh.mranftl.com/fonts/open-sans?subsets=latin,cyrillic> — weights 300, 300 italic; filenames as in `self-hosted-fonts.css` (open-sans-v34-latin_cyrillic-300.*, open-sans-v34-latin_cyrillic-300italic.*).
- **Inter:** <https://gwfh.mranftl.com/fonts/inter?subsets=latin> — weights 400, 600, 700; filenames inter-v12-latin-regular.*, inter-v12-latin-600.*, inter-v12-latin-700.*.
- **Poppins:** <https://gwfh.mranftl.com/fonts/poppins?subsets=latin> — weights 400, 600, 700; filenames poppins-v20-latin-regular.*, poppins-v20-latin-600.*, poppins-v20-latin-700.*.

For those: create the subdir and place the files there. Then run deploy so `collectstatic` copies them: `./scripts/deploy.sh`.

See also `docs/LOGS_ANALYSIS_2026-02-10.md` §4.1 (Nginx missing static fonts).
