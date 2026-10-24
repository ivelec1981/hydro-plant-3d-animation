# From water to electricity

A 3D educational animation of a hydroelectric plant with a Pelton turbine and a synchronous generator, generated entirely by code: no 3D software, no third-party models, images or recordings.

**[Download the 90-second video (MP4, 1080p)](https://github.com/ivelec1981/hydro-plant-3d-animation/releases/tag/v1.0)**

**New: [Short circuit and the equal area criterion (95 s, MP4, 1080p, subtitled)](https://github.com/ivelec1981/hydro-plant-3d-animation/releases/tag/short-circuit-v1.0)**: why clearing a fault 0.1 s later can make a generator lose synchronism. See [Short circuit](#short-circuit-equal-area-criterion) below.

**[Load angle, studio version (87 s, MP4, 1080p, subtitled)](https://github.com/ivelec1981/hydro-plant-3d-animation/releases/tag/load-angle-v1.0)**: why the generator delivers more power without turning faster. See [Load angle](#load-angle-studio-version) below.

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

## Load angle (studio version)

A second video, suggested by Luis Manuel Dután Amay. The same 20-pole generator, connected to a 60 Hz grid, goes from 20 to 23 MW. The rotor speeds up by less than a tenth of a revolution per minute for a moment, the load angle δ swings and settles from 30° to 35.1°, and the machine returns to 360 rpm. With a weaker connection, the same 23 MW need about 46°.

- Model: classical single-machine infinite bus (fixed excitation, saliency neglected), illustrative parameters. Every frame reads its state from the simulated time series; nothing is animated by hand.
- Rendered with the same WebGL2 engine. The scene code for this video is not yet in this repository.
- Voice: Chatterbox (Resemble AI, MIT licence), English, with burned-in subtitles.
- Visual style inspired by a short AI-generated clip; no image from it is used.

## Short circuit (equal area criterion)

A third video that continues the load angle one, with the same generator and grid. At 23 MW and δ = 35.1°, the generator feeds the grid through two parallel lines. A bolted three-phase fault on one line, right next to the plant, leaves it unable to deliver power. The turbine keeps pushing, so the rotor speeds up (accelerating area A1). When the faulted line opens, the grid brakes the rotor (decelerating area A2).

- Cleared in 100 ms: δ peaks at about 80° when A2 equals A1, then swings around 46°. The machine stays in step.
- Cleared in 200 ms: the available braking area is too small, δ passes 134° and the machine loses synchronism.
- Critical clearing: 56.9°, or 168 ms (about 10 cycles) from the equal area criterion. The simulation with light damping (D = 1 pu) gives 172 ms.
- Checks: A1 = A2 at the peak with D = 0, to within 0.00001 %. The analytic and simulated critical times agree to within 0.01 ms. RK4 agrees with a half step and with solve_ivp (DOP853).
- Model limits: classical model, illustrative parameters. Fixed excitation, no governor, AVR or PSS. Both ends of the line open at once, with no reclosing. Out-of-step protection is mentioned but not simulated.
- The scene code for this video is not yet in this repository.

## Credits and licences

- Conceptual reference: an animation by Luis Manuel Dután Amay, based on a slide by Daniel Kirschen. Models, illustrations, script and calculations in this repository are original.
- Code and data: [MIT](LICENSE).
- The released video uses the Piper voice `en_US-ryan-high`, trained on the RyanSpeech dataset (CC BY-NC-SA 4.0). The video is therefore shared for **non-commercial** use under CC BY-NC-SA 4.0.
- Built with [Claude Code](https://claude.com/claude-code).
