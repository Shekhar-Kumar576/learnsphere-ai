"""SQLite storage: learning-chat history and mock-interview sessions."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.getenv("DATABASE_PATH", "./data/app.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS interview_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL,
  questions TEXT NOT NULL,          -- JSON list of question strings
  status TEXT NOT NULL DEFAULT 'in_progress',
  summary TEXT,                     -- JSON, filled on finish
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS interview_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  answer TEXT NOT NULL,
  feedback TEXT NOT NULL,           -- JSON
  rating REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, question_index)
);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_sess_user ON interview_sessions(user_id, id DESC);
"""


@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with conn() as c:
        c.executescript(SCHEMA)


def jdump(v) -> str:
    return json.dumps(v, ensure_ascii=False)


def jload(s):
    return json.loads(s) if s else None
