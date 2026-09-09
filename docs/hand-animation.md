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
