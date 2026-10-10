import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DRUMS, ellPt } from './layout.js'
import { talk } from './talk.js'

// Handsome Dan, Yale's bulldog. He tours a loop of 1000 randomly chosen classrooms:
// walk the cloister to the next room, go in through a door, pause at the front, head back out.
// Walk up to him and he stops, turns to you and sits so you can pet him; walk away and he carries on.

export const DAN = { x: 0, z: 0 } // live position for the minimap

const SPEED = 1.8 // m/s
const PAUSE = 2.5 // seconds hanging out at the front of each room
const TOUR_LENGTH = 1000
const GREET_DIST = 2.6 // he stops and sits when you get this close...
const LEAVE_DIST = 3.6 // ...and goes back to his tour once you are this far away
const SIT_TILT = 0.35 // radians his body leans back when sitting
const FRONT_Z = 0.22 // front paws stay planted; the sit pivots around them
const HEART_LIFE = 1.4 // seconds a heart floats after a pet

function heartGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, -0.5)
  s.bezierCurveTo(-0.9, 0.1, -0.5, 0.75, 0, 0.3)
  s.bezierCurveTo(0.5, 0.75, 0.9, 0.1, 0, -0.5)
  return new THREE.ShapeGeometry(s)
}

// cloister centerline loop
const RING = Array.from({ length: 120 }, (_, i) => {
  const t = (i / 120) * Math.PI * 2
  const c = Math.cos(t)
  const s = Math.sin(t)
  return [24.4 * Math.sign(c) * Math.pow(Math.abs(c), 1 / 3), 21.4 * Math.sign(s) * Math.pow(Math.abs(s), 1 / 3)]
})
const nearestRing = (p) => {
  let best = 0
  let bd = Infinity
  RING.forEach((q, i) => {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (d < bd) {
      bd = d
      best = i
    }
  })
  return best
}
function ringPath(a, b) {
  const n = RING.length
  const fwd = (b - a + n) % n
  const step = fwd <= n / 2 ? 1 : -1
  const out = []
  for (let i = a; i !== b; i = (i + step + n) % n) out.push(RING[i])
  out.push(RING[b])
  return out
}

// for each classroom: the spot at the front of the room, and the door route out to the cloister
const ROOMS = DRUMS.map((d) => {
  const { fc, back } = d.front
  const inside = [fc[0] + back[0] * 1.6, fc[1] + back[1] * 1.6]
  const routes = d.doors.map((a) => {
    const p = ellPt(d.c, d.rx, d.rz, a)
    const n = [p[0] - d.c[0], p[1] - d.c[1]]
    const l = Math.hypot(...n)
    const inner = [p[0] - (n[0] / l) * 0.7, p[1] - (n[1] / l) * 0.7]
    const outer = [p[0] + (n[0] / l) * 1.0, p[1] + (n[1] / l) * 1.0]
    const ring = nearestRing(outer)
    return { inner, outer, ring, cost: Math.hypot(RING[ring][0] - outer[0], RING[ring][1] - outer[1]) }
  })
  const exit = routes.reduce((a, b) => (b.cost < a.cost ? b : a))
  return { inside, ...exit }
})

function tour(seed) {
  let s = seed
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
  const out = []
  while (out.length < TOUR_LENGTH) {
    const k = Math.floor(r() * ROOMS.length)
    if (k !== out[out.length - 1]) out.push(k)
  }
  if (out[0] === out[out.length - 1]) out[out.length - 1] = (out[0] + 1) % ROOMS.length
  return out
}

function legPath(from, to) {
  const A = ROOMS[from]
  const Bb = ROOMS[to]
  return [A.inside, A.inner, A.outer, ...ringPath(A.ring, Bb.ring), Bb.outer, Bb.inner, Bb.inside]
}

function bandanaTex() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#00356b'
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#ffffff'
  g.font = 'bold 120px Georgia, serif'
  g.textAlign = 'center'
  g.fillText('Y', 128, 175)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const SPH = new THREE.SphereGeometry(1, 24, 16)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14)
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o })

