import json

import pytest
from fastapi.testclient import TestClient

from app import ai, db
from app.main import app

H = {"X-User-Id": "user-test-1234"}
H2 = {"X-User-Id": "user-other-5678"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "t.db"))
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    async def fake_llm(system, user, *, json_mode=False, temperature=0.3):
        if not json_mode:
            return "Gradient descent minimises loss step by step."
        if "Create" in user and "interview questions" in user:
            return json.dumps({"questions": ["What is a list?", "Explain OOP.", "What is a decorator?"]})
        if "Evaluate the answer" in user:
            return json.dumps({"relevance": 4, "clarity": 5, "depth": 3, "strengths": ["clear"],
                               "improvements": ["add example"], "model_answer_outline": "define, example"})
        return json.dumps({"overall_summary": "Good.", "top_strengths": ["clarity"],
                           "practice_areas": ["depth"], "recommended_topics": ["OOP"]})

    monkeypatch.setattr(ai, "call_llm", fake_llm)
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/api/health").json()
    assert r["ok"] and r["aiConfigured"]


def test_requires_user_header(client):
    assert client.get("/api/stats").status_code == 400


def test_chat_saves_history(client):
    r = client.post("/api/chat", json={"question": "What is GD?", "lessonTime": 12}, headers=H)
    assert r.status_code == 200 and "Gradient" in r.json()["answer"]
    assert len(client.get("/api/history", headers=H).json()["items"]) == 1
    assert client.get("/api/history", headers=H2).json()["items"] == []


def test_chat_validation(client):
    r = client.post("/api/chat", json={"question": ""}, headers=H)
    assert r.status_code == 422 and "error" in r.json()


def test_full_interview_flow(client):
    s = client.post("/api/interview/start", json={"role": "Python Developer", "num_questions": 3}, headers=H).json()
    sid = s["session_id"]
    assert len(s["questions"]) == 3
    a = client.post(f"/api/interview/{sid}/answer", json={"question_index": 0, "answer": "A list is ordered."}, headers=H)
    assert a.status_code == 200 and a.json()["feedback"]["rating"] == 4.0
    assert client.post(f"/api/interview/{sid}/answer", json={"question_index": 9, "answer": "x"}, headers=H).status_code == 422
    f = client.post(f"/api/interview/{sid}/finish", headers=H).json()
    assert f["status"] == "finished" and f["summary"]["average_rating"] == 4.0
    assert client.post(f"/api/interview/{sid}/answer", json={"question_index": 1, "answer": "x"}, headers=H).status_code == 409
    st = client.get("/api/stats", headers=H).json()
    assert st["interviews_finished"] == 1 and st["average_rating"] == 4.0 and st["focus_areas"] == ["depth"]
    assert len(client.get("/api/interview/sessions", headers=H).json()["items"]) == 1


def test_sessions_are_private_per_user(client):
    sid = client.post("/api/interview/start", json={"role": "Tester"}, headers=H).json()["session_id"]
    assert client.get(f"/api/interview/{sid}", headers=H2).status_code == 404


def test_finish_needs_an_answer(client):
    sid = client.post("/api/interview/start", json={"role": "Tester"}, headers=H).json()["session_id"]
    assert client.post(f"/api/interview/{sid}/finish", headers=H).status_code == 409


def test_delete_my_data(client):
    client.post("/api/chat", json={"question": "hi"}, headers=H)
    client.post("/api/interview/start", json={"role": "Tester"}, headers=H)
    client.delete("/api/me/data", headers=H)
    st = client.get("/api/stats", headers=H).json()
    assert st["questions_asked"] == 0 and st["interviews_started"] == 0


def test_rate_limit(client, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_PER_10MIN", "2")
    h = {"X-User-Id": "user-ratelim-1"}
    codes = [client.post("/api/chat", json={"question": "q"}, headers=h).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_no_key_gives_503(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "n.db"))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with TestClient(app) as c:
        assert c.get("/api/health").json()["aiConfigured"] is False
        r = c.post("/api/chat", json={"question": "hi"}, headers={"X-User-Id": "user-nokey-123"})
        assert r.status_code == 503 and "not configured" in r.json()["error"]


def test_malformed_ai_json_is_502(client, monkeypatch):
    async def bad(system, user, *, json_mode=False, temperature=0.3):
        return "not json"
    monkeypatch.setattr(ai, "call_llm", bad)
    r = client.post("/api/interview/start", json={"role": "Tester"}, headers=H)
    assert r.status_code == 502


def test_spa_and_unknown_api(client):
    assert client.get("/").status_code == 200
    assert client.get("/api/nope").status_code == 404
    assert client.get("/some/client/route").status_code == 200
