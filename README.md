# Paintlang Studio

**A live-coding IDE for painting.** Write scenery as code and watch it render as you type.
Paint on the canvas and your gestures come back as code. Drag any object and its
coordinates are rewritten in the source. Import any image and it becomes editable,
labeled shape code. The code and the canvas are the same artwork, edited from either side.

*The visual-art analogue of Sonic Pi / Strudel - but bidirectional.*

## Try it

Open `index.html` in any modern browser. No install, no build, no server.

## What makes it different

- **True bidirectional editing** - every brush stroke, shape, and import is a line of
  code. Moving, resizing, or recoloring something on the canvas rewrites the actual
  literals in the source (with pressure data preserved). Selecting an object highlights
  its exact line.
- **Image → code tracing** - drop in a PNG/JPG/SVG and get a layered, painterly
  decomposition: `form({ x, y, w, h, color, shade, pts })` calls with human-readable
  placement, light-direction gradients sampled from the photo, and per-shape comments
  (`// 12 · large dark gold · top left`). Four fidelity levels.
- **A real painting engine** - 12 pressure- and direction-aware stamp brushes
  (watercolour with wet edges, oil that mixes with the canvas, true-multiply marker,
  smudge, charcoal...), each fully tunable, with tuned values serialized into the stroke's
  code so paintings re-render identically anywhere.
- **A real language** - it's JavaScript: loops, seeded randomness, 1-D noise, and a
  scenery library (`mountains`, `water` with live reflections, `trees`, `fog`...) for
  generative work. Deterministic re-renders.
- **Layers, undo, scrubbing** - imports stack as named `layer()` blocks with a reorder
  strip; snapshot undo/redo covers gestures and rewrites; click any number in the code
  for a drag-slider.
- **Share links with no backend** - the whole painting travels deflate-compressed in the
  URL fragment.

## Source layout

```
index.html            entry - markup + ordered script tags
css/studio.css        theme (VS Code Dark+ design language, all tokens in :root)
js/01...11-*.js         modules in load order (classic scripts, shared global scope):
                      core → scene/caches → scenery API → brush engine → forms/api →
                      runtime → editor → tools → chrome/layers → importer → examples
build.mjs             node build.mjs → dist/ single-file bundles
marketing/            launch copy + demo video script
```

**Load order matters** - the numbered files share top-level scope. Add new modules by
number and list them in `index.html`.

## Building single-file bundles

```
node build.mjs
```
- `dist/paintlang-standalone.html` - the whole app in one shareable file
- `dist/paintlang-artifact.html` - content-only variant for hosts that supply their
  own document skeleton

## License

MIT - see [LICENSE](LICENSE).
