# Wikipedia — Main Page, desktop web

Reference for the design benchmark (`docs/benchmarks/PROTOCOL.md`). Agents get `reference.png`
and `assets/`, never this file: the measured styles below are for the judges and for checking.

## Capture

|          |                                                                                  |
| -------- | -------------------------------------------------------------------------------- |
| Page     | https://en.wikipedia.org/wiki/Main_Page, logged out                              |
| Date     | 2026-11-07 (the content changes every day: this capture is frozen)               |
| Skin     | Vector 2022, light, text Standard, width Standard                                |
| Browser  | Playwright 1.64 Chromium, macOS, `en-US`                                         |
| Viewport | 1440×900 CSS px, device scale factor 2 → `reference.png` 2880×1800 (`--scale 2`) |
| Script   | Playwright: `goto` + `networkidle`, wait for every image, viewport screenshot    |

The blue dot under the bookmark icon is Wikipedia's own "new feature" hint, present in the
capture: it is part of the reference.

## Assets

| File                                  | On screen                                              | Source                                                                                                                                  | Author, license                                           |
| ------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `assets/icons/wikipedia-wordmark.svg` | "Wikipedia" wordmark with the 25 years badge, top left | https://en.wikipedia.org/static/images/mobile/copyright/wikipedia-wordmark-en-25.svg                                                    | Wikimedia Foundation, trademark (internal benchmark only) |
| `assets/icons/wikipedia-tagline.svg`  | "25 years of the free encyclopedia" under the wordmark | https://en.wikipedia.org/static/images/mobile/copyright/wikipedia-tagline-en-25.svg                                                     | Wikimedia Foundation, trademark                           |
| `assets/icons/menu.svg`               | Main menu (hamburger), top left                        | `load.php?modules=skins.vector.icons&image=menu`                                                                                        | Codex icons, MIT                                          |
| `assets/icons/search.svg`             | Magnifier in the search field                          | Codex `cdxIconSearch` (inlined by the page)                                                                                             | Codex icons, MIT                                          |
| `assets/icons/bookmark-outline.svg`   | Bookmark, page toolbar                                 | `load.php?modules=ext.readingLists.bookmark.icons&image=bookmarkOutline`                                                                | Codex icons, MIT                                          |
| `assets/icons/more-vertical.svg`      | Vertical ellipsis (Tools), page toolbar                | `load.php?modules=skins.vector.icons&image=verticalEllipsis`                                                                            | Codex icons, MIT                                          |
| `assets/images/frozen-yogurt.jpg`     | "Help us improve this article!" photo                  | https://commons.wikimedia.org/wiki/File:Blueberry_frozen_yoghurt_(4937999312).jpg                                                       | Kate Ter Haar, CC BY 2.0                                  |
| `assets/images/kimi-antonelli.jpg`    | "In the news" photo                                    | https://commons.wikimedia.org/wiki/File:2026-08-23_Motorsport,_Formel_1,_Gro%C3%9Fer_Preis_der_Niederlande_2026_STP_3010_(cropped2).jpg | Steffen Prößdorf, CC BY-SA 4.0                            |
| `assets/images/aracelio-iglesias.jpg` | "Did you know…" photo, cut by the bottom edge          | https://commons.wikimedia.org/wiki/File:Aracelio_Iglesias.jpg                                                                           | Unknown author, public domain                             |

Photos are 600 px wide (the page shows them 118–162 CSS px wide, 236–324 device px).
Icons are drawn in black: the page colors them with a mask (`#202122`, links `#3366cc`).

## Measured styles (CSS px, computed by Chromium)

| Element                                                | Box (x, y, w, h)              | Background | Border                                   |
| ------------------------------------------------------ | ----------------------------- | ---------- | ---------------------------------------- |
| Welcome banner `#mp-topbanner`                         | 44, 139, 1132, 117            | `#f9f9f9`  | 1px `#dddddd`                            |
| Left column `#mp-left`                                 | 44, 260, 520, —               | `#f5fffa`  | 1px `#cef2e0`                            |
| Right column `#mp-right`                               | 568, 260, 608, —              | `#f5faff`  | 1px `#cedff2`                            |
| Left section headings (featured article, Did you know) | 502 × 36, padding 3.84 / 7.68 | `#cef2e0`  | 1px `#a3bfb1`                            |
| Right section headings (Help us improve, In the news)  | 590 × 36                      | `#cedff2`  | 1px `#a3b0bf`                            |
| Search field                                           | 266, 17, 404, 32              | `#ffffff`  | 1px `#72777d`, radius 2px 0 0 2px        |
| Radio buttons (Appearance)                             | 18 × 18                       | `#ffffff`  | 1px `#72777d`, round; selected `#3366cc` |

| Text role                        | Size / line height | Weight               | Color                      |
| -------------------------------- | ------------------ | -------------------- | -------------------------- |
| "Welcome to Wikipedia,"          | 25.92 / 35.64      | 400                  | `#101418`, link `#3366cc`  |
| Welcome subtitle                 | 15.2 / 24.7        | 400                  | `#202122`                  |
| Editor and article counts        | 13.6 / 22.1        | 400                  | `#202122`                  |
| Section headings                 | 19.2 / 26.4        | 700                  | `#101418`                  |
| Body text                        | 16 / 26            | 400 (bold links 700) | `#202122`, links `#3366cc` |
| Image captions                   | 14.14 / 19.79      | 400                  | `#202122`                  |
| Tabs, toolbar, top links         | 14                 | 400                  | `#202122`, links `#3366cc` |
| Appearance panel title / options | 14 / 22            | 700 / 400            | `#202122`                  |
