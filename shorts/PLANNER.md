# Motion planner contract

This is the authoring guidance for the current coding assistant and a future Gemini adapter. Emit JSON matching `brief.schema.json`, then pass `briefSchema` and `compileStory` validation. Do not emit JSX, JavaScript, image-generation requests, or properties outside the schema.

## Content profiles

The workflow supplies a genre: `what-if`, `mythology`, or `explainer`. Preserve it through the brief and prepared video input. Mythology is a traditional narrative with conflict, refuge/transformation, and meaning; it must not be forced into an alternate-universe experiment. Its source attribution stays in narration and metadata. For a suitable story, use `symbolic-story`: a continuous illustrated subject, not a new static slide for each sentence. The module accepts moon/flame/lotus symbols and a Shiva icon, protective sanctuary arch, or no guardian. Select Shiva only when the approved narration explicitly concerns Shiva; do not repurpose it as another deity. If the vocabulary does not fit, use the generic actor planner honestly or extend the reusable library deliberately.

## Plan actions before captions

For each narration cue, identify the subject and the physical or conceptual change that explains it. Decide which objects move, deform, separate, stop, grow, or retain their state. Then express those changes as object-property keyframes. Use the script to describe the visible explanation.

Examples:

- A rotating subject stops while another keeps moving: hold the first object's `phase` while advancing the other's position/phase.
- Water overtops a coast: increase a waves actor's `amplitude`, advance `phase`, and move its surface relative to a city actor.
- A weaker downward force: keep the mass object unchanged, shorten its force arrow, and reduce the numeric weight readout.
- Slower free fall: use different durations with `accelerate` easing for the same start/end height.

A camera push, title entrance, particles, color flash, or zoom on a still is not the explanatory action. Each scene must change a supported subject property beyond opacity; camera-only, text-only, and particle-only scenes are rejected. This structural check does not judge whether the explanation is engaging or scientifically correct: review the script and rendered motion.

## Supported visual vocabulary

| Kind | Capability | Additional animated properties |
| --- | --- | --- |
| `planet` | Textured Earth sphere using the bundled NASA map | `phase` in radians |
| `shape` | Circle, rectangle, arrow, ring | Common transforms |
| `text` | Labels, a short hook, numeric readouts | `value` for numeric text |
| `city` | Seeded procedural skyline | Common transforms |
| `waves` | A layered surface that deforms | `phase` in radians, `amplitude` in pixels |
| `particles` | Seeded moving streak field | `phase` in field widths |
| `orbit` | Elliptical path with a marker | `phase` in radians |
| `sacred-symbol` | Om glyph, illustrative ripples, A/U/M associations and quiet reflection | `phase` from 0 to number of steps |
| `symbolic-story` | Continuous symbolic narrative with reveal/diminish/approach/protect/renew steps | `phase` from 0 to number of steps |
| `comparison` | Two-body force, fall, or equal-speed launch experiment | `phase` as progress 0–1 |

Every actor supports `x`, `y` (stage pixels), `scale`, `rotation` (degrees), and `opacity`. Camera supports only `x`, `y`, `scale`. Initial state is in `actor.state`. Other initial state channels default to neutral values and are only usable on the kinds listed above. Do not use the textured Earth for a different named planet; use abstract shapes or request a deliberate library extension.

For supported mechanics stories, prefer the comparison director: choose a shared `gravityRatio`, labels, and one `force`, `fall`, or `launch` demonstration per scene. The renderer calculates relative trajectories and results from the same initial conditions. Fall time varies as 1/√gravityRatio; equal-speed launch height and airtime vary as 1/gravityRatio; weight varies as gravityRatio at fixed mass. `focus:time` displays airtime for a launch; `focus:height` displays height. The module owns its consistent layout, sphere shading, trails, labels and readouts. Do not add planet backdrops, arbitrary worked examples or unrelated actors. The module assumes ideal mechanics without air resistance and does not support anatomy, atmosphere, collisions or promises about clearing ceilings. Use the general actor engine when the complete story cannot faithfully use these mechanisms.

