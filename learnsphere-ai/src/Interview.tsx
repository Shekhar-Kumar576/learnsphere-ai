import { useEffect, useState } from "react"
import { api, type Health, type Stats } from "./api"

type Feedback = {
  relevance: number; clarity: number; depth: number; rating: number
  strengths: string[]; improvements: string[]; model_answer_outline: string
}
type Summary = {
  overall_summary: string; top_strengths: string[]; practice_areas: string[]
  recommended_topics: string[]; average_rating: number; answered: number; total_questions: number
}
type Detail = {
  session_id: number; role: string; topic: string; difficulty: string; status: string
  created_at: string; questions: string[]
  answers: { question_index: number; answer: string; feedback: Feedback }[]
  summary: Summary | null
}
type Row = {
  id: number; role: string; topic: string; difficulty: string; status: string
  created_at: string; answered: number; avg_rating: number | null
}
type StartResp = { session_id: number; questions: string[] }

const ROLES = ["Python Developer", "Frontend Developer", "Data Analyst", "Software Engineer (Fresher)", "HR / Behavioural"]

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="iv-bar">
      <span>{label}</span>
      <i><b style={{ width: `${(value / 5) * 100}%` }} /></i>
      <em>{value}/5</em>
    </div>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="iv-list">
      <strong>{title}</strong>
      <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  )
}

function FeedbackCard({ fb }: { fb: Feedback }) {
  return (
    <div className="iv-fb card">
      <p className="eyebrow">AI FEEDBACK • INDICATIVE RATING {fb.rating}/5</p>
      <div className="iv-bars">
        <Bar label="Relevance" value={fb.relevance} />
        <Bar label="Clarity" value={fb.clarity} />
        <Bar label="Depth" value={fb.depth} />
      </div>
      <List title="What went well" items={fb.strengths} />
      <List title="How to improve" items={fb.improvements} />
      {fb.model_answer_outline && (
        <div className="iv-list"><strong>What a strong answer covers</strong><p>{fb.model_answer_outline}</p></div>
      )}
    </div>
  )
}

function Report({ d }: { d: Detail }) {
  const s = d.summary
  return (
    <div className="iv-report">
      {s ? (
        <div className="card iv-summary">
          <p className="eyebrow">INTERVIEW SUMMARY</p>
          <h2>{d.role}{d.topic ? ` • ${d.topic}` : ""}</h2>
          <div className="iv-score">{s.average_rating}<span>/5 average (indicative)</span></div>
          <p>{s.overall_summary}</p>
          <p className="iv-note">{s.answered} of {s.total_questions} questions answered</p>
          <List title="Top strengths" items={s.top_strengths} />
          <List title="Practice next" items={s.practice_areas} />
          <List title="Recommended topics to study" items={s.recommended_topics} />
        </div>
      ) : (
        <div className="card iv-summary"><p>This interview was not finished, so there is no summary yet.</p></div>
      )}
      <h3 className="iv-h3">Question by question</h3>
      {d.answers.map((a) => (
        <details key={a.question_index} className="card iv-detail">
          <summary>Q{a.question_index + 1}. {d.questions[a.question_index]} <b>{a.feedback.rating}/5</b></summary>
          <p className="iv-ans"><strong>Your answer:</strong> {a.answer}</p>
          <FeedbackCard fb={a.feedback} />
        </details>
      ))}
    </div>
  )
}

