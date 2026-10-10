"""FastAPI backend for the virtual Evans Hall: chat with professor agents.

Run from the repo root:
    C:/venvs/lecture07/Scripts/python.exe -m uvicorn main:app --app-dir backend --port 8007
"""

import logging
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db
import professors

log = logging.getLogger("uvicorn.error")

app = FastAPI(title="Yale SOM virtual professors")
# the 3D app is a static site that may be served from another origin (Vite, GitHub Pages)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MAX_SESSIONS = 500
MAX_HISTORY = 40  # messages kept per conversation
# conversation memory, in process: {(professor slug, session id): pydantic-ai message history}
sessions: dict[tuple[str, str], list] = {}


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    tools_used: list[str]


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "model": professors.MODEL_NAME, "professors": len(db.faculty_names())}


@app.get("/api/professors")
def list_professors() -> list[dict]:
    return [professors.profile(f) for f in db.faculty_names()]


@app.get("/api/professors/{slug}")
def get_professor(slug: str) -> dict:
    faculty = professors.find_faculty(slug)
    if faculty is None:
        raise HTTPException(404, f"No professor '{slug}'")
    return professors.profile(faculty)


@app.post("/api/professors/{slug}/chat")
async def chat(slug: str, req: ChatRequest) -> ChatResponse:
    try:
        agent = professors.get_agent(slug)
    except RuntimeError as e:  # missing API key
        raise HTTPException(503, str(e))
    if agent is None:
        raise HTTPException(404, f"No professor '{slug}'")

    session_id = req.session_id or uuid4().hex
    key = (slug, session_id)
    history = sessions.get(key, [])
    try:
        result = await agent.run(req.message, message_history=history)
    except Exception:
        log.exception("chat with %s failed", slug)
        raise HTTPException(502, "The professor could not answer right now.")

    if key not in sessions and len(sessions) >= MAX_SESSIONS:
        sessions.pop(next(iter(sessions)))  # drop the oldest conversation
    sessions[key] = trim(result.all_messages())
    tools_used = [p.tool_name for m in result.new_messages() for p in m.parts if p.part_kind == "tool-call"]
    return ChatResponse(reply=result.output, session_id=session_id, tools_used=tools_used)


def trim(messages: list) -> list:
    """Keep the tail of a conversation, starting on a user turn so tool calls stay paired with their results."""
    if len(messages) <= MAX_HISTORY:
        return messages
    for i in range(len(messages) - MAX_HISTORY, len(messages)):
        m = messages[i]
        if m.kind == "request" and any(p.part_kind == "user-prompt" for p in m.parts):
            return messages[i:]
    return messages
