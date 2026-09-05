// Destructure hooks from the globally available React object (provided by CDN)
const { useState, useEffect, useMemo, useRef } = React;

/* ---------- constants & helpers ---------- */

const PLACE_LABELS = { first: "1st", second: "2nd", third: "3rd" };
const PLACE_POINTS = { first: 3, second: 2, third: 1 };
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function formatDateHuman(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}`;
}

function getISOWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { isoYear: date.getUTCFullYear(), week };
}

function periodInfo(dateStr, granularity) {
  const [y, m] = dateStr.split("-").map(Number);
  if (granularity === "year") return { key: `${y}`, label: `${y}` };
  if (granularity === "month") {
    return { key: `${y}-${String(m).padStart(2, "0")}`, label: `${MONTH_NAMES[m - 1]} ${y}` };
  }
  const { isoYear, week } = getISOWeek(dateStr);
  if (granularity === "week") {
    return { key: `${isoYear}-W${String(week).padStart(2, "0")}`, label: `Week ${week}, ${isoYear}` };
  }
  const biweek = Math.ceil(week / 2);
  const startWeek = biweek * 2 - 1;
  return { key: `${isoYear}-B${String(biweek).padStart(2, "0")}`, label: `Weeks ${startWeek}\u2013${startWeek + 1}, ${isoYear}` };
}

const PALETTE = ["#C1533D", "#2F6F5E", "#2E6E9E", "#B8860B", "#7B4FA3", "#C4638A", "#4A8B7C", "#A3703D"];

function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function Avatar({ name, color, size = 28 }) {
  return (
    <div
      className="gnt-avatar"
      style={{ width: size, height: size, background: color || "#8A8F84", fontSize: size * 0.4 }}
    >
      {getInitials(name || "?")}
    </div>
  );
}

function PlayerChip({ player, score }) {
  if (!player) return <span>\u2014</span>;
  return (
    <span className="gnt-chip">
      <Avatar name={player.name} color={player.color} size={20} />
      {player.name}
      {score !== undefined && score !== null && (
        <span className="gnt-dim gnt-num" style={{ fontSize: 11.5 }}>({score})</span>
      )}
    </span>
  );
}

function ColorSwatchPicker({ value, onChange }) {
  return (
    <div className="gnt-swatches">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          className={`gnt-swatch${value === c ? " selected" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Choose color ${c}`}
        />
      ))}
    </div>
  );
}

const STORAGE_PREFIX = "gnt:";

function loadKey(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("storage load failed", key, e);
    return fallback;
  }
}

function saveKey(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error("storage save failed", key, e);
  }
}

/* ---------- storage helpers ---------- */

function useAppData() {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    (async () => {
      const [g, p, l] = await Promise.all([
        loadKey("games", []),
        loadKey("players", []),
        loadKey("logs", []),
      ]);
      let changed = false;
      const migratedPlayers = p.map((pl, i) => {
        if (pl.color) return pl;
        changed = true;
        return { ...pl, color: PALETTE[i % PALETTE.length] };
      });
      if (changed) saveKey("players", migratedPlayers);
      setGames(g);
      setPlayers(migratedPlayers);
      setLogs(l);
      setLoading(false);
    })();
  }, []);

  return { loading, games, setGames, players, setPlayers, logs, setLogs };
}

/* ---------- app ---------- */

function GameNightTracker() {
  const { loading, games, setGames, players, setPlayers, logs, setLogs } = useAppData();
  const [tab, setTab] = useState("log");
  const fileInputRef = useRef(null);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("gnt:theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    try { localStorage.setItem("gnt:theme", theme); } catch {}
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function exportData() {
    const payload = { exportedAt: new Date().toISOString(), games, players, logs };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-night-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImportChange(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.games) || !Array.isArray(data.players) || !Array.isArray(data.logs)) {
        alert("This file doesn't look like a Game Night backup.");
        return;
      }
      const ok = window.confirm("Importing will replace all current games, players, and entries on this device. Continue?");
      if (!ok) return;
      setGames(data.games);
      setPlayers(data.players);
      setLogs(data.logs);
      saveKey("games", data.games);
      saveKey("players", data.players);
      saveKey("logs", data.logs);
    } catch (err) {
      alert("Couldn't read that file. Make sure it's a Game Night backup JSON file.");
    }
  }

  const gameById = useMemo(() => Object.fromEntries(games.map((g) => [g.id, g])), [games]);
  const playerById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  const playCount = (gameId) => logs.filter((l) => l.gameId === gameId).length;
  const playerAppearances = (playerId) =>
    logs.filter((l) => l.first === playerId || l.second === playerId || l.third === playerId).length;

  async function addGame(name) {
    const trimmed = name.trim();
    if (!trimmed) return "Enter a game name.";
    if (games.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) return "That game is already in the library.";
    const next = [...games, { id: uid(), name: trimmed, rules: "" }];
    setGames(next);
    await saveKey("games", next);
    return "";
  }

  async function deleteGame(id) {
    if (playCount(id) > 0) return "Can't remove \u2014 this game has logged entries.";
    const next = games.filter((g) => g.id !== id);
    setGames(next);
    await saveKey("games", next);
    return "";
  }

  async function updateGame(id, updates) {
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) return "Enter a game name.";
      if (games.some((g) => g.id !== id && g.name.toLowerCase() === trimmed.toLowerCase())) return "That game already exists.";
    }
    const next = games.map((g) => {
      if (g.id !== id) return g;
      const merged = { ...g };
      if (updates.name !== undefined) merged.name = updates.name.trim();
      if (updates.rules !== undefined) merged.rules = updates.rules;
      return merged;
    });
    setGames(next);
    await saveKey("games", next);
    return "";
  }

  async function addPlayer(name, color) {
    const trimmed = name.trim();
    if (!trimmed) return "Enter a player name.";
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return "That player already exists.";
    const next = [...players, { id: uid(), name: trimmed, color: color || PALETTE[players.length % PALETTE.length] }];
    setPlayers(next);
    await saveKey("players", next);
    return "";
  }

  async function updatePlayer(id, updates) {
    const trimmed = (updates.name || "").trim();
    if (!trimmed) return "Enter a player name.";
    if (players.some((p) => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase())) return "That player already exists.";
    const next = players.map((p) => (p.id === id ? { ...p, name: trimmed, color: updates.color || p.color } : p));
    setPlayers(next);
    await saveKey("players", next);
    return "";
  }

  async function deletePlayer(id) {
    if (playerAppearances(id) > 0) return "Can't remove \u2014 this player has logged entries.";
    const next = players.filter((p) => p.id !== id);
    setPlayers(next);
    await saveKey("players", next);
    return "";
  }

  async function saveLog(entry) {
    let next;
    if (entry.id && logs.some((l) => l.id === entry.id)) {
      next = logs.map((l) => (l.id === entry.id ? entry : l));
    } else {
      next = [{ ...entry, id: uid() }, ...logs];
    }
    next.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    setLogs(next);
    await saveKey("logs", next);
  }

  async function deleteLog(id) {
    const next = logs.filter((l) => l.id !== id);
    setLogs(next);
    await saveKey("logs", next);
  }

  if (loading) {
    return (
      <div className="gnt-app" data-theme={theme} style={{ padding: 40, textAlign: "center" }}>
        <div className="gnt-dim">Loading your scoreboard\u2026</div>
      </div>
    );
  }

  const tabs = [
    { id: "log", label: "Log a Game" },
    { id: "results", label: "Results" },
    { id: "totals", label: "Totals" },
    { id: "library", label: "Game Library" },
    { id: "players", label: "Players" },
  ];

  return (
    <div className="gnt-app" data-theme={theme}>
      <div className="gnt-header">
        <div className="gnt-header-row">
          <div>
            <div className="gnt-title gnt-display">Game Night</div>
            <div className="gnt-subtitle">The family scoreboard</div>
          </div>
          <div className="gnt-databar">
            <button className="gnt-btn gnt-btn-sm gnt-btn-ghost" onClick={toggleTheme} title="Switch between light and dark mode">
              {theme === "dark" ? "\u2600\uFE0F Light" : "\uD83C\uDF19 Dark"}
            </button>
            <button className="gnt-btn gnt-btn-sm gnt-btn-ghost" onClick={exportData} title="Download a backup file of all your data">
              Export backup
            </button>
            <button className="gnt-btn gnt-btn-sm gnt-btn-ghost" onClick={() => fileInputRef.current.click()} title="Restore data from a backup file">
              Import backup
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleImportChange} />
          </div>
        </div>
      </div>
      <div className="gnt-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`gnt-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="gnt-body">
        {tab === "log" && (
          <LogTab
            games={games}
            players={players}
            logs={logs}
            gameById={gameById}
            playerById={playerById}
            saveLog={saveLog}
            deleteLog={deleteLog}
          />
        )}
        {tab === "results" && <ResultsTab logs={logs} players={players} playerById={playerById} />}
        {tab === "totals" && <TotalsTab logs={logs} players={players} games={games} playerById={playerById} gameById={gameById} />}
        {tab === "library" && <LibraryTab games={games} playCount={playCount} addGame={addGame} updateGame={updateGame} deleteGame={deleteGame} />}
        {tab === "players" && (
          <PlayersTab players={players} appearances={playerAppearances} addPlayer={addPlayer} updatePlayer={updatePlayer} deletePlayer={deletePlayer} />
        )}
      </div>
    </div>
  );
}