## Timeline

Define named actors once at the top level. All scenes operate on this shared world. Property values carry into the next scene. Objects keep their identity; the renderer does not replace the world at each narration boundary.

Each scene contains `title`, `cues`, and `motion`. Scene titles are metadata, not automatic title slides. Cues are synthesized in order, then their actual durations determine keyframe times. Keep the narration to roughly 85–110 words for a 30–45 second video, and inspect the measured result.

A motion track has `actor`, `property`, and ordered `keyframes`. Anchors are `start`, `end`, or `{ "cue": 0, "offset": 0.5 }` for halfway through cue zero. Easing belongs to the destination keyframe: `linear`, `smooth`, `hold`, `accelerate` (t²), or `decelerate` (1 − (1 − t)²). Before an explicit first keyframe, the old value holds. A differing first value is an explicit reposition, so hide the actor first if that jump should not be visible.

Use `hold` for discontinuous events and actual stops. Use `linear` for constant rates. Match start/end states across related actions. Motion is illustrative unless a calculation explicitly warrants a quantitative claim.

Keep constant factual readouts constant. Do not count a fixed speed upward from zero unless the narration actually describes an acceleration. Animate numeric values when the underlying quantity changes, as with a reduced weight or elapsed time. Fade unused labels promptly rather than leaving faint text over later explanations.

## Composition

Use the original clean motion-graphics style. Give the subject most of the vertical canvas. Keep important content within x=70–925 and y=200–1350 on the 1080×1920 stage; lower captions occupy y≈1470. Deliberate cropping of large geometry is allowed. Put a hook on screen briefly, then free the space for the explanation. Labels should sit next to the object they explain. Avoid a repeating headline/illustration/statistic layout and large text hits on every sentence.

Use camera movement only to reveal a relationship or follow a subject. Do not use decorative shake, flashes, spinning words, or repeated crash sounds as substitutes for motion design. Prefer a continuous visual explanation over a sequence of unrelated shots.

## Scope and validation

The library is intentionally small. If the subject cannot be meaningfully represented by these primitives, flag that gap for a reusable library extension instead of inventing unsupported assets or emitting an irrelevant Earth scene. This is a capability limitation, not something to hide with a still image.

The GroqCloud adapter uses this contract to plan a shared cast and then motion tracks for each approved narration scene. All outputs pass runtime validation before the existing local renderer is called. The script is generated in a separate stage and is preserved verbatim during motion planning. Unsupported visual concepts must fail or be expressed honestly using supported primitives; never invent a new primitive or fall back to an unrelated Earth image. The same contract can be used by another model provider later.


## Timed symbol explainers

An optional `structure` fixes beat names, durations, a verbatim hook, and a closing-question requirement. Match each approved script scene to its beat; narration is measured and fitted before animation anchors resolve. Custom structures total 30–60 seconds; absent a structure, the original 30–45-second contract remains.

The `sacred-symbol` director supports Om with reveal/resonate/states/silence/reflect modes. Each of the three ordered A/U/M associations names a zero-based narration `cue` in the single states scene. Headings and meanings must reflect the approved script, not invent physical frequencies or claims about the modern glyph's curves. The renderer owns local font loading, geometry, wave motion and cue-linked emphasis. Keep scriptural interpretation attributed to the actual text/tradition.


## Delivery is part of the script contract

An optional scene `delivery` declares per-cue rates, pausesAfterMs and a maximum end hold. Motion planning must preserve this object verbatim alongside display and spoken cues. Measured narration and planned pauses determine cue times. Explicit delivery rejects beat overflow and unplanned dead air instead of speeding speech up. Keep actor animation anchored to the original narration cue; phrase caption chunks are a presentation layer and must not become new motion anchors.

For Shorts, use familiar examples and a specific curiosity hook. Each beat should advance the explanation. Avoid repeating definitions or padding word counts. A brief listening beat may serve the payoff when supported by the content. These instructions also apply to source adaptations; keep theological interpretation attributed and preserve source facts.
