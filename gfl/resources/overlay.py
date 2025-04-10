import os
import shutil
import zipfile
from PIL import Image

OUTPUT_SIZE = (220, 440)
OVERLAY_SIZE = (750, 750)

base_dir = os.path.dirname(os.path.abspath(__file__))
assets_dir = os.path.join(base_dir, "assets")
background_dir = os.path.join(assets_dir, "background")
output_dir = os.path.join(base_dir, "char_images")
char_dir = os.path.join(assets_dir, "char")
char_zip_path = os.path.join(assets_dir, "char.zip")

os.makedirs(output_dir, exist_ok=True)

def process_images():
    print("Memproses gambar...")
    backgrounds = {}
    for i in range(2, 7):
        for ext in (".png", ".jpg", ".jpeg"):
            bg_path = os.path.join(background_dir, f"{i}BANNER{ext}")
            if os.path.exists(bg_path):
                backgrounds[str(i)] = bg_path
                break

    overlays = {}
    if os.path.exists(char_dir):
        for i in range(2, 7):
            subfolder = os.path.join(char_dir, str(i))
            if os.path.isdir(subfolder):
                overlays[str(i)] = [
                    os.path.join(subfolder, f)
                    for f in os.listdir(subfolder)
                    if f.lower().endswith((".png", ".jpg", ".jpeg"))
                ]

    for key in backgrounds:
        if key not in overlays:
            continue

        bg_img = Image.open(backgrounds[key]).convert("RGBA").resize(OUTPUT_SIZE)

        for ov_path in overlays[key]:
            overlay_original = Image.open(ov_path).convert("RGBA")
            overlay_img = overlay_original.resize(OVERLAY_SIZE)

            original_size = overlay_original.size
            if original_size == (1024, 1024):
                pos_y = -55
            elif original_size == (2048, 2048):
                pos_y = 0
            else:
                pos_y = 0

            pos_x = 0

            canvas = Image.new("RGBA", OVERLAY_SIZE, (0, 0, 0, 0))
            canvas.paste(bg_img, (OVERLAY_SIZE[0] // 2 - OUTPUT_SIZE[0] // 2, 0))
            canvas.paste(overlay_img, (pos_x, pos_y), overlay_img)

            crop_left = OVERLAY_SIZE[0] // 2 - OUTPUT_SIZE[0] // 2
            crop_top = 0
            crop_right = crop_left + OUTPUT_SIZE[0]
            crop_bottom = crop_top + OUTPUT_SIZE[1]
            final_img = canvas.crop((crop_left, crop_top, crop_right, crop_bottom))

            ov_name = os.path.splitext(os.path.basename(ov_path))[0].replace(" ", "_")
            out_name = f"{ov_name}[{key}].png"
            final_img.save(os.path.join(output_dir, out_name))

            os.remove(ov_path)

        folder_path = os.path.join(char_dir, key)
        if os.path.isdir(folder_path) and not os.listdir(folder_path):
            os.rmdir(folder_path)

    if os.path.isdir(char_dir) and not os.listdir(char_dir):
        shutil.rmtree(char_dir)
        print("Folder char selesai diproses dan dihapus.")

print("Menunggu file char.zip atau folder char...")

if os.path.exists(char_zip_path):
    with zipfile.ZipFile(char_zip_path, 'r') as zip_ref:
        zip_ref.extractall(assets_dir)
    os.remove(char_zip_path)

if os.path.exists(char_dir):
    process_images()