import { useEffect, useMemo, useRef, useState } from "react"
import { Interview } from "./Interview"
import { api, userId, type Health, type Stats } from "./api"

type Route = "home" | "courses" | "workspace" | "interview" | "resources" | "quiz" | "history" | "settings"
type Message = {
  id: number
  role: "user" | "assistant"
  text: string
  sources?: Source[]
  followups?: string[]
}
type Source = {
  type: "video" | "pdf" | "ppt"
  label: string
  time?: number
  detail: string
}
type HistoryItem = { type: string; title: string; detail: string; time: string }
type UploadItem = {
  id: number
  name: string
  size: string
  type: string
  status: string
  progress: number
  extractedText?: string
}

const photo =
  "https://images.unsplash.com/photo-1758270705290-62b6294dd044?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=1200"
const videoUrl = "/ml-lesson.mp4"
const videoUrlWebm = "/ml-lesson.webm"

const nav: { id: Route; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "courses", label: "My Learning", icon: "book" },
  { id: "workspace", label: "AI Learning Workspace", icon: "spark" },
  { id: "interview", label: "Mock Interview", icon: "quiz" },
  { id: "resources", label: "My Resources", icon: "folder" },
  { id: "quiz", label: "Practice & Quizzes", icon: "quiz" },
  { id: "history", label: "Learning History", icon: "history" },
  { id: "settings", label: "Settings", icon: "settings" },
]

const transcript = [
  {
    time: 0,
    stamp: "00:00",
    title: "Instructor",
    text: "Welcome to machine learning foundations. We begin by asking how computers learn patterns from examples.",
  },
  {
    time: 16,
    stamp: "00:16",
    title: "Instructor",
    text: "Supervised learning uses labelled examples: each input is paired with the answer we want the model to learn.",
  },
  {
    time: 32,
    stamp: "00:32",
    title: "Instructor",
    text: "Think of teaching a student with flashcards. The question is the input and the answer on the back is the label.",
  },
  {
    time: 48,
    stamp: "00:48",
    title: "Instructor",
    text: "Classification predicts a category, while regression predicts a continuous number.",
  },
  {
    time: 64,
    stamp: "01:04",
    title: "Instructor",
    text: "Later we will compare this with unsupervised learning, where examples do not come with labels.",
  },
  {
    time: 80,
    stamp: "01:20",
    title: "Instructor",
    text: "A training set teaches the model; a separate test set helps us evaluate how well it generalizes.",
  },
  {
    time: 96,
    stamp: "01:36",
    title: "Instructor",
    text: "In the next chapter, we will explore model evaluation and overfitting in more detail.",
  },
]

const quizData = [
  {
    q: "Which type of learning uses labelled training data?",
    options: [
      "Unsupervised learning",
      "Supervised learning",
      "Reinforcement learning",
      "Random search",
    ],
    answer: 1,
    explain:
      "Supervised learning learns a mapping from inputs to known labels.",
  },
  {
    q: "Predicting a house price is usually which kind of task?",
    options: ["Classification", "Clustering", "Regression", "Ranking"],
    answer: 2,
    explain:
      "House price is a continuous numeric value, so it is a regression task.",
  },
  {
    q: "Why is a separate test set useful?",
    options: [
      "To label the data",
      "To evaluate generalization",
      "To increase training time",
      "To remove all errors",
    ],
    answer: 1,
    explain:
      "A test set estimates performance on examples the model did not train on.",
  },
]

