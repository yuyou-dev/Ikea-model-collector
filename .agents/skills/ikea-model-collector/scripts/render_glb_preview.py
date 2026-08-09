import argparse
import json
import struct
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata", required=True)
    argv = __import__("sys").argv
    return parser.parse_args(argv[argv.index("--") + 1 :])


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def compatible_copy(source):
    """Remove the optional dispersion extension when the local Blender lacks it."""
    data = source.read_bytes()
    chunks, offset, changed = [], 12, False
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        payload = data[offset + 8 : offset + 8 + length]
        if chunk_type == 0x4E4F534A:
            document = json.loads(payload.rstrip(b"\x00 "))
            for material in document.get("materials", []):
                extensions = material.get("extensions", {})
                changed = extensions.pop("KHR_materials_dispersion", None) is not None or changed
                if not extensions:
                    material.pop("extensions", None)
            for field in ("extensionsUsed", "extensionsRequired"):
                values = document.get(field, [])
                if "KHR_materials_dispersion" in values:
                    values.remove("KHR_materials_dispersion")
                    changed = True
                if not values:
                    document.pop(field, None)
            payload = json.dumps(document, separators=(",", ":")).encode()
            payload += b" " * (-len(payload) % 4)
        chunks.append(struct.pack("<II", len(payload), chunk_type) + payload)
        offset += 8 + length
    if not changed:
        return None
    rebuilt = bytearray(data[:12]) + b"".join(chunks)
    struct.pack_into("<I", rebuilt, 8, len(rebuilt))
    handle = tempfile.NamedTemporaryFile(suffix=".glb", delete=False)
    handle.write(rebuilt)
    handle.close()
    return Path(handle.name)


args = arguments()
model = Path(args.model).resolve()
output = Path(args.output).resolve()
metadata_path = Path(args.metadata).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
metadata_path.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
import_path = model
try:
    bpy.ops.import_scene.gltf(filepath=str(model))
except RuntimeError:
    import_path = compatible_copy(model)
    if import_path is None:
        raise
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(import_path))

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
if not meshes:
    raise RuntimeError("The GLB contains no mesh objects")
corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
minimum = Vector(tuple(min(v[i] for v in corners) for i in range(3)))
maximum = Vector(tuple(max(v[i] for v in corners) for i in range(3)))
center, size = (minimum + maximum) / 2, maximum - minimum
radius = max(size)
if radius <= 0:
    raise RuntimeError("The GLB has zero-size bounds")

bpy.ops.mesh.primitive_plane_add(size=radius * 30, location=(center.x, center.y, minimum.z - radius * 0.006))
floor = bpy.context.object
material = bpy.data.materials.new("Solid light gray background")
material.use_nodes = True
material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.5, 0.5, 0.5, 1)
material.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
floor.data.materials.append(material)

direction = Vector((1, -1, 1)).normalized()
bpy.ops.object.camera_add(location=center + direction * radius * 6)
camera = bpy.context.object
camera.data.type = "ORTHO"
look_at(camera, center)
bpy.context.view_layer.update()
projected = [camera.matrix_world.inverted() @ corner for corner in corners]
width = max(p.x for p in projected) - min(p.x for p in projected)
height = max(p.y for p in projected) - min(p.y for p in projected)
camera.data.ortho_scale = max(width, height) * 1.28
bpy.context.scene.camera = camera

for name, location, energy, area in (
    ("Key", (center.x - radius * 2, center.y - radius * 2.8, center.z + radius * 4.5), 620, radius * 2.5),
    ("Fill", (center.x + radius * 2.5, center.y - radius * 1.2, center.z + radius * 2.4), 105, radius * 3),
    ("Rim", (center.x, center.y + radius * 2.4, center.z + radius * 3.2), 260, radius * 2.2),
):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name, light.data.energy, light.data.size = name, energy * radius * radius, area
    look_at(light, center)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.08
scene.render.resolution_x = scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(output)
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.5, 0.5, 0.5, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.18
scene.view_settings.view_transform = "Khronos PBR Neutral"
scene.view_settings.look = "None"
scene.view_settings.exposure = -0.15
bpy.ops.render.render(write_still=True)

metadata = {
    "schemaVersion": "ikea_preview.v1",
    "model": str(model),
    "preview": str(output),
    "dimensionsMeters": {"x": size.x, "y": size.y, "z": size.z},
    "meshObjects": len(meshes),
    "studio": {"preset": "orthographic-shadow-v5", "renderEngine": "CYCLES", "samples": 64, "projection": "orthographic-isometric"},
}
metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
if import_path != model:
    import_path.unlink(missing_ok=True)
print(json.dumps(metadata))
