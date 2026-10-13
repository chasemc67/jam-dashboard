# Third-party model provenance

## Speed model provenance review (2026-10-13)

The two new bundles use the provenance recorded in guitar-overlay `LICENSES.md`
("Model v3" and "Speed experiments"). The permissive-only requirement applies to
these additions; the existing AGPL-3.0 V1 bundle remains unchanged and available.

| Bundle / candidate | Code, weights and training provenance |
| --- | --- |
| `FretTrackerR832W8A8` / `r832_w8a8` | Original FretNet/query head; torchvision ResNet-50 architecture and `ResNet50_Weights.IMAGENET1K_V2` ImageNet initialization, published under BSD-3-Clause. Existing project-trained v4q teacher, weight/activation quantized with coremltools. |
| `FretTrackerExtended512W8A8` / `extended_512_w8a8` | Original `scripts/speedup_train.py` GT/distillation code and existing v4q teacher; torchvision ResNet-34 and `ResNet34_Weights.DEFAULT` (`IMAGENET1K_V1`) ImageNet initialization, published under BSD-3-Clause. VAL-selected 512 student, weight/activation quantized with coremltools. |
| Dependencies | PyTorch, torchvision, NumPy and coremltools: BSD-3-Clause; OpenCV: Apache-2.0. No Ultralytics code or weights enter either new model. |
| Training data | Existing project labels in YOLO-pose text format (no Ultralytics dependency); teacher provenance and split hashes in speedup training protocols. ImageNet pretrained weights retain the source's separate dataset-terms caveat; unrestricted rights to pretraining images are not asserted. |

[torchvision BSD-3-Clause license](https://github.com/pytorch/vision/blob/main/LICENSE)
and [ResNet weight definitions](https://github.com/pytorch/vision/blob/main/torchvision/models/resnet.py).
Exact measured package identities and output contracts are recorded in
`models/speedup-provenance.json`. Both use the shared 0.30-fret refit/renumber path.

## Hand cutout model audit (2026-10-12)

No training or new model binaries are shipped with hand cutout.

| Runtime / file used | License and evidence | Distribution |
| --- | --- | --- |
| Apple Vision hand pose and person segmentation (fast/balanced) | Built into macOS; Apple SDK/OS terms, not an open-source model. [Vision API](https://developer.apple.com/documentation/vision/vngeneratepersonsegmentationrequest), [Apple agreements](https://developer.apple.com/support/terms/). No model file downloaded or redistributed. | Native app |
| Skin threshold | Original deterministic YCbCr threshold inside Vision hand-pose boxes; only the built-in Vision model is used. | Native app |
| `hand_landmarker.task` (float16 version 1; includes palm detector and hand landmarks TFLite models) | Apache-2.0, explicitly stated on page 2 of the [hand model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf). [Versioned download](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task). | Python evaluation only |
| `selfie_multiclass_256x256.tflite` (float32 version 1) | Apache-2.0, explicitly stated on page 1 of the [multiclass model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Multiclass%20Segmentation.pdf). [Versioned download](https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite). Body-skin probability channel 2 is intersected with hand boxes. | Python evaluation only |
| `efficient_sam_vitt.pt` | Apache-2.0 under the repository [LICENSE](https://github.com/yformer/EfficientSAM/blob/d525f622e6f640acf5a0fc37c7ca1f243da5bde0/LICENSE); weights are distributed in that same repository, with no separate restrictive license. [Checkpoint](https://github.com/yformer/EfficientSAM/blob/d525f622e6f640acf5a0fc37c7ca1f243da5bde0/weights/efficient_sam_vitt.pt). | Python evaluation only |
| Existing `FretTrackerV4Q832.mlpackage` / compiled `.mlmodelc` | Existing project-trained FretNet; own architecture and BSD-3-Clause torchvision ResNet-50 initialization per `desktop/README.md`. [torchvision license](https://github.com/pytorch/vision/blob/main/LICENSE). Reused unchanged for comparisons; no new training. | Existing app model |

SHA-256 of evaluated external files:

```
fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1  hand_landmarker.task
c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0  selfie_multiclass_256x256.tflite
dff858b19600a46461cbb7de98f796b23a7a888d9f5e34c0b033f7d6eb9e4e6a  efficient_sam_vitt.pt
```

EfficientSAM checkout: `d525f622e6f640acf5a0fc37c7ca1f243da5bde0`.
The repository also downloads unused ViT-S/ONNX checkpoint variants under the same
Apache-2.0 license; they are not evaluated, exported, or shipped.

Existing V1 remains AGPL-3.0 (Ultralytics), as documented in `desktop/README.md`;
it is not used for the hand-cutout comparison MP4s. Hand cutout adds no AGPL dependency.
Existing V3 has the same documented permissive provenance as V4Q832. Model-picker
compatibility tests may load all three existing models without modifying them.

MediaPipe's supported Tasks guides expose Python/Web/Android, with no drop-in
macOS Swift Tasks package. A native integration would require a C++/Bazel bridge,
TFLite runtime/custom operators, and the palm/ROI task graph; converting only a
TFLite network would not reproduce the task. It is evaluated in Python on the Mini
rather than shipped. [Task/platform documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker).
EfficientSAM is evaluated with PyTorch MPS and Vision box prompts. A CoreML export
is not bundled: the 1024-pixel image encoder, prompt decoder and dynamic hand count
need a separate conversion/validation effort; native usable latency has not been
established. Neither Python result is represented as native app performance.
