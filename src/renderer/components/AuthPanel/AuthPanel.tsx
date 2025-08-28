/* eslint-disable react/button-has-type */
// renderer/components/AuthPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type RemoteInfo = { host: string; url: string };
type Msg = { text: string; tone: 'ok' | 'err' | 'hint' };

export default function AuthPanel() {
  const [remote, setRemote] = useState<RemoteInfo | null>(null);
  const [account, setAccount] = useState(''); // Bitbucket needs username; GH can use 'git'
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>({ text: '', tone: 'hint' });
  const [id, setId] = useState({ name: '', email: '' });

  // Put your real client IDs here or inject via env/config IPC
  const GITHUB_CLIENT_ID = 'Ov23li1TTgR1Gd0z6Kz0';
  const BITBUCKET_CLIENT_ID = 'YOUR_BITBUCKET_CLIENT_ID';

  const ghHost = useMemo(() => remote?.host === 'github.com', [remote]);
  const bbHost = useMemo(() => remote?.host === 'bitbucket.org', [remote]);

  useEffect(() => {
    (async () => {
      try {
        window.authAPI
          .getIdentity()
          .then(setId)
          .catch((err) => console.error(err));
        const r = await window.authAPI.detectRemote();
        setRemote(r);
        // Probe if we already have a token saved (OAuth)
        const defaultAccount = r.host === 'github.com' ? 'git' : '';
        if (!account) setAccount(defaultAccount);
        const rec = await window.authAPI.load(r.host, defaultAccount);
        setConnected(!!rec);
        setMsg({
          text: rec ? 'Already signed in for this host.' : 'Not signed in yet.',
          tone: rec ? 'ok' : 'hint',
        });
      } catch {
        setMsg({
          text: 'Open a repository first. Remote not detected.',
          tone: 'err',
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (id.name !== '' && id.email !== '') {
      window.authAPI.setIdentity(id.name, id.email);
    }
  }, [id]);

  async function signInGithub() {
    if (!remote) return;
    try {
      setBusy(true);
      console.log(window.authAPI);
      await window.authAPI.oauthGithub(GITHUB_CLIENT_ID, 'git');
      setConnected(true);
      setMsg({ text: 'GitHub OAuth success.', tone: 'ok' });
    } catch (e: any) {
      setMsg({ text: `GitHub OAuth failed: ${e?.message || e}`, tone: 'err' });
    } finally {
      setBusy(false);
    }
  }

  async function signInBitbucket() {
    if (!remote) return;
    if (!account)
      return setMsg({ text: 'Enter your Bitbucket username.', tone: 'err' });
    try {
      setBusy(true);
      await window.authAPI.oauthBitbucket(BITBUCKET_CLIENT_ID, account);
      setConnected(true);
      setMsg({ text: 'Bitbucket OAuth success.', tone: 'ok' });
    } catch (e: any) {
      setMsg({
        text: `Bitbucket OAuth failed: ${e?.message || e}`,
        tone: 'err',
      });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!remote) return;
    try {
      setBusy(true);
      const acc = ghHost ? 'git' : account || '';
      if (!acc)
        return setMsg({
          text: 'No account selected to disconnect.',
          tone: 'err',
        });
      await window.authAPI.del(remote.host, acc);
      setConnected(false);
      setMsg({ text: 'Signed out (local token removed).', tone: 'ok' });
    } catch (e: any) {
      setMsg({
        text: `Failed to remove token: ${e?.message || e}`,
        tone: 'err',
      });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!remote) return;
    try {
      setBusy(true);
      const acc = ghHost ? 'git' : account || '';
      if (!acc)
        return setMsg({ text: 'Enter your account first.', tone: 'err' });
      const r = await window.authAPI.test(remote.host, acc);
      setMsg(
        r.ok
          ? { text: '✅ Connection OK (ls-remote).', tone: 'ok' }
          : { text: `❌ ${r.error || 'Auth failed'}`, tone: 'err' },
      );
    } finally {
      setBusy(false);
    }
  }
  const navigate = useNavigate();
  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 16,
        maxWidth: 760,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: '8px 0 16px' }}>Remote Authentication (OAuth)</h2>
        <button
          style={{ padding: 2, fontSize: '0.9rem', backgroundColor: 'red' }}
          onClick={() => {
            navigate('/');
          }}
        >
          close
        </button>
      </div>

      <section style={box}>
        <legend style={legend}>Remote</legend>
        <div style={grid2}>
          <div>
            <label style={label}>Detected Host</label>
            <input
              style={input}
              readOnly
              value={remote?.host ?? ''}
              placeholder="github.com / bitbucket.org"
            />
          </div>
          <div>
            <label style={label}>Detected URL</label>
            <input
              style={input}
              readOnly
              value={remote?.url ?? ''}
              placeholder="https://host/owner/repo.git"
            />
          </div>
        </div>
        <p style={hint}>
          SSH remotes are normalized to HTTPS for isomorphic-git. Only OAuth is
          used (no PAT/app password).
        </p>
        <div style={grid2}>
          <div>
            <label style={label}>Name</label>
            <input
              style={input}
              value={id.name ?? ''}
              on
              onChange={(e) => {
                setId({ ...id, name: e.target.value });
              }}
              placeholder="name"
            />
          </div>
          <div>
            <label style={label}>Email</label>
            <input
              style={input}
              value={id.email ?? ''}
              onChange={(e) => {
                setId({ ...id, email: e.target.value });
              }}
              placeholder="email"
            />
          </div>
        </div>
      </section>

      <section style={box}>
        <legend style={legend}>Sign-in</legend>

        {bbHost && (
          <>
            <label style={label}>Bitbucket Username</label>
            <input
              style={input}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="your-bitbucket-username"
            />
          </>
        )}

        <div style={{ ...grid2, marginTop: 10 }}>
          <button
            style={btn}
            disabled={busy || !remote || !ghHost}
            onClick={signInGithub}
            title="Sign in with GitHub"
          >
            Sign in with GitHub
          </button>
          <button
            style={btn}
            disabled={busy || !remote || !bbHost}
            onClick={signInBitbucket}
            title="Sign in with Bitbucket"
          >
            Sign in with Bitbucket
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button style={btn} disabled={busy || !remote} onClick={test}>
            Test Connection
          </button>
          <button
            style={btn}
            disabled={busy || !remote || !connected}
            onClick={disconnect}
          >
            Sign out
          </button>
          <span
            style={{
              ...hintStyle(connected ? 'ok' : 'hint'),
              alignSelf: 'center',
            }}
          >
            {connected
              ? 'Connected (token stored securely).'
              : 'Not connected.'}
          </span>
        </div>

        <p style={{ ...hint, marginTop: 8 }}>
          <b>GitHub:</b> uses OAuth (PKCE). Username is fixed to{' '}
          <code>git</code> under the hood.
          <br />
          <b>Bitbucket Cloud:</b> uses OAuth (PKCE). Enter your Bitbucket
          username above.
        </p>

        <div style={{ ...hintStyle(msg.tone), marginTop: 8 }}>{msg.text}</div>
      </section>
    </div>
  );
}

// inline styles
const box: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
};
const legend: React.CSSProperties = { fontWeight: 600, marginBottom: 8 };
const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
};
const label: React.CSSProperties = {
  display: 'block',
  margin: '6px 0 4px',
  fontSize: 12,
  color: '#444',
};
const input: React.CSSProperties = {
  padding: 8,
  border: '1px solid #ccc',
  borderRadius: 6,
  width: '100%',
};
const btn: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #bbb',
  borderRadius: 6,
  cursor: 'pointer',
};
const hint: React.CSSProperties = { fontSize: 12, color: '#666', marginTop: 6 };
const hintStyle = (tone: 'ok' | 'err' | 'hint'): React.CSSProperties =>
  tone === 'ok'
    ? { color: '#0a0', fontSize: 12 }
    : tone === 'err'
      ? { color: '#a00', fontSize: 12 }
      : { color: '#666', fontSize: 12 };
