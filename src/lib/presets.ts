// Prompt presets. Each one appends real direction to the prompt sent to the model;
// nothing here fakes a result.
export interface Preset { id: string; label: string; prompt: string }

export const STYLE_PRESETS: Preset[] = [
  { id: "cinematic", label: "Cinematic still", prompt: "cinematic film still, anamorphic lens, shallow depth of field, dramatic lighting, film grain, color graded" },
  { id: "album-cover", label: "Album cover", prompt: "square album cover artwork, bold striking composition, iconic, high contrast, professional music packaging design" },
  { id: "neon-noir", label: "Neon noir", prompt: "neon noir, rain-soaked streets, magenta and cyan neon reflections, moody night atmosphere" },
  { id: "vhs", label: "VHS / 90s", prompt: "1990s VHS camcorder look, chromatic aberration, scan lines, washed colors, analog noise" },
  { id: "editorial", label: "Fashion editorial", prompt: "high fashion editorial photograph, studio lighting, magazine quality, sharp detail" },
  { id: "35mm", label: "35mm film", prompt: "shot on 35mm Kodak Portra 400, natural light, soft grain, candid" },
  { id: "dreamy", label: "Dreamy haze", prompt: "ethereal dreamy haze, soft bloom, pastel light leaks, surreal atmosphere" },
  { id: "dark-fantasy", label: "Dark fantasy", prompt: "dark fantasy concept art, volumetric fog, epic scale, painterly detail" },
  { id: "anime", label: "Anime", prompt: "anime key visual, cel shaded, vibrant colors, detailed background art" },
  { id: "3d-render", label: "3D render", prompt: "octane 3D render, glossy materials, studio HDRI lighting, ultra detailed" },
  { id: "bw-grain", label: "B&W grain", prompt: "black and white photograph, heavy grain, deep shadows, high contrast silver gelatin print" },
  { id: "y2k-chrome", label: "Y2K chrome", prompt: "Y2K aesthetic, liquid chrome typography and shapes, iridescent, futuristic early-2000s design" },
];

export const CAMERA_PRESETS: Preset[] = [
  { id: "dolly-in", label: "Dolly in", prompt: "the camera slowly dollies forward toward the subject" },
  { id: "dolly-out", label: "Dolly out", prompt: "the camera smoothly dollies backward, revealing the scene" },
  { id: "crash-zoom", label: "Crash zoom", prompt: "a sudden fast crash zoom into the subject's face" },
  { id: "orbit", label: "360 orbit", prompt: "the camera orbits 360 degrees around the subject in one continuous move" },
  { id: "arc-left", label: "Arc left", prompt: "the camera arcs smoothly to the left around the subject" },
  { id: "arc-right", label: "Arc right", prompt: "the camera arcs smoothly to the right around the subject" },
  { id: "crane-up", label: "Crane up", prompt: "the camera cranes upward, rising high above the scene" },
  { id: "crane-down", label: "Crane down", prompt: "the camera cranes down from above to eye level" },
  { id: "fpv-drone", label: "FPV drone", prompt: "fast FPV drone shot diving and weaving through the scene" },
  { id: "handheld", label: "Handheld", prompt: "handheld camera with natural shake, documentary feel" },
  { id: "whip-pan", label: "Whip pan", prompt: "a fast whip pan with motion blur" },
  { id: "dolly-zoom", label: "Dolly zoom", prompt: "vertigo dolly zoom: the camera moves in while zooming out, the background stretches" },
  { id: "bullet-time", label: "Bullet time", prompt: "frozen bullet-time moment, the camera sweeps around the subject while time stands still" },
  { id: "tilt-up", label: "Tilt up", prompt: "the camera tilts up slowly from the ground to the subject" },
  { id: "static", label: "Locked off", prompt: "static locked-off tripod shot, the camera does not move" },
  { id: "snorricam", label: "Body cam", prompt: "body-mounted snorricam shot, the camera stays fixed on the subject's face as they move" },
];

export const EFFECT_PRESETS: Preset[] = [
  { id: "disintegrate", label: "Disintegrate", prompt: "the subject disintegrates into drifting particles of dust" },
  { id: "explode", label: "Explosion", prompt: "a massive cinematic explosion erupts behind the subject" },
  { id: "on-fire", label: "Set ablaze", prompt: "flames engulf the scene, burning embers fly through the air" },
  { id: "levitate", label: "Levitate", prompt: "the subject slowly levitates off the ground, weightless" },
  { id: "melt", label: "Melt", prompt: "everything slowly melts and drips like liquid wax" },
  { id: "glitch", label: "Glitch", prompt: "digital glitch distortion, datamosh artifacts, RGB split flicker" },
  { id: "strobe", label: "Strobe lights", prompt: "pulsing strobe lights and concert lighting synced to a beat" },
  { id: "rain", label: "Rainstorm", prompt: "heavy cinematic rain pours down, lightning flashes" },
  { id: "freeze", label: "Freeze over", prompt: "ice crystals spread and the scene freezes over" },
  { id: "petals", label: "Petal storm", prompt: "a storm of flower petals swirls around the subject" },
  { id: "hologram", label: "Hologram", prompt: "the subject turns into a flickering blue hologram" },
  { id: "visualizer", label: "Music visualizer", prompt: "abstract audio-reactive music visualizer, pulsing light shapes and waveforms moving to the rhythm, seamless loop" },
];

const ALL = { style: STYLE_PRESETS, camera: CAMERA_PRESETS, effect: EFFECT_PRESETS };
export type PresetKind = keyof typeof ALL;
export type PresetChoice = Partial<Record<PresetKind, string>>;

/** Joins the user's prompt with the chosen presets. Unknown preset ids throw. */
export function composePrompt(prompt: string, choice: PresetChoice = {}): string {
  const parts = [prompt.trim()];
  for (const kind of Object.keys(ALL) as PresetKind[]) {
    const id = choice[kind];
    if (!id) continue;
    const p = ALL[kind].find((x) => x.id === id);
    if (!p) throw new Error(`Unknown ${kind} preset: ${id}`);
    parts.push(p.prompt);
  }
  return parts.filter(Boolean).join(". ");
}
