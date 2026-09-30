# Design source (reference only — not built or bundled)

Exported from the Claude Design project
`ec1d69e7-8a03-474e-ad4d-f238c77d8486`, which holds both the design and the
clickable prototype:

- Design:    https://claude.ai/design/p/ec1d69e7-8a03-474e-ad4d-f238c77d8486?file=Bespa.html
- Prototype: https://claude.ai/design/p/ec1d69e7-8a03-474e-ad4d-f238c77d8486?file=Bespa+Prototype.html

These are **web React (.jsx)**. The app is React Native via Expo, so nothing here is
imported by `src/`; the files are read and translated, then kept for diffing when the
design changes. Nothing in this directory is bundled.

Both `bespa_design/` and `bespa_prototype/` were exported, and their trees are
byte-identical — the two entry HTML files live in the same project, so each export carries
the whole thing. Either directory can be read; they are kept as exported rather than
pruned, and git stores the shared blobs once.

`screens-nrega.jsx` is present too (an MGNREGA tracker) though it was not in the original
file list.

Files:

    Bespa.html              design entry
    Bespa Prototype.html    prototype entry
    design-system.jsx       palette, type, spacing — the main thing to reconcile
    app.jsx                 design-only shell
    design-canvas.jsx       design-only shell
    prototype.jsx           prototype-only shell
    tweaks-panel.jsx        design-only tooling
    screens-auth-home.jsx   maps to src/app/(auth)
    screens-location.jsx    maps to src/app/(onboarding)/pick-village
    screens-cab.jsx         no backend yet
    screens-services.jsx    no backend yet
    screens-social.jsx      no backend yet
    screens-account.jsx     no backend yet
    screens-profile.jsx     no backend yet
    screens-driver-verify.jsx  no backend yet

## Where the code's own design system sits

`src/theme/tokens.ts` derives from `spec/08-design-system.md`. When these two disagree,
spec 08's accessibility guarantees win and the conflict gets raised rather than silently
resolved: contrast floors (>=4.5:1 body, >=3:1 large) in BOTH themes, colour never the
sole signal, >=44x44pt targets (>=56 for emergency actions), primary actions in the
bottom third, icon *and* word for every category, and extra vertical room for Nastaliq.
