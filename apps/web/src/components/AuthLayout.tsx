import type { ReactNode } from "react";

const todayLabel = new Date()
  .toLocaleDateString("tr-TR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  .toUpperCase();

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-frame">
        <div className="auth-grid-bg" aria-hidden="true" />

        <div className="auth-masthead">
          <div className="auth-masthead-top">
            <span>OPENGYM/OPS</span>
            <span>{todayLabel}</span>
          </div>
          <div>
            <div className="auth-masthead-eyebrow">
              FACILITY MANAGEMENT SYSTEM
            </div>
            <div className="auth-masthead-title">
              SET.
              <br />
              REP.
              <br />
              RUN.
            </div>
          </div>
          <div />
        </div>

        <div className="auth-card-wrap">
          <div className="auth-card">
            <span className="corner-mark corner-mark--tl" aria-hidden="true">
              +
            </span>
            <span className="corner-mark corner-mark--tr" aria-hidden="true">
              +
            </span>
            <span className="corner-mark corner-mark--bl" aria-hidden="true">
              +
            </span>
            <span className="corner-mark corner-mark--br" aria-hidden="true">
              +
            </span>
            <div className="auth-eyebrow">TERMINAL ACCESS</div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
