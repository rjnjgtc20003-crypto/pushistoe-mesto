# Hand animation: anatomical references and implementation

The hand is now a 21-bone skin, generated from the supplied OBJ. Each of the four
fingers has a metacarpal and MCP/PIP/DIP chain; the thumb has CMC/MCP/IP controls;
the wrist and forearm are separate. Bone heat weights are computed on the
connected control mesh in Blender and interpolated through two subdivisions.
The browser uses indexed geometry, four normalized influences per vertex, and
Three.js SkinnedMesh. Two hands have independent skeletons.

## Sources consulted

- [Leijnse et al., 2010: interphalangeal coupling and its variability](https://pubmed.ncbi.nlm.nih.gov/20483414/).
  Supports coordinated, but not universally identical, PIP/DIP movement.
- [Coordination of thumb joints during opposition](https://pubmed.ncbi.nlm.nih.gov/16643926/).
  Supports combined thumb CMC flexion/pronation and inter-joint coordination.
- [Santello, Flanders and Soechting, 1998: postural hand synergies](https://pmc.ncbi.nlm.nih.gov/articles/PMC6793309/).
  Supports coordinated hand postures for grasping rather than independently
  random joint motion.
- [Three.js SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html).
  Skeleton binding, joint indices and vertex weights.
- [Blender Armature modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/armature.html).
  Skin deformation and the distinction between linear and volume-preserving skinning.

The 2016 PLOS article “Biomechanical Characteristics of Hand Coordination in
Grasping Activities of Daily Living” was excluded after checking the publisher's
retraction notice.

## Scope of the approximation

This is an anatomically informed animation, not motion capture or a biomechanical
simulation. Angles, delays and the 0.64 distal/middle flexion ratio are artistic
choices for these gentle gestures, not measured values or universal anatomy.
Joint angles stay in conservative flexion ranges. Skin is linearly blended;
there is no tendon solver or full collision simulation.

`hand-poses.js` defines distinct relaxed, stroking, patting and squeezing postures.
The ring/little side cups further; the thumb opposes and rotates. Per-joint
time-based responses provide overlapping motion at different display rates.
Gesture tracks retain the user's positioning and orientation, play at 1/1.3 of
their old speed, and end with a brief release/withdrawal.

## Reproduction and verification

1. Run Blender with `--background --python scripts/build-hand-rig.py`.
2. Run `node scripts/check-hand-rig.mjs`.
3. Run Blender with `--background --python scripts/render-hand-poses.py`.

The editable rig and diagnostic renders are generated in ignored `outputs/`.
Only `assets/hand-rig.json` is sent to the browser. Diagnostic renders compare
four poses and the authored hand transforms against a body proxy. They are
asset checks, not browser/device testing.

## Palm-supported stroking, revision 3

The original uneven editor keys remain archived in `pet.json`, with their original
timing. The `playback` section identifies the current live controller.

`stroke-motion.js` now uses one 4.6-second travel curve. A smooth velocity ramp at
the beginning/end surrounds a constant-speed middle section. Lowering over
0–1.15 s and lifting over 3.45–4.6 s OVERLAP that travel. The old implementation
stopped completely between its three independent phases; the new curve does not
stop or form geometric corners at contact/release.

The palm's orientation follows only part of the inner body's curvature. The wrist
and relaxed fingers change pose throughout the pass, rather than maintaining one
pose while the whole model rotates. Joint response remains time based. These
small angle choices are artistic, not motion-capture data.

Five deformed skin points establish the local palm frame. An additional 130 skin
samples cover the heel, palm edges, thumb and finger pads. `supportPalm` solves
ray/ellipsoid distances to keep them outside a padded body surface. A smooth
maximum blends between supporting samples without a contact-switching jerk.
This is a broad contact approximation, not a full hand/tendon physics solver.
Full-mesh checks at 20 Hz additionally test unsampled vertices against the body.

Hand scale increased from 1.24 to 1.55 (25%). This is a visual proportion choice
for the stylized character, not a claim about an average human hand/head ratio.
Archived pat/squeeze paths are retargeted around the actual palm centre so the
larger meshes do not inadvertently shift the established hand contact locations.

The fur contact footprint now follows the palm's orientation and larger size.
All contact calculations use the shared interaction rig and the current breathing
transform, so rotating the scene does not move the palm relative to the creature.
Portrait framing reserves horizontal space for the larger hand and the full coat.

Hand shaders are compiled before buttons become enabled, then geometry/bone
textures and the canvas-output shader variant are warmed with offscreen and
scissored draws. See [WebGLRenderer.compileAsync](https://threejs.org/docs/pages/WebGLRenderer.html#compileAsync).
The ordinary scene is redrawn before yielding back to the browser, so the warm-up
does not display a hand on the character.

Reference: [ASPCA Feline-ality guide, item 8, PDF page 77](https://www.aspcapro.org/sites/default/files/Feline-ality%20Guide_PRO.pdf#page=77)
describes long strokes with an open, slightly cupped hand. This supports the
gesture choice; it does not prescribe our artistic contact offsets or angles.
The literature also distinguishes full-palm stroking from two-finger stroking:
[I wanna hold your hand](https://pmc.ncbi.nlm.nih.gov/articles/PMC10079127/).

`node scripts/check-palm-contact.mjs` verifies palmar placement, tangency and
invariance under scene rotation at five authored contact keyframes, and exports
the actual runtime-deformed hand geometry. `scripts/render-palm-contact.py`
renders that geometry against the body for inspection. These checks use the
same local Three.js cache as `check-hand-runtime.mjs`.

`check-stroke-motion.mjs` checks 553 successive posed-hand transforms, monotonic
supported-palm travel, nonzero speed at contact/release, scalar and vector
acceleration, view-rotation invariance and full-mesh body clearance. The current
maximum speed is 0.857 units/s; maximum change in speed is 2.331 units/s².
`render-stroke-motion.py` can render nine chronological mesh samples.

`check-browser-motion.mjs` runs an isolated, headless Chrome instance without
Computer Use. It compares the published page with the local candidate, times the
animation callbacks, plays all three gestures, and captures separate static
checks from multiple angles and a 390 × 844 / DPR 3 viewport. Tests of a small
viewport still use the desktop GPU; they do NOT certify iPhone/Android hardware
or Safari. `MOTION_SITE_ROOT` selects a built site and `MOTION_REPORT_DIR` keeps
separate baseline/candidate reports. Set `PLAYWRIGHT_MODULE` when using a bundled
Playwright installation instead of a project dependency.

In the September 10 headless test, first-pet max frame interval fell from 61.5 ms
on the published baseline to 7.6 ms on the candidate, and the warm candidate was
7.5 ms. The DPR 3 candidate had a 30.1 ms first-run interval and a 10.2 ms warm
maximum; the desktop result is not a guarantee of identical device performance.

`build-github-site.mjs` pins local module and fetched asset URLs to one content
revision for GitHub Pages, avoiding mixed old/new cached modules after a release.
