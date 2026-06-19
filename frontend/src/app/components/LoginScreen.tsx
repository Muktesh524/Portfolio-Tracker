import { useState } from "react";
import { Activity, LogIn, UserPlus, Loader2, AlertCircle } from "lucide-react";
import { TC } from "./TerminalShared";
import { useAuth } from "../AuthContext";

export function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode]         = useState<"login" | "signup">("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Email and password required"); return; }
    if (mode === "signup" && password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password);
      }
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") setError("Invalid email or password");
      else if (code === "auth/email-already-in-use") setError("Email already registered. Try logging in.");
      else if (code === "auth/weak-password") setError("Password too weak (min 6 characters)");
      else if (code === "auth/invalid-email") setError("Invalid email address");
      else setError(err?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: TC.bg0, border: `1px solid ${TC.border}`,
    color: TC.text, fontSize: '12px', fontFamily: TC.font,
    outline: 'none', borderRadius: '1px',
    transition: 'border-color 120ms',
  };

  const labelStyle: React.CSSProperties = {
    color: TC.text4, fontSize: '9px', letterSpacing: '0.12em',
    fontFamily: TC.font, display: 'block', marginBottom: '4px',
  };

  return (
    <div style={{
      width: '100%', height: '100vh',
      background: TC.bg0, fontFamily: TC.font,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '380px',
        background: TC.bg1,
        border: `1px solid ${TC.border}`,
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${TC.border}`,
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <Activity style={{ width: 18, height: 18, color: TC.green }} />
          <div>
            <div style={{ color: TC.green, fontSize: '13px', letterSpacing: '0.08em', fontWeight: 600 }}>
              BLOOMBERG<span style={{ color: TC.text5 }}> TERMINAL</span>
            </div>
            <div style={{ color: TC.text5, fontSize: '9px', letterSpacing: '0.1em', marginTop: '2px' }}>
              PORTFOLIO DASHBOARD — SECURE ACCESS
            </div>
          </div>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${TC.border}` }}>
          {(["login", "signup"] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1, padding: '10px',
                background: mode === m ? TC.bg2 : 'transparent',
                borderBottom: mode === m ? `2px solid ${TC.green}` : '2px solid transparent',
                border: 'none', borderRight: m === "login" ? `1px solid ${TC.border}` : 'none',
                color: mode === m ? TC.green : TC.text4,
                fontSize: '10px', letterSpacing: '0.1em',
                cursor: 'pointer', fontFamily: TC.font,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'all 120ms',
              }}
            >
              {m === "login" ? <LogIn style={{ width: 11, height: 11 }} /> : <UserPlus style={{ width: 11, height: 11 }} />}
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 10px', background: TC.red + '14',
              border: `1px solid ${TC.red}33`, borderRadius: '1px',
            }}>
              <AlertCircle style={{ width: 12, height: 12, color: TC.red, flexShrink: 0 }} />
              <span style={{ color: TC.red, fontSize: '10px' }}>{error}</span>
            </div>
          )}

          <div>
            <label style={labelStyle}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = TC.green + '66'; }}
              onBlur={e => { e.currentTarget.style.borderColor = TC.border; }}
              autoComplete="email"
            />
          </div>

          <div>
            <label style={labelStyle}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Min 6 characters" : "Enter password"}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = TC.green + '66'; }}
              onBlur={e => { e.currentTarget.style.borderColor = TC.border; }}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '10px',
              background: TC.green + '18', border: `1px solid ${TC.green}44`,
              color: TC.green, fontSize: '11px', letterSpacing: '0.1em',
              fontFamily: TC.font, cursor: loading ? 'wait' : 'pointer',
              borderRadius: '1px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              opacity: loading ? 0.7 : 1,
              transition: 'all 120ms',
            }}
          >
            {loading ? (
              <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />
            ) : mode === "login" ? (
              <LogIn style={{ width: 13, height: 13 }} />
            ) : (
              <UserPlus style={{ width: 13, height: 13 }} />
            )}
            {loading ? "AUTHENTICATING…" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          padding: '10px 24px',
          borderTop: `1px solid ${TC.border}`,
          color: TC.text5, fontSize: '9px', letterSpacing: '0.06em',
          textAlign: 'center',
        }}>
          DATA: FIREBASE + AMFI + NSE (EDUCATIONAL PURPOSE ONLY)
        </div>
      </div>
    </div>
  );
}
