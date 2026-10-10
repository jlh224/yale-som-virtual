import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Labubu from './Labubu.jsx'
import { talk } from './talk.js'

// Prof. Tauhid Zaman, built from primitives: black hoodie with a pink BLACKPINK print, joggers,
// sneakers, buzz cut, and a pink Labubu clipped to his waistband.
// Figure faces +z and stands about 1.73 m tall; its own left hip (where the Labubu hangs) is at +x.

const SKIN = '#c08a5e'
const HOODIE = '#131316'
const PANTS = '#2c2c33'
const PINK = '#ff4fa3'
const HAIR = '#17120f'

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
const TORSO = new THREE.CylinderGeometry(0.2, 0.235, 0.62, 28)
const BUZZ = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, 1.45) // cap over the top of the head
const STUBBLE = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 1.8, Math.PI - 1.8) // jaw
const SMILE = new THREE.TorusGeometry(1, 0.16, 6, 14, Math.PI)

const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />

function printTex() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = PINK
  g.font = '900 78px "Arial Black", Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('BLACKPINK', 256, 68, 492)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const HIP = 0.9
const HEAD_Y = 0 // face parts are placed relative to the head's center

export default function Zaman({ who, motion }) {
  const body = useRef()
  const legL = useRef()
  const legR = useRef()
  const armR = useRef()
  const armL = useRef()
  const charm = useRef()
  const print = useMemo(() => new THREE.MeshBasicMaterial({ map: printTex(), transparent: true }), [])
  const hoodie = m(HOODIE)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const talking = talk.active === who
    body.current.scale.y = 1 + Math.sin(t * 1.8) * 0.006 // breathing
    // right arm: throws up a "yo" wave every so often; while chatting both hands talk
    const wave = Math.max(0, Math.sin(t * 0.9)) ** 6
    if (talking) {
      armR.current.rotation.set(-0.9 - Math.sin(t * 3.1) * 0.25, 0, -0.2)
      armL.current.rotation.set(-0.7 - Math.sin(t * 2.6 + 1) * 0.25, 0, 0.2)
    } else {
      armR.current.rotation.set(-wave * 0.4, 0, -0.14 - wave * 2.4 + Math.sin(t * 9) * wave * 0.25)
      armL.current.rotation.set(0.05, 0, 0.14)
    }
    // walking: legs swing from the hips, arms swing the other way
    const stride = Math.sin(motion.current.phase) * 0.55 * motion.current.walk
    legL.current.rotation.x = stride
    legR.current.rotation.x = -stride
    armL.current.rotation.x -= stride * 0.7
    armR.current.rotation.x += stride * 0.7 * (talking ? 0 : 1)
    body.current.position.y = Math.abs(Math.cos(motion.current.phase)) * 0.015 * motion.current.walk
    charm.current.rotation.z = Math.sin(t * 2.2) * 0.14
    charm.current.rotation.x = Math.sin(t * 1.7) * 0.08
  })

  return (
    <group>
      {/* sneakers + joggers */}
      {[-1, 1].map((sx) => (
        // each leg pivots at the hip so it can swing when he walks
        <group key={sx} ref={sx === 1 ? legL : legR} position={[0.1 * sx, HIP, 0]}>
          <B g={BOX} c="#f4f4f6" p={[0, 0.045 - HIP, 0.04]} s={[0.11, 0.07, 0.27]} />
          <B g={BOX} c={PINK} p={[0, 0.012 - HIP, 0.04]} s={[0.115, 0.024, 0.275]} />
          <B g={CYL} c={PANTS} p={[0, 0.49 - HIP, 0]} s={[0.085, 0.82, 0.09]} />
          <B g={CYL} c="#1c1c21" p={[0, 0.11 - HIP, 0]} s={[0.09, 0.06, 0.095]} />
        </group>
      ))}
      <B g={CYL} c={PANTS} p={[0, 0.88, 0]} s={[0.2, 0.14, 0.15]} />

      <group ref={body}>
        {/* hoodie */}
        <mesh geometry={TORSO} material={hoodie} position={[0, 1.17, 0]} scale={[1, 1, 0.75]} />
        <B g={CYL} c="#0c0c0e" p={[0, 0.87, 0]} s={[0.24, 0.07, 0.18]} />
        <B c={HOODIE} p={[0, 1.45, 0]} s={[0.26, 0.09, 0.16]} />
        <B c={HOODIE} p={[0, 1.47, -0.11]} s={[0.16, 0.13, 0.1]} />
        <B g={BOX} c="#0c0c0e" p={[0, 1.0, 0.168]} s={[0.24, 0.13, 0.02]} />
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B g={CYL} c={PINK} p={[0.035 * sx, 1.38, 0.158]} r={[0.08, 0, 0]} s={[0.006, 0.15, 0.006]} />
            <B c={PINK} p={[0.035 * sx, 1.3, 0.162]} s={[0.01, 0.014, 0.01]} />
          </group>
        ))}
        <mesh material={print} position={[0, 1.2, 0.17]}>
          <planeGeometry args={[0.27, 0.067]} />
        </mesh>
        <B g={CYL} c={SKIN} p={[0, 1.5, 0]} s={[0.048, 0.08, 0.048]} />

        {/* arms */}
        <group ref={armL} position={[0.27, 1.43, 0]}>
          <mesh geometry={CAP} material={hoodie} position={[0, -0.24, 0]} scale={[0.065, 0.2, 0.065]} />
          <B c={SKIN} p={[0, -0.5, 0.02]} s={[0.045, 0.055, 0.04]} />
        </group>
        <group ref={armR} position={[-0.27, 1.43, 0]}>
          <mesh geometry={CAP} material={hoodie} position={[0, -0.24, 0]} scale={[0.065, 0.2, 0.065]} />
          <B c={SKIN} p={[0, -0.5, 0.02]} s={[0.045, 0.055, 0.04]} />
        </group>

        {/* head: buzz cut, thick brows, light stubble, easy smile */}
        <group position={[0, 1.63, 0]} scale={1.15}>
          <B c={SKIN} p={[0, HEAD_Y, 0]} s={[0.105, 0.1225, 0.114]} />
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <B c={SKIN} p={[0.106 * sx, HEAD_Y, 0]} s={[0.018, 0.03, 0.018]} />
              <B c="#ffffff" p={[0.04 * sx, HEAD_Y + 0.022, 0.098]} s={[0.02, 0.016, 0.01]} />
              <B c="#1d1410" p={[0.04 * sx, HEAD_Y + 0.022, 0.106]} s={[0.01, 0.011, 0.007]} />
              <B g={BOX} c={HAIR} p={[0.041 * sx, HEAD_Y + 0.052, 0.1]} r={[0, 0, -0.08 * sx]} s={[0.046, 0.012, 0.012]} />
            </group>
          ))}
          <B c="#b47f55" p={[0, HEAD_Y - 0.012, 0.112]} s={[0.021, 0.027, 0.022]} />
          <mesh geometry={SMILE} material={m('#7a3b33')} position={[0, HEAD_Y - 0.045, 0.107]} rotation={[0, 0, Math.PI]} scale={[0.03, 0.016, 0.02]} />
          <mesh geometry={BUZZ} material={m(HAIR, { roughness: 1 })} position={[0, HEAD_Y, 0]} rotation={[-0.3, 0, 0]} scale={[0.108, 0.126, 0.117]} />
          <mesh
            geometry={STUBBLE}
            material={m('#3a2a20', { transparent: true, opacity: 0.22, depthWrite: false })}
            position={[0, HEAD_Y, 0]}
            rotation={[0.3, 0, 0]}
            scale={[0.1065, 0.124, 0.1155]}
          />
        </group>
      </group>

      {/* Labubu on a pink strap, clipped to the waistband at his left hip */}
      <group ref={charm} position={[0.2, 0.9, 0.07]}>
        <B g={CYL} c={PINK} p={[0, -0.05, 0]} s={[0.007, 0.1, 0.007]} />
        <B g={SPH} c="#c9a44a" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, 0, 0]} s={[0.014, 0.014, 0.014]} />
        <Labubu fur="#ff8fc7" expression="grin" height={0.24} position={[0, -0.33, 0]} phase={2} />
      </group>
    </group>
  )
}
