import bpy, json, math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'outputs/palm-contact-geometry.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
skin=bpy.data.materials.new('skin');skin.diffuse_color=(.73,.46,.34,1)
coat=bpy.data.materials.new('body');coat.diffuse_color=(.11,.02,.035,1)
faces=[data['indices'][i:i+3] for i in range(0,len(data['indices']),3)]
for i,sample in enumerate(data['samples']):
    x=(i-2)*2.65
    mesh=bpy.data.meshes.new('contact');mesh.from_pydata(sample['vertices'],[],faces);mesh.update()
    hand=bpy.data.objects.new('hand',mesh);bpy.context.collection.objects.link(hand);hand.location.x=x;mesh.materials.append(skin)
    for p in mesh.polygons:p.use_smooth=True
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=(x,-.05,0))
    body=bpy.context.object;body.scale=(.88,.82,.76);body.data.materials.append(coat)
    for p in body.data.polygons:p.use_smooth=True
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL'
bpy.ops.object.camera_add(location=(0,1.109,7.922))
camera=bpy.context.object;camera.rotation_euler=(-math.atan2(1.109,7.922),0,0);camera.data.type='ORTHO';camera.data.ortho_scale=13.5;scene.camera=camera
scene.render.resolution_x=1850;scene.render.resolution_y=550;scene.render.resolution_percentage=100
scene.render.filepath=str(root/'outputs/palm-stroke-contact.png');bpy.ops.render.render(write_still=True)
