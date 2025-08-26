/* eslint-disable no-void */
// renderer/components/AuthPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';

type RemoteInfo = { host: string; url: string };

export default function AuthPanel() {
  const [remote, setRemote] = useState<RemoteInfo | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [account, setAccount] = useState('');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' | 'hint' }>(
    { text: '', tone: 'hint' },
  );

  const gh = useMemo(() => remote?.host === 'github.com', [remote]);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.authAPI.detectRemote();
        setRemote(r);
        const list = await window.authAPI.listAccounts(r.host);
        setAccounts(list);
        if (r.host === 'github.com' && !account) setAccount('git'); // GH: username placeholder
      } catch {
        setMsg({
          text: 'Open a repository first. Remote not detected.',
          tone: 'err',
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSaved() {
    if (!remote?.host || !account)
      return setMsg({ text: 'Host and account required.', tone: 'err' });
    const tok = (await window.authAPI.load(remote.host, account)) ?? '';
    setToken(tok);
    setMsg({
      text: tok ? 'Loaded token.' : 'No token saved for this account.',
      tone: tok ? 'ok' : 'hint',
    });
  }

  async function save() {
    if (!remote?.host || !account || !token)
      return setMsg({
        text: 'Host, account, and token required.',
        tone: 'err',
      });
    await window.authAPI.save(remote.host, account, token);
    setAccounts(await window.authAPI.listAccounts(remote.host));
    setMsg({ text: 'Saved.', tone: 'ok' });
  }

  async function del() {
    if (!remote?.host || !account)
      return setMsg({ text: 'Host and account required.', tone: 'err' });
    await window.authAPI.del(remote.host, account);
    setToken('');
    setAccounts(await window.authAPI.listAccounts(remote.host));
    setMsg({ text: 'Deleted.', tone: 'ok' });
  }

  async function test() {
    if (!remote?.host || !account)
      return setMsg({ text: 'Host and account required.', tone: 'err' });
    const r = await window.authAPI.test(remote.host, account);
    setMsg(
      r.ok
        ? { text: '✅ Connection OK (ls-remote succeeded).', tone: 'ok' }
        : { text: `❌ ${r.error ?? 'Auth failed'}`, tone: 'err' },
    );
  }

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 16,
        maxWidth: 760,
        margin: '0 auto',
      }}
    >
      <h2 style={{ margin: '8px 0 16px' }}>Remote Authentication</h2>

      <section style={box}>
        <legend style={legend}>Remote</legend>
        <div style={grid2}>
          <div>
            <label style={label}>Detected Host</label>
            <input
              style={input}
              readOnly
              value={remote?.host ?? ''}
              placeholder="github.com"
            />
          </div>
          <div>
            <label style={label}>Detected URL</label>
            <input
              style={input}
              readOnly
              value={remote?.url ?? ''}
              placeholder="https://github.com/owner/repo.git"
            />
          </div>
        </div>
        <p style={hint}>
          SSH remotes are normalized to HTTPS for isomorphic-git.
        </p>
      </section>

      <section style={box}>
        <legend style={legend}>Credentials</legend>
        <div style={grid2}>
          <div>
            <label style={label}>
              Account{' '}
              {gh ? '(GitHub: use "git")' : '(Bitbucket: your username)'}
            </label>
            <input
              style={input}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={gh ? 'git' : 'your-username'}
            />
          </div>
          <div>
            <label style={label}>Saved Accounts on Host</label>
            <select
              style={input}
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                setAccount(val);
                void (async () => {
                  const tok =
                    (await window.authAPI.load(remote!.host, val)) ?? '';
                  setToken(tok);
                  setMsg({
                    text: tok
                      ? 'Loaded token.'
                      : 'No token saved for this account.',
                    tone: tok ? 'ok' : 'hint',
                  });
                })();
              }}
            >
              <option value="">(none)</option>
              {accounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label style={label}>Token / App Password</label>
        <textarea
          style={{ ...input, height: 96, resize: 'vertical' as const }}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your PAT / App Password"
        />

        <div style={{ ...grid2, marginTop: 10 }}>
          <button style={btn} onClick={loadSaved}>
            Load
          </button>
          <button style={btn} onClick={save}>
            Save
          </button>
        </div>
        <div style={{ ...grid2, marginTop: 10 }}>
          <button style={btn} onClick={del}>
            Delete
          </button>
          <button style={btn} onClick={test}>
            Test Connection
          </button>
        </div>

        <div style={{ ...hintStyle(msg.tone), marginTop: 8 }}>{msg.text}</div>

        <p style={hint}>
          <b>GitHub</b>: Fine-grained PAT with repo read/write. Username can be{' '}
          <code>git</code>, password = token.
          <br />
          <b>Bitbucket Cloud</b>: App Password. Username = your Bitbucket
          username, password = app password.
        </p>
      </section>
    </div>
  );
}

// inline styles (no CSS deps)
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
  background: '#f8f8f8',
  cursor: 'pointer',
};
const hint: React.CSSProperties = { fontSize: 12, color: '#666', marginTop: 6 };
const hintStyle = (tone: 'ok' | 'err' | 'hint'): React.CSSProperties =>
  tone === 'ok'
    ? { color: '#0a0', fontSize: 12 }
    : tone === 'err'
      ? { color: '#a00', fontSize: 12 }
      : { color: '#666', fontSize: 12 };
