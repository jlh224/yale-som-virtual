// Shared between the 3D scene and the DOM UI.
// targets: things you can walk up to and act on, as { who, pos: [x, y, z], height, prompt, use?, enabled? }
//   prompt finishes the hint "Click or press E to ..."; without a use() the target opens a professor chat
// active: key of the professor being chatted with right now, or null
export const talk = { targets: [], active: null }
export const TALK_RANGE = 6 // meters
export const API = import.meta.env.VITE_API_URL ?? '/api'
