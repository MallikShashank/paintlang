# Paintlang Studio - launch kit

## One-liner

> A live-coding IDE for painting: the code and the canvas are the same artwork,
> edited from either side.

## 90-second demo video script

| t | screen | voice / caption |
|---|--------|-----------------|
| 0-8s | Sunset Lake example, cursor scrubbing the sun's `y` - sun slides, reflection follows | "This painting is a program. Every number is live." |
| 8-20s | Type `trees(6, ...)`, forest appears; change a colour literal | "Write scenery as code - it renders as you type." |
| 20-35s | Switch to Paint tool, watercolour stroke across the sky; camera pans to the editor - the stroke appears as `stroke([[x,y,pressure]...])` | "Now paint by hand. Your gesture comes back as code - with pen pressure." |
| 35-50s | Select tool: drag a tree; show the coordinates rewriting in the source; resize with a handle | "Drag anything. The source rewrites itself. This is real bidirectional editing." |
| 50-70s | Drop the Mona Lisa onto the canvas; progress ticks; painting appears; scroll the generated `form({ x, y, w, h, color, shade... })` lines; recolor one shape, drag another | "Import any image. It becomes labeled, editable shape code - every mass has a position, a size, a light direction." |
| 70-85s | Smudge across her cheek; open ⚙ and slide brush flow with the live sample | "Twelve tunable brushes. Oil that mixes. Watercolour that blooms. Smudge that drags real paint." |
| 85-90s | Click Share link → toast; paste URL in a new tab, painting loads | "The whole painting fits in a link. Paintlang Studio - free and open source." |

## Show HN post

**Title:** Show HN: Paintlang - a live-coding IDE where painting and code edit each other

**Body:**
I built a painting environment where the artwork *is* a program. Typing code renders
live (like Sonic Pi/Strudel, but for images). The unusual part is the reverse
direction: brush strokes serialize into the source with pen pressure, dragging a shape
rewrites its coordinate literals, recoloring rewrites its `color:` string, and
importing a photo produces labeled, human-editable shape code with light-direction
gradients sampled per region.

Under the hood: the source is instrumented before each run so every painted object
knows its call site; canvas edits become surgical text edits (with `nudge()`/`resize()`
fallbacks for loop-generated objects, where no literal exists to rewrite). Strokes are
deterministic seeded stamp recipes, so re-renders are identical. Everything is
plain-browser JS - no build, no server; share links carry the deflate-compressed
document in the URL fragment.

It's MIT-licensed. I'd love feedback on the bidirectional-editing model - especially
the correspondence problem (what should happen when you drag an object born inside a
loop?).

## Reddit (r/generative, r/creativecoding)

**Title:** I made a painting IDE where dragging things on the canvas rewrites the code -
and importing an image turns it into editable shape code

Short body + a 30s clip of: scrub a number → import an image → drag a traced shape →
show the rewritten line. End with the share link.

## Positioning / pricing sketch (for later)

- Free & open source: the studio itself (this repo).
- Pro (~$6-8/mo, hosted): accounts, private works, gallery/remixing, hi-res & SVG
  export, brush-pack cloud, higher trace quotas.
- Classroom (~$3/student/yr): assignments, student galleries, teacher dashboard.
- Separate SKU: the tracer as a Figma/Adobe plugin ("image → clean editable layers").

## Checklist before posting

- [ ] GitHub repo public, README renders well, LICENSE present
- [ ] GitHub Pages enabled (repo root) - the launch link IS the app
- [ ] Demo video/GIF recorded (script above)
- [ ] Formal trademark search on "Paintlang" (quick web check found no blocking product)
- [ ] Domain registered (paintlang.dev / .studio / .art)
