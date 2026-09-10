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

## Palm-supported stroking, revision 3 (superseded contact approximation)

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

## Distributed palm support and persistent fur response, revision 4

The research-led change is scoped to **petting**. The current hand scale (1.55),
the archived authoring tracks, the other two gestures, face and colour modes are
preserved. This is still an artistic approximation, not a tendon/skin solver.

The palm now follows the full surface normal. The previously flattened rotation
arc put the trailing fingers into the body, and the collision guard lifted the
whole palm to accommodate them. Contact clearance is 0.045 scene units and the
petting MCP/PIP/DIP poses remain open. The support guard uses a compact smooth
maximum; non-contacting samples no longer accumulate an artificial air gap.

`check-palm-support.mjs` classifies posed skin into palm, heel, knuckle pads and
finger regions. The middle-of-pass palm median gap fell from 0.172 to 0.060
scene units. At the measured contact times, roughly 80-83% of the central palm
samples are within 0.10 units of the core, alongside heel/knuckle support. These
are **sample-based geometric diagnostics**, not physical pressure or measured
contact area. The tolerances are regression thresholds for this scene, not
human biological standards. The full-mesh collision and continuous-motion tests
also remain in place.

`fur-response.js` carries a 64 x 32 persistent comb field in creature-local
coordinates. It samples the deformed palmar skin (including wrist and side
coverage separate from body-support samples). No petting dent is triggered by
the pressure timeline alone. Nearby skin sets a bending target; released bends
decay over time. The same field drives the dense rendered coat using two small
linearly filtered half-float textures, with no per-hair CPU simulation.

The centreline turns over its first fifth and continues tangentially, preserving
arc length before collision correction. A conservative interpolated skin-plane
guard still modifies the curve during contact: this is not an exact strand/mesh
collision or friction solver, and it can shorten the numerical curve locally.
Guide interpolation and occlusion by foreground fur remain approximations.
Switching directly to a legacy gesture clears the comb field to avoid applying
both its old compression and a retained petting bend to the same hairs.
The coat has more samples along the root bend but fewer radial faces, reducing
the triangle count without reducing the number of hairs.

Checks:

- `node scripts/check-palm-support.mjs`: broad palm/heel/knuckle proximity, not
  just fingertip non-penetration. `CONTACT_REPORT` names the diagnostic export.
- `node scripts/check-fur-response.mjs`: pre-collision arc length, localized
  contact, no dent beneath a hovering hand, gradual recovery, 30/60/120 Hz.
- `node scripts/check-stroke-motion.mjs`: 553 successive poses, surface-relative
  rotation invariance, continuity, whole-mesh clearance. Maximum speed 0.791,
  angular speed 0.617, scalar acceleration 2.176 in scene units and seconds.
- `node scripts/preview-palm-stroke.mjs`: isolated headless chronological and
  front/side/back/top previews, including the bare core. The existing browser
  benchmark checks real-time playback and a phone-sized DPR 3 viewport.

The research report is a separate local artifact; it is not deployed with the
site. The ANSUR/AIST measurements do not certify this sphere as a human head or
justify further hand scaling without measuring the model's anatomical landmarks.

On the Intel UHD desktop headless check, the new petting callback cost had a
1.9 ms p95 and the run maintained about 144 fps. The 390 x 844 / DPR 3 viewport
averaged about 106 fps, with one 36 ms first-run interval and an 11.7 ms warm
maximum. These are desktop measurements, not actual iPhone/Android benchmarks.

## Shared palm contact for all three gestures, revision 5

This revision extends skin-driven contact to **head-pat and squeeze**. The editor
JSON files are preserved unchanged as archives. `contact-gestures.js` retargets
their three-contact pattern to actual palm centres, with new quintic approach,
press and release beats (3.1 s for pats, 4.1 s for squeezing). These are artist-tuned
paths, not captured human motion or a literal playback of every editor key.
Hand scale stays 1.55; the face assets, colour modes and six-button UI are unchanged.

Both hands now use the same support ellipsoid as the rendered body. Opposing
palms have mirrored contact targets; pressure starts after entering the long
coat, and the body and hair roots share the same squash transform. The old
shader-only cheek dent and timeline-triggered hair shortening are removed: they
could move hair independently of the body and the contacting skin. The existing
small facial squeeze response remains.

The fur field accepts separate skin samples, normals and spreading directions
for each palm. A pat/squeeze lays the coat away from the pad centre; stroking
combs along the stroke. Switching gestures no longer erases the released bend.
The contact-plane approximation still is not exact per-strand collision or a
friction solver, and can leave local silhouette/occlusion imperfections.

