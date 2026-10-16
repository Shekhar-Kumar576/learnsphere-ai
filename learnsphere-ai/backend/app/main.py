"""LearnSphere AI backend (FastAPI).

Modules: learning assistant chat, AI mock interview, history/dashboard stats.
Also serves the built React frontend (../dist) so one service hosts everything.
"""
import os
import re
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import ai, db


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="LearnSphere AI API", version="2.0", lifespan=lifespan)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"]
    )


# ---------- error format: always {"error": "..."} ----------
@app.exception_handler(ai.AIError)
async def _ai_error(_: Request, e: ai.AIError):
    return JSONResponse({"error": e.message}, status_code=e.status)


@app.exception_handler(HTTPException)
async def _http_error(_: Request, e: HTTPException):
    return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, e: RequestValidationError):
    first = e.errors()[0] if e.errors() else {}
    where = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    return JSONResponse({"error": f"Invalid input ({where}): {first.get('msg', 'bad value')}"}, status_code=422)


# ---------- user identity (anonymous device id, NOT a real login) ----------
USER_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def current_user(x_user_id: str = Header(default="")) -> str:
    if not USER_RE.match(x_user_id):
        raise HTTPException(400, "Missing or invalid X-User-Id header")
    return x_user_id


# ---------- simple in-memory rate limit for AI calls ----------
_hits: dict[str, deque] = defaultdict(deque)


def ai_limit(user: str = Depends(current_user)) -> str:
    limit = int(os.getenv("RATE_LIMIT_PER_10MIN", "40"))
    now = time.time()
    q = _hits[user]
    while q and now - q[0] > 600:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Too many AI requests. Please wait a few minutes.")
    q.append(now)
    return user


# ---------- schemas ----------
class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    context: str = Field(default="", max_length=20000)
    lessonTime: float = Field(default=0, ge=0, le=100000)


class StartIn(BaseModel):
    role: str = Field(min_length=2, max_length=80)
    topic: str = Field(default="", max_length=120)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    num_questions: int = Field(default=5, ge=3, le=10)


class AnswerIn(BaseModel):
    question_index: int = Field(ge=0, le=20)
    answer: str = Field(min_length=1, max_length=4000)


# ---------- health ----------
@app.get("/api/health")
def health():
    return {"ok": True, "aiConfigured": ai.configured(), "model": ai.model() if ai.configured() else None}


# ---------- learning assistant ----------
@app.post("/api/chat")
async def chat(body: ChatIn, user: str = Depends(ai_limit)):
    answer = await ai.tutor_answer(body.question.strip(), body.context, body.lessonTime)
    with db.conn() as c:
        c.execute(
            "INSERT INTO chat_history(user_id, question, answer) VALUES (?,?,?)",
            (user, body.question.strip(), answer),
        )
    return {"answer": answer, "mode": "live-ai"}


@app.get("/api/history")
def history(user: str = Depends(current_user)):
    with db.conn() as c:
        rows = c.execute(
            "SELECT question, answer, created_at FROM chat_history WHERE user_id=? ORDER BY id DESC LIMIT 30",
            (user,),
        ).fetchall()
    return {"items": [dict(r) for r in rows]}


# ---------- mock interview ----------
def _own_session(c, sid: int, user: str):
    s = c.execute("SELECT * FROM interview_sessions WHERE id=? AND user_id=?", (sid, user)).fetchone()
    if not s:
        raise HTTPException(404, "Interview session not found")
    return s


@app.post("/api/interview/start")
async def interview_start(body: StartIn, user: str = Depends(ai_limit)):
    qs = await ai.make_questions(body.role.strip(), body.topic.strip(), body.difficulty, body.num_questions)
    with db.conn() as c:
        cur = c.execute(
            "INSERT INTO interview_sessions(user_id, role, topic, difficulty, questions) VALUES (?,?,?,?,?)",
            (user, body.role.strip(), body.topic.strip(), body.difficulty, db.jdump(qs)),
        )
        sid = cur.lastrowid
    return {"session_id": sid, "role": body.role.strip(), "topic": body.topic.strip(),
            "difficulty": body.difficulty, "questions": qs}


@app.post("/api/interview/{sid}/answer")
async def interview_answer(sid: int, body: AnswerIn, user: str = Depends(ai_limit)):
    with db.conn() as c:
        s = _own_session(c, sid, user)
    questions = db.jload(s["questions"])
    if s["status"] != "in_progress":
        raise HTTPException(409, "This interview is already finished")
    if body.question_index >= len(questions):
        raise HTTPException(422, "question_index out of range")
    fb = await ai.evaluate_answer(s["role"], s["topic"], questions[body.question_index], body.answer.strip())
    with db.conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO interview_answers(session_id, question_index, answer, feedback, rating) "
            "VALUES (?,?,?,?,?)",
            (sid, body.question_index, body.answer.strip(), db.jdump(fb), fb["rating"]),
        )
    return {"question_index": body.question_index, "feedback": fb}


