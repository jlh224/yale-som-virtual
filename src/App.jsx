import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './World.jsx'
import Player from './Player.jsx'
import Minimap from './Minimap.jsx'
import TouchControls from './TouchControls.jsx'
import Interact from './Interact.jsx'
import ChatPanel from './ChatPanel.jsx'
import { REAL_PROFESSORS } from './Faculty.jsx'
import { EYE, SPAWN } from './layout.js'
import { talk } from './talk.js'

export default function App() {
  const [locked, setLocked] = useState(false)
  const [where, setWhere] = useState('')
  const [showMap, setShowMap] = useState(true)
  const lockRef = useRef()
  const mapRef = useRef()
  const onLock = useCallback((v) => setLocked(v), [])
  const onWhere = useCallback((w) => setWhere(w), [])
  // phones have no pointer lock, so they get a joystick + drag-to-look instead
  const [isTouch] = useState(() => matchMedia('(pointer: coarse)').matches) // phones + tablets; touchscreen laptops still get mouse mode
  const [touchOn, setTouchOn] = useState(false)
  const touchRef = useRef({ active: false, move: [0, 0], look: [0, 0], jump: false })
  const setTouch = (on) => {
    touchRef.current.active = on
    touchRef.current.move = [0, 0]
    setTouchOn(on)
  }
  const playing = locked || touchOn
  // talking to professors: aim = who the crosshair is on, chat = who the chat window is open with
  const [aim, setAim] = useState(null)
  const [chat, setChat] = useState(null)
  const aimRef = useRef(null)
  aimRef.current = playing && !chat ? aim : null
  const aimPrompt = aimRef.current && talk.targets.find((t) => t.who === aimRef.current)?.prompt
  const openChat = useCallback((who) => {
    setChat(who)
    if (document.pointerLockElement) document.exitPointerLock() // free the mouse for typing
  }, [])
  // act on whatever the crosshair is on: chat with a professor, or the target's own action (petting Dan)
  const use = useCallback(
    (who) => {
      const target = talk.targets.find((t) => t.who === who)
      if (target?.use) target.use()
      else if (target) openChat(who)
    },
    [openChat],
  )
  const closeChat = (resume) => {
    setChat(null)
    if (resume && !touchOn) lockRef.current?.()
  }
  useEffect(() => {
    talk.active = chat
  }, [chat])
  useEffect(() => {
    const typing = (e) => e.target.closest?.('input, textarea')
    const k = (e) => {
      if (typing(e)) return
      if (e.code === 'KeyM') setShowMap((v) => !v)
      if (e.code === 'KeyE' && aimRef.current) use(aimRef.current)
    }
    // with the pointer locked, a click acts on whoever is under the crosshair
    const click = () => document.pointerLockElement && aimRef.current && use(aimRef.current)
    // embedded browsers can refuse pointer lock; fall back to the joystick so the click still walks in
    const noLock = () => {
      touchRef.current.active = true
      setTouchOn(true)
    }
    window.addEventListener('keydown', k)
    window.addEventListener('mousedown', click)
    document.addEventListener('pointerlockerror', noLock)
    return () => {
      window.removeEventListener('keydown', k)
      window.removeEventListener('mousedown', click)
      document.removeEventListener('pointerlockerror', noLock)
    }
  }, [use])

  return (
    <>
      <Canvas
        camera={{ fov: 72, near: 0.05, far: 800, position: [SPAWN.x, EYE, SPAWN.z] }}
        dpr={[1, 1.75]}
      >
        <World />
        <Player lockRef={lockRef} mapRef={mapRef} touchRef={touchRef} onLock={onLock} onWhere={onWhere} />
        <Interact onAim={setAim} />
      </Canvas>

      <div className="where">
        <span className="dot" />
        {where}
      </div>
      <div className={showMap ? 'mapwrap' : 'mapwrap hidden'}>
        <Minimap drawRef={mapRef} />
      </div>
      <button className="maptoggle" onClick={() => setShowMap((s) => !s)}>
        {showMap ? 'hide map' : 'map'}
      </button>
      {playing && !chat && <div className="crosshair" />}
      {touchOn && !chat && <TouchControls touchRef={touchRef} onPause={() => setTouch(false)} />}
      {aimPrompt &&
        (touchOn ? (
          <button className="talkhint tap" onPointerDown={() => use(aim)}>
            {aimPrompt[0].toUpperCase() + aimPrompt.slice(1)}
          </button>
        ) : (
          <div className="talkhint">
            <b>Click</b> or press <b>E</b> to {aimPrompt}
          </div>
        ))}
      {chat && <ChatPanel prof={REAL_PROFESSORS[chat]} onClose={closeChat} />}

      {!playing && !chat && (
        <div className="overlay" onClick={() => (isTouch ? setTouch(true) : lockRef.current?.())}>
          <div className="card">
            <div className="kicker">Yale SOM · Evans Hall</div>
            <h1>Floor 2</h1>
            <p className="sub">Classroom drums, the cloister, Ross Library, the Beinecke Terrace Room, and the courtyard.</p>
            <button className="go">{isTouch ? 'Tap to walk in' : 'Click to walk in'}</button>
            {!isTouch && (
              <button
                className="go alt"
                onClick={(e) => {
                  e.stopPropagation()
                  setTouch(true)
                }}
              >
                Use on-screen joystick
              </button>
            )}
            {isTouch ? (
              <div className="keys">
                <span><b>Left thumb</b> joystick to walk (push all the way to hurry)</span>
                <span><b>Right thumb</b> drag to look</span>
              </div>
            ) : (
              <div className="keys">
                <span><b>W A S D</b> walk</span>
                <span><b>Mouse</b> look</span>
                <span><b>Shift</b> sprint</span>
                <span><b>Space</b> jump</span>
                <span><b>C</b> crouch</span>
                <span><b>M</b> map</span>
                <span><b>Esc</b> pause</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