export function Interview({ onChange }: { onChange?: () => void }) {
  const [tab, setTab] = useState<"practice" | "progress">("practice")
  const [phase, setPhase] = useState<"setup" | "session" | "done">("setup")
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [role, setRole] = useState("Python Developer")
  const [topic, setTopic] = useState("")
  const [difficulty, setDifficulty] = useState("intermediate")
  const [count, setCount] = useState(5)

  const [sid, setSid] = useState<number | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [answer, setAnswer] = useState("")
  const [feedback, setFeedback] = useState<Record<number, Feedback>>({})
  const [result, setResult] = useState<Detail | null>(null)

  const [stats, setStats] = useState<Stats | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [opened, setOpened] = useState<Detail | null>(null)

  useEffect(() => {
    api<Health>("/api/health").then(setHealth).catch(() => setHealth({ ok: false, aiConfigured: false, model: null }))
  }, [])

  useEffect(() => {
    if (tab !== "progress") return
    setOpened(null)
    Promise.all([api<Stats>("/api/stats"), api<{ items: Row[] }>("/api/interview/sessions")])
      .then(([s, r]) => { setStats(s); setRows(r.items) })
      .catch((e: Error) => setError(e.message))
  }, [tab])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("")
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const start = () => run(async () => {
    const r = await api<StartResp>("/api/interview/start", {
      method: "POST", body: { role, topic, difficulty, num_questions: count },
    })
    setSid(r.session_id); setQuestions(r.questions); setIdx(0); setAnswer(""); setFeedback({}); setResult(null)
    setPhase("session")
  })

  const submit = () => run(async () => {
    const r = await api<{ feedback: Feedback }>(`/api/interview/${sid}/answer`, {
      method: "POST", body: { question_index: idx, answer },
    })
    setFeedback((f) => ({ ...f, [idx]: r.feedback }))
  })

  const finish = () => run(async () => {
    const d = await api<Detail>(`/api/interview/${sid}/finish`, { method: "POST" })
    setResult(d); setPhase("done"); onChange?.()
  })

  const next = () => {
    if (idx < questions.length - 1) { setIdx(idx + 1); setAnswer(""); setError("") } else void finish()
  }

  const open = (id: number) => run(async () => setOpened(await api<Detail>(`/api/interview/${id}`)))
  const answered = Object.keys(feedback).length
  const fb = feedback[idx]
  const reset = () => { setPhase("setup"); setResult(null); setError("") }

  return (
    <div className="page iv-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">AI MOCK INTERVIEW</p>
          <h1>Practice interviews with instant feedback</h1>
          <p>Pick a role, answer AI-generated questions, and get improvement tips after every answer.</p>
        </div>
      </div>

      {health && !health.aiConfigured && (
        <div className="iv-banner warn">The server has no AI key configured, so interviews cannot run yet. Set OPENAI_API_KEY on the backend.</div>
      )}
      {error && <div className="iv-banner err" role="alert">{error}</div>}

      <div className="iv-tabs">
        <button className={tab === "practice" ? "active" : ""} onClick={() => setTab("practice")}>Practice</button>
        <button className={tab === "progress" ? "active" : ""} onClick={() => setTab("progress")}>My progress</button>
      </div>

      {tab === "practice" && phase === "setup" && (
        <div className="card iv-form">
          <label className="iv-field">
            <span>Role or subject</span>
            <input value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} />
            <div className="iv-chips">
              {ROLES.map((r) => <button key={r} type="button" className="iv-chip" onClick={() => setRole(r)}>{r}</button>)}
            </div>
          </label>
          <label className="iv-field">
            <span>Focus topic (optional)</span>
            <input value={topic} maxLength={120} placeholder="e.g. OOP, SQL joins, teamwork" onChange={(e) => setTopic(e.target.value)} />
          </label>
          <div className="iv-grid2">
            <label className="iv-field">
              <span>Difficulty</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label className="iv-field">
              <span>Number of questions</span>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <button className="btn primary" disabled={busy || role.trim().length < 2} onClick={start}>
            {busy ? "Preparing questions…" : "Start interview"}
          </button>
        </div>
      )}

      {tab === "practice" && phase === "session" && (
        <div>
          <div className="card iv-question">
            <p className="eyebrow">QUESTION {idx + 1} OF {questions.length}</p>
            <h2>{questions[idx]}</h2>
            <textarea
              rows={7}
              maxLength={4000}
              disabled={busy || !!fb}
              value={answer}
              placeholder="Type your answer as you would say it in an interview…"
              onChange={(e) => setAnswer(e.target.value)}
            />
            <div className="iv-actions">
              <span className="iv-note">{answer.length}/4000</span>
              {!fb && (
                <>
                  <button className="btn secondary" disabled={busy} onClick={next}>Skip</button>
                  <button className="btn primary" disabled={busy || !answer.trim()} onClick={submit}>
                    {busy ? "Reviewing…" : "Submit answer"}
                  </button>
                </>
              )}
              {fb && (
                <button className="btn primary" disabled={busy} onClick={next}>
                  {idx < questions.length - 1 ? "Next question" : "Finish & see summary"}
                </button>
              )}
            </div>
          </div>
          {fb && <FeedbackCard fb={fb} />}
          {answered > 0 && idx < questions.length - 1 && (
            <button className="btn ghost iv-early" disabled={busy} onClick={finish}>Finish early ({answered} answered)</button>
          )}
          <p className="iv-note">Ratings are AI-assisted coaching aids, not validated scores.</p>
        </div>
      )}

      {tab === "practice" && phase === "done" && result && (
        <div>
          <Report d={result} />
          <div className="iv-actions"><button className="btn primary" onClick={reset}>Start another interview</button></div>
        </div>
      )}

      {tab === "progress" && !opened && (
        <div>
          {stats && (
            <div className="iv-stats">
              <div className="card"><b>{stats.questions_asked}</b><span>Learning questions asked</span></div>
              <div className="card"><b>{stats.interviews_finished}</b><span>Interviews finished</span></div>
              <div className="card"><b>{stats.answers_reviewed}</b><span>Answers reviewed</span></div>
              <div className="card"><b>{stats.average_rating ?? "–"}</b><span>Average rating (of 5)</span></div>
            </div>
          )}
          {stats && stats.focus_areas.length > 0 && (
            <div className="card iv-summary"><List title="Focus areas from your last interview" items={stats.focus_areas} /></div>
          )}
          <h3 className="iv-h3">Interview history</h3>
          {rows.length === 0 && <div className="card iv-summary"><p>No interviews yet. Start one from the Practice tab.</p></div>}
          {rows.map((r) => (
            <button key={r.id} className="card iv-row" onClick={() => open(r.id)}>
              <div>
                <strong>{r.role}{r.topic ? ` • ${r.topic}` : ""}</strong>
                <small>{r.difficulty} • {r.answered} answered • {r.status === "finished" ? "finished" : "not finished"} • {r.created_at}</small>
              </div>
              <b>{r.avg_rating != null ? `${r.avg_rating}/5` : "–"}</b>
            </button>
          ))}
        </div>
      )}

      {tab === "progress" && opened && (
        <div>
          <button className="btn secondary iv-early" onClick={() => setOpened(null)}>← Back to history</button>
          <Report d={opened} />
        </div>
      )}
    </div>
  )
}
