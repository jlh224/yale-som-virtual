import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { talk } from './talk.js'

// Prof. Peter Schott, built from primitives: light blue button-down with an open collar and rolled
// sleeves, khakis, boat shoes, wavy brown hair, and (he is from Southern California) sunglasses
// pushed up on his head.
// Figure faces +z and stands about 1.87 m tall.

const SKIN = '#e0b08c'
const SHIRT = '#a9c8ee'
const SHIRT_DARK = '#8fb3e0'
const KHAKI = '#c9b58a'
const HAIR = '#5a3f2a'

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }))
  return mats.get(k)
}
const SPH = new THREE.SphereGeometry(1, 24, 16)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 12)
const TORSO = new THREE.CylinderGeometry(0.2, 0.17, 0.6, 28) // shoulders wider than the waist
const STUBBLE = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 1.8, Math.PI - 1.8)
const SMILE = new THREE.TorusGeometry(1, 0.16, 6, 14, Math.PI)

const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />

const HIP = 0.94
// wavy hair: overlapping tufts swept up and back, as [x, y, z, size]
const TUFTS = [
  [0, 0.105, 0.03, 0.07],
  [-0.05, 0.1, 0.05, 0.055],
  [0.05, 0.1, 0.045, 0.055],
  [-0.075, 0.075, 0.0, 0.055],
  [0.075, 0.075, 0.0, 0.055],
  [0, 0.11, -0.03, 0.075],
  [-0.055, 0.085, -0.06, 0.06],
  [0.055, 0.085, -0.06, 0.06],
  [0, 0.06, -0.095, 0.065],
  [-0.085, 0.04, -0.04, 0.045],
  [0.085, 0.04, -0.04, 0.045],
  [0.02, 0.118, 0.065, 0.045],
]

