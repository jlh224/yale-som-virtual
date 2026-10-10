import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TALK_RANGE, talk } from './talk.js'

const AIM_RADIUS = 0.45 // how close the crosshair's ray has to pass to count as looking at someone

// Reports which talkable professor is under the crosshair (and close enough), or null.
export default function Interact({ onAim }) {
  const aimed = useRef(null)
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    camera.getWorldDirection(dir)
    const flat = Math.max(Math.hypot(dir.x, dir.z), 1e-3)
    let best = null
    let bestD = TALK_RANGE
    for (const t of talk.targets) {
      if (t.enabled === false) continue
      const dx = t.pos[0] - camera.position.x
      const dz = t.pos[2] - camera.position.z
      const d = Math.hypot(dx, dz)
      if (d > bestD) continue
      // the point on the figure at the height where the view ray reaches it
      const y = Math.min(t.pos[1] + t.height, Math.max(t.pos[1] + Math.min(0.3, t.height / 2), camera.position.y + (dir.y * d) / flat))
      const dy = y - camera.position.y
      const along = dx * dir.x + dy * dir.y + dz * dir.z
      if (along <= 0) continue
      if (dx * dx + dy * dy + dz * dz - along * along < AIM_RADIUS * AIM_RADIUS) {
        best = t.who
        bestD = d
      }
    }
    if (best !== aimed.current) {
      aimed.current = best
      onAim(best)
    }
  })
  return null
}