A small precomputed morph compresses the fleshy palm pads and subtly widens
them under pressure. Its influence responds over time. CPU contact uses
`SkinnedMesh.getVertexPosition`, including both this corrective and bone skinning,
so it measures the same surface as the renderer. This is a bounded corrective,
not a soft-tissue simulation, and introduces no per-frame mesh reconstruction.
Finger flexion stays mild instead of curling into a grasp.

The support offset now relaxes over 70 ms, using at most 0.020 of its 0.035-unit
coat margin. This removes the acceleration spike when the supporting skin sample
changes, without letting the full checked mesh enter the body. The archived
static helper remains available without temporal smoothing for old diagnostics.

Verification (scene-unit tolerances, not anatomical claims):

- `check-contact-gestures.mjs`: 120 Hz poses, full-mesh body clearance sampled at
  10 Hz, broad palmar proximity at peak pressure, mirrored squeeze targets and
  invariance under scene rotation. Minimum normalized body distance: 1.037 for
  patting and 1.031 for squeezing; peak-pressure central-palm median gap stays
  below 0.078 units. Maximum angular speed is below 0.59 rad/s for both gestures.
- The same test caught a support-switch acceleration spike in squeezing;
  temporal contact support reduced it from 27.8 to 7.44 units/s².
- `check-fur-response.mjs`: separate two-palm response, symmetry, contact-order
  independence and retained recovery when one hand leaves, in addition to the
  earlier single-palm and frame-rate tests.
- Rig and stroke regressions include the pad morph in CPU vertex measurements.
  Petting still passes the 553-pose trajectory and whole-mesh clearance checks.
- `preview-palm-stroke.mjs` now captures all gestures from front/side/back/top,
  bare-body contact views and chronological samples. `CONTACT_PREVIEW_SCENE_ROOT`
  can select the built, cache-versioned output for verification before publishing.

Headless Chrome is used without Computer Use. Phone-sized viewport checks still
run on a desktop GPU; real iPhone/Safari and Android device testing remains open.

## Viewer-centred staging and cheek contact, revision 6

The user clarified that symmetry means the **visible leading fingertips at the
start and trailing cuff at the end**, not equal palm-centre angles. Their example
degrees were explanatory, not animation coordinates. The new palm path is
deliberately asymmetric to balance the actual projected hand. Screen-space
checks use the scene's front camera, the skinned fingertip region and cuff edge;
their reflected angular extents differ by under 3 degrees at matched approach,
contact and release samples. This is a visual regression tolerance, not anatomy.

Petting now has two 2.9-second left-to-right passes and a 1.65-second elevated
return (7.45 seconds total). The return does not stroke backwards. Pressure,
position and opacity join continuously. Whole-mesh checks keep curled fingers
clear of the core, and the moving middle return clears the longest coat. The
return gently opens the fingers and stays below the top controls. Finger MCP,
PIP and DIP poses now change on landing/release with small individual variations
during contact; distal joint excursions are roughly 3–4 degrees instead of zero.
The wrist also changes its pose rather than keeping a single loose-hand angle.

Palm placement now constrains both the facing normal and the longitudinal
finger direction. Wrist articulation still works against the contact constraint:
holding a palm on the surface necessarily limits its global rotation. The
visible motion comes from coordinated finger changes and the wrist/cuff relative
to that palm, not from rotating the whole contact plane away from the body.

Patting keeps its rhythm but is centred by its visible footprint. Squeezing uses
front/lower cheek anchors and explicit finger directions, with wrists extending
toward +Z (the viewer in the initial view). The entire rig still rotates together;
hands never billboard or chase the camera. The approach has a forward-depth
component instead of arriving from beneath the body.

`body-shape.js` provides a bounded, symmetric radial cheek indentation. The core
shader, persistent fur roots/normals, and palm support all use this same surface.
Global squeeze is reduced from 10.5% to 2.5%; most deformation is local to the
cheeks, leaving crown/back nearly unchanged. The fur gets a small additional
shape texture. Shape coefficients are precomputed so pressure updates do not
allocate per-root arrays each frame. This remains an artistic contact model,
not a full soft-tissue or strand-collision simulation.

Checks now include `check-visible-gestures.mjs` (both complete posed passes,
screen-space symmetry, moving distal joints and airborne return),
`check-stroke-motion.mjs` (repetition, forward contact and phase continuity),
`check-cheek-shape.mjs` (localized deformation, analytic/geometric normal agreement
and shared fur/body surface), and the updated contact tests (viewer-facing cuffs,
cheek location, visual pat centring, full-mesh clearance and view invariance).
The headless benchmark waits for the complete longer pet animation and checks
all three actions at phone viewport size. It still does not test real phones.

Authored keyframe arrays are preserved. The pet playback metadata documents the
new controller; it does not replace or reinterpret the user's archived keys.