export default function HandsomeDan() {
  const root = useRef()
  const legs = useRef([])
  const tail = useRef()
  const head = useRef()
  const M = useMemo(
    () => ({
      white: mat('#f4f1ea'),
      brown: mat('#b07a4a'),
      dark: mat('#2a1d16'),
      pink: mat('#d98c8c'),
      tooth: mat('#ffffff', { roughness: 0.3 }),
      eye: mat('#120c08', { roughness: 0.2 }),
      bandana: new THREE.MeshStandardMaterial({ map: bandanaTex(), roughness: 0.9, side: THREE.DoubleSide }),
      tag: mat('#c9a44a', { metalness: 0.8, roughness: 0.3 }),
    }),
    [],
  )
  const bandanaGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    // triangle hanging from the neck, point down
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.17, 0.08, 0, 0.17, 0.08, 0, 0, -0.17, 0.02], 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2))
    g.computeVertexNormals()
    return g
  }, [])

  const state = useMemo(() => {
    const order = tour(1701) // Yale founded 1701
    return { order, leg: 0, path: legPath(order[0], order[1]), seg: 0, u: 0, pause: 0, greeting: false, sit: 0, pets: [] }
  }, [])
  const hearts = useRef([])
  const heartG = useMemo(heartGeo, [])
  const heartMats = useMemo(() => [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial({ color: '#ff4fa3', transparent: true, side: THREE.DoubleSide, depthWrite: false })), [])

  // he can be petted once he is sitting; each pet sends up a heart
  const target = useMemo(() => ({ who: 'dan', pos: [0, 0, 0], height: 0.8, prompt: 'pet Handsome Dan', enabled: false }), [])
  useEffect(() => {
    target.use = () => {
      state.pets.push(performance.now() / 1000)
      if (state.pets.length > heartMats.length) state.pets.shift()
    }
    talk.targets.push(target)
    return () => {
      talk.targets = talk.targets.filter((t) => t !== target)
    }
  }, [target, state, heartMats])

  useFrame(({ clock, camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const st = state
    const near = Math.hypot(camera.position.x - DAN.x, camera.position.z - DAN.z)
    st.greeting = near < (st.greeting ? LEAVE_DIST : GREET_DIST)
    let moving = true
    if (st.greeting) {
      moving = false // stay put for as long as you are next to him
    } else if (st.pause > 0) {
      st.pause -= dt
      moving = false
    } else {
      let step = SPEED * dt
      while (step > 0) {
        const a = st.path[st.seg]
        const b = st.path[st.seg + 1]
        if (!b) {
          // arrived: pause, then start the next leg of the 1000-room loop
          st.leg = (st.leg + 1) % st.order.length
          st.path = legPath(st.order[st.leg], st.order[(st.leg + 1) % st.order.length])
          st.seg = 0
          st.u = 0
          st.pause = PAUSE
          break
        }
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6
        const left = (1 - st.u) * len
        if (step < left) {
          st.u += step / len
          step = 0
        } else {
          step -= left
          st.seg += 1
          st.u = 0
        }
      }
    }
    const a = st.path[st.seg]
    const b = st.path[st.seg + 1] || a
    const x = a[0] + (b[0] - a[0]) * st.u
    const z = a[1] + (b[1] - a[1]) * st.u
    root.current.position.set(x, 0, z)
    if (b !== a || st.greeting) {
      const want = st.greeting ? Math.atan2(camera.position.x - x, camera.position.z - z) : Math.atan2(b[0] - a[0], b[1] - a[1])
      let d = want - root.current.rotation.y
      d = Math.atan2(Math.sin(d), Math.cos(d))
      root.current.rotation.y += d * Math.min(1, dt * 8)
    }
    DAN.x = x
    DAN.z = z
    if (import.meta.env.DEV) document.body.dataset.dan = `${x.toFixed(2)},${z.toFixed(2)},${st.order[st.leg]},${st.order[(st.leg + 1) % st.order.length]}`
    const t = clock.elapsedTime
    const now = performance.now() / 1000
    const petted = st.pets.length ? Math.max(0, 1 - (now - st.pets[st.pets.length - 1]) / 1.2) : 0 // 1 right after a pet, fading out
    st.sit += ((st.greeting ? 1 : 0) - st.sit) * Math.min(1, dt * 6)
    target.pos[0] = x
    target.pos[2] = z
    target.enabled = st.sit > 0.6
    const tilt = SIT_TILT * st.sit
    legs.current.forEach((l, i) => {
      if (!l) return
      const walk = moving ? Math.sin(t * 12 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5 : 0
      // sitting: front legs stay upright under the raised chest, hind legs fold forward along the floor
      l.rotation.x = walk * (1 - st.sit) + (i > 1 ? -1.25 * st.sit : tilt)
    })
    tail.current.rotation.z = Math.sin(t * (moving ? 10 : 18 + petted * 14)) * (0.6 + petted * 0.3)
    head.current.rotation.y = moving ? Math.sin(t * 2) * 0.1 : st.greeting ? Math.sin(t * 9) * 0.25 * petted : Math.sin(t * 1.3) * 0.5
    head.current.rotation.x = 0.15 * st.sit - 0.2 * petted
    // lean back onto the haunches, pivoting around the front paws
    const body = root.current.children[0]
    body.rotation.x = -tilt
    body.position.y = (moving ? Math.abs(Math.sin(t * 12)) * 0.02 : 0) - FRONT_Z * Math.sin(tilt) + Math.abs(Math.sin(t * 10)) * 0.03 * petted
    body.position.z = FRONT_Z * (1 - Math.cos(tilt))
    // hearts float up over his head and face the camera
    hearts.current.forEach((h, i) => {
      const age = i < st.pets.length ? now - st.pets[i] : HEART_LIFE
      h.visible = age < HEART_LIFE
      if (!h.visible) return
      h.position.set(Math.sin(i * 2.4 + age * 3) * 0.12, 0.95 + age * 0.55, 0.2)
      h.scale.setScalar(0.07 + age * 0.05)
      h.quaternion.copy(root.current.quaternion).invert().multiply(camera.quaternion)
      heartMats[i].opacity = 1 - age / HEART_LIFE
    })
  })

  const B = ({ p, s, m, r = [0, 0, 0], g = SPH }) => <mesh geometry={g} material={m} position={p} scale={s} rotation={r} />
  return (
    <group ref={root}>
      <group>
        {/* stocky body with brown patches */}
        <B p={[0, 0.36, 0]} s={[0.21, 0.19, 0.33]} m={M.white} />
        <B p={[0.1, 0.42, -0.12]} s={[0.12, 0.1, 0.15]} m={M.brown} />
        <B p={[-0.12, 0.33, -0.2]} s={[0.1, 0.1, 0.1]} m={M.brown} />
        <B p={[0, 0.4, 0.2]} s={[0.24, 0.2, 0.18]} m={M.white} />
        {/* legs: front pair wide-set like a bulldog */}
        {[
          [-0.15, 0.22],
          [0.15, 0.22],
          [-0.13, -0.22],
          [0.13, -0.22],
        ].map(([lx, lz], i) => (
          <group key={i} ref={(el) => (legs.current[i] = el)} position={[lx, 0.3, lz]}>
            <B g={CYL} p={[0, -0.13, 0]} s={[0.055, 0.26, 0.055]} m={M.white} />
            <B p={[0, -0.27, 0.03]} s={[0.06, 0.03, 0.08]} m={M.white} />
          </group>
        ))}
        <group ref={tail} position={[0, 0.45, -0.33]}>
          <B p={[0, 0.03, -0.02]} s={[0.035, 0.05, 0.035]} m={M.white} />
        </group>
        {/* bandana + tag */}
        <mesh geometry={bandanaGeo} material={M.bandana} position={[0, 0.47, 0.35]} rotation={[-0.25, 0, 0]} />
        <B g={CYL} p={[0, 0.55, 0.3]} s={[0.2, 0.05, 0.12]} m={M.bandana} />
        {/* big bulldog head */}
        <group ref={head} position={[0, 0.6, 0.36]}>
          <B p={[0, 0, 0]} s={[0.2, 0.17, 0.16]} m={M.white} />
          <B p={[0.08, 0.05, 0.06]} s={[0.09, 0.09, 0.1]} m={M.brown} />
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <B p={[0.16 * sx, 0.11, -0.02]} r={[0, 0, 0.6 * sx]} s={[0.07, 0.04, 0.05]} m={M.dark} />
              <B p={[0.07 * sx, 0.05, 0.13]} s={[0.032, 0.03, 0.02]} m={M.eye} />
              <B p={[0.075 * sx, -0.05, 0.12]} s={[0.075, 0.07, 0.07]} m={M.white} />
            </group>
          ))}
          <B p={[0, 0.0, 0.17]} s={[0.05, 0.035, 0.03]} m={M.eye} />
          {/* underbite: wide jaw, little teeth poking up */}
          <B p={[0, -0.1, 0.11]} s={[0.13, 0.05, 0.08]} m={M.pink} />
          {[-1, 1].map((sx) => (
            <B key={sx} p={[0.06 * sx, -0.06, 0.17]} s={[0.012, 0.022, 0.01]} m={M.tooth} />
          ))}
          <B p={[0, -0.03, 0.16]} s={[0.12, 0.02, 0.03]} m={M.dark} />
        </group>
      </group>
      {heartMats.map((hm, i) => (
        <mesh key={i} ref={(el) => (hearts.current[i] = el)} geometry={heartG} material={hm} visible={false} />
      ))}
    </group>
  )
}
