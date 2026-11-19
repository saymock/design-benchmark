# Wikipedia — Home (Community), Android

Reference for the design benchmark (`docs/benchmarks/PROTOCOL.md`). Agents get `reference.png`
and `assets/`, never this file: the measured styles below are for the judges and for checking.

## Capture

|            |                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| App        | Wikipedia for Android 50616-r-2026-11-03 (the Play Store build, from releases.wikimedia.org), Home tab, "Community"                            |
| Device     | Android emulator, Pixel 9 profile, Android 16 (API 36, Google APIs image): 1080×2424 px, density 420 = **411×923 dp @2.625** (`--scale 2.625`) |
| Date       | 2026-11-12, 16:24 CET                                                                                                                          |
| Language   | Interface and feed in English (English Wikipedia)                                                                                              |
| Appearance | Light                                                                                                                                          |
| Status bar | System UI demo mode: 9:41, Wi-Fi full, battery 100 %, no mobile data, no notifications                                                         |
| File       | `adb exec-out screencap -p`, untouched                                                                                                         |

Fresh install: the two onboarding screens were passed ("Forward", then "Skip" on the interests
screen) and the screen captured as it opened, without scrolling. The red dots on "Saved" and
"Activity" are the app's own "new" hints, present in the capture: they are part of the reference.

`reference.png` is the capture without its last column and last row (1079×2423): a 411×923
frame renders at 2.625 to 1079×2423 (411.4 and 923.4 dp are not whole numbers), and the
protocol's trial run of 2026-11-12 found `sizeMatch: false` with the full 1080×2424. The pixels
kept are unchanged.

App source for the icons and fonts: https://github.com/wikimedia/apps-android-wikipedia, tag
`r/50616-r-2026-11-03` (commit `0fbe6ea`). The home screen is Jetpack Compose with Material 3's
default typography (`feed/HomeScreen.kt`, `feed/featured/FeaturedArticleModule.kt`).

## Assets

| File                                                    | On screen                                   | Source                                                          | Author, license                                           |
| ------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| `assets/icons/wikipedia-wordmark.svg`                   | "WIKIPEDIA" logo, top left                  | app drawable `feed_header_wordmark.xml`, converted to SVG       | Wikimedia Foundation, trademark (internal benchmark only) |
| `assets/icons/arrow-down.svg`                           | Language button chevron                     | app drawable `ic_arrow_down_24.xml`                             | Wikimedia Foundation, Apache 2.0 (app code)               |
| `assets/icons/more-vertical.svg`                        | "Featured article" overflow                 | app drawable `ic_more_vert_white_24dp.xml`                      | Wikimedia Foundation, Apache 2.0 (app code)               |
| `assets/icons/bookmark-outline.svg`                     | Save button on the image, Saved tab         | app drawable `ic_bookmark_border_white_24dp.xml`                | Wikimedia Foundation, Apache 2.0 (app code)               |
| `assets/icons/share.svg`                                | Share button on the image                   | app drawable `ic_share.xml`                                     | Wikimedia Foundation, Apache 2.0 (app code)               |
| `assets/icons/home-filled.svg`                          | Home tab                                    | app drawable `ic_home_filled_24dp.xml`                          | Wikimedia Foundation, Apache 2.0 (app code)               |
| `assets/icons/search.svg`                               | Search tab                                  | app drawable `ic_search_white_24dp.xml`                         | Wikimedia Foundation, Apache 2.0 (app code)               |
| `assets/icons/activity.svg`                             | Activity tab                                | app drawable `outline_activity_24.xml`                          | Wikimedia Foundation, Apache 2.0 (app code)               |
| `assets/icons/menu.svg`                                 | More tab                                    | app drawable `ic_menu_white_24dp.xml`                           | Wikimedia Foundation, Apache 2.0 (app code)               |
| `assets/images/wikipedia-globe.png`                     | Globe in the "Content and resources" banner | app drawable `drawable-xxxhdpi/w_nav_mark_180.png` (180 px)     | Wikimedia Foundation, trademark (internal benchmark only) |
| `assets/images/royal-gloucestershire-hussars-badge.png` | Featured article image                      | https://commons.wikimedia.org/wiki/File:Rgh-badge.png (800×700) | Factotem, public domain                                   |

The icons were white vectors tinted by the app at run time; their fills were set to
`currentColor`. The article image is the one of that day's feed
(`api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/12`, `tfa.originalimage`), the data
the app shows. The app crops it to a 415 dp high box with 16 dp corners and lays a black veil
at 39 % over it (`Color(0, 0, 0, 100)`): the PNG's transparent background shows as `#9b9b9b`.

## Measured styles

Colors measured in the capture (darkest pixel of each text, flat areas for backgrounds); they
match Wikipedia's palette.

| Element                                                                                         | Color                                                                                  |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Main text ("For you", "Featured article", article title and extract, overflow dots)             | `#202122`                                                                              |
| Secondary text (banner, "Today - Nov 12, 2026", module description, "Unit of the British Army") | `#54595d`                                                                              |
| Selected tab "Community" and its underline; Home tab icon and label                             | `#3366cc`                                                                              |
| Unselected bottom navigation items (icons and labels)                                           | `#72777d`                                                                              |
| Home tab pill                                                                                   | `#e8f0ff`                                                                              |
| "Content and resources…" banner background                                                      | `#eaecf0`                                                                              |
| Language button: "EN" box                                                                       | `#4d4d4e` (primary text at 80 %), white letters                                        |
| Bookmark and share buttons on the image                                                         | `#f8f9fa` circles, `#202122` icons                                                     |
| Article card over the image                                                                     | White at 92 % (`#eeeeed` to `#f7f7f7` over the image), 8 dp corners; divider `#d2d2d2` |
| Red "new" dots (Saved, Activity)                                                                | `#b32424`                                                                              |
| Page and bottom navigation background                                                           | `#ffffff`                                                                              |