export default function Schott({ who, motion }) {
  const body = useRef()
  const legL = useRef()
  const legR = useRef()
  const armR = useRef()
  const armL = useRef()
  const head = useRef()
  const shirt = m(SHIRT)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const talking = talk.active === who
    body.current.scale.y = 1 + Math.sin(t * 1.8) * 0.006 // breathing
    // an easy two-finger wave now and then; while chatting he talks with his hands
    const wave = Math.max(0, Math.sin(t * 0.8 + 1)) ** 6
    if (talking) {
      armR.current.rotation.set(-0.85 - Math.sin(t * 3.4) * 0.3, 0, -0.25)
      armL.current.rotation.set(-0.75 - Math.sin(t * 2.9 + 1) * 0.3, 0, 0.25)
    } else {
      armL.current.rotation.set(-wave * 0.3, 0, 0.14 + wave * 2.3 + Math.sin(t * 9) * wave * 0.25)
      armR.current.rotation.set(0.05, 0, -0.14)
    }
    head.current.rotation.z = Math.sin(t * 0.9) * 0.05 // relaxed, always nodding along
    head.current.rotation.x = talking ? Math.sin(t * 4) * 0.05 : 0
    const stride = Math.sin(motion.current.phase) * 0.55 * motion.current.walk
    legL.current.rotation.x = stride
    legR.current.rotation.x = -stride
    armL.current.rotation.x -= stride * 0.7 * (talking ? 0 : 1)
    armR.current.rotation.x += stride * 0.7
    body.current.position.y = Math.abs(Math.cos(motion.current.phase)) * 0.015 * motion.current.walk
  })

  return (
    <group>
      {/* boat shoes + khakis */}
      {[-1, 1].map((sx) => (
        <group key={sx} ref={sx === 1 ? legL : legR} position={[0.095 * sx, HIP, 0]}>
          <B g={BOX} c="#6b4a2f" p={[0, 0.04 - HIP, 0.04]} s={[0.1, 0.06, 0.26]} />
          <B g={BOX} c="#efe6d2" p={[0, 0.012 - HIP, 0.04]} s={[0.105, 0.024, 0.265]} />
          <B g={CYL} c={KHAKI} p={[0, 0.5 - HIP, 0]} s={[0.078, 0.88, 0.082]} />
        </group>
      ))}
      <B g={CYL} c={KHAKI} p={[0, 0.93, 0]} s={[0.175, 0.13, 0.13]} />
      <B g={CYL} c="#5a3d28" p={[0, 0.985, 0]} s={[0.178, 0.035, 0.133]} />
      <B g={BOX} c="#c9a44a" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, 0.985, 0.132]} s={[0.04, 0.035, 0.012]} />

      <group ref={body}>
        {/* shirt: button placket, open collar */}
        <mesh geometry={TORSO} material={shirt} position={[0, 1.27, 0]} scale={[1, 1, 0.7]} />
        <B c={SHIRT} p={[0, 1.53, 0]} s={[0.235, 0.075, 0.145]} />
        <B g={BOX} c={SHIRT_DARK} p={[0, 1.24, 0.132]} s={[0.03, 0.5, 0.012]} />
        {[1.08, 1.2, 1.32, 1.44].map((y) => (
          <B key={y} c="#f4f4f0" p={[0, y, 0.14]} s={[0.009, 0.009, 0.005]} />
        ))}
        <B g={BOX} c={SHIRT_DARK} p={[0.105, 1.38, 0.118]} s={[0.07, 0.06, 0.008]} />
        <B c={SKIN} p={[0, 1.53, 0.1]} s={[0.05, 0.06, 0.03]} />
        {[-1, 1].map((sx) => (
          <B key={sx} g={BOX} c={SHIRT} p={[0.06 * sx, 1.585, 0.085]} r={[0.5, 0.5 * sx, 0.5 * sx]} s={[0.09, 0.06, 0.012]} />
        ))}
        <B g={CYL} c={SKIN} p={[0, 1.6, 0]} s={[0.047, 0.09, 0.047]} />

        {/* arms: sleeves rolled to the elbow */}
        {[
          [armL, 1],
          [armR, -1],
        ].map(([ref, sx]) => (
          <group key={sx} ref={ref} position={[0.25 * sx, 1.52, 0]}>
            <mesh geometry={CAP} material={shirt} position={[0, -0.14, 0]} scale={[0.062, 0.1, 0.062]} />
            <B g={CYL} c={SHIRT_DARK} p={[0, -0.29, 0]} s={[0.064, 0.03, 0.064]} />
            <mesh geometry={CAP} material={m(SKIN)} position={[0, -0.4, 0]} scale={[0.048, 0.07, 0.048]} />
            <B c={SKIN} p={[0, -0.54, 0.02]} s={[0.045, 0.055, 0.04]} />
          </group>
        ))}

        {/* head: longer face, wavy brown hair, light stubble, big grin */}
        <group ref={head} position={[0, 1.735, 0]} scale={1.28}>
          <B c={SKIN} p={[0, 0, 0]} s={[0.1, 0.128, 0.11]} />
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <B c={SKIN} p={[0.1 * sx, 0, 0]} s={[0.018, 0.03, 0.018]} />
              <B c="#ffffff" p={[0.038 * sx, 0.022, 0.094]} s={[0.02, 0.014, 0.01]} />
              <B c="#4d6a78" p={[0.038 * sx, 0.022, 0.102]} s={[0.01, 0.01, 0.007]} />
              <B g={BOX} c={HAIR} p={[0.04 * sx, 0.048, 0.097]} r={[0, 0, 0.1 * sx]} s={[0.042, 0.009, 0.01]} />
            </group>
          ))}
          <B c="#d3a07c" p={[0, -0.012, 0.108]} s={[0.019, 0.03, 0.022]} />
          <mesh geometry={SMILE} material={m('#ffffff')} position={[0, -0.05, 0.1]} rotation={[0, 0, Math.PI]} scale={[0.036, 0.022, 0.02]} />
          <mesh
            geometry={STUBBLE}
            material={m('#7a5a45', { transparent: true, opacity: 0.16, depthWrite: false })}
            rotation={[0.3, 0, 0]}
            scale={[0.1015, 0.1295, 0.1115]}
          />
          {TUFTS.map(([x, y, z, s], i) => (
            <B key={i} c={HAIR} o={{ roughness: 1 }} p={[x, y, z]} s={[s, s * 0.75, s]} />
          ))}
          {/* sunglasses pushed up into his hair */}
          <group position={[0, 0.13, 0.07]} rotation={[-0.9, 0, 0]}>
            {[-1, 1].map((sx) => (
              <B key={sx} g={CYL} c="#15171c" o={{ roughness: 0.2, metalness: 0.4 }} p={[0.04 * sx, 0, 0]} r={[Math.PI / 2, 0, 0]} s={[0.032, 0.008, 0.024]} />
            ))}
            <B g={BOX} c="#15171c" p={[0, 0.004, 0]} s={[0.03, 0.006, 0.006]} />
          </group>
        </group>
      </group>
    </group>
  )
}
