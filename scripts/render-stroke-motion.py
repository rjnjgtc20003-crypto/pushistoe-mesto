"""Contact-sheet check of the actual runtime geometry throughout one stroke."""
import bpy,json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'outputs/stroke-motion-geometry.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
skin=bpy.data.materials.new('skin');skin.diffuse_color=(.73,.46,.34,1)
coat=bpy.data.materials.new('coat');coat.diffuse_color=(.11,.02,.035,1)
faces=[data['indices'][i:i+3] for i in range(0,len(data['indices']),3)]
chosen=[4,12,16,25,42,59,68,74,81]
for i,index in enumerate(chosen):
    sample=data['samples'][index];x=(i%3-1)*2.9;y=(1-i//3)*2.8
    mesh=bpy.data.meshes.new('hand');mesh.from_pydata(sample['vertices'],[],faces);mesh.update()
    hand=bpy.data.objects.new('hand',mesh);bpy.context.collection.objects.link(hand);hand.location=(x,y,0);mesh.materials.append(skin)
    for p in mesh.polygons:p.use_smooth=True
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=(x,y-.05,0))
    body=bpy.context.object;body.scale=(.88,.82,.76);body.data.materials.append(coat)
    for p in body.data.polygons:p.use_smooth=True
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL'
bpy.ops.object.camera_add(location=(0,0,15))
camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=9.3;scene.camera=camera
scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.filepath=str(root/'outputs/stroke-motion-sheet.png');bpy.ops.render.render(write_still=True)
