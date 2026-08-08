# Third-party notices

This repository uses the following packages at build or runtime:

- React and React DOM: MIT License.
- Vite and `@vitejs/plugin-react`: MIT License.
- Lucide React: ISC License.
- TypeScript: Apache License 2.0.
- Vitest: MIT License.
- MediaPipe Tasks Vision: Apache License 2.0.
- MediaPipe Pose Landmarker Full and Lite models: Apache License 2.0. The
  models are stored at `public/models/pose_landmarker_full.task` and
  `public/models/pose_landmarker_lite.task`, and originated from the official
  MediaPipe model bucket.

No proprietary prompts, real elderly-person records, API keys, audio, video,
biometric templates, or licensed assessment-scale text are included in this
repository. The only bundled model weights are the MediaPipe Pose Landmarker
assets described above.

Future adapters may connect to FunASR, faster-whisper, sherpa-onnx, object
detection, or commercial APIs. Their code, model weights, and service terms
must be reviewed separately before redistribution or production use.
