# Paintlang launch and growth plan

Written 2026-07-12, the day both payment rails went live. Work top to bottom;
each phase gates the next. Copy for HN/Reddit and the demo video script live
in launch.md - reuse them, updated for what shipped since (gallery, accounts,
library, Pro).

## Phase 0 - launch prep (1-2 days, do before ANY posting)

1. Demo video (the single highest-leverage asset, ~60-90 seconds):
   - Record with OBS at 1920x1080, paintlang.com in a clean browser profile,
     no bookmarks bar. No voiceover needed; captions + music beat one take.
   - Shot list, in order, ~10s each:
     a. Type `sun(490, 320, 44, { glow: 2.4 })` into the sunset example -
        canvas updates as you type.
     b. Click a number, drag the slider - sun slides across the sky.
     c. Paint one brush stroke - the stroke() code appears in the editor.
     d. Drag the sun on the canvas - the literals rewrite themselves.
     e. Import a photo at Ultra - watch the trace land in a new tab, layers
        pane filling with named subjects.
     f. Change `const MEDIUM = 'oil'` to 'watercolor' - whole painting
        re-renders. This is the money shot; hold it.
     g. Open the Great Wave from the gallery, hit Replay for 8 seconds.
     h. End card: "The code and the canvas are the same artwork. paintlang.com"
   - Export a 16:9 master + a 9:16 vertical crop (shots e-g) for Shorts/Reels.
2. Analytics: enable Cloudflare Web Analytics (cookieless, no consent banner
   needed) on paintlang.com. FIRST update privacy.html: change the "no
   third-party trackers" line to disclose Cloudflare's cookieless analytics -
   the policy must stay truthful.
3. Dry-run the funnel end to end as a stranger: incognito -> gallery ->
   open a piece -> replay -> import a photo -> sign in with Google -> save ->
   see the Upgrade button. Fix anything that feels rough BEFORE traffic.
4. Create an X/Twitter account (@paintlang if free) and a personal post
   drafted. Optional: a Discord server with #showcase, #help, #components.
5. Verify one real Dodo card purchase + refund (checks live event names).

## Phase 1 - launch week (order matters)

Day 1 - Show HN (Tuesday-Thursday, 8-10am ET):
  - Title: "Show HN: Paintlang - a live-coding painting studio where dragging
    the art rewrites the code" (concrete, no hype words).
  - URL: https://paintlang.com (not the gallery - HN wants the tool).
  - Immediately post a first comment: the story (saw live-coded music, wanted
    it for painting), what is hard (bidirectional literal rewriting,
    image-to-code tracing), what is free vs paid, ask for feedback. Answer
    every comment for the first 6 hours - HN rewards present founders.
  - Do NOT ask anyone to upvote; ranking penalties are real.

Day 2-4 - Reddit, one sub per day (each sub hates cross-posted spam):
  - r/InternetIsBeautiful: lead with the GALLERY link ("Van Gogh as a program
    that paints itself").
  - r/creativecoding + r/generative: lead with the studio and the MEDIUM
    one-word re-render.
  - r/SideProject or r/indiehackers: lead with the build story + dual-rail
    payments as an Indian founder (that story is genuinely useful there).
  - Read each sub's self-promo rules first; participate in comments.

Day 5 - Product Hunt:
  - Launch 12:01am PT. Gallery: 5-6 images (studio, gallery room, layers
    pane, MEDIUM flip before/after, Upgrade panel) + the demo video.
  - Tagline: "Paint with code, code by painting". First comment = maker story.

All week - X thread: 6-8 tweets mirroring the video shots as clips/GIFs,
  ending with the gallery link. Pin it.

## Phase 2 - content engine (weekly, sustainable)

- One "room release" post per week: pick a gallery artist, post the replay
  video of one piece + its story + open-the-code link. This is the SEO star
  compounding: every post links paintlang.com/gallery.html.
- Vertical replay clips to YouTube Shorts / Instagram Reels / TikTok - replay
  is natively hypnotic; zero extra production cost (gallery-gen makes more
  pieces whenever needed; AIC has thousands of CC0 works).
- Repost the best community library contributions with credit.
- Monthly: regenerate gallery with 2-3 new pieces (server/gallery-gen.mjs,
  then node og-gen.mjs, commit gallery/ + assets/).

## Phase 3 - SEO (background, compounding)

1. Add sitemap.xml (/, gallery.html, terms, privacy) + robots.txt.
2. Long-term: per-artist gallery pages (/gallery/van-gogh.html) - 10 indexed
   pages targeting "artist name + interactive/code" queries.
3. JSON-LD is already on the studio; add VisualArtwork schema to gallery
   pieces when doing per-artist pages.

## Phase 4 - community and education (weeks 2-6)

- Watch GitHub issues + Discord daily during launch month; fast replies
  convert critics into contributors.
- Education pilot: email 5-10 CS/art teachers (or post in r/CSEducation):
  free classroom use, ask only for a 20-minute feedback call. Two pilots =
  the education tier's requirements list (org accounts, class galleries,
  assignment templates).
- Library seeding: keep official components growing weekly so the library
  never looks stale; add search/tags when it passes ~40 items.

## Phase 5 - measure, then price (weeks 3-8)

Watch (worker-side numbers via D1/dashboards):
  - traces/day by tier, signups/day, saves/day, upgrade clicks vs completions,
    which limit users actually hit first (works cap vs ultra cap).
Decide only after data:
  - whether free ultra 10/day is too generous or too stingy,
  - whether the first paid seam should move (e.g. private share links),
  - annual plan (2 months free) once monthly churn is known.

## Standing engineering next steps (from the roadmap)

1. Component library v2: search, tags, insert-preview thumbnails.
2. Fluent component syntax (use('name').at(x,y)) as the import format.
3. 4x/print HD export (real render-pipeline work) as a Pro feature.
4. Figma tracer plugin. 5. Tracer API keys + metering for B2B licensing.

## Compliance queue (before serious revenue)

CA: GST registration + LUT (zero-rate exports). Lawyer: terms/privacy review.
Rotate Razorpay keys + Dodo secret (passed through chat once). e-FIRA
certificates from the bank for Dodo/foreign payouts.