const starterHistory: HistoryItem[] = [
  {
    type: "Lesson",
    title: "ML Foundations",
    detail: "Sample activity • watched to 00:48",
    time: "Today, 9:42 AM",
  },
  {
    type: "Resource",
    title: "ML Foundations — Course Notes.pdf",
    detail: "Sample resource • page 7",
    time: "Yesterday",
  },
]

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-7h6v7" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3-1.7 4.3L6 9l4.3 1.7L12 15l1.7-4.3L18 9l-4.3-1.7L12 3Z" />
        <path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Zm14-2-.7 1.8-1.8.7 1.8.7L19 17l.7-1.8 1.8-.7-1.8-.7L19 12Z" />
      </>
    ),
    folder: <path d="M3 5h6l2 2h10v12H3V5Z" />,
    quiz: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.7 9a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.2.9-1.2 1.9M12 17h.01" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5m4-1v5l3 2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    upload: (
      <>
        <path d="M12 16V4m-4 4 4-4 4 4" />
        <path d="M4 15v5h16v-5" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4 20-7Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    file: (
      <>
        <path d="M6 2h8l4 4v16H6V2Z" />
        <path d="M14 2v5h5M9 13h6m-6 4h6" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
  }
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.spark}
    </svg>
  )
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        <span />
      </span>
      {!compact && (
        <strong>
          LearnSphere <em>AI</em>
        </strong>
      )}
    </div>
  )
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  type = "button",
  className = "",
}: React.PropsWithChildren<{
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost"
  disabled?: boolean
  type?: "button" | "submit"
  className?: string
}>) {
  return (
    <button
      type={type}
      className={`btn ${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function App() {
  const [route, setRoute] = useState<Route>("home")
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [dark, setDark] = useState(
    () => localStorage.getItem("ls-theme") === "dark",
  )
  const [reducedMotion, setReducedMotion] = useState(
    () => localStorage.getItem("ls-motion") === "reduced",
  )
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("ls-history")
      return saved ? JSON.parse(saved) as HistoryItem[] : starterHistory
    } catch { return starterHistory }
  })
  const [uploads, setUploads] = useState<UploadItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("ls-uploads") || "[]") as UploadItem[] }
    catch { return [] }
  })
  const [preview, setPreview] = useState<string | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const refreshStats = () => {
    api<Stats>("/api/stats").then(setStats).catch(() => setStats(null))
  }
  useEffect(() => {
    api<Health>("/api/health").then(setHealth).catch(() => setHealth(null))
  }, [])
  useEffect(() => {
    refreshStats()
  }, [route])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light"
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full"
    localStorage.setItem("ls-theme", dark ? "dark" : "light")
    localStorage.setItem("ls-motion", reducedMotion ? "reduced" : "full")
  }, [dark, reducedMotion])
  useEffect(() => {
    localStorage.setItem("ls-history", JSON.stringify(history))
  }, [history])
  useEffect(() => {
    try { localStorage.setItem("ls-uploads", JSON.stringify(uploads)) } catch { /* storage quota: keep session state */ }
  }, [uploads])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setSearchOpen(true)
      }
      if (event.key === "Escape") { setSearchOpen(false); setNotifications(false); setMenuOpen(false) }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const go = (next: Route) => {
    setRoute(next)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })
  }
  const addHistory = (item: HistoryItem) =>
    setHistory((h) => [
      item,
      ...h.filter((x) => x.title !== item.title).slice(0, 15),
    ])

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="side-top">
          <Logo />
          <button
            className="mobile-close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          <p className="eyebrow side-label">LEARNING SPACE</p>
          {nav.filter((n) => n.id !== "settings").map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={route === item.id ? "active" : ""}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {(item.id === "workspace" || item.id === "interview") && <b>AI</b>}
            </button>
          ))}
          <p className="eyebrow side-label lower">PREFERENCES</p>
          <button
            onClick={() => go("settings")}
            className={route === "settings" ? "active" : ""}
          >
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </nav>
        <div className="side-bottom">
          <div className="storage">
            <div>
              <span>Interview practice</span>
              <b>{stats?.interviews_finished ?? 0}</b>
            </div>
            <small>
              {stats?.answers_reviewed ?? 0} answers reviewed
              {stats?.average_rating != null ? ` • avg ${stats.average_rating}/5` : ""}
            </small>
          </div>
          <Button onClick={() => go("workspace")} className="side-cta">
            <Icon name="play" size={17} /> Start Learning
          </Button>
          <div className="profile">
            <span className="avatar">ST</span>
            <div>
              <strong>Student</strong>
              <small>Guest profile (no login)</small>
            </div>
            <button aria-label="Profile options">•••</button>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="menu-button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="mobile-logo">
            <Logo />
          </div>
          <button className="search-box" onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
            <span>Search courses, lessons, resources...</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="top-actions">
            <span className="demo-pill">
              <i /> {health?.aiConfigured ? "LIVE AI" : "SAMPLE MODE"}
            </span>
            <button
              className="icon-btn"
              aria-label="Notifications"
              onClick={() => setNotifications(!notifications)}
            >
              <Icon name="bell" />
            </button>
            <button className="mini-avatar" aria-label="Open profile">
              ST
            </button>
          </div>
          {notifications && (
            <div className="popover notification">
              <strong>Notifications</strong>
              <p>No new notifications.</p>
            </div>
          )}
        </header>
        {route === "home" && <Home go={go} stats={stats} />}
        {route === "courses" && <Courses go={go} />}
        {route === "workspace" && <Workspace go={go} addHistory={addHistory} />}
        {route === "interview" && <Interview onChange={refreshStats} />}
        {route === "resources" && (
          <Resources
            uploads={uploads}
            setUploads={setUploads}
            preview={preview}
            setPreview={setPreview}
            addHistory={addHistory}
          />
        )}
        {route === "quiz" && <Quiz addHistory={addHistory} />}
        {route === "history" && <History history={history} go={go} />}
        {route === "settings" && (
          <Settings
            dark={dark}
            setDark={setDark}
            reducedMotion={reducedMotion}
            setReducedMotion={setReducedMotion}
            clear={() => {
              api("/api/me/data", { method: "DELETE" }).then(refreshStats).catch(() => {})
              setHistory(starterHistory)
              setUploads([])
              localStorage.removeItem("ls-uploads")
              localStorage.removeItem("ls-progress-ml")
            }}
          />
        )}
      </main>
      {searchOpen && <SearchModal close={() => setSearchOpen(false)} go={go} uploads={uploads} />}
    </div>
  )
}

function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string
  title: string
  text?: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  )
}

function Home({ go, stats }: { go: (r: Route) => void; stats: Stats | null }) {
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="hero-copy reveal">
          <span className="hero-tag">
            <Icon name="spark" size={15} /> AI learning, grounded in your
            material
          </span>
          <h1>
            Learn Smarter.
            <br />
            <span>Understand Deeper.</span>
          </h1>
          <p>
            Your AI learning companion understands your lectures, PDFs, and
            presentations—helping you get answers from the material you are
            actually studying.
          </p>
          <div className="hero-actions">
            <Button onClick={() => go("workspace")}>
              Start Learning <Icon name="arrow" size={17} />
            </Button>
            <Button variant="secondary" onClick={() => go("workspace")}>
              <Icon name="play" size={17} /> Explore Demo
            </Button>
          </div>
          <div className="trust-row">
            <span>
              <i>
                <Icon name="check" size={13} />
              </i>{" "}
              Timestamp aware
            </span>
            <span>
              <i>
                <Icon name="check" size={13} />
              </i>{" "}
              Source grounded
            </span>
            <span>
              <i>
                <Icon name="check" size={13} />
              </i>{" "}
              Privacy first
            </span>
          </div>
        </div>
        <div
          className="orb-stage"
          aria-label="Animated learning network illustration"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orb">
            <div className="orb-core">
              <Icon name="spark" size={38} />
            </div>
            <span className="orb-ring a" />
            <span className="orb-ring b" />
          </div>
          <div className="float-card fc-video">
            <span>
              <Icon name="play" size={14} />
            </span>
            <div>
              <small>LECTURE</small>
              <strong>ML Foundations</strong>
              <i>
                <b />
              </i>
            </div>
          </div>
          <div className="float-card fc-pdf">
            <span>
              <Icon name="file" size={16} />
            </span>
            <div>
              <small>SOURCE FOUND</small>
              <strong>PDF • Page 7</strong>
            </div>
          </div>
          <div className="float-card fc-ai">
            <span>
              <Icon name="spark" size={16} />
            </span>
            <div>
              <small>AI ASSISTANT</small>
              <strong>Answer grounded</strong>
            </div>
          </div>
          <div className="context-chip">
            <i /> Context synced • 18:42
          </div>
        </div>
      </section>
      <section className="feature-strip">
        {[
          [
            "play",
            "Ask while watching",
            "Pause at any moment and ask in context.",
          ],
          [
            "file",
            "Trusted, cited answers",
            "See the exact video, page, or slide source.",
          ],
          [
            "quiz",
            "Practice what you learn",
            "Create quick quizzes from covered material.",
          ],
        ].map(([icon, title, text], i) => (
          <div key={title}>
            <span className={`feature-icon f${i}`}>
              <Icon name={icon} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>
      <section className="section-block">
        <div className="section-title">
          <div>
            <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
            <h2>Continue learning</h2>
          </div>
          <button onClick={() => go("courses")}>
            View all courses <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="course-grid">
          <CourseCard
            featured
            go={go}
            title="Introduction to Machine Learning"
            meta="Dr. Priya Sharma • 12 lessons"
            progress={68}
          />
          <CourseCard
            go={go}
            title="Python Programming Fundamentals"
            meta="Rahul Mehta • 18 lessons"
            progress={42}
            color="cyan"
          />
          <CourseCard
            go={go}
            title="Generative AI and RAG"
            meta="Ananya Rao • 10 lessons"
            progress={24}
            color="purple"
          />
        </div>
      </section>
      <section className="home-lower">
        <div className="insights card">
          <div className="section-title compact">
            <div>
              <p className="eyebrow">YOUR MOMENTUM</p>
              <h2>Learning insights</h2>
            </div>
            <span>All time</span>
          </div>
          <div className="metrics">
            <div
              className="ring"
              style={{ "--p": `${((stats?.average_rating ?? 0) / 5) * 100}%` } as React.CSSProperties}
            >
              <span>
                <b>{stats?.average_rating ?? "–"}</b>
                <small>avg rating / 5</small>
              </span>
            </div>
            <div className="metric">
              <span className="metric-icon violet">
                <Icon name="book" />
              </span>
              <b>{stats?.questions_asked ?? 0}</b>
              <small>Questions asked</small>
            </div>
            <div className="metric">
              <span className="metric-icon blue">
                <Icon name="check" />
              </span>
              <b>{stats?.interviews_finished ?? 0}</b>
              <small>Interviews finished</small>
            </div>
            <div className="metric">
              <span className="metric-icon green">
                <Icon name="quiz" />
              </span>
              <b>{stats?.answers_reviewed ?? 0}</b>
              <small>Answers reviewed</small>
            </div>
          </div>
        </div>
        <div className="quick card">
          <div className="section-title compact">
            <div>
              <p className="eyebrow">SHORTCUTS</p>
              <h2>Quick actions</h2>
            </div>
          </div>
          <div className="quick-grid">
            {[
              ["upload", "Upload material", "resources"],
              ["play", "Continue lesson", "workspace"],
              ["spark", "Ask AI a question", "workspace"],
              ["quiz", "Generate a quiz", "quiz"],
            ].map(([icon, label, target]) => (
              <button key={label} onClick={() => go(target as Route)}>
                <span>
                  <Icon name={icon} />
                </span>
                {label}
                <Icon name="arrow" size={15} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function CourseCard({
  title,
  meta,
  progress,
  featured,
  go,
  color = "",
}: {
  title: string
  meta: string
  progress: number
  featured?: boolean
  go: (r: Route) => void
  color?: string
}) {
  return (
    <article className="course-card">
      <div
        className={`course-art ${color}`}
        style={
          featured
            ? {
                backgroundImage: `linear-gradient(110deg,rgba(18,22,55,.28),rgba(67,56,202,.05)),url("${photo}")`,
              }
            : undefined
        }
      >
        <span>{featured ? "CURRENT COURSE" : "IN PROGRESS"}</span>
        <button aria-label={`Open ${title}`} onClick={() => go("workspace")}>
          <Icon name="play" />
        </button>
      </div>
      <div className="course-info">
        <small>
          {featured
            ? "ARTIFICIAL INTELLIGENCE"
            : color === "cyan"
              ? "DEVELOPMENT"
              : "GENERATIVE AI"}
        </small>
        <h3>{title}</h3>
        <p>{meta}</p>
        <div className="progress-label">
          <span>Progress</span>
          <b>{progress}%</b>
        </div>
        <div className="progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <Button variant="secondary" onClick={() => go("workspace")}>
          Resume Learning <Icon name="arrow" size={16} />
        </Button>
      </div>
    </article>
  )
}

function Courses({ go }: { go: (r: Route) => void }) {
  return (
    <div className="page">
      <PageHeading
        eyebrow="MY LEARNING"
        title="Courses built around your goals"
        text="Continue active courses or revisit completed lessons."
        action={<Button onClick={() => go("workspace")}>Open workspace</Button>}
      />
      <div className="filter-row">
        <button className="active">
          In progress <b>3</b>
        </button>
        <button>
          Completed <b>8</b>
        </button>
        <button>
          Saved <b>5</b>
        </button>
      </div>
      <div className="course-grid wide">
        <CourseCard
          featured
          go={go}
          title="Introduction to Machine Learning"
          meta="Dr. Priya Sharma • Last studied today"
          progress={68}
        />
        <CourseCard
          go={go}
          title="Python Programming Fundamentals"
          meta="Rahul Mehta • Last studied 2 days ago"
          progress={42}
          color="cyan"
        />
        <CourseCard
          go={go}
          title="Generative AI and RAG"
          meta="Ananya Rao • Last studied last week"
          progress={24}
          color="purple"
        />
      </div>
    </div>
  )
}

function Workspace({
  go,
  addHistory,
}: {
  go: (r: Route) => void
  addHistory: (h: HistoryItem) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [time, setTime] = useState(() =>
    Number(localStorage.getItem("ls-progress-ml") || 0),
  )
  const [activeTab, setActiveTab] = useState<"transcript" | "resources">(
    "transcript",
  )
  const [mobileTab, setMobileTab] =
    useState<"lesson" | "outline" | "assistant">("lesson")
  const [paused, setPaused] = useState(true)
  const [askTick, setAskTick] = useState(0)
  const [narrate, setNarrate] = useState(true)
  const [videoError, setVideoError] = useState(false)
  const spoken = useRef(-1)
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window
  const seek = (t: number) => {
    if (video.current) {
      video.current.currentTime = t
      setTime(t)
    }
  }
  useEffect(() => {
    if (video.current && time > 0) video.current.currentTime = time
  }, [])
  const update = () => {
    const t = video.current?.currentTime || 0
    setTime(t)
    localStorage.setItem("ls-progress-ml", String(t))
  }
  const active = Math.max(
    0,
    transcript.map((x) => x.time).reduce((last, t, i) => t <= time ? i : last, 0),
  )
  // Browser text-to-speech reads the current transcript line while the video plays.
  useEffect(() => {
    if (!canSpeak) return
    if (!narrate || paused) {
      window.speechSynthesis.cancel()
      spoken.current = -1
      return
    }
    if (spoken.current === active) return
    spoken.current = active
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(transcript[active].text)
    u.lang = "en-US"
    u.rate = 0.95
    window.speechSynthesis.speak(u)
  }, [active, narrate, paused, canSpeak])
  useEffect(() => () => { if (canSpeak) window.speechSynthesis.cancel() }, [canSpeak])
  const transcriptContext = transcript
    .filter((l) => l.time <= time)
    .map((l) => `[${l.stamp}] ${l.text}`)
    .join("\n")
  const askAboutMoment = () => {
    video.current?.pause()
    setAskTick((n) => n + 1)
    setMobileTab("assistant")
  }
  return (
    <div className="workspace">
      <div className="workspace-top">
        <div>
          <button onClick={() => go("courses")}>My Learning</button>
          <span>/</span>
          <strong>Introduction to Machine Learning</strong>
        </div>
        <div>
          <span className="live-sync">
            <i /> AI context synced to <b>{formatTime(time)}</b>
          </span>
          <button>
            <Icon name="settings" size={17} />
          </button>
        </div>
      </div>
      <div className="mobile-work-tabs">
        {(["outline", "lesson", "assistant"] as const).map((t) => (
          <button
            key={t}
            className={mobileTab === t ? "active" : ""}
            onClick={() => setMobileTab(t)}
          >
            {t === "lesson"
              ? "Lesson"
              : t === "outline"
                ? "Outline"
                : "AI Assistant"}
          </button>
        ))}
      </div>
      <div className="workspace-grid">
        <aside
          className={`outline-panel ${
            mobileTab === "outline" ? "mobile-active" : ""
          }`}
        >
          <div className="course-mini">
            <span>COURSE</span>
            <h2>Introduction to Machine Learning</h2>
            <p>Module 1 of 4 • 68% complete</p>
            <div className="progress">
              <i style={{ width: "68%" }} />
            </div>
          </div>
          <div className="outline-scroll">
            <div className="module">
              <button>
                <span>01</span>
                <div>
                  <small>MODULE 1</small>
                  <strong>ML Foundations</strong>
                </div>
                <b>⌃</b>
              </button>
              <div className="lessons">
                <button className="done">
                  <i>
                    <Icon name="check" size={13} />
                  </i>
                  <div>
                    <span>What is Machine Learning?</span>
                    <small>08:42</small>
                  </div>
                </button>
                <button className="current">
                  <i>
                    <Icon name="play" size={12} />
                  </i>
                  <div>
                    <span>Supervised Learning</span>
                    <small>01:52 • Playing</small>
                  </div>
                </button>
                <button onClick={() => seek(16)}>
                  <i>3</i>
                  <div>
                    <span>Unsupervised Learning</span>
                    <small>07:14</small>
                  </div>
                </button>
                <button onClick={() => seek(20)}>
                  <i>4</i>
                  <div>
                    <span>Training & Test Data</span>
                    <small>09:31</small>
                  </div>
                </button>
              </div>
            </div>
            {[
              "Model Evaluation",
              "Essential Algorithms",
              "Build Your First Model",
            ].map((m, i) => (
              <div className="module collapsed" key={m}>
                <button>
                  <span>0{i + 2}</span>
                  <div>
                    <small>MODULE {i + 2}</small>
                    <strong>{m}</strong>
                  </div>
                  <b>⌄</b>
                </button>
              </div>
            ))}
          </div>
          <div className="outline-foot">
            <span>
              <Icon name="check" size={14} /> 4 lessons completed
            </span>
            <small>Course certificate at 100%</small>
          </div>
        </aside>
        <section
          className={`lesson-panel ${
            mobileTab === "lesson" ? "mobile-active" : ""
          }`}
        >
          <div className="lesson-head">
            <div>
              <span>MODULE 1 • LESSON 2</span>
              <h1>Supervised Learning: Learning with Labels</h1>
            </div>
            <button aria-label="Lesson options">•••</button>
          </div>
          <div className="video-shell">
            <video
              ref={video}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={update}
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
              onEnded={() => setPaused(true)}
              onError={() => setVideoError(true)}
              onLoadedMetadata={() => {
                if (video.current && time > 0) video.current.currentTime = time
              }}
            >
              <source src={videoUrl} type="video/mp4" />
              <source src={videoUrlWebm} type="video/webm" />
              Your browser does not support HTML5 video.
            </video>
            {videoError && (
              <p className="video-error">
                The video could not be loaded. Check your connection and refresh the page.
              </p>
            )}
            <div className="video-badge">
              <Icon name="spark" size={13} /> Animated lesson • captions • transcript
              below
            </div>
          </div>
          <div className="ask-bar">
            {paused && time > 0 ? (
              <>
                <span>⏸ Paused at <b>{formatTime(time)}</b></span>
                <button onClick={askAboutMoment}>Ask AI about this moment</button>
              </>
            ) : (
              <span>Pause the video at any point, then ask the AI about that moment.</span>
            )}
            {canSpeak && (
              <button className="ghost" onClick={() => setNarrate((n) => !n)}>
                {narrate ? "🔊 Narration on" : "🔇 Narration off"}
              </button>
            )}
          </div>
          <div className="lesson-meta">
            <div>
              <span className="instructor">PS</span>
              <div>
                <strong>Dr. Priya Sharma</strong>
                <small>Professor of Computer Science</small>
              </div>
            </div>
            <div>
              <button>♡ Save</button>
              <button>↗ Share</button>
            </div>
          </div>
          <div className="content-tabs">
            <button
              className={activeTab === "transcript" ? "active" : ""}
              onClick={() => setActiveTab("transcript")}
            >
              Transcript
            </button>
            <button
              className={activeTab === "resources" ? "active" : ""}
              onClick={() => setActiveTab("resources")}
            >
              Resources <b>3</b>
            </button>
            <button>Notes</button>
          </div>
          {activeTab === "transcript" ? (
            <div className="transcript">
              <div className="transcript-head">
                <span>
                  <i /> Sample transcript • synced with video
                </span>
                <button>
                  <Icon name="search" size={15} /> Search
                </button>
              </div>
              {transcript.map((line, i) => (
                <button
                  key={line.time}
                  className={i === active ? "active" : ""}
                  onClick={() => seek(line.time)}
                >
                  <time>{line.stamp}</time>
                  <div>
                    <strong>{line.title}</strong>
                    <p>{line.text}</p>
                  </div>
                  {i === active && (
                    <span>
                      <Icon name="play" size={11} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="inline-resources">
              {[
                "ML Foundations — Course Notes.pdf",
                "Supervised Learning — Slides.pptx",
                "Key Terms — Study Notes.txt",
              ].map((x, i) => (
                <button onClick={() => go("resources")} key={x}>
                  <Icon name="file" />
                  <div>
                    <strong>{x}</strong>
                    <small>
                      {i === 0 ? "12 pages" : i === 1 ? "18 slides" : "4 KB"}
                    </small>
                  </div>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          )}
        </section>
        <ChatPanel
          time={time}
          seek={seek}
          go={go}
          addHistory={addHistory}
          transcriptContext={transcriptContext}
          askTick={askTick}
          className={mobileTab === "assistant" ? "mobile-active" : ""}
        />
      </div>
    </div>
  )
}

function uploadsTextFromStorage() {
  try {
    const items = JSON.parse(localStorage.getItem("ls-uploads") || "[]") as UploadItem[]
    return items.filter((x) => x.extractedText).map((x) => `\n--- ${x.name} ---\n${x.extractedText}`).join("\n").slice(0, 20000)
  } catch { return "" }
}

function ChatPanel({
  time,
  seek,
  go,
  addHistory,
  transcriptContext,
  askTick,
  className,
}: {
  time: number
  seek: (t: number) => void
  go: (r: Route) => void
  addHistory: (h: HistoryItem) => void
  transcriptContext: string
  askTick: number
  className?: string
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      text: "Hi! I’m synced with this lesson. Ask me about anything covered so far, and I’ll ground the answer in the available sample materials.",
    },
  ])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState<0 | 1 | 2>(0)
  const [liveAI, setLiveAI] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (askTick === 0) return
    setInput("Explain what was just said at this moment in simple words.")
    inputRef.current?.focus()
  }, [askTick])
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((data: { aiConfigured?: boolean }) => setLiveAI(Boolean(data.aiConfigured))).catch(() => setLiveAI(false))
  }, [])
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, thinking])

  const send = (question = input) => {
    if (!question.trim() || thinking) return
    const q = question.trim()
    setMessages((m) => [...m, { id: Date.now(), role: "user", text: q }])
    setInput("")
    setThinking(1)
    addHistory({
      type: "AI Question",
      title: q,
      detail: `Lesson conversation • paused at ${formatTime(time)}`,
      time: "Just now",
    })
    window.setTimeout(() => setThinking(2), 250)
    const resourceContext = `LECTURE TRANSCRIPT (Supervised Learning), up to ${formatTime(time)}:\n${transcriptContext}\n\n${uploadsTextFromStorage()}`.slice(0, 20000)
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId() },
      body: JSON.stringify({ question: q, lessonTime: time, context: resourceContext }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("AI backend is not configured")
        return response.json() as Promise<{ answer: string; mode?: string }>
      })
      .then((data) => setMessages((m) => [...m, {
        id: Date.now() + 1,
        role: "assistant",
        text: typeof data.answer === "string" && data.answer.trim()
          ? data.answer
          : "The AI returned an empty answer. Please try asking again.",
      }]))
      .catch(() => setMessages((m) => [...m, {
        ...answerFor(q, time),
        text: `${answerFor(q, time).text}\n\n[Sample mode] Live AI was unavailable for this request. Start the backend and check its API key to enable live answers.`,
      }]))
      .finally(() => setThinking(0))
  }
  return (
    <aside className={`chat-panel ${className || ""}`}>
      <div className="chat-head">
        <div className="assistant-icon">
          <Icon name="spark" />
        </div>
        <div>
          <strong>Learning Assistant</strong>
          <span>
            <i /> {liveAI ? "Live AI connected" : "Sample answer mode"}
          </span>
        </div>
        <button title="New conversation" onClick={() => setMessages([{ id: Date.now(), role: "assistant", text: "New conversation started. Ask a question about the lesson or your uploaded text notes." }])}>
          ＋
        </button>
        <button title="Conversation history" onClick={() => go("history")}>
          <Icon name="history" size={18} />
        </button>
      </div>
      <div className="context-bar">
        <span>CONTEXT</span>
        <div>
          <Icon name="play" size={13} />
          <strong>Supervised Learning</strong>
        </div>
        <b>
          Up to {formatTime(time)} <Icon name="check" size={12} />
        </b>
      </div>
      <div className="chat-scroll">
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="assistant-icon large">
              <Icon name="spark" size={26} />
            </div>
            <h3>What would you like to understand?</h3>
            <p>
              I’ll only use the lesson up to {formatTime(time)} and permitted
              resources.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} seek={seek} go={go} send={send} />
        ))}
        {thinking > 0 && (
          <div className="thinking">
            <div className="assistant-icon small">
              <Icon name="spark" size={14} />
            </div>
            <div>
              <span>
                <i />
                <i />
                <i />
              </span>
              <p>
                {thinking === 1
                  ? "Searching sample lecture and course resources…"
                  : "Checking relevant timestamps and sources…"}
              </p>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="suggestions">
        {[
          "Explain this simply",
          "Give a real-world example",
          "Summarize so far",
          "Generate a quiz",
        ].map((x) => (
          <button
            key={x}
            onClick={() => (x.includes("quiz") ? go("quiz") : send(x))}
          >
            {x}
          </button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
          ref={inputRef}
          aria-label="Ask the learning assistant"
          placeholder="Ask about this lesson..."
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <div>
          <span>
            <Icon name="spark" size={13} /> Uses permitted sample sources
          </span>
          <button
            aria-label="Send question"
            type="submit"
            disabled={!input.trim() || !!thinking}
          >
            <Icon name="send" size={17} />
          </button>
        </div>
      </form>
    </aside>
  )
}

function answerFor(question: string, time: number): Message {
  const q = question.toLowerCase()
  const base = { id: Date.now() + 1, role: "assistant" as const }
  if (
    (q.includes("unsupervised") ||
      q.includes("overfitting") ||
      q.includes("future")) &&
    time < 64
  )
    return {
      ...base,
      text: "That concept hasn’t been covered at your current position yet. To avoid revealing future lecture content, I can answer after you reach 01:04, or you can open a permitted course resource.",
      followups: ["What has been covered so far?", "Open course notes"],
    }
  if (q.includes("not in") || q.includes("quantum") || q.includes("blockchain"))
    return {
      ...base,
      text: "I couldn’t find enough supporting information in the available sample learning materials to answer this confidently.",
      followups: [
        "Search permitted resources again",
        "Upload additional notes",
        "Ask a more specific question",
      ],
    }
  if (
    q.includes("regression") ||
    q.includes("classification") ||
    q.includes("compare")
  ) {
    const sources: Source[] = [
      {
        type: "ppt",
        label: "PPT • Slide 4",
        detail: "Task types comparison table in the prepared sample deck.",
      },
    ]
    if (time >= 48)
      sources.unshift({
        type: "video",
        label: "Video 00:48–01:04",
        time: 48,
        detail: "Instructor compares category and continuous predictions.",
      })
    return {
      ...base,
      text: "**Classification** predicts a category, such as whether an email is spam. **Regression** predicts a continuous number, such as a house price. Both can use labelled examples; the difference is the kind of output they learn to predict.",
      sources,
      followups: ["Give me another example", "Quiz me on this"],
    }
  }
  if (q.includes("test") || q.includes("train")) {
    const sources: Source[] = [
      {
        type: "pdf",
        label: "PDF • Page 7",
        detail: "Evaluation section in the prepared sample notes.",
      },
    ]
    if (time >= 80)
      sources.unshift({
        type: "video",
        label: "Video 01:20–01:36",
        time: 80,
        detail: "Training and test split explanation.",
      })
    return {
      ...base,
      text: "The **training set** is the material a model learns patterns from. The **test set** is held back and used like an unseen exam: it helps us check whether the model can generalize beyond examples it memorized.",
      sources,
      followups: ["What is generalization?", "Why not test on training data?"],
    }
  }
  if (q.includes("summar")) {
    if (time < 16)
      return {
        ...base,
        text: "You’re at the very start of the lesson, so there isn’t enough watched lecture content to summarize yet. Play a little more, or I can summarize a permitted course resource instead.",
        followups: ["Summarize the course notes", "What is this lesson about?"],
      }
    return {
      ...base,
      text:
        time < 48
          ? "So far, you’ve learned that machine learning finds patterns from examples. In supervised learning, every training input is paired with a known label, like a flashcard with an answer on the back."
          : "So far, you’ve learned that machine learning finds patterns from examples. In supervised learning, every training input has a known label. Classification predicts categories, while regression predicts numbers.",
      sources: [
        {
          type: "video",
          label: `Video 00:00–${formatTime(time)}`,
          time: 0,
          detail: "Summary is limited to your current playback context.",
        },
        {
          type: "pdf",
          label: "PDF • Page 3",
          detail: "Key concepts overview in prepared sample notes.",
        },
      ],
      followups: ["Turn this into flashcards", "Give me a 2-question quiz"],
    }
  }
  const sources: Source[] = [
    {
      type: "pdf",
      label: "PDF • Page 3",
      detail: "Supervised learning definition in prepared course notes.",
    },
    {
      type: "ppt",
      label: "PPT • Slide 4",
      detail: "Labelled examples diagram in prepared sample slides.",
    },
  ]
  if (time >= 16)
    sources.unshift({
      type: "video",
      label: "Video 00:16–00:48",
      time: 16,
      detail: "Definition and flashcard analogy from the sample transcript.",
    })
  return {
    ...base,
    text: "**Supervised learning** is a way of teaching a computer with examples that already include the correct answer.\n\nThink of **flashcards**: the front shows a picture of an animal (the input), and the back says “cat” or “dog” (the label). After seeing enough labelled cards, the model learns patterns that help it label a new picture.\n\n**Key idea:** inputs + known answers → learned prediction rule.",
    sources,
    followups: [
      "How is this different from unsupervised learning?",
      "Give me a college-life example",
    ],
  }
}

function ChatMessage({
  message,
  seek,
  go,
  send,
}: {
  message: Message
  seek: (t: number) => void
  go: (r: Route) => void
  send: (x: string) => void
}) {
  return (
    <div className={`message ${message.role}`}>
      {message.role === "assistant" && (
        <div className="assistant-icon small">
          <Icon name="spark" size={14} />
        </div>
      )}
      <div className="bubble">
        {String(message.text ?? "").split("\n").map((p, i) => (
          <p key={i}>{renderBold(p)}</p>
        ))}
        {message.sources && (
          <div className="sources">
            <strong>
              <Icon name="check" size={13} /> Sources used{" "}
              <span>Sample data</span>
            </strong>
            {message.sources.map((s) => (
              <button
                key={s.label}
                title={s.detail}
                onClick={() =>
                  s.type === "video" && s.time !== undefined
                    ? seek(s.time)
                    : go("resources")
                }
              >
                <span className={s.type}>
                  <Icon name={s.type === "video" ? "play" : "file"} size={13} />
                </span>
                {s.label}
                <Icon name="arrow" size={13} />
              </button>
            ))}
          </div>
        )}
        {message.followups && (
          <div className="followups">
            {message.followups.map((x) => (
              <button key={x} onClick={() => send(x)}>
                {x}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function renderBold(text: string) {
  return text
    .split("**")
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}

function Resources({
  uploads,
  setUploads,
  preview,
  setPreview,
  addHistory,
}: {
  uploads: UploadItem[]
  setUploads: React.Dispatch<React.SetStateAction<UploadItem[]>>
  preview: string | null
  setPreview: (x: string | null) => void
  addHistory: (h: HistoryItem) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [resourceQuery, setResourceQuery] = useState("")
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    Array.from(files).forEach(async (file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || ""
      if (!["pdf", "ppt", "pptx", "txt", "md", "csv", "json"].includes(ext)) {
        window.alert(`Unsupported file type: ${file.name}`)
        return
      }
      if (file.size > 25 * 1024 * 1024) {
        window.alert(`${file.name} is larger than the 25 MB limit.`)
        return
      }
      const id = Date.now() + Math.random()
      const canReadText = ["txt", "md", "csv", "json"].includes(ext)
      let extractedText = ""
      try { if (canReadText) extractedText = (await file.text()).slice(0, 120000) }
      catch { /* Keep the upload record and report extraction status below. */ }
      const status = canReadText
        ? (extractedText ? "Text extracted" : "No readable text found")
        : "Uploaded • parser required"
      setUploads((u) => [{
        id, name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: ext.toUpperCase(), status, progress: 100,
        ...(extractedText ? { extractedText } : {}),
      }, ...u])
      addHistory({
        type: "Upload", title: file.name,
        detail: canReadText
          ? `Local text extracted (${extractedText.length.toLocaleString()} characters)`
          : `File stored in this browser; ${ext.toUpperCase()} text extraction needs a document parser`,
        time: new Date().toLocaleString(),
      })
    })
  }
  const samples = [
    {
      name: "ML Foundations — Course Notes.pdf",
      meta: "PDF • 12 pages • Sample",
      type: "PDF",
    },
    {
      name: "Supervised Learning — Slides.pptx",
      meta: "PPTX • 18 slides • Sample",
      type: "PPT",
    },
    {
      name: "Key Terms — Study Notes.txt",
      meta: "TXT • 4 KB • Sample",
      type: "TXT",
    },
  ]
  return (
    <div className="page">
      <PageHeading
        eyebrow="KNOWLEDGE LIBRARY"
        title="Course resources"
        text="Keep every trusted learning source organized and ready for contextual answers."
        action={
          <Button onClick={() => input.current?.click()}>
            <Icon name="upload" size={17} /> Upload material
          </Button>
        }
      />
      <input
        ref={input}
        hidden
        type="file"
        accept=".pdf,.ppt,.pptx,.txt,text/plain,application/pdf"
        multiple
        onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = "" }}
      />
      <div className="resource-layout">
        <div>
          <div
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              addFiles(e.dataTransfer.files)
            }}
          >
            <span>
              <Icon name="upload" size={28} />
            </span>
            <h3>Drop learning material here</h3>
            <p>PDF, PPT, PPTX, or TXT • Maximum 25 MB per file</p>
            <Button variant="secondary" onClick={() => input.current?.click()}>
              Browse Files
            </Button>
            <small>
              Files stay in this browser session. Processing is transparently
              simulated.
            </small>
          </div>
          <div className="resource-list card">
            <div className="section-title compact">
              <div>
                <p className="eyebrow">ALL MATERIALS</p>
                <h2>Resource library</h2>
              </div>
              <label className="resource-search">
                <Icon name="search" size={16} />
                <input aria-label="Search resources" value={resourceQuery} onChange={(e) => setResourceQuery(e.target.value)} placeholder="Search resources" />
              </label>
            </div>
            {uploads.filter((file) => file.name.toLowerCase().includes(resourceQuery.toLowerCase())).map((file) => (
              <div className="resource-row" key={file.id}>
                <span className="file-icon">
                  <Icon name="file" />
                </span>
                <div className="resource-name">
                  <strong>{file.name}</strong>
                  <small>
                    {file.type} • {file.size}
                  </small>
                  <div className="progress">
                    <i style={{ width: `${file.progress}%` }} />
                  </div>
                </div>
                <span
                  className={file.progress === 100 ? "status ready" : "status"}
                >
                  {file.status}
                </span>
                <button onClick={() => setPreview(file.name)}>Preview</button>
                <button
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setUploads((u) => u.filter((x) => x.id !== file.id))
                  }
                >
                  ×
                </button>
              </div>
            ))}
            {samples.filter((file) => file.name.toLowerCase().includes(resourceQuery.toLowerCase())).map((file) => (
              <div className="resource-row" key={file.name}>
                <span className="file-icon">
                  <Icon name="file" />
                </span>
                <div className="resource-name">
                  <strong>{file.name}</strong>
                  <small>{file.meta}</small>
                </div>
                <span className="status ready">Ready</span>
                <button onClick={() => setPreview(file.name)}>Preview</button>
                <button>•••</button>
              </div>
            ))}
          </div>
        </div>
        <DocumentPreview
          name={preview || samples[0].name}
          close={preview ? () => setPreview(null) : undefined}
        />
      </div>
    </div>
  )
}

function DocumentPreview({ name, close }: { name: string; close?: () => void }) {
  const [page, setPage] = useState(7)
  return (
    <aside className="document-preview card">
      <div className="doc-head">
        <div>
          <span>
            <Icon name="file" />
          </span>
          <div>
            <strong>{name}</strong>
            <small>Sample preview</small>
          </div>
        </div>
        {close && (
          <button onClick={close}>
            <Icon name="close" />
          </button>
        )}
      </div>
      <div className="doc-toolbar">
        <button onClick={() => setPage(Math.max(1, page - 1))}>‹</button>
        <span>
          Page <b>{page}</b> of 12
        </span>
        <button onClick={() => setPage(Math.min(12, page + 1))}>›</button>
        <i />
        <button>−</button>
        <span>100%</span>
        <button>＋</button>
      </div>
      <div className="paper">
        <span>LEARNING NOTE • {String(page).padStart(2, "0")}</span>
        <h2>
          {page === 7
            ? "Evaluating what a model learns"
            : "Supervised Learning Foundations"}
        </h2>
        <p>
          A supervised model learns from input–label pairs. We reserve part of
          the data so we can evaluate performance on examples the model has not
          seen during training.
        </p>
        <div className="paper-callout">
          <strong>Key distinction</strong>
          <p>
            Training data teaches the pattern. Test data checks whether that
            pattern generalizes.
          </p>
        </div>
        <h3>Practical example</h3>
        <p>
          For house-price prediction, past homes and their sale prices become
          labelled examples. A held-back set is then used to measure prediction
          quality.
        </p>
        <div className="highlight">
          Citation-ready excerpt • Sample document data
        </div>
      </div>
      <div className="doc-foot">
        <span>
          <Icon name="search" size={15} /> Search in document
        </span>
        <button>Open externally ↗</button>
      </div>
    </aside>
  )
}

function Quiz({ addHistory }: { addHistory: (h: HistoryItem) => void }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [complete, setComplete] = useState(false)
  const correct = answers.filter((a, i) => a === quizData[i].answer).length
  const reset = () => {
    setIndex(0)
    setSelected(null)
    setAnswers([])
    setComplete(false)
  }
  const next = () => {
    if (selected === null) return
    const nextAnswers = [...answers, selected]
    setAnswers(nextAnswers)
    if (index === quizData.length - 1) {
      setComplete(true)
      const score = nextAnswers.filter(
        (a, i) => a === quizData[i].answer,
      ).length
      addHistory({
        type: "Quiz",
        title: "Supervised Learning Check",
        detail: `Demo quiz • ${score}/${quizData.length} correct`,
        time: "Just now",
      })
    } else {
      setIndex(index + 1)
      setSelected(null)
    }
  }
  return (
    <div className="page quiz-page">
      <PageHeading
        eyebrow="ACTIVE LEARNING"
        title="Practice what you’ve learned"
        text="Questions use only concepts covered in the prepared sample lesson."
      />
      {!complete ? (
        <div className="quiz-card card">
          <div className="quiz-top">
            <div>
              <span className="demo-pill">
                <i /> SAMPLE QUIZ
              </span>
              <h2>Supervised Learning Check</h2>
              <p>Beginner • 3 questions • ~3 min</p>
            </div>
            <div className="quiz-ring">
              {index + 1}
              <small>/ {quizData.length}</small>
            </div>
          </div>
          <div className="quiz-progress">
            <i style={{ width: `${((index + 1) / quizData.length) * 100}%` }} />
          </div>
          <div className="question">
            <span>QUESTION {index + 1}</span>
            <h3>{quizData[index].q}</h3>
            <div className="answers">
              {quizData[index].options.map((opt, i) => (
                <button
                  key={opt}
                  disabled={selected !== null}
                  onClick={() => setSelected(i)}
                  className={
                    selected === i
                      ? i === quizData[index].answer
                        ? "correct"
                        : "wrong"
                      : selected !== null && i === quizData[index].answer
                        ? "correct"
                        : ""
                  }
                >
                  <b>{String.fromCharCode(65 + i)}</b>
                  <span>{opt}</span>
                  {selected !== null && i === quizData[index].answer && (
                    <Icon name="check" />
                  )}
                </button>
              ))}
            </div>
            {selected !== null && (
              <div
                className={`explanation ${
                  selected === quizData[index].answer ? "good" : ""
                }`}
              >
                <strong>
                  {selected === quizData[index].answer
                    ? "Correct!"
                    : "Not quite — here’s why"}
                </strong>
                <p>{quizData[index].explain}</p>
              </div>
            )}
          </div>
          <div className="quiz-actions">
            <span>
              {selected === null
                ? "Choose one answer to continue"
                : "Answer recorded"}
            </span>
            <Button disabled={selected === null} onClick={next}>
              {index === quizData.length - 1 ? "See Results" : "Next Question"}{" "}
              <Icon name="arrow" size={16} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="result-card card">
          <div className="result-orb">
            <Icon name="spark" size={30} />
          </div>
          <p className="eyebrow">QUIZ COMPLETE</p>
          <h2>Strong work!</h2>
          <p>
            You scored{" "}
            <strong>
              {correct} out of {quizData.length}
            </strong>{" "}
            on the Supervised Learning Check.
          </p>
          <div className="score">
            {Math.round((correct / quizData.length) * 100)}
            <span>%</span>
          </div>
          <div className="result-stats">
            <span>
              <b>{correct}</b>Correct
            </span>
            <span>
              <b>{quizData.length - correct}</b>To review
            </span>
          </div>
          <Button onClick={reset}>Retry Quiz</Button>
        </div>
      )}
    </div>
  )
}

function History({
  history,
  go,
}: {
  history: HistoryItem[]
  go: (r: Route) => void
}) {
  const [filter, setFilter] = useState("All activity")
  const filtered =
    filter === "All activity"
      ? history
      : history.filter(
          (h) =>
            h.type ===
            filter
              .replace("AI conversations", "AI Question")
              .replace("Quizzes", "Quiz"),
        )
  return (
    <div className="page">
      <PageHeading
        eyebrow="YOUR JOURNEY"
        title="Learning history"
        text="Demo sample activity and your current-session interactions are labelled clearly."
        action={<Button onClick={() => go("workspace")}>Resume lesson</Button>}
      />
      <div className="history-stats">
        {[
          ["6.4h", "Learning time", "This week"],
          ["12", "Lessons complete", "All time"],
          ["84%", "Quiz average", "3 attempts"],
          [
            String(history.filter((h) => h.type === "AI Question").length),
            "AI questions",
            "This session",
          ],
        ].map(([a, b, c]) => (
          <div className="card" key={b}>
            <b>{a}</b>
            <span>{b}</span>
            <small>{c}</small>
          </div>
        ))}
      </div>
      <div className="history-layout">
        <div className="history-filters card">
          <strong>Filter activity</strong>
          {[
            "All activity",
            "Lesson",
            "AI conversations",
            "Quizzes",
            "Upload",
          ].map((x) => (
            <button
              className={filter === x ? "active" : ""}
              onClick={() => setFilter(x)}
              key={x}
            >
              {x}
              <Icon name="arrow" size={14} />
            </button>
          ))}
        </div>
        <div className="timeline card">
          <div className="section-title compact">
            <div>
              <p className="eyebrow">ACTIVITY TIMELINE</p>
              <h2>Recent activity</h2>
            </div>
            <button>
              <Icon name="search" size={16} /> Search
            </button>
          </div>
          {filtered.length ? (
            filtered.map((item, i) => (
              <div className="timeline-row" key={`${item.title}-${i}`}>
                <span className={`timeline-icon t${i % 3}`}>
                  <Icon
                    name={
                      item.type === "Quiz"
                        ? "quiz"
                        : item.type === "Upload" || item.type === "Resource"
                          ? "file"
                          : item.type === "AI Question"
                            ? "spark"
                            : "play"
                    }
                  />
                </span>
                <div>
                  <small>{item.type.toUpperCase()}</small>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <time>{item.time}</time>
                {item.type === "Lesson" && (
                  <button onClick={() => go("workspace")}>
                    Resume <Icon name="arrow" size={14} />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">
              <Icon name="history" size={30} />
              <h3>No activity in this filter</h3>
              <p>Complete a lesson, question, or quiz to see it here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Settings({
  dark,
  setDark,
  reducedMotion,
  setReducedMotion,
  clear,
}: {
  dark: boolean
  setDark: (x: boolean) => void
  reducedMotion: boolean
  setReducedMotion: (x: boolean) => void
  clear: () => void
}) {
  const [notifications, setNotifications] = useState(true)
  return (
    <div className="page">
      <PageHeading
        eyebrow="PREFERENCES"
        title="Settings"
        text="Tune your learning environment and demo experience."
      />
      <div className="settings-grid">
        <section className="settings-card card">
          <div>
            <span>
              <Icon name="moon" />
            </span>
            <div>
              <h2>Appearance</h2>
              <p>Choose a comfortable interface theme.</p>
            </div>
          </div>
          <label>
            <span>
              <strong>Dark theme</strong>
              <small>Use darker surfaces across the app</small>
            </span>
            <input
              type="checkbox"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
            />
            <i />
          </label>
        </section>
        <section className="settings-card card">
          <div>
            <span>
              <Icon name="spark" />
            </span>
            <div>
              <h2>Accessibility</h2>
              <p>Control movement and visual effects.</p>
            </div>
          </div>
          <label>
            <span>
              <strong>Reduce motion</strong>
              <small>Disable floating and reveal animations</small>
            </span>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
            <i />
          </label>
        </section>
        <section className="settings-card card">
          <div>
            <span>
              <Icon name="bell" />
            </span>
            <div>
              <h2>Notifications</h2>
              <p>Manage helpful study reminders.</p>
            </div>
          </div>
          <label>
            <span>
              <strong>Study reminders</strong>
              <small>Receive learning streak updates</small>
            </span>
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
            />
            <i />
          </label>
        </section>
        <section className="settings-card card">
          <div>
            <span>
              <Icon name="book" />
            </span>
            <div>
              <h2>Learning preferences</h2>
              <p>Set your default explanation style.</p>
            </div>
          </div>
          <select aria-label="Default explanation style">
            <option>Simple and concise</option>
            <option>Detailed and technical</option>
            <option>Example first</option>
          </select>
        </section>
        <section className="about-card card">
          <p className="eyebrow">ABOUT</p>
          <Logo />
          <p>
            LearnSphere AI — AI-Powered Interactive Learning Assistant with AI
            Mock Interview Extension (AHGV BuildVerse 2026). Learning chat and
            Mock Interview run on a FastAPI backend with an AI model. The sample
            course, video, quiz and resource search are prepared demo content.
          </p>
          <span>Prototype v2.0 • React + Vite + FastAPI</span>
        </section>
        <section className="danger-card card">
          <p className="eyebrow">DEMO DATA</p>
          <h2>Start with a clean slate</h2>
          <p>
            Clear local progress, uploads, and current-session history. Prepared
            sample content remains available.
          </p>
          <Button variant="secondary" onClick={clear}>
            Clear demo data
          </Button>
        </section>
      </div>
    </div>
  )
}

function SearchModal({
  close,
  go,
  uploads,
}: {
  close: () => void
  go: (r: Route) => void
  uploads: UploadItem[]
}) {
  const [q, setQ] = useState("")
  const items = [
    {
      title: "Introduction to Machine Learning",
      meta: "Course • 68% complete",
      route: "workspace" as Route,
    },
    {
      title: "Supervised Learning: Learning with Labels",
      meta: "Lesson • Module 1",
      route: "workspace" as Route,
    },
    {
      title: "ML Foundations — Course Notes.pdf",
      meta: "Resource • 12 pages",
      route: "resources" as Route,
    },
    {
      title: "Supervised Learning Check",
      meta: "Quiz • 3 questions",
      route: "quiz" as Route,
    },
    ...uploads.map((upload) => ({
      title: upload.name,
      meta: `Uploaded ${upload.type} • ${upload.status}`,
      route: "resources" as Route,
    })),
  ]
  const results = items.filter((x) =>
    x.title.toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="search-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-search">
          <Icon name="search" />
          <input
            autoFocus
            placeholder="Search courses, lessons, resources..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={close}>ESC</button>
        </div>
        <div className="search-results">
          <span>{q ? `${results.length} RESULTS` : "QUICK ACCESS"}</span>
          {results.map((x) => (
            <button
              key={x.title}
              onClick={() => {
                go(x.route)
                close()
              }}
            >
              <span>
                <Icon
                  name={
                    x.route === "workspace"
                      ? "play"
                      : x.route === "resources"
                        ? "file"
                        : "quiz"
                  }
                />
              </span>
              <div>
                <strong>{x.title}</strong>
                <small>{x.meta}</small>
              </div>
              <Icon name="arrow" />
            </button>
          ))}
          {!results.length && (
            <div className="empty-state">
              <Icon name="search" size={28} />
              <h3>No matching material</h3>
              <p>Try another topic or upload your own notes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(Math.floor(safe % 60)).padStart(2, "0")}`
}

export default App
