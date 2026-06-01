import { useEffect, useRef, useState } from "react";

const round = (x) => Math.round((x + Number.EPSILON) * 1e10) / 1e10;

// Safe expression evaluator (no eval): tokenize → shunting-yard → evaluate RPN.
function evaluate(expr) {
  const tokens = expr.match(/(\d+\.?\d*|\.\d+|[+\-*/()])/g);
  if (!tokens) return null;

  const prec = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const out = [];
  const ops = [];
  const isNum = (t) => /^[\d.]/.test(t);

  for (const t of tokens) {
    if (isNum(t)) out.push(parseFloat(t));
    else if (t in prec) {
      while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop());
      ops.push(t);
    } else if (t === "(") ops.push(t);
    else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop());
      ops.pop();
    }
  }
  while (ops.length) out.push(ops.pop());

  const st = [];
  for (const t of out) {
    if (typeof t === "number") st.push(t);
    else {
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) return null;
      if (t === "+") st.push(a + b);
      else if (t === "-") st.push(a - b);
      else if (t === "*") st.push(a * b);
      else if (t === "/") st.push(b === 0 ? NaN : a / b);
    }
  }
  const r = st.pop();
  if (r === undefined || Number.isNaN(r) || !Number.isFinite(r)) return null;
  return round(r);
}

// Current numeric value of the expression (for memory ops).
function currentValue(expr) {
  const r = evaluate(expr);
  if (r !== null) return r;
  const n = parseFloat(expr);
  return Number.isFinite(n) ? n : 0;
}

// % → divide the trailing number by 100 (true percentage, e.g. 50 → 0.5).
function applyPercent(expr) {
  const m = expr.match(/(\d+\.?\d*|\.\d+)$/);
  if (!m) return expr;
  return expr.slice(0, m.index) + String(round(parseFloat(m[1]) / 100));
}

// Insert a recalled memory value sensibly.
function insertMemory(expr, mem) {
  if (expr === "") return String(mem);
  const last = expr.slice(-1);
  if ("+-*/(".includes(last)) return expr + String(mem);
  const m = expr.match(/(\d+\.?\d*|\.\d+)$/);
  if (m) return expr.slice(0, m.index) + String(mem); // replace trailing number
  return expr + String(mem);
}

const PRETTY = { "*": " × ", "/": " ÷ ", "+": " + ", "-": " − " };
const prettify = (e) => e.replace(/[*/+\-]/g, (m) => PRETTY[m]);

const grid = [
  { k: "MC", t: "mem" }, { k: "MR", t: "mem" }, { k: "M+", t: "mem" }, { k: "M-", t: "mem" },
  { k: "C", t: "clear" }, { k: "DEL", t: "del", label: "⌫" }, { k: "%", t: "op" }, { k: "/", t: "op", label: "÷" },
  { k: "7" }, { k: "8" }, { k: "9" }, { k: "*", t: "op", label: "×" },
  { k: "4" }, { k: "5" }, { k: "6" }, { k: "-", t: "op", label: "−" },
  { k: "1" }, { k: "2" }, { k: "3" }, { k: "+", t: "op", label: "+" },
  { k: "0", wide: true }, { k: ".", }, { k: "=", t: "eq" },
];

