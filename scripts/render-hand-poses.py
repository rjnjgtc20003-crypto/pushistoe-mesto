import bpy, json, math
from pathlib import Path
from mathutils import Vector, Quaternion
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'outputs/hand-rig.blend'))
source_mesh=bpy.data.objects['AnatomicalHand']
source_arm=bpy.data.objects['HandSkeleton']
samples=json.loads((root/'outputs/hand-pose-samples.json').read_text())
mat=bpy.data.materials.new('Warm skin');mat.diffuse_color=(0.73,0.46,0.34,1)
for i,sample in enumerate(samples):
    arm=source_arm.copy();arm.data=source_arm.data.copy();bpy.context.collection.objects.link(arm)
    mesh=source_mesh.copy();mesh.data=source_mesh.data.copy();bpy.context.collection.objects.link(mesh)
    mesh.parent=arm;mesh.modifiers['Skeleton'].object=arm
    mesh.data.materials.clear();mesh.data.materials.append(mat)
    arm.location=(.84+(i-1.5)*.96,1.70,.10)
    for name,angles in sample['pose'].items():
        bone=arm.pose.bones[name];bone.rotation_mode='QUATERNION'
        x,y,z=[math.radians(a) for a in angles]
        bone.rotation_quaternion=Quaternion((1,0,0),x) @ Quaternion((0,1,0),y) @ Quaternion((0,0,1),z)
source_mesh.hide_render=True;source_arm.hide_render=True
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
scene.world.color=(.06,.06,.06)
bpy.ops.object.camera_add(location=(0,-2.6,3.7))
camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=4.1;scene.camera=camera
scene.render.resolution_x=1500;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.render.filepath=str(root/'outputs/hand-poses.png');bpy.ops.render.render(write_still=True)

# Render the actual authored transforms against a body proxy, in Three.js axes.
for o in list(bpy.data.objects):
    if o not in [source_mesh,source_arm,camera]: bpy.data.objects.remove(o,do_unlink=True)
center=Vector((-.837816,-1.6898845,-.101304))
for i,(gesture,frame,pressure) in enumerate([('pet',8,.85),('head-pat',13,1),('squeeze',11,.9)]):
    track=json.loads((root/f'public/github-site/assets/{gesture}.json').read_text(encoding='utf-8'))
    key=min(track['keyframes'],key=lambda k:abs(k['frame']-frame))
    for side in (['left','right'] if gesture=='squeeze' else [None]):
        value=key[side] if side else key
        arm=source_arm.copy();arm.data=source_arm.data.copy();bpy.context.collection.objects.link(arm)
        mesh=source_mesh.copy();mesh.data=source_mesh.data.copy();bpy.context.collection.objects.link(mesh)
        mesh.hide_render=False;mesh.parent=arm;mesh.modifiers['Skeleton'].object=arm
        mesh.data.materials.clear();mesh.data.materials.append(mat)
        model=bpy.data.objects.new('model',None);bpy.context.collection.objects.link(model);arm.parent=model;model.location=-center
        posed=bpy.data.objects.new('pose',None);bpy.context.collection.objects.link(posed);model.parent=posed
        posed.rotation_mode='QUATERNION';posed.rotation_quaternion=Quaternion((1,0,0),math.pi*.46) @ Quaternion((0,0,1),math.pi/2)
        action=bpy.data.objects.new('action',None);bpy.context.collection.objects.link(action);posed.parent=action
        action.location=value['position'];action.location.x+=(i-1)*3
        if gesture=='squeeze':action.location.x+=(-1 if side=='left' else 1)*.17
        else:action.location.y-=.05
        q=value['quaternion'];action.rotation_mode='QUATERNION';action.rotation_quaternion=(q[3],q[0],q[1],q[2])
        action.scale=(-1.24 if side=='right' else 1.24,1.24,1.24)
        sample=next(s for s in samples if s['gesture']==gesture and s['pressure']>0)
        for name,angles in sample['pose'].items():
            bone=arm.pose.bones[name];bone.rotation_mode='QUATERNION';x,y,z=map(math.radians,angles)
            bone.rotation_quaternion=Quaternion((1,0,0),x) @ Quaternion((0,1,0),y) @ Quaternion((0,0,1),z)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=((i-1)*3,-.05,0))
    body=bpy.context.object;body.scale=(.88,.82,.76)
    bodymat=bpy.data.materials.new('body');bodymat.diffuse_color=(.10,.014,.03,1);body.data.materials.append(bodymat)
    for p in body.data.polygons:p.use_smooth=True
camera.location=(0,1.109,7.922);camera.rotation_euler=(-math.atan2(1.109,7.922),0,0)
bpy.context.view_layer.update()
print('CONTACT CAMERA',camera.matrix_world)
print('CONTACT HANDS',[(o.name, list(o.matrix_world.translation)) for o in bpy.data.objects if o.name.startswith('action')])
camera.data.ortho_scale=9
scene.render.resolution_y=650;scene.render.filepath=str(root/'outputs/hand-contact.png');bpy.ops.render.render(write_still=True)
