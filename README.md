# From water to electricity

A 3D educational animation of a hydroelectric plant with a Pelton turbine and a synchronous generator, generated entirely by code: no 3D software, no third-party models, images or recordings.

**[Download the 90-second video (MP4, 1080p)](https://github.com/ivelec1981/hydro-plant-3d-animation/releases/latest)**

It follows the whole chain: reservoir and net head, penstock, nozzle and jet, Pelton runner, salient-pole generator, the rotating field of a stator that does not move, synchronisation, step-up transformer, transmission and distribution. The full timeline (about 5 minutes, rendered from this code) also includes two simulated tests: frequency response of an isolated system (governor) and voltage response on a finite-impedance grid (AVR).

> Educational model with illustrative parameters. It does not represent a real plant and is not a design or validation tool.

## Illustrative case

| Quantity | Value |
|---|---:|
| Net head / design flow | 400 m / 8.5 m³/s |
| Combined turbine-generator efficiency | 0.90 |
| Electrical power, P = ρ·g·Q·Hn·η | ≈ 30 MW |
| Jet speed | ≈ 86 m/s (309 km/h) |
| Poles, speed, frequency | 20, 360 rpm, 60 Hz |
| Voltage levels | 13.8 kV → 230 kV → 69 kV → 13.8 kV → 120/240 V |

All numbers shown on screen are read from `datos/parametros.json` and from the outputs of `sim/ensayos.py`. Change the parameters, run the steps again, and the video changes with them.

## How it works

- `web/`: a small dependency-free WebGL2 renderer (physically based shading, shadows, water, clip planes) plus the procedural models, the camera plan and the vector graphic layer. Every frame is a pure function of its number.
- `sim/`: Python models. Frequency test (inertia, nonlinear turbine with water column, governor with permanent and transient droop, slow secondary control), voltage test (one-axis salient-pole generator, static AVR, Thévenin grid) and the numerical check of the three-phase rotating field.
- `render/`: headless Chrome driven through the DevTools Protocol, frames piped to ffmpeg, parallel and resumable.
- `audio/tools/`: speech synthesis, synthesised music and ambience, mixing to −16 LUFS, subtitles, final muxing and verification with ffprobe.

Requirements: Node 22+, Chrome or Edge, ffmpeg and ffprobe on the PATH, Python 3.11 with numpy. No npm dependencies. The English voice uses [Piper](https://github.com/OHF-Voice/piper1-gpl) with the `en_US-ryan-high` model, downloaded separately.

Step-by-step commands are in [LEEME.md](LEEME.md) (in Spanish, the working language of the project; the source is commented in English). Interactive preview: serve this folder with any static server and open `web/index.html?lang=en`.

## What has and has not been checked

- Automatic checks: frame count, resolution, frame rate, codecs, loudness, true peak, voice alignment, and frame-accurate comparison of the short cut against its sources.
- The physics checks are listed in `entregables/Datos_e_hipotesis.md` (for example, the steady-state primary frequency deviation matches the droop value, and the three phase contributions add up to a rotating wave of constant amplitude).
- The narration is synthetic. Word-level timings for the English voice are estimated, so labels may lead or lag the spoken word by a few tenths of a second.
- Known issue: in scene 4 of the full timeline, the brightness of two stator phase groups is swapped with respect to the pole positions. The rotating-field insert uses the correct assignment.

## Credits and licences

- Conceptual reference: an animation by Luis Manuel Dután Amay, based on a slide by Daniel Kirschen. Models, illustrations, script and calculations in this repository are original.
- Code and data: [MIT](LICENSE).
- The released video uses the Piper voice `en_US-ryan-high`, trained on the RyanSpeech dataset (CC BY-NC-SA 4.0). The video is therefore shared for **non-commercial** use under CC BY-NC-SA 4.0.
- Built with [Claude Code](https://claude.com/claude-code).
