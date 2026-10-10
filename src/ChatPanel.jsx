import { useEffect, useRef, useState } from 'react'
import { API } from './talk.js'

// conversations survive closing the panel: { [professor id]: { sessionId, messages } }
const conversations = new Map()

export default function ChatPanel({ prof, onClose }) {
  const saved = conversations.get(prof.id)
  const [messages, setMessages] = useState(saved?.messages ?? [{ from: 'prof', text: prof.greeting }])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const session = useRef(saved?.sessionId ?? null)
  const list = useRef()
  const input = useRef()
  const last = prof.name.split(' ').slice(-1)[0]

  useEffect(() => {
    conversations.set(prof.id, { sessionId: session.current, messages })
    list.current.scrollTop = list.current.scrollHeight
  }, [messages, busy, prof.id])
  useEffect(() => input.current.focus(), [])

  const send = async (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    setMessages((m) => [...m, { from: 'me', text }])
    setBusy(true)
    try {
      const res = await fetch(`${API}/professors/${prof.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: session.current }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      session.current = data.session_id
      setMessages((m) => [...m, { from: 'prof', text: data.reply }])
    } catch {
      setMessages((m) => [...m, { from: 'error', text: `Prof. ${last} can't answer right now. Check that the backend is running.` }])
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  return (
    <div className="chat" onKeyDown={(e) => e.key === 'Escape' && onClose(false)}>
      <div className="chathead">
        <div>
          <div className="chatname">Prof. {prof.name}</div>
          <div className="chatcourse">{prof.course}</div>
        </div>
        <button className="chatclose" onClick={() => onClose(true)} aria-label="Close chat">
          ✕
        </button>
      </div>
      <div className="chatlist" ref={list}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.from}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="bubble prof typing">Prof. {last} is typing…</div>}
      </div>
      <form className="chatform" onSubmit={send}>
        <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Ask Prof. ${last} something`} maxLength={4000} />
        <button disabled={busy || !draft.trim()}>Send</button>
      </form>
    </div>
  )
}
