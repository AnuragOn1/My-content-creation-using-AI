#!/usr/bin/env bash
# One-time setup for a fresh machine/session: deps + offline TTS model.
set -euo pipefail
cd "$(dirname "$0")"
pip install -q kokoro-onnx soundfile scipy onnx pillow
npm install --silent
mkdir -p models
REL=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
[ -f models/voices-v1.0.bin ] || curl -sSL -o models/voices-v1.0.bin "$REL/voices-v1.0.bin"
[ -f models/kokoro-v1.0.onnx ] || curl -sSL -o models/kokoro-v1.0.onnx "$REL/kokoro-v1.0.onnx"
# Expose the model's per-phoneme durations as an output, so captions can sync word by word
[ -f models/kokoro-v1.0-timed.onnx ] || python3 - <<'PY'
import onnx
m = onnx.load("models/kokoro-v1.0.onnx")
m.graph.node.append(onnx.helper.make_node("Identity", ["/encoder/Clip_output_0"], ["duration"], name="duration_out"))
m.graph.output.append(onnx.helper.make_tensor_value_info("duration", onnx.TensorProto.FLOAT, None))
onnx.save(m, "models/kokoro-v1.0-timed.onnx")
PY
echo "engine ready"