export default function Calculator() {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState(() => localStorage.getItem("calc_expr") || "");
  const [memory, setMemory] = useState(() => parseFloat(localStorage.getItem("calc_memory")) || 0);
  const [pos, setPos] = useState(null); // null → default bottom-right anchor
  const panelRef = useRef(null);
  const drag = useRef({ active: false, offX: 0, offY: 0 });

  // Persist expression + memory so the last result survives opens and reloads.
  useEffect(() => localStorage.setItem("calc_expr", expr), [expr]);
  useEffect(() => localStorage.setItem("calc_memory", String(memory)), [memory]);

  const live = evaluate(expr.replace(/[+\-*/]\s*$/, ""));

  const press = (key) => {
    if (key === "MC") return setMemory(0);
    if (key === "MR") return setExpr((p) => insertMemory(p, memory));
    if (key === "M+") return setMemory((m) => round(m + currentValue(expr)));
    if (key === "M-") return setMemory((m) => round(m - currentValue(expr)));

    setExpr((prev) => {
      if (key === "C") return "";
      if (key === "DEL") return prev.slice(0, -1);
      if (key === "%") return applyPercent(prev);
      if (key === "=") {
        const r = evaluate(prev);
        return r === null ? prev : String(r);
      }
      const isOp = (c) => "+-*/".includes(c);
      const last = prev.slice(-1);
      if (isOp(key) && isOp(last)) return prev.slice(0, -1) + key;
      return prev + key;
    });
  };

  // Keyboard support while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const k = e.key;
      if (/[0-9.+\-*/()%]/.test(k) && k.length === 1) {
        press(k);
        e.preventDefault();
      } else if (k === "Enter" || k === "=") {
        press("=");
        e.preventDefault();
      } else if (k === "Backspace") {
        press("DEL");
        e.preventDefault();
      } else if (k === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memory, expr]);

  // ---- Dragging (pointer events, works for mouse + touch) ----
  const onPointerDown = (e) => {
    if (e.target.closest("button")) return; // don't drag when hitting a control
    const rect = panelRef.current.getBoundingClientRect();
    drag.current = { active: true, offX: e.clientX - rect.left, offY: e.clientY - rect.top };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const w = panelRef.current.offsetWidth;
    const h = panelRef.current.offsetHeight;
    const x = Math.min(Math.max(8, e.clientX - drag.current.offX), window.innerWidth - w - 8);
    const y = Math.min(Math.max(8, e.clientY - drag.current.offY), window.innerHeight - h - 8);
    setPos({ x, y });
  };
  const endDrag = () => {
    drag.current.active = false;
  };

  const panelStyle = pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined;

  return (
    <>
      {open && (
        <div
          className="calc-panel glass-surface"
          ref={panelRef}
          style={panelStyle}
          role="dialog"
          aria-label="Calculator"
        >
          <div
            className="calc-head draggable"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span className="calc-title">
              <span className="calc-grip">⠿</span> Calculator
            </span>
            <span className="calc-head-right">
              {memory !== 0 && (
                <span className="calc-mem-flag" title={`Memory: ${memory}`}>
                  M
                </span>
              )}
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                &times;
              </button>
            </span>
          </div>

          <div className="calc-display">
            <div className="calc-expr">{expr ? prettify(expr) : "0"}</div>
            <div className="calc-live">{live !== null && expr ? `= ${live}` : " "}</div>
          </div>

          <div className="calc-grid">
            {grid.map((b) => (
              <button
                key={b.k}
                className={`calc-btn ${b.t === "op" ? "is-op" : ""} ${b.t === "eq" ? "is-eq" : ""} ${
                  b.t === "clear" ? "is-clear" : ""
                } ${b.t === "mem" ? "is-mem" : ""} ${b.t === "del" ? "is-del" : ""} ${
                  b.wide ? "is-wide" : ""
                }`}
                onClick={() => press(b.k)}
              >
                {b.label || b.k}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        className={`calc-fab ${open ? "active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close calculator" : "Open calculator"}
        title="Calculator"
      >
        {open ? (
          "×"
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="2.5" width="16" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <rect x="6.8" y="5" width="10.4" height="3.2" rx="1" fill="currentColor" />
            <circle cx="8" cy="12" r="1.1" fill="currentColor" />
            <circle cx="12" cy="12" r="1.1" fill="currentColor" />
            <circle cx="16" cy="12" r="1.1" fill="currentColor" />
            <circle cx="8" cy="15.6" r="1.1" fill="currentColor" />
            <circle cx="12" cy="15.6" r="1.1" fill="currentColor" />
            <circle cx="16" cy="15.6" r="1.1" fill="currentColor" />
            <circle cx="8" cy="19.1" r="1.1" fill="currentColor" />
            <circle cx="12" cy="19.1" r="1.1" fill="currentColor" />
            <circle cx="16" cy="19.1" r="1.1" fill="currentColor" />
          </svg>
        )}
      </button>
    </>
  );
}
