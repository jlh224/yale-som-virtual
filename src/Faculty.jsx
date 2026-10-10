import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Professor, { PROFESSORS } from './Professor.jsx'
import Zaman from './Zaman.jsx'
import Schott from './Schott.jsx'
import { DRUMS, LECTERNS, collide, floorAt } from './layout.js'
import { talk } from './talk.js'

// Real Yale SOM professors. Each is an AI agent in the backend (id = their slug there), so you can
// walk up and chat with them. Add a professor here and give them a room in ROOM_PROFESSOR.
export const REAL_PROFESSORS = {
  zaman: {
    id: 'tauhid-zaman',
    name: 'Tauhid Zaman',
    course: 'MGT 409 · AI Foundations for Managers',
    greeting: "Yo! Welcome to MGT 409. What's good? Ask me about AI, the class, or any other course at SOM.",
    height: 1.75,
    Avatar: Zaman,
  },
  schott: {
    id: 'peter-schott',
    name: 'Peter Schott',
    course: 'MGT 407 · Statistics (EMBA)',
    greeting: "Hey hey, welcome in! I'm Peter Schott. Stats, trade, anything at SOM: what can I help you with? This is gonna be fun.",
    height: 1.85,
    Avatar: Schott,
  },
}

// who teaches in which classroom (matches the slide decks); Hogwarts fills in for everyone not yet built
export const ROOM_PROFESSOR = {
  2400: 'snape', // MGT 402 Basics of Accounting
  2410: 'mcgonagall', // MGT 404 Basics of Economics
  2420: 'lockhart', // MGT 538 Mastering Influence & Persuasion
  2430: 'slughorn', // MGT 887 Negotiations
  2200: 'zaman', // MGT 409 AI Foundations for Managers (EVANS 2200 in the course database)
  2210: 'schott', // MGT 403 Probability Modeling & Statistics, next door to Zaman
  2220: 'moody', // MGT 800 Crisis Management in Tech
  2230: 'flitwick', // MGT 541 Corporate Finance
}

const nameOf = (who) => (REAL_PROFESSORS[who] ?? PROFESSORS[who]).name

function plaqueTex(name) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#c9a44a'
  g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#2a1d0c'
  g.fillRect(8, 8, 496, 112)
  g.fillStyle = '#f3dfa8'
  g.font = 'bold 44px Georgia, serif'
  g.textAlign = 'center'
  g.fillText(`Prof. ${name.split(' ').slice(-1)[0]}`, 256, 80)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const WALK_SPEED = 1.5 // m/s
const PERSONAL_SPACE = 1.7 // how close he comes before stopping

// A real professor scans the room like the wizards do until you walk into the classroom. Then he
// walks over (staying on the flat floor at the front), stops in front of you and faces you. When
// you leave he goes back to his spot.
function TalkingProfessor({ who, position, rotation, phase, room }) {
  const root = useRef()
  const { Avatar, height, name } = REAL_PROFESSORS[who]
  const live = useMemo(() => [...position], [position]) // where he is now; Interact aims at this
  const motion = useRef({ walk: 0, phase: 0 }) // read by the avatar to swing its legs
  const step = useMemo(() => ({ x: 0, z: 0 }), [])
  useEffect(() => {
    const target = { who, pos: live, height, prompt: `talk to Prof. ${name.split(' ').slice(-1)[0]}` }
    talk.targets.push(target)
    return () => {
      talk.targets = talk.targets.filter((t) => t !== target)
    }
  }, [who, live, height, name])

  // he may stand anywhere in his room that is level with the front floor
  const canStand = (x, z) =>
    ((x - room.c[0]) / (room.rx - 0.7)) ** 2 + ((z - room.c[1]) / (room.rz - 0.7)) ** 2 < 1 && floorAt(x, z) < 0.05

  useFrame(({ camera, clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const g = root.current
    const cx = camera.position.x
    const cz = camera.position.z
    // he sees you once you are inside the room, on the seating side of the front wall
    const seen =
      ((cx - room.c[0]) / room.rx) ** 2 + ((cz - room.c[1]) / room.rz) ** 2 < 1 &&
      (cx - room.fc[0]) * room.back[0] + (cz - room.fc[1]) * room.back[1] > 0

    let gx = position[0]
    let gz = position[2]
    if (seen) {
      const d = Math.hypot(live[0] - cx, live[2] - cz)
      const k = d > 1e-3 ? PERSONAL_SPACE / d : 0
      gx = cx + (live[0] - cx) * k
      gz = cz + (live[2] - cz) * k
    }
    const dx = gx - live[0]
    const dz = gz - live[2]
    const dist = Math.hypot(dx, dz)
    let moved = 0
    if (dist > 0.08) {
      const s = Math.min(WALK_SPEED * dt, dist) / dist
      step.x = live[0] + dx * s
      step.z = live[2] + dz * s
      collide(step)
      // blocked by a riser or the edge of the room: slide along whichever axis is still free
      if (!canStand(step.x, step.z)) {
        if (canStand(step.x, live[2])) step.z = live[2]
        else if (canStand(live[0], step.z)) step.x = live[0]
        else {
          step.x = live[0]
          step.z = live[2]
        }
      }
      moved = Math.hypot(step.x - live[0], step.z - live[2])
      live[0] = step.x
      live[2] = step.z
      g.position.set(live[0], live[1], live[2])
    }
    const walking = moved > WALK_SPEED * dt * 0.3
    const m = motion.current
    m.walk += ((walking ? 1 : 0) - m.walk) * Math.min(1, dt * 8)
    m.phase += dt * 7.5

    // face where he is going; once he has arrived (or while chatting) face you; otherwise scan the room
    let target = rotation + Math.sin((clock.elapsedTime + phase) * 0.4) * 0.3
    if (walking) target = Math.atan2(dx, dz)
    else if (seen || talk.active === who) target = Math.atan2(cx - live[0], cz - live[2])
    const turn = target - g.rotation.y
    g.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 5) // shortest way round
  })
  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]}>
      <Avatar who={who} motion={motion} />
    </group>
  )
}

export default function Faculty() {
  const items = useMemo(
    () =>
      DRUMS.map((d, i) => {
        const who = ROOM_PROFESSOR[d.id]
        const { fc, back, t, half, rot } = d.front
        const lec = LECTERNS[i]
        return {
          who,
          room: { c: d.c, rx: d.rx, rz: d.rz, fc, back },
          pos: [fc[0] + back[0] * 1.15 - t[0] * half * 0.3, 0, fc[1] + back[1] * 1.15 - t[1] * half * 0.3],
          rot,
          plaque: { p: [lec.x + back[0] * 0.26, 0.85, lec.z + back[1] * 0.26], rot, mat: new THREE.MeshBasicMaterial({ map: plaqueTex(nameOf(who)) }) },
        }
      }),
    [],
  )
  return (
    <>
      {items.map((it, i) => (
        <group key={i}>
          {REAL_PROFESSORS[it.who] ? (
            <TalkingProfessor who={it.who} position={it.pos} rotation={it.rot} phase={i * 1.7} room={it.room} />
          ) : (
            <Professor who={it.who} position={it.pos} rotation={it.rot} phase={i * 1.7} />
          )}
          <mesh position={it.plaque.p} rotation={[0, it.plaque.rot, 0]} material={it.plaque.mat}>
            <planeGeometry args={[0.6, 0.15]} />
          </mesh>
        </group>
      ))}
      {/* Hagrid keeps an eye on the Labubus in the courtyard */}
      <Professor who="hagrid" position={[-10.5, -5, -2]} rotation={Math.PI / 2} />
    </>
  )
}
