# Wikipedia — Home (Explore), iOS

Reference for the design benchmark (`docs/benchmarks/PROTOCOL.md`). Agents get `reference.png`
and `assets/`, never this file: the measured styles below are for the judges and for checking.

## Capture

|            |                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------- |
| App        | Wikipedia for iOS, App Store version, Home tab, "Community" feed                              |
| Device     | A real iPhone, 1290×2796 px = **430×932 pt @3x** (`--scale 3`); iOS 26 (Liquid Glass tab bar) |
| Date       | 2026-11-07, 23:11                                                                             |
| Language   | Interface in English, feed content from French Wikipedia ("On French Wikipedia")              |
| Appearance | Light                                                                                         |
| File       | The phone's screenshot, untouched (PNG, 16 bits per channel)                                  |

As captured, not normalized: the status bar shows 23:11, silent mode and 39 % battery, and the
first card of the feed was hidden by the user ("Card hidden · Undo"). Both are part of the
reference. The bottom of the feed shows through the translucent tab bar.

App source for the icons: https://github.com/wikimedia/wikipedia-ios, commit `0b9980f`
(2026-11-06).

## Assets

| File                                               | On screen                                               | Source                                                                               | Author, license                                           |
| -------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `assets/icons/wikipedia-w.svg`                     | "W" logo, top left                                      | app asset `WMFComponents/…/Assets.xcassets/W.imageset/W.pdf`, converted to SVG       | Wikimedia Foundation, trademark (internal benchmark only) |
| `assets/icons/more-vertical.svg`                   | Vertical dots of the section headers                    | app asset `Wikipedia/Images.xcassets/overflow.imageset`, converted to SVG            | Wikimedia Foundation, MIT (app code)                      |
| `assets/images/france-map.png`                     | "Which came first?", first event (France in Europe map) | https://commons.wikimedia.org/wiki/File:Mapadefrancia.svg (French rendering, 960 px) | Monsieur Fou, CC BY-SA 4.0                                |
| `assets/images/richard-nixon.jpg`                  | "Which came first?", second event                       | https://commons.wikimedia.org/wiki/File:Richard_Nixon_presidential_portrait_(1).jpg  | US Department of Defense, public domain                   |
| `assets/images/pablo-pagis.jpg`                    | Top read #1                                             | https://commons.wikimedia.org/wiki/File:Pablo_a_l%27entrainement_du_FC_Lorient.jpg   | Kermaguer, CC BY 4.0                                      |
| `assets/images/star-academy-logo.png` (and `.svg`) | Top read #3, behind the tab bar                         | https://fr.wikipedia.org/wiki/Fichier:Starc-ac-logo-2025.svg                         | Endemol France, trademark (internal benchmark only)       |

The images come from the Wikimedia feed of that day (`api.wikimedia.org/feed/v1/wikipedia/fr/
featured/2026/11/07` and `onthisday/events/11/07`), the same data the app shows. They are
960 px wide; the app shows them about 37 pt wide (111 px).

## Measured styles

Colors measured in the capture (darkest pixel of each text, flat areas for backgrounds); they
match Wikipedia's palette.

| Element                                                          | Color                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| Main text ("Today", card text, article titles)                   | `#202122`                                                |
| Secondary text ("On French Wikipedia", descriptions)             | `#72777d`                                                |
| Links ("Undo", "Play today's game", overflow dots, rank circles) | `#3366cc`                                                |
| "Card hidden" banner background                                  | `#f8f9fa`                                                |
| Segmented control track ("Community / For You")                  | `#ececed`                                                |
| Cards and page background                                        | `#ffffff` to `#fcfcfc`, cards with a soft shadow         |
| Tab bar: selected item                                           | `#2975bf` on a light gray capsule; other items `#202122` |