@app.post("/api/interview/{sid}/finish")
async def interview_finish(sid: int, user: str = Depends(ai_limit)):
    with db.conn() as c:
        s = _own_session(c, sid, user)
        if s["status"] == "finished":
            return _session_detail(c, s)
        rows = c.execute(
            "SELECT question_index, answer, feedback, rating FROM interview_answers "
            "WHERE session_id=? ORDER BY question_index", (sid,)).fetchall()
    if not rows:
        raise HTTPException(409, "Answer at least one question before finishing")
    questions = db.jload(s["questions"])
    packed = [
        {"index": r["question_index"], "question": questions[r["question_index"]], "answer": r["answer"],
         "rating": r["rating"], "improvements": db.jload(r["feedback"]).get("improvements", [])}
        for r in rows
    ]
    summary = await ai.summarise_session(s["role"], s["topic"], packed)
    summary["average_rating"] = round(sum(r["rating"] for r in rows) / len(rows), 1)
    summary["answered"] = len(rows)
    summary["total_questions"] = len(questions)
    with db.conn() as c:
        c.execute(
            "UPDATE interview_sessions SET status='finished', summary=?, finished_at=CURRENT_TIMESTAMP WHERE id=?",
            (db.jdump(summary), sid),
        )
        s = _own_session(c, sid, user)
        return _session_detail(c, s)


def _session_detail(c, s) -> dict:
    rows = c.execute(
        "SELECT question_index, answer, feedback, rating FROM interview_answers "
        "WHERE session_id=? ORDER BY question_index", (s["id"],)).fetchall()
    return {
        "session_id": s["id"], "role": s["role"], "topic": s["topic"], "difficulty": s["difficulty"],
        "status": s["status"], "created_at": s["created_at"], "questions": db.jload(s["questions"]),
        "answers": [{"question_index": r["question_index"], "answer": r["answer"],
                     "feedback": db.jload(r["feedback"])} for r in rows],
        "summary": db.jload(s["summary"]),
    }


@app.get("/api/interview/sessions")
def interview_sessions(user: str = Depends(current_user)):
    with db.conn() as c:
        rows = c.execute(
            "SELECT s.id, s.role, s.topic, s.difficulty, s.status, s.created_at, "
            "COUNT(a.id) AS answered, ROUND(AVG(a.rating),1) AS avg_rating "
            "FROM interview_sessions s LEFT JOIN interview_answers a ON a.session_id = s.id "
            "WHERE s.user_id=? GROUP BY s.id ORDER BY s.id DESC LIMIT 20", (user,)).fetchall()
    return {"items": [dict(r) for r in rows]}


@app.get("/api/interview/{sid}")
def interview_get(sid: int, user: str = Depends(current_user)):
    with db.conn() as c:
        return _session_detail(c, _own_session(c, sid, user))


# ---------- dashboard ----------
@app.get("/api/stats")
def stats(user: str = Depends(current_user)):
    with db.conn() as c:
        chats = c.execute("SELECT COUNT(*) FROM chat_history WHERE user_id=?", (user,)).fetchone()[0]
        sess = c.execute(
            "SELECT COUNT(*) AS total, SUM(status='finished') AS done FROM interview_sessions WHERE user_id=?",
            (user,)).fetchone()
        ans = c.execute(
            "SELECT COUNT(*) AS n, ROUND(AVG(a.rating),1) AS avg FROM interview_answers a "
            "JOIN interview_sessions s ON s.id=a.session_id WHERE s.user_id=?", (user,)).fetchone()
        last = c.execute(
            "SELECT summary FROM interview_sessions WHERE user_id=? AND status='finished' "
            "ORDER BY id DESC LIMIT 1", (user,)).fetchone()
    focus = (db.jload(last["summary"]) or {}).get("practice_areas", []) if last else []
    return {
        "questions_asked": chats,
        "interviews_started": sess["total"] or 0,
        "interviews_finished": sess["done"] or 0,
        "answers_reviewed": ans["n"] or 0,
        "average_rating": ans["avg"],
        "focus_areas": focus,
    }


@app.delete("/api/me/data")
def delete_my_data(user: str = Depends(current_user)):
    with db.conn() as c:
        c.execute("DELETE FROM chat_history WHERE user_id=?", (user,))
        c.execute("DELETE FROM interview_sessions WHERE user_id=?", (user,))  # answers cascade
    return {"ok": True}


# ---------- serve the built frontend (production) ----------
DIST = Path(os.getenv("FRONTEND_DIST", Path(__file__).resolve().parents[2] / "dist")).resolve()

if DIST.is_dir():
    if (DIST / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not found")
        target = (DIST / full_path).resolve()
        if full_path and target.is_file() and DIST in target.parents:
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
