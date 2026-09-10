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

## Palm-supported stroking

The stroking gesture now uses five sampled points on the deformed palmar skin.
Their centre and plane define contact, rather than the centre of the whole hand
model. During contact, the hand is aligned tangentially to the head and the palm
is seated above the body on the compressed coat. Fingers remain nearly extended;
fur beneath the palm is constrained to its contact plane within a soft footprint.
The correction blends out on approach and release and is computed in the common
scene rig so viewing rotation cannot change the contact.

The live `pet` action now uses `stroke-motion.js`, not the uneven editor keys.
The original keyframes remain archived in `pet.json` with their original timing;
its `playback` section identifies the live controller and duration. One 4.2-second
gesture comprises 0.8 s lowering, 2.6 s left-to-right travel and 0.8 s lifting.
Quintic phase easing gives zero velocity and acceleration at the phase joins.
Travel is parameterized by distance along the head's ellipse; the surface normal
controls hand rotation continuously. Palm seating is exact throughout, including
the approach/lift offset, so there is no distance-triggered snapping correction.
Fur direction uses the analytical path tangent rather than a noisy difference
between editor samples. Hand visibility fades at the start and finish.

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

`check-stroke-motion.mjs` checks 505 successive posed-hand transforms, monotonic
stroke travel, contact orientation, maximum speeds/acceleration and both sides
of every phase join. `render-stroke-motion.py` renders nine chronological samples
of the same runtime-deformed geometry. This checks the animated trajectory;
it does not measure frame-rendering performance on physical phones.
