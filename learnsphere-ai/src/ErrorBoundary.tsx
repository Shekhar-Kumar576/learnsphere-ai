import { Component, type ErrorInfo, type ReactNode } from "react"

// Shows a readable message instead of a blank screen if any part of the UI crashes.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI crashed:", error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f1226", color: "#f2f3ff", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 560 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 10px" }}>Something went wrong</h1>
          <p style={{ color: "#9aa0c8", lineHeight: 1.6, margin: "0 0 14px" }}>
            The page hit an unexpected error. Your saved data is safe. Reload to continue.
            If it keeps happening, try an Incognito window (browser extensions and auto-translate can interfere).
          </p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#1a1e3f", borderRadius: 10, padding: 12, fontSize: 12, color: "#ffb3c6", margin: "0 0 16px" }}>
            {String(error.message || error).slice(0, 400)}
          </pre>
          <button onClick={() => window.location.reload()} style={{ background: "#7c6cf2", color: "#fff", border: 0, borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>
            Reload app
          </button>
        </div>
      </div>
    )
  }
}
