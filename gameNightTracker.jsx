import { useState, useEffect, useMemo } from "react";

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

async function loadKey(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    return res && res.value ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}

async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e) {
    console.error("storage save failed", key, e);
  }
}

/* ---------- styles ---------- */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Karla:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@500;600;700&display=swap');

.gnt-app {
  --felt: #1B3A2F;
  --felt-2: #234A3B;
  --felt-light: #2F5C49;
  --parchment: #F6F1E4;
  --parchment-2: #ECE4CE;
  --ink: #1E241F;
  --ink-soft: #5B6459;
  --gold: #D4A537;
  --silver: #AEB4BC;
  --bronze: #B4783F;
  --danger: #A8432B;
  --line: #D9D0B8;
  font-family: 'Karla', sans-serif;
  color: var(--ink);
  background: var(--parchment);
  min-height: 100%;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 0 rgba(0,0,0,0.05);
}
.gnt-display { font-family: 'Anton', sans-serif; letter-spacing: 0.02em; text-transform: uppercase; }
.gnt-mono { font-family: 'JetBrains Mono', monospace; }

.gnt-header {
  background: var(--felt);
  background-image: radial-gradient(circle at 15% 20%, rgba(255,255,255,0.04), transparent 45%);
  color: var(--parchment);
  padding: 22px 24px 16px;
}
.gnt-title { font-size: 28px; line-height: 1; color: var(--parchment); }
.gnt-subtitle { font-family: 'Karla', sans-serif; font-style: italic; color: #C9CFC3; font-size: 13px; margin-top: 4px; }

.gnt-tabs { display: flex; gap: 8px; flex-wrap: wrap; padding: 14px 24px; background: var(--felt); }
.gnt-tab {
  font-family: 'Anton', sans-serif; letter-spacing: 0.03em; text-transform: uppercase;
  font-size: 12.5px; padding: 9px 16px; border-radius: 999px; border: 1px solid rgba(246,241,228,0.25);
  background: var(--felt-2); color: #D8DED2; cursor: pointer; transition: all 0.15s ease;
}
.gnt-tab:hover { background: var(--felt-light); }
.gnt-tab.active { background: var(--gold); color: #2A1F05; border-color: var(--gold); }

.gnt-body { padding: 24px; }
.gnt-card {
  background: #FFFDF7; border: 1px solid var(--line); border-radius: 12px; padding: 20px; margin-bottom: 18px;
}
.gnt-card-title { font-family: 'Anton', sans-serif; text-transform: uppercase; letter-spacing: 0.02em; font-size: 15px; color: var(--felt); margin-bottom: 14px; }

.gnt-label { font-size: 12px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px; }
.gnt-input, .gnt-select, .gnt-textarea {
  width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 8px; background: #fff;
  font-family: 'Karla', sans-serif; font-size: 14px; color: var(--ink); box-sizing: border-box;
}
.gnt-input:focus, .gnt-select:focus, .gnt-textarea:focus { outline: 2px solid var(--gold); outline-offset: 1px; border-color: var(--gold); }
.gnt-textarea { resize: vertical; min-height: 60px; }

.gnt-btn {
  font-family: 'Karla', sans-serif; font-weight: 700; font-size: 13.5px; padding: 9px 18px; border-radius: 8px;
  border: 1px solid var(--line); background: #fff; color: var(--ink); cursor: pointer; transition: all 0.15s ease;
}
.gnt-btn:hover { background: var(--parchment-2); }
.gnt-btn-primary { background: var(--felt); color: var(--parchment); border-color: var(--felt); }
.gnt-btn-primary:hover { background: var(--felt-light); }
.gnt-btn-danger { color: var(--danger); }
.gnt-btn-danger:hover { background: #F6E7E1; }
.gnt-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.gnt-btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 6px; }

.gnt-error { color: var(--danger); font-size: 13px; margin-top: 8px; }
.gnt-empty { color: var(--ink-soft); font-size: 14px; padding: 18px 4px; text-align: center; }

.gnt-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.gnt-table th { text-align: left; font-family: 'Anton', sans-serif; font-size: 11px; letter-spacing: 0.03em; text-transform: uppercase; color: var(--ink-soft); padding: 8px 10px; border-bottom: 2px solid var(--line); white-space: nowrap; }
.gnt-table td { padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
.gnt-table tr:last-child td { border-bottom: none; }
.gnt-table tbody tr:hover { background: var(--parchment-2); }
.gnt-num { font-family: 'JetBrains Mono', monospace; font-weight: 600; }
.gnt-dim { color: var(--ink-soft); }

.gnt-pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
.gnt-pill-gold { background: #F4E3B0; color: #6B4E0A; }
.gnt-pill-silver { background: #E4E6E9; color: #52565B; }
.gnt-pill-bronze { background: #EAD1B4; color: #6E3F14; }

.gnt-podium { display: flex; align-items: flex-end; justify-content: center; gap: 14px; padding: 10px 0 0; }
.gnt-podium-col { display: flex; flex-direction: column; align-items: center; width: 120px; }
.gnt-podium-name { font-weight: 700; font-size: 13.5px; text-align: center; margin-bottom: 4px; }
.gnt-podium-pts { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-soft); margin-bottom: 8px; }
.gnt-podium-bar { width: 100%; border-radius: 8px 8px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 8px; font-family: 'Anton', sans-serif; font-size: 20px; }
.gnt-podium-1 .gnt-podium-bar { height: 108px; background: linear-gradient(180deg, #E8C25E, var(--gold)); color: #4A3204; }
.gnt-podium-2 .gnt-podium-bar { height: 78px; background: linear-gradient(180deg, #C7CCD2, var(--silver)); color: #3C4046; }
.gnt-podium-3 .gnt-podium-bar { height: 58px; background: linear-gradient(180deg, #CB9865, var(--bronze)); color: #4A2A0C; }

.gnt-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.gnt-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
@media (max-width: 640px) {
  .gnt-grid-2, .gnt-grid-3 { grid-template-columns: 1fr; }
  .gnt-podium { gap: 8px; }
  .gnt-podium-col { width: 90px; }
}

.gnt-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.gnt-seg button { font-family: 'Karla', sans-serif; font-weight: 700; font-size: 12.5px; padding: 7px 14px; border: none; background: #fff; color: var(--ink-soft); cursor: pointer; }
.gnt-seg button + button { border-left: 1px solid var(--line); }
.gnt-seg button.active { background: var(--felt); color: var(--parchment); }

.gnt-row-actions { display: flex; gap: 6px; }
.gnt-list-item { display: flex; align-items: center; justify-content: space-between; padding: 9px 2px; border-bottom: 1px solid var(--line); }
.gnt-list-item:last-child { border-bottom: none; }
`;

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
      setGames(g);
      setPlayers(p);
      setLogs(l);
      setLoading(false);
    })();
  }, []);

  return { loading, games, setGames, players, setPlayers, logs, setLogs };
}

/* ---------- app ---------- */

export default function GameNightTracker() {
  const { loading, games, setGames, players, setPlayers, logs, setLogs } = useAppData();
  const [tab, setTab] = useState("log");

  const gameById = useMemo(() => Object.fromEntries(games.map((g) => [g.id, g])), [games]);
  const playerById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  const playCount = (gameId) => logs.filter((l) => l.gameId === gameId).length;
  const playerAppearances = (playerId) =>
    logs.filter((l) => l.first === playerId || l.second === playerId || l.third === playerId).length;

  async function addGame(name) {
    const trimmed = name.trim();
    if (!trimmed) return "Enter a game name.";
    if (games.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) return "That game is already in the library.";
    const next = [...games, { id: uid(), name: trimmed }];
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

  async function addPlayer(name) {
    const trimmed = name.trim();
    if (!trimmed) return "Enter a player name.";
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return "That player already exists.";
    const next = [...players, { id: uid(), name: trimmed }];
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
      <div className="gnt-app" style={{ padding: 40, textAlign: "center" }}>
        <style>{STYLES}</style>
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
    <div className="gnt-app">
      <style>{STYLES}</style>
      <div className="gnt-header">
        <div className="gnt-title gnt-display">Game Night</div>
        <div className="gnt-subtitle">The family scoreboard</div>
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
        {tab === "totals" && <TotalsTab logs={logs} players={players} games={games} playerById={playerById} />}
        {tab === "library" && <LibraryTab games={games} playCount={playCount} addGame={addGame} deleteGame={deleteGame} />}
        {tab === "players" && (
          <PlayersTab players={players} appearances={playerAppearances} addPlayer={addPlayer} deletePlayer={deletePlayer} />
        )}
      </div>
    </div>
  );
}

/* ---------- Log tab ---------- */

function LogTab({ games, players, logs, gameById, playerById, saveLog, deleteLog }) {
  const blank = { id: null, date: todayISO(), gameId: "", first: "", second: "", third: "", notes: "" };
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date) return setError("Choose a date.");
    if (!form.gameId) return setError("Choose a game.");
    if (!form.first || !form.second || !form.third) return setError("Choose all three places.");
    if (new Set([form.first, form.second, form.third]).size < 3) return setError("Each place needs a different player.");
    await saveLog({ ...form });
    setForm(blank);
  }

  function startEdit(entry) {
    setForm({ ...entry });
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
                    <td>{playerById[l.first]?.name || "\u2014"}</td>
                    <td>{playerById[l.second]?.name || "\u2014"}</td>
                    <td>{playerById[l.third]?.name || "\u2014"}</td>
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
  );
}

/* ---------- Totals tab ---------- */

function TotalsTab({ logs, players, games, playerById }) {
  const [placeFilter, setPlaceFilter] = useState("first");

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
                <div className="gnt-podium-name">{p.name}</div>
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
                    <td style={{ fontWeight: 700 }}>{s.name}</td>
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

function LibraryTab({ games, playCount, addGame, deleteGame }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

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
          {games.map((g) => (
            <div key={g.id} className="gnt-list-item">
              <div>
                <span style={{ fontWeight: 700 }}>{g.name}</span>{" "}
                <span className="gnt-dim" style={{ fontSize: 12.5 }}>({playCount(g.id)} time{playCount(g.id) === 1 ? "" : "s"} played)</span>
              </div>
              <button className="gnt-btn gnt-btn-sm gnt-btn-danger" onClick={() => handleDelete(g.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Players tab ---------- */

function PlayersTab({ players, appearances, addPlayer, deletePlayer }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function handleAdd(e) {
    e.preventDefault();
    const msg = await addPlayer(name);
    if (msg) setError(msg);
    else { setName(""); setError(""); }
  }

  async function handleDelete(id) {
    const msg = await deletePlayer(id);
    if (msg) setError(msg);
  }

  return (
    <div className="gnt-card">
      <div className="gnt-card-title">Players</div>
      <form onSubmit={handleAdd} className="gnt-row-actions" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <input className="gnt-input" placeholder="Add a player, e.g. Mom" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
        <button type="submit" className="gnt-btn gnt-btn-primary">Add</button>
      </form>
      {error && <div className="gnt-error" style={{ marginBottom: 12 }}>{error}</div>}
      {players.length === 0 ? (
        <div className="gnt-empty">No players yet. Add your first one above.</div>
      ) : (
        <div>
          {players.map((p) => (
            <div key={p.id} className="gnt-list-item">
              <div>
                <span style={{ fontWeight: 700 }}>{p.name}</span>{" "}
                <span className="gnt-dim" style={{ fontSize: 12.5 }}>({appearances(p.id)} game{appearances(p.id) === 1 ? "" : "s"} played)</span>
              </div>
              <button className="gnt-btn gnt-btn-sm gnt-btn-danger" onClick={() => handleDelete(p.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}