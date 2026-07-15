# Paintlang Studio

**A live-coding IDE for painting.** Write scenery as code and watch it render as you type.
Paint on the canvas and your gestures come back as code. Drag any object and its
coordinates are rewritten in the source. Import any photo and it becomes a layered
painting made of editable code. The code and the canvas are the same artwork, edited
from either side.

*The visual-art analogue of Sonic Pi / Strudel - but bidirectional.*

**Live at [paintlang.com](https://paintlang.com)** · walk
[The Coded Gallery](https://paintlang.com/gallery.html) - Van Gogh, Monet, Hokusai and
more as programs you can open, watch paint themselves, and remix.

## Try it

Use [paintlang.com](https://paintlang.com), or open `index.html` in any modern browser -
the studio itself needs no install, no build, no server. (Image tracing and accounts
talk to the hosted service; everything else is fully client-side.)

## What makes it different

- **True bidirectional editing** - every brush stroke, shape, and import is a line of
  code. Moving, resizing, or recoloring something on the canvas rewrites the actual
  literals in the source (with pressure data preserved). Selecting an object highlights
  its exact line; click any number for a drag-slider.
- **Image to code tracing** - drop in a PNG/JPG/SVG and get a painterly decomposition:
  an underpainting of `form({ x, y, w, h, color, shade, pts })` masses with
  human-readable placement and light-direction gradients sampled from the photo, plus
  coarse-to-fine `strokes()` brushwork. Recognised subjects (a person, a dog, a boat...)
  and scene stuff (sky, water, greenery) become their own named layers, brushwork
  included. Four fidelity levels up to Ultra. Traced paintings declare
  `const MEDIUM = 'oil'` - change that one word and the whole painting re-renders as
  watercolour, chalk, or flat colour.
- **A real painting engine** - 12 pressure- and direction-aware stamp brushes
  (watercolour with wet edges, oil that mixes with the canvas, true-multiply marker,
  smudge, charcoal...), each fully tunable, with tuned values serialized into the
  stroke's code so paintings re-render identically anywhere.
- **A real language** - it's JavaScript: loops, seeded randomness, 1-D noise, and a
  scenery library (`mountains`, `water` with live reflections, `trees`, `fog`...) for
  generative work. Deterministic re-renders.
- **A studio, not a toy** - document tabs (each painting is a tab, mirrored above the
  code and the canvas, remembered by the browser), a per-tab Layers pane
  (show/hide/reorder/rename/rescale/delete - all by rewriting the source), snapshot
  undo/redo per tab, a floating tool box you can drag, resize and collapse, and a
  replay mode that repaints the picture stroke by stroke.
- **Accounts, cloud saves, version history** - sign in with GitHub, Google, or a
  no-email key account. Every save is a version; step any painting back to an earlier
  stage from your private gallery, on any device.
- **A shared component library** - official Paintlang components (skies, water, forests,
  motifs, even the traced masses of Hokusai's Great Wave) plus community contributions.
  Every component is a plain code snippet: insert it, then edit it like anything else.
  Contribute one layer of your own painting; remove your contributions any time.
- **Share links** - small paintings travel deflate-compressed in the URL fragment
  with no server involved; larger ones are stored by the hosted service behind a
  six character short link.
- **A community wall** - publish paintings publicly, open and remix anyone's (with
  automatic credit lineage), love them, follow artists, and browse their profiles.
  Unique artist names. Any code arriving from outside your studio - shared links,
  community paintings, library components - is held unrendered until you press
  Ctrl+Enter.
- **Export anywhere** - take a painting out as raw Paintlang code, SVG vectors, a
  self-contained HTML5 canvas page, a p5.js sketch, a WebGL page with an editable
  GLSL shader, or a Lottie animation of it painting itself.

## The Coded Gallery

[paintlang.com/gallery.html](https://paintlang.com/gallery.html) is an exhibition of
public-domain masterpieces traced into Paintlang code: ten artist rooms, fourteen
paintings, each with its story, the artist's story, and Paintlang's reading of it
(so-many masses + so-many brush strokes, in named layers). Every piece opens in the
studio as editable code, or replays itself stroke by stroke. Artwork images courtesy of
the Art Institute of Chicago open access program (CC0).

## Source layout

```
index.html            entry - markup + ordered script tags
css/studio.css        theme (VS Code Dark+ and Light+ design language, dark and
                      light studio, all tokens in :root)
js/00...13-*.js       modules in load order (classic scripts, shared global scope):
                      icons → core → scene/caches → scenery API → brush engine →
                      forms/api → runtime → editor → tools → chrome/layers/tabs →
                      importer → examples/boot → drawer/accounts/community →
                      export engine (SVG, canvas JS, p5.js, WebGL/GLSL, Lottie)
gallery.html          the exhibition page
gallery/              traced masterpieces (.paint code, .svg thumbnails, pieces.json)
assets/brand/         the mark and social assets
build.mjs             node build.mjs → dist/ single-file bundles
test/run-tests.mjs    node test/run-tests.mjs → syntax, build, and unit checks
```

**Load order matters** - the numbered files share top-level scope. Add new modules by
number and list them in `index.html`. Before adding top-level names, check they don't
collide with existing globals. UI rules: no emojis (icons come from the SVG library in
`js/00-icons.js` - `plIco('name')` in code, `data-ico="name"` in markup) and no em
dashes in any text.

## Services

The studio talks to a small hosted API (Cloudflare Worker) for the proprietary image
tracer, accounts (GitHub/Google OAuth or key-based), cloud saves with version history,
and the shared component library. Rate limits apply to tracing. The client for all of
this is in `js/10-importer.js` and `js/12-account.js`; point them elsewhere with
`localStorage['paintlang-trace-api']` if you run your own compatible service.

## Building single-file bundles

```
node build.mjs
```
- `dist/paintlang-standalone.html` - the whole app in one shareable file
- `dist/paintlang-artifact.html` - content-only variant for hosts that supply their
  own document skeleton

Note: the single-file bundles include the studio but still use the hosted service for
tracing and accounts.

## License

MIT - see [LICENSE](LICENSE). The image-tracing service is proprietary and not part of
this repository.
