Reproduce the screen shown in `reference.png` (in the current directory; 411×923 CSS px) as a
high-fidelity, editable design.

- Fidelity: same layout and spacing, typography (family, size, weight, color), colors, borders,
  radii, icons and every text, to the pixel where you can.
- Editability: build it the way a good designer would, so a person can keep working on it: named
  groups, auto-layout / flex where the UI flows, repeated items (rows, nav items, fields) built once
  and reused, real text and real icons.
- Never paste the reference screenshot, or crops of it, into the design. Only genuine photos or
  logos may be images.
- Check your work visually against the reference and fix what differs before you finish.
- Work autonomously: do not ask questions, make reasonable choices.


`assets/` (in the current directory) holds the screen's real files, as a designer would get them
from the product team: photos and illustrations in `assets/images/`, icons and logos in
`assets/icons/` (SVG unless noted), and the fonts in `assets/fonts.md`. Use these files in your
design (upload or import them with your tools) instead of substitutes, redrawings or other
pictures. Some icons may only be named (an SF Symbol or Material Symbol, listed in a README in
`assets/icons/`): use that icon, or the closest one your tool offers.

Use the Figma MCP tools. Work in the existing Figma design file with key "<figma-file-key>": add a new page named "bench wikipedia-android figma-3" and, on it, one top-level frame of exactly 411×923. Do not touch the other pages.
When done, print as the very last line: RESULT {"fileKey":"<file key>","nodeId":"<frame node id, e.g. 1:2>"}
