import { useState, useCallback, useEffect } from "react";

// Exception based pipeline table. Pulls jobs from the fetch endpoint, sends
// them to the score endpoint, and renders the ranked result. Recommended roles
// surface first; anything carrying an honesty flag is marked so you never apply
// to a role that would push you past what you can truthfully claim. Roles you
// mark applied drop out of the view unless you choose to show them.

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", color: "#1a1a1a" },
  bar: { display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" },
  button: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #d0d0c8",
    background: "#0f6e56",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
  },
  toggle: { display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#5f5e5a", cursor: "pointer" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e3e1d8", color: "#5f5e5a" },
  td: { padding: "8px 10px", borderBottom: "1px solid #efeee8", verticalAlign: "top" },
  tdApplied: { opacity: 0.5 },
  score: { fontWeight: 500, fontVariantNumeric: "tabular-nums" },
  recYes: { background: "#e1f5ee", color: "#0f6e56", padding: "2px 8px", borderRadius: 12, fontSize: 12 },
  recNo: { background: "#f1efe8", color: "#5f5e5a", padding: "2px 8px", borderRadius: 12, fontSize: 12 },
  flag: { background: "#faeeda", color: "#854f0b", padding: "2px 8px", borderRadius: 12, fontSize: 12, marginRight: 6, display: "inline-block", marginTop: 4 },
  link: { color: "#185fa5", textDecoration: "none" },
  source: { color: "#888780", fontSize: 12 },
  applyBtn: {
    padding: "4px 10px",
    borderRadius: 8,
    border: "1px solid #d0d0c8",
    background: "#ffffff",
    color: "#444441",
    cursor: "pointer",
    fontSize: 12,
  },
  appliedBtn: {
    padding: "4px 10px",
    borderRadius: 8,
    border: "1px solid #9fe1cb",
    background: "#e1f5ee",
    color: "#0f6e56",
    cursor: "pointer",
    fontSize: 12,
  },
};

export default function JobPipeline() {
  const [jobs, setJobs] = useState([]);
  const [appliedUrls, setAppliedUrls] = useState(new Set());
  const [showApplied, setShowApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Hydrate applied status on load so it survives a refresh.
  useEffect(() => {
    fetch("/api/applied-urls")
      .then((r) => r.json())
      .then((d) => setAppliedUrls(new Set(d.urls || [])))
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetch("/api/fetch-jobs").then((r) => r.json());
      const scored = await fetch("/api/score-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobs: fetched.jobs }),
      }).then((r) => r.json());
      setJobs(scored.jobs || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleApplied = useCallback(
    async (url) => {
      const willApply = !appliedUrls.has(url);
      setAppliedUrls((prev) => {
        const next = new Set(prev);
        if (willApply) next.add(url);
        else next.delete(url);
        return next;
      });
      try {
        await fetch("/api/mark-applied", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, applied: willApply }),
        });
      } catch (err) {
        // Local state already updated; persistence is best effort.
      }
    },
    [appliedUrls]
  );

  const visible = jobs.filter((j) => showApplied || !appliedUrls.has(j.url));
  const appliedCount = jobs.filter((j) => appliedUrls.has(j.url)).length;

  return (
    <div style={styles.wrap}>
      <div style={styles.bar}>
        <button style={styles.button} onClick={refresh} disabled={loading}>
          {loading ? "Running pipeline" : "Refresh jobs"}
        </button>
        <span style={styles.source}>
          {visible.length} shown, {appliedCount} applied
        </span>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={showApplied}
            onChange={(e) => setShowApplied(e.target.checked)}
          />
          Show applied
        </label>
        {error ? <span style={{ color: "#a32d2d" }}>{error}</span> : null}
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Fit</th>
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Location</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Notes</th>
            <th style={styles.th}>Applied</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((j, idx) => {
            const s = j.score || {};
            const flags = s.honesty_flags || [];
            const isApplied = appliedUrls.has(j.url);
            const cell = isApplied ? { ...styles.td, ...styles.tdApplied } : styles.td;
            return (
              <tr key={j.url || idx}>
                <td style={{ ...cell, ...styles.score }}>
                  {typeof s.fit_score === "number" ? s.fit_score : "n/a"}
                </td>
                <td style={cell}>
                  <a style={styles.link} href={j.url} target="_blank" rel="noreferrer">
                    {j.title}
                  </a>
                  <div style={styles.source}>
                    {j.company} | {(j.sources || []).join(", ")}
                  </div>
                </td>
                <td style={cell}>{j.location}</td>
                <td style={cell}>
                  <span style={s.recommend ? styles.recYes : styles.recNo}>
                    {s.recommend ? "Recommended" : "Review"}
                  </span>
                </td>
                <td style={cell}>
                  <div>{s.reasons}</div>
                  {flags.map((f, i) => (
                    <span key={i} style={styles.flag}>
                      {f}
                    </span>
                  ))}
                </td>
                <td style={cell}>
                  <button
                    style={isApplied ? styles.appliedBtn : styles.applyBtn}
                    onClick={() => toggleApplied(j.url)}
                  >
                    {isApplied ? "Applied" : "Mark applied"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