/* ---------- Log tab ---------- */

function LogTab({ games, players, logs, gameById, playerById, saveLog, deleteLog }) {
  const blank = { id: null, date: todayISO(), gameId: "", first: "", second: "", third: "", firstScore: "", secondScore: "", thirdScore: "", notes: "" };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  const canLog = games.length > 0 && players.length >= 3;

  const optsFor = (slot) => {
    const taken = ["first", "second", "third"].filter((s) => s !== slot).map((s) => form[s]);
    return players.filter((p) => !taken.includes(p.id));
  };

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  function toNumberOrNull(v) {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date) return setError("Choose a date.");
    if (!form.gameId) return setError("Choose a game.");
    if (!form.first || !form.second || !form.third) return setError("Choose all three places.");
    if (new Set([form.first, form.second, form.third]).size < 3) return setError("Each place needs a different player.");
    for (const key of ["firstScore", "secondScore", "thirdScore"]) {
      if (form[key] !== "" && Number.isNaN(Number(form[key]))) return setError("Scores must be numbers.");
    }
    await saveLog({
      ...form,
      firstScore: toNumberOrNull(form.firstScore),
      secondScore: toNumberOrNull(form.secondScore),
      thirdScore: toNumberOrNull(form.thirdScore),
    });
    setForm(blank);
  }

  function startEdit(entry) {
    setForm({
      ...entry,
      firstScore: entry.firstScore ?? "",
      secondScore: entry.secondScore ?? "",
      thirdScore: entry.thirdScore ?? "",
    });
    setError("");
  }

  return (
    <div>
      <div className="gnt-card">
        <div className="gnt-card-title">{form.id ? "Edit Entry" : "Log a Game"}</div>
        {!canLog ? (
          <div className="gnt-empty">
            Add at least one game (Game Library tab) and three players (Players tab) before logging a result.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="gnt-grid-2" style={{ marginBottom: 12 }}>
              <div>
                <label className="gnt-label">Date</label>
                <input type="date" className="gnt-input" value={form.date} onChange={(e) => update("date", e.target.value)} />
              </div>
              <div>
                <label className="gnt-label">Game</label>
                <select className="gnt-select" value={form.gameId} onChange={(e) => update("gameId", e.target.value)}>
                  <option value="">Select a game\u2026</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="gnt-grid-3" style={{ marginBottom: 12 }}>
              {["first", "second", "third"].map((slot) => (
                <div key={slot}>
                  <label className="gnt-label">{PLACE_LABELS[slot]} place</label>
                  <select className="gnt-select" value={form[slot]} onChange={(e) => update(slot, e.target.value)}>
                    <option value="">Select\u2026</option>
                    {optsFor(slot).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="gnt-input"
                    style={{ marginTop: 8 }}
                    placeholder="Score (optional)"
                    value={form[`${slot}Score`]}
                    onChange={(e) => update(`${slot}Score`, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="gnt-label">Notes (optional)</label>
              <textarea className="gnt-textarea" value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Anything worth remembering about this game\u2026" />
            </div>
            {error && <div className="gnt-error">{error}</div>}
            <div className="gnt-row-actions" style={{ marginTop: 10 }}>
              <button type="submit" className="gnt-btn gnt-btn-primary">{form.id ? "Update entry" : "Save entry"}</button>
              {form.id && (
                <button type="button" className="gnt-btn" onClick={() => { setForm(blank); setError(""); }}>Cancel edit</button>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="gnt-card">
        <div className="gnt-card-title">All Entries ({logs.length})</div>
        {logs.length === 0 ? (
          <div className="gnt-empty">No games logged yet. Your first entry will show up here.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="gnt-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Game</th>
                  <th>1st</th>
                  <th>2nd</th>
                  <th>3rd</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="gnt-mono">{formatDateHuman(l.date)}</td>
                    <td>{gameById[l.gameId]?.name || <span className="gnt-dim">Deleted game</span>}</td>
                    <td>{playerById[l.first] ? <PlayerChip player={playerById[l.first]} score={l.firstScore} /> : "\u2014"}</td>
                    <td>{playerById[l.second] ? <PlayerChip player={playerById[l.second]} score={l.secondScore} /> : "\u2014"}</td>
                    <td>{playerById[l.third] ? <PlayerChip player={playerById[l.third]} score={l.thirdScore} /> : "\u2014"}</td>
                    <td className="gnt-dim">{l.notes || "\u2014"}</td>
                    <td>
                      <div className="gnt-row-actions">
                        <button className="gnt-btn gnt-btn-sm" onClick={() => startEdit(l)}>Edit</button>
                        <button className="gnt-btn gnt-btn-sm gnt-btn-danger" onClick={() => deleteLog(l.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Trend chart ---------- */

function TrendChart({ logs, players }) {
  const series = useMemo(() => {
    if (logs.length === 0 || players.length === 0) return null;
    const sorted = [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const map = {};
    const order = [];
    sorted.forEach((l) => {
      const { key, label } = periodInfo(l.date, "month");
      if (!map[key]) { map[key] = { key, label, deltas: {} }; order.push(key); }
      if (l.first) map[key].deltas[l.first] = (map[key].deltas[l.first] || 0) + PLACE_POINTS.first;
      if (l.second) map[key].deltas[l.second] = (map[key].deltas[l.second] || 0) + PLACE_POINTS.second;
      if (l.third) map[key].deltas[l.third] = (map[key].deltas[l.third] || 0) + PLACE_POINTS.third;
    });
    const running = {};
    players.forEach((p) => (running[p.id] = 0));
    return order.map((k) => {
      const per = map[k];
      const point = { key: per.key, label: per.label, values: {} };
      players.forEach((p) => {
        running[p.id] += per.deltas[p.id] || 0;
        point.values[p.id] = running[p.id];
      });
      return point;
    });
  }, [logs, players]);

  if (!series || series.length < 2) {
    return <div className="gnt-empty">Log games across a couple of different months to see a trend line here.</div>;
  }

  const width = 640, height = 260;
  const padL = 32, padR = 12, padT = 12, padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxVal = Math.max(1, ...series.flatMap((d) => players.map((p) => d.values[p.id] || 0)));
  const stepX = innerW / (series.length - 1);
  const xAt = (i) => padL + i * stepX;
  const yAt = (v) => padT + innerH - (v / maxVal) * innerH;
  const gridLines = 4;
  const labelEvery = Math.max(1, Math.ceil(series.length / 6));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = padT + (innerH / gridLines) * i;
          const val = Math.round(maxVal - (maxVal / gridLines) * i);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--line)" strokeWidth="1" />
              <text x={padL - 6} y={y + 3} fontSize="9" textAnchor="end" fill="var(--ink-soft)">{val}</text>
            </g>
          );
        })}
        {series.map((d, i) =>
          i % labelEvery === 0 || i === series.length - 1 ? (
            <text key={d.key} x={xAt(i)} y={height - 8} fontSize="9" textAnchor="middle" fill="var(--ink-soft)">
              {d.label.split(" ")[0].slice(0, 3)}
            </text>
          ) : null
        )}
        {players.map((p) => {
          const points = series.map((d, i) => `${xAt(i)},${yAt(d.values[p.id] || 0)}`).join(" ");
          return (
            <g key={p.id}>
              <polyline points={points} fill="none" stroke={p.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {series.map((d, i) => (
                <circle key={i} cx={xAt(i)} cy={yAt(d.values[p.id] || 0)} r="2.5" fill={p.color} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="gnt-legend">
        {players.map((p) => (
          <div key={p.id} className="gnt-legend-item">
            <span className="gnt-legend-dot" style={{ background: p.color }} />
            {p.name}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Results tab ---------- */

function ResultsTab({ logs, players, playerById }) {
  const [granularity, setGranularity] = useState("month");

  const { rows, totals } = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      const { key, label } = periodInfo(l.date, granularity);
      if (!map[key]) map[key] = { key, label, wins: {}, gamesLogged: 0 };
      map[key].gamesLogged += 1;
      if (l.first) map[key].wins[l.first] = (map[key].wins[l.first] || 0) + 1;
    });
    const rows = Object.values(map).sort((a, b) => (a.key < b.key ? 1 : -1));
    const totals = {};
    players.forEach((p) => {
      totals[p.id] = rows.reduce((sum, r) => sum + (r.wins[p.id] || 0), 0);
    });
    return { rows, totals };
  }, [logs, players, granularity]);

  const opts = [
    { id: "year", label: "Year" },
    { id: "month", label: "Month" },
    { id: "week", label: "Week" },
    { id: "twoweek", label: "Two Weeks" },
  ];

  return (
    <div>
      <div className="gnt-card">
      <div className="gnt-card-title">Wins Over Time</div>
      <div style={{ marginBottom: 16 }}>
        <div className="gnt-seg">
          {opts.map((o) => (
            <button key={o.id} className={granularity === o.id ? "active" : ""} onClick={() => setGranularity(o.id)}>{o.label}</button>
          ))}
        </div>
      </div>
      {players.length === 0 ? (
        <div className="gnt-empty">Add players to see results here.</div>
      ) : rows.length === 0 ? (
        <div className="gnt-empty">No games logged yet.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="gnt-table">
            <thead>
              <tr>
                <th>Period</th>
                {players.map((p) => <th key={p.id}>{p.name}</th>)}
                <th>Games logged</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  {players.map((p) => <td key={p.id} className="gnt-num">{r.wins[p.id] || 0}</td>)}
                  <td className="gnt-num gnt-dim">{r.gamesLogged}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                {players.map((p) => <td key={p.id} className="gnt-num" style={{ fontWeight: 700 }}>{totals[p.id]}</td>)}
                <td className="gnt-num gnt-dim">{logs.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className="gnt-dim" style={{ fontSize: 12.5, marginTop: 10 }}>Win counts reflect 1st-place finishes only.</div>
      </div>

      <div className="gnt-card">
        <div className="gnt-card-title">Points Trend</div>
        <div className="gnt-dim" style={{ fontSize: 12.5, marginBottom: 14 }}>Cumulative points over time, month by month.</div>
        <TrendChart logs={logs} players={players} />
      </div>
    </div>
  );
}

/* ---------- Totals tab ---------- */

function TotalsTab({ logs, players, games, playerById, gameById }) {
  const [placeFilter, setPlaceFilter] = useState("first");
  const [scoreSort, setScoreSort] = useState("desc");

  const standings = useMemo(() => {
    return players
      .map((p) => {
        let points = 0, first = 0, second = 0, third = 0, played = 0;
        logs.forEach((l) => {
          if (l.first === p.id) { points += PLACE_POINTS.first; first++; played++; }
          else if (l.second === p.id) { points += PLACE_POINTS.second; second++; played++; }
          else if (l.third === p.id) { points += PLACE_POINTS.third; third++; played++; }
        });
        return { ...p, points, first, second, third, played };
      })
      .sort((a, b) => b.points - a.points);
  }, [players, logs]);

  const SLOT_SCORE_KEYS = [["first", "firstScore"], ["second", "secondScore"], ["third", "thirdScore"]];

  const scoreStats = useMemo(() => {
    const perPlayer = {};
    const perGamePlayer = {};
    players.forEach((p) => { perPlayer[p.id] = { total: 0, count: 0 }; });
    games.forEach((g) => {
      perGamePlayer[g.id] = {};
      players.forEach((p) => { perGamePlayer[g.id][p.id] = { total: 0, count: 0 }; });
    });
    logs.forEach((l) => {
      SLOT_SCORE_KEYS.forEach(([slot, scoreKey]) => {
        const pid = l[slot];
        const score = l[scoreKey];
        if (pid && typeof score === "number" && !Number.isNaN(score)) {
          if (perPlayer[pid]) { perPlayer[pid].total += score; perPlayer[pid].count += 1; }
          if (perGamePlayer[l.gameId] && perGamePlayer[l.gameId][pid]) {
            perGamePlayer[l.gameId][pid].total += score;
            perGamePlayer[l.gameId][pid].count += 1;
          }
        }
      });
    });
    return { perPlayer, perGamePlayer };
  }, [players, games, logs]);

  const scoreRecords = useMemo(() => {
    const records = [];
    logs.forEach((l) => {
      SLOT_SCORE_KEYS.forEach(([slot, scoreKey]) => {
        const pid = l[slot];
        const score = l[scoreKey];
        if (pid && typeof score === "number" && !Number.isNaN(score)) {
          records.push({ id: `${l.id}-${slot}`, date: l.date, gameId: l.gameId, playerId: pid, score });
        }
      });
    });
    return records;
  }, [logs]);

  const sortedScoreRecords = useMemo(
    () => [...scoreRecords].sort((a, b) => (scoreSort === "desc" ? b.score - a.score : a.score - b.score)),
    [scoreRecords, scoreSort]
  );

  const breakdown = useMemo(() => {
    const map = {};
    games.forEach((g) => {
      map[g.id] = {};
      players.forEach((p) => {
        map[g.id][p.id] = logs.filter((l) => l.gameId === g.id && l[placeFilter] === p.id).length;
      });
    });
    return map;
  }, [games, players, logs, placeFilter]);

  const winRateByGame = useMemo(() => {
    const map = {};
    games.forEach((g) => {
      map[g.id] = {};
      players.forEach((p) => {
        const played = logs.filter((l) => l.gameId === g.id && (l.first === p.id || l.second === p.id || l.third === p.id)).length;
        const wins = logs.filter((l) => l.gameId === g.id && l.first === p.id).length;
        map[g.id][p.id] = played > 0 ? { played, wins, rate: Math.round((wins / played) * 100) } : null;
      });
    });
    return map;
  }, [games, players, logs]);

  const streaks = useMemo(() => {
    const result = {};
    players.forEach((p) => {
      const playerLogs = logs
        .filter((l) => l.first === p.id || l.second === p.id || l.third === p.id)
        .slice()
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      let best = 0, run = 0;
      playerLogs.forEach((l) => {
        if (l.first === p.id) { run += 1; best = Math.max(best, run); }
        else run = 0;
      });
      let current = 0;
      for (let i = playerLogs.length - 1; i >= 0; i--) {
        if (playerLogs[i].first === p.id) current += 1;
        else break;
      }
      result[p.id] = { current, best };
    });
    return result;
  }, [players, logs]);

  const podium = standings.filter((s) => s.points > 0).slice(0, 3);
  const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;
  const podiumRank = (p) => podium.indexOf(p) + 1;

  const placeOpts = [
    { id: "first", label: "1st place" },
    { id: "second", label: "2nd place" },
    { id: "third", label: "3rd place" },
  ];

  return (
    <div>
      <div className="gnt-card">
        <div className="gnt-card-title">Current Standing</div>
        {podium.length === 0 ? (
          <div className="gnt-empty">Log some games to see the standings.</div>
        ) : (
          <div className="gnt-podium">
            {order.map((p) => (
              <div key={p.id} className={`gnt-podium-col gnt-podium-${podiumRank(p)}`}>
                <div className="gnt-podium-name">
                  <Avatar name={p.name} color={p.color} size={34} />
                  <div>{p.name}</div>
                </div>
                <div className="gnt-podium-pts">{p.points} pts</div>
                <div className="gnt-podium-bar">{podiumRank(p)}</div>
              </div>
            ))}
          </div>
        )}
        {standings.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 20 }}>
            <table className="gnt-table">
              <thead>
                <tr>
                  <th>Rank</th><th>Player</th><th>Points</th><th>1st</th><th>2nd</th><th>3rd</th><th>Games played</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.id}>
                    <td className="gnt-num">{i + 1}</td>
                    <td style={{ fontWeight: 700 }}><PlayerChip player={s} /></td>
                    <td className="gnt-num">{s.points}</td>
                    <td className="gnt-num"><span className="gnt-pill gnt-pill-gold">{s.first}</span></td>
                    <td className="gnt-num"><span className="gnt-pill gnt-pill-silver">{s.second}</span></td>
                    <td className="gnt-num"><span className="gnt-pill gnt-pill-bronze">{s.third}</span></td>
                    <td className="gnt-num gnt-dim">{s.played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="gnt-card">
        <div className="gnt-card-title">Win Streaks</div>
        {players.length === 0 ? (
          <div className="gnt-empty">Add players to track streaks.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="gnt-table">
              <thead>
                <tr><th>Player</th><th>Current streak</th><th>Best streak</th></tr>
              </thead>
              <tbody>
                {[...players]
                  .sort((a, b) => streaks[b.id].current - streaks[a.id].current || streaks[b.id].best - streaks[a.id].best)
                  .map((p) => (
                    <tr key={p.id}>
                      <td><PlayerChip player={p} /></td>
                      <td className="gnt-num">{streaks[p.id].current > 0 ? `\uD83D\uDD25 ${streaks[p.id].current}` : "\u2014"}</td>
                      <td className="gnt-num gnt-dim">{streaks[p.id].best}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="gnt-dim" style={{ fontSize: 12.5, marginTop: 10 }}>A streak counts consecutive 1st-place finishes across all games.</div>
      </div>

      <div className="gnt-card">
        <div className="gnt-card-title">Player Scores</div>
        {players.length === 0 ? (
          <div className="gnt-empty">Add players to see score totals.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="gnt-table">
              <thead>
                <tr><th>Player</th><th>Total score</th><th>Scored entries</th><th>Average</th></tr>
              </thead>
              <tbody>
                {[...players]
                  .sort((a, b) => scoreStats.perPlayer[b.id].total - scoreStats.perPlayer[a.id].total)
                  .map((p) => {
                    const s = scoreStats.perPlayer[p.id];
                    return (
                      <tr key={p.id}>
                        <td><PlayerChip player={p} /></td>
                        <td className="gnt-num">{s.count > 0 ? s.total : "\u2014"}</td>
                        <td className="gnt-num gnt-dim">{s.count}</td>
                        <td className="gnt-num gnt-dim">{s.count > 0 ? (s.total / s.count).toFixed(1) : "\u2014"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
        <div className="gnt-dim" style={{ fontSize: 12.5, marginTop: 10 }}>Only entries logged with a numeric score are counted here.</div>
      </div>

      <div className="gnt-card">
        <div className="gnt-card-title">Score by Game</div>
        {games.length === 0 || players.length === 0 ? (
          <div className="gnt-empty">Add games and players to see this breakdown.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="gnt-table">
              <thead>
                <tr>
                  <th>Game</th>
                  {players.map((p) => <th key={p.id}>{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    {players.map((p) => {
                      const cell = scoreStats.perGamePlayer[g.id][p.id];
                      return (
                        <td key={p.id} className="gnt-num">
                          {cell.count > 0 ? (
                            <>
                              {cell.total}
                              <span className="gnt-dim" style={{ fontWeight: 400, fontSize: 11 }}> ({cell.count})</span>
                            </>
                          ) : "\u2014"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="gnt-dim" style={{ fontSize: 12.5, marginTop: 10 }}>Totals combine every scored entry for that player in that game; the number in parentheses is how many entries had a score.</div>
      </div>

      <div className="gnt-card">
        <div className="gnt-card-title">Score Leaderboard</div>
        <div style={{ marginBottom: 16 }}>
          <div className="gnt-seg">
            <button className={scoreSort === "desc" ? "active" : ""} onClick={() => setScoreSort("desc")}>Highest first</button>
            <button className={scoreSort === "asc" ? "active" : ""} onClick={() => setScoreSort("asc")}>Lowest first</button>
          </div>
        </div>
        {scoreRecords.length === 0 ? (
          <div className="gnt-empty">Log a game with a score to see the leaderboard.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="gnt-table">
              <thead>
                <tr><th>#</th><th>Player</th><th>Game</th><th>Date</th><th>Score</th></tr>
              </thead>
              <tbody>
                {sortedScoreRecords.slice(0, 15).map((r, i) => (
                  <tr key={r.id}>
                    <td className="gnt-num gnt-dim">{i + 1}</td>
                    <td><PlayerChip player={playerById[r.playerId]} /></td>
                    <td>{gameById[r.gameId]?.name || <span className="gnt-dim">Deleted game</span>}</td>
                    <td className="gnt-mono">{formatDateHuman(r.date)}</td>
                    <td className="gnt-num" style={{ fontWeight: 700 }}>{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {scoreRecords.length > 15 && (
          <div className="gnt-dim" style={{ fontSize: 12.5, marginTop: 10 }}>Showing top 15 of {scoreRecords.length} scored entries.</div>
        )}
      </div>

      <div className="gnt-card">
        <div className="gnt-card-title">Win Rate by Game</div>
        {games.length === 0 || players.length === 0 ? (
          <div className="gnt-empty">Add games and players to see win rates.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="gnt-table">
              <thead>
                <tr>
                  <th>Game</th>
                  {players.map((p) => <th key={p.id}>{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    {players.map((p) => {
                      const cell = winRateByGame[g.id][p.id];
                      return (
                        <td key={p.id} className="gnt-num">
                          {cell ? (
                            <>
                              {cell.rate}%<span className="gnt-dim" style={{ fontWeight: 400, fontSize: 11 }}> ({cell.wins}/{cell.played})</span>
                            </>
                          ) : "\u2014"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="gnt-dim" style={{ fontSize: 12.5, marginTop: 10 }}>Win rate = 1st-place finishes \u00f7 times that player has played the game.</div>
      </div>

      <div className="gnt-card">
        <div className="gnt-card-title">Finishes by Game</div>
        <div style={{ marginBottom: 16 }}>
          <div className="gnt-seg">
            {placeOpts.map((o) => (
              <button key={o.id} className={placeFilter === o.id ? "active" : ""} onClick={() => setPlaceFilter(o.id)}>{o.label}</button>
            ))}
          </div>
        </div>
        {games.length === 0 || players.length === 0 ? (
          <div className="gnt-empty">Add games and players to see this breakdown.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="gnt-table">
              <thead>
                <tr>
                  <th>Game</th>
                  {players.map((p) => <th key={p.id}>{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    {players.map((p) => (
                      <td key={p.id} className="gnt-num">{breakdown[g.id][p.id] || "\u2014"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Library tab ---------- */

/* ---------- Rules modal ---------- */

function RulesModal({ game, onClose, onSave }) {
  const [editing, setEditing] = useState(!game.rules);
  const [draft, setDraft] = useState(game.rules || "");

  async function handleSave() {
    await onSave(game.id, draft);
    setEditing(false);
  }

  return (
    <div className="gnt-modal-backdrop" onClick={onClose}>
      <div className="gnt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gnt-modal-header">
          <div className="gnt-card-title" style={{ margin: 0 }}>{game.name} \u2014 Rules</div>
          <button className="gnt-btn gnt-btn-sm" onClick={onClose}>Close</button>
        </div>
        {editing ? (
          <>
            <textarea
              className="gnt-textarea"
              style={{ minHeight: 220 }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="House rules, setup notes, scoring reminders\u2026"
              autoFocus
            />
            <div className="gnt-row-actions" style={{ marginTop: 12 }}>
              <button className="gnt-btn gnt-btn-primary" onClick={handleSave}>Save rules</button>
              <button className="gnt-btn" onClick={() => { setDraft(game.rules || ""); setEditing(false); }}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div className="gnt-rules-text">{game.rules}</div>
            <div className="gnt-row-actions" style={{ marginTop: 12 }}>
              <button className="gnt-btn" onClick={() => setEditing(true)}>Edit rules</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Library tab ---------- */

function LibraryTab({ games, playCount, addGame, updateGame, deleteGame }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [rulesGameId, setRulesGameId] = useState(null);

  const rulesGame = games.find((g) => g.id === rulesGameId) || null;

  async function handleAdd(e) {
    e.preventDefault();
    const msg = await addGame(name);
    if (msg) setError(msg);
    else { setName(""); setError(""); }
  }

  async function handleDelete(id) {
    const msg = await deleteGame(id);
    if (msg) setError(msg);
  }

  function startEdit(g) {
    setEditingId(g.id);
    setEditName(g.name);
    setError("");
  }

  async function handleSaveEdit(id) {
    const msg = await updateGame(id, { name: editName });
    if (msg) setError(msg);
    else setEditingId(null);
  }

  async function handleSaveRules(id, rulesText) {
    await updateGame(id, { rules: rulesText });
  }

  return (
    <div className="gnt-card">
      <div className="gnt-card-title">Game Library</div>
      <form onSubmit={handleAdd} className="gnt-row-actions" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <input className="gnt-input" placeholder="Add a game, e.g. Catan" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
        <button type="submit" className="gnt-btn gnt-btn-primary">Add</button>
      </form>
      {error && <div className="gnt-error" style={{ marginBottom: 12 }}>{error}</div>}
      {games.length === 0 ? (
        <div className="gnt-empty">No games yet. Add your first one above.</div>
      ) : (
        <div>
          {games.map((g) =>
            editingId === g.id ? (
              <div key={g.id} className="gnt-list-item">
                <div className="gnt-row-actions" style={{ flex: 1, alignItems: "center" }}>
                  <input className="gnt-input" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ maxWidth: 240 }} autoFocus />
                  <button className="gnt-btn gnt-btn-sm gnt-btn-primary" onClick={() => handleSaveEdit(g.id)}>Save</button>
                  <button className="gnt-btn gnt-btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={g.id} className="gnt-list-item">
                <div>
                  <span style={{ fontWeight: 700 }}>{g.name}</span>{" "}
                  <span className="gnt-dim" style={{ fontSize: 12.5 }}>({playCount(g.id)} time{playCount(g.id) === 1 ? "" : "s"} played)</span>
                </div>
                <div className="gnt-row-actions">
                  <button
                    className={`gnt-btn gnt-btn-sm${g.rules ? " gnt-btn-has-rules" : ""}`}
                    onClick={() => setRulesGameId(g.id)}
                    title={g.rules ? "View or edit rules" : "Add rules"}
                  >
                    \uD83D\uDCD6 Rules
                  </button>
                  <button className="gnt-btn gnt-btn-sm" onClick={() => startEdit(g)}>Edit</button>
                  <button className="gnt-btn gnt-btn-sm gnt-btn-danger" onClick={() => handleDelete(g.id)}>Remove</button>
                </div>
              </div>
            )
          )}
        </div>
      )}
      {rulesGame && <RulesModal game={rulesGame} onClose={() => setRulesGameId(null)} onSave={handleSaveRules} />}
    </div>
  );
}

/* ---------- Players tab ---------- */

function PlayersTab({ players, appearances, addPlayer, updatePlayer, deletePlayer }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    const used = players.map((p) => p.color);
    setColor(PALETTE.find((c) => !used.includes(c)) || PALETTE[players.length % PALETTE.length]);
  }, [players.length]);

  async function handleAdd(e) {
    e.preventDefault();
    const msg = await addPlayer(name, color);
    if (msg) setError(msg);
    else { setName(""); setError(""); }
  }

  async function handleDelete(id) {
    const msg = await deletePlayer(id);
    if (msg) setError(msg);
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditColor(p.color);
    setError("");
  }

  async function handleSaveEdit(id) {
    const msg = await updatePlayer(id, { name: editName, color: editColor });
    if (msg) setError(msg);
    else setEditingId(null);
  }

  return (
    <div className="gnt-card">
      <div className="gnt-card-title">Players</div>
      <form onSubmit={handleAdd} style={{ marginBottom: 16 }}>
        <div className="gnt-row-actions" style={{ alignItems: "flex-start", marginBottom: 10 }}>
          <input className="gnt-input" placeholder="Add a player, e.g. Mom" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
          <button type="submit" className="gnt-btn gnt-btn-primary">Add</button>
        </div>
        <label className="gnt-label">Color</label>
        <ColorSwatchPicker value={color} onChange={setColor} />
      </form>
      {error && <div className="gnt-error" style={{ marginBottom: 12 }}>{error}</div>}
      {players.length === 0 ? (
        <div className="gnt-empty">No players yet. Add your first one above.</div>
      ) : (
        <div>
          {players.map((p) =>
            editingId === p.id ? (
              <div key={p.id} className="gnt-list-item" style={{ display: "block" }}>
                <div className="gnt-row-actions" style={{ alignItems: "center", marginBottom: 8 }}>
                  <input className="gnt-input" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ maxWidth: 220 }} autoFocus />
                  <button className="gnt-btn gnt-btn-sm gnt-btn-primary" onClick={() => handleSaveEdit(p.id)}>Save</button>
                  <button className="gnt-btn gnt-btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
                <ColorSwatchPicker value={editColor} onChange={setEditColor} />
              </div>
            ) : (
              <div key={p.id} className="gnt-list-item">
                <div className="gnt-row-actions" style={{ alignItems: "center" }}>
                  <Avatar name={p.name} color={p.color} size={28} />
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  <span className="gnt-dim" style={{ fontSize: 12.5 }}>({appearances(p.id)} game{appearances(p.id) === 1 ? "" : "s"} played)</span>
                </div>
                <div className="gnt-row-actions">
                  <button className="gnt-btn gnt-btn-sm" onClick={() => startEdit(p)}>Edit</button>
                  <button className="gnt-btn gnt-btn-sm gnt-btn-danger" onClick={() => handleDelete(p.id)}>Remove</button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// Mount the app to the root DOM node
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<GameNightTracker />);
