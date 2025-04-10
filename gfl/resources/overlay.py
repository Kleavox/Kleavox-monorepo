import os
from PIL import Image

OUTPUT_SIZE = (220, 440)
OVERLAY_SIZE = (750, 750)

base_dir = os.path.dirname(os.path.abspath(__file__))
background_dir = os.path.join(base_dir, "background")
output_dir = os.path.join(base_dir, "char_images")
char_dir = os.path.join(base_dir, "char")

os.makedirs(output_dir, exist_ok=True)

backgrounds = {}
for i in range(2, 7):
    bg_name = f"{i}BANNER"
    for ext in (".png", ".jpg", ".jpeg"):
        bg_path = os.path.join(background_dir, f"{bg_name}{ext}")
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

for key in list(overlays.keys()):
    if key not in backgrounds:
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
        print(f"Saved: {out_name}")

        os.remove(ov_path)

    subfolder_path = os.path.join(char_dir, key)
    if os.path.isdir(subfolder_path) and not os.listdir(subfolder_path):
        os.rmdir(subfolder_path)

if os.path.isdir(char_dir) and not os.listdir(char_dir):
    os.rmdir(char_dir)