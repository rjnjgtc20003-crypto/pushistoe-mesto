"""Build a continuous, weighted hand from the supplied mesh; no runtime Blender dependency.
Run with Blender --background --python scripts/build-hand-rig.py.
Coordinates deliberately match the existing OBJ and authored gesture tracks.
"""
import bpy
import bmesh
import json
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/github-site/assets/hand-rig.json'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.obj_import(filepath=str(ROOT / 'public/github-site/assets/hand.obj'))
mesh = next(o for o in bpy.context.selected_objects if o.type == 'MESH')
for v in mesh.data.vertices:
    p = mesh.matrix_world @ v.co
    v.co = (p.x, p.z, -p.y)
mesh.matrix_world = Matrix.Identity(4)
mesh.name = 'AnatomicalHand'
if 'custom_normal' in mesh.data.attributes:
    mesh.data.attributes.remove(mesh.data.attributes['custom_normal'])
for edge in mesh.data.edges: edge.use_edge_sharp=False
surface=bmesh.new(); surface.from_mesh(mesh.data)
wrist_boundary=[edge for edge in surface.edges if edge.is_boundary
                and all(v.co.y < -2.17 for v in edge.verts)]
if wrist_boundary: bmesh.ops.holes_fill(surface,edges=wrist_boundary,sides=0)
surface.to_mesh(mesh.data); surface.free()

# Joint centres fitted to the actual mesh, not to a generic rectangular palm.
paths = {
    'index': [(-.80,-1.72,-.105),(-.793,-1.525,-.100),(-.761,-1.390,-.104),(-.747,-1.303,-.109),(-.746,-1.228,-.108)],
    'middle': [(-.91,-1.75,-.120),(-.904,-1.515,-.109),(-.897,-1.363,-.113),(-.889,-1.270,-.124),(-.889,-1.183,-.123)],
    'ring': [(-1.005,-1.77,-.131),(-1.009,-1.537,-.119),(-1.013,-1.395,-.129),(-1.010,-1.316,-.129),(-1.009,-1.235,-.130)],
    'little': [(-1.08,-1.80,-.142),(-1.109,-1.562,-.134),(-1.142,-1.464,-.130),(-1.153,-1.399,-.122),(-1.157,-1.336,-.117)],
    'thumb': [(-.875,-1.881,-.085),(-.744,-1.77,-.040),(-.650,-1.659,-.015),(-.539,-1.606,-.007)],
}
arm_data = bpy.data.armatures.new('HandSkeleton')
arm = bpy.data.objects.new('HandSkeleton', arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True); mesh.select_set(False)
bpy.ops.object.mode_set(mode='EDIT')
root = arm_data.edit_bones.new('forearm')
root.head = (-.97,-2.20,-.14); root.tail = (-.97,-2.025,-.14)
wrist = arm_data.edit_bones.new('wrist')
wrist.head = root.tail; wrist.tail = (-.94,-1.76,-.12); wrist.parent = root
for name, points in paths.items():
    previous = wrist
    labels = ['cmc','mcp','ip'] if name == 'thumb' else ['palm','mcp','pip','dip']
    for j, label in enumerate(labels):
        b = arm_data.edit_bones.new(f'{name}_{label}')
        b.head = points[j]; b.tail = points[j+1]; b.parent = previous
        b.align_roll(Vector((0,0,1)))
        previous = b
bpy.ops.object.mode_set(mode='OBJECT')

# Solve heat weights on the connected control mesh, then interpolate them during subdivision.
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
bpy.context.view_layer.objects.active = mesh
for mod in list(mesh.modifiers):
    if mod.type == 'ARMATURE': mesh.modifiers.remove(mod)
sub = mesh.modifiers.new('SkinSubdivision','SUBSURF'); sub.levels=2
bpy.ops.object.modifier_apply(modifier=sub.name)
for p in mesh.data.polygons: p.use_smooth=True

bones = list(arm_data.bones)
bone_ids = {b.name:i for i,b in enumerate(bones)}
group_names = {g.index:g.name for g in mesh.vertex_groups}
weights=[]; indices=[]
for v in mesh.data.vertices:
    w = sorted([(bone_ids[group_names[g.group]],g.weight) for g in v.groups
                if group_names[g.group] in bone_ids and g.weight>1e-7], key=lambda p:-p[1])[:4]
    if not w: raise RuntimeError(f'Unweighted vertex {v.index}')
    total=sum(p[1] for p in w)
    weights.extend([round(p[1]/total,7) for p in w]+[0]*(4-len(w)))
    indices.extend([p[0] for p in w]+[0]*(4-len(w)))
# Keep the editable/preview rig on exactly the same four influences as runtime.
for group in mesh.vertex_groups:
    group.remove(list(range(len(mesh.data.vertices))))
for i in range(len(mesh.data.vertices)):
    for j in range(4):
        weight=weights[i*4+j]
        if weight: mesh.vertex_groups[bones[indices[i*4+j]].name].add([i],weight,'REPLACE')
mesh.data.calc_loop_triangles()
data={'version':1,'bones':[],'positions':[],'normals':[], 'indices':[],
      'skinIndex':indices,'skinWeight':weights}
for b in bones:
    local = b.parent.matrix_local.inverted() @ b.matrix_local if b.parent else b.matrix_local
    p,q,s=local.decompose()
    data['bones'].append({'name':b.name,'parent':bone_ids[b.parent.name] if b.parent else -1,
                          'position':list(p),'quaternion':[q.x,q.y,q.z,q.w]})
for v in mesh.data.vertices:
    data['positions'].extend(round(c,7) for c in v.co)
    data['normals'].extend(round(c,7) for c in v.normal)
for tri in mesh.data.loop_triangles: data['indices'].extend(tri.vertices)
OUT.write_text(json.dumps(data,separators=(',',':')),encoding='utf8')
print(f'RIG: {len(bones)} bones, {len(mesh.data.vertices)} vertices, all weighted')

# Keep the editable rig for future pose/weight work (not shipped to the browser).
modifier=mesh.modifiers.new('Skeleton','ARMATURE'); modifier.object=arm
modifier.use_deform_preserve_volume=False # Match the runtime linear blend skinning.
preview_dir=ROOT/'outputs'; preview_dir.mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(preview_dir/'hand-rig.blend'))
