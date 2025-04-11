from flask import Flask, request, jsonify
import os
import zipfile
from overlay import process_overlay

app = Flask(__name__)

UPLOAD_FOLDER = 'assets'
CHAR_FOLDER = os.path.join(UPLOAD_FOLDER, 'char')
OUTPUT_FOLDER = 'assets/char_images'
LOG_FILE = 'logs/overlay.log'

@app.route('/upload', methods=['POST'])
def upload_zip():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if not file.filename.endswith('.zip'):
        return jsonify({'error': 'Only .zip files are allowed'}), 400

    zip_path = os.path.join(UPLOAD_FOLDER, 'char.zip')
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    file.save(zip_path)

    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(UPLOAD_FOLDER)
        os.remove(zip_path)

        process_overlay(UPLOAD_FOLDER, OUTPUT_FOLDER, LOG_FILE)

        return jsonify({'message': 'Overlay completed successfully!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)