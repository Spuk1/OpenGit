/* eslint-disable no-continue */
// renderer/components/CommitHistory.tsx
import React, { JSX, useEffect, useMemo, useState } from 'react';

const COL_W = 6; // lane column width (px)
const ROW_H = 36; // row height (px)
const PAD_X = 15; // left padding inside the SVG (px)
const DOT_R = 4; // node radius
// ——— styles ———
const card: React.CSSProperties = {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  fontSize: 14,
  border: '1px solid #e0e0e0',
  borderRadius: 10,
  overflow: 'hidden',
  height: '90vh',
};
const header: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 700,
  borderBottom: '1px solid #eee',
};
const scroller: React.CSSProperties = {
  overflowY: 'auto', // vertical scroll
  height: '100%',
};
const rowWrap: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr', // graph width + text
  height: ROW_H, // EXACTLY match ROW_H
};
const graphCell: React.CSSProperties = {
  borderRight: '1px solid #eee',
  display: 'flex',
  alignItems: 'center', // centers SVG vertically → dot at center
};
const textCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '0 10px',
  minWidth: 0, // allow subject ellipsis
};
const topLine: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  minWidth: 0,
};
const sha: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 12,
  background: '#eef2ff',
  color: '#3b5bcc',
  padding: '0 6px',
  borderRadius: 6,
  flex: '0 0 auto',
};
const subjectStyle: React.CSSProperties = {
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const metaLine: React.CSSProperties = {
  color: '#5f6368',
  fontSize: 12,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
};
const dotSep: React.CSSProperties = { opacity: 0.6 };
const pad: React.CSSProperties = { padding: 16 };

type LogEntry = {
  oid: string;
  commit: {
    message: string;
    parent?: string[];
    author: {
      name: string;
      email: string;
      timestamp: number;
      timezoneOffset?: number;
    };
  };
};

type RowLayout = {
  index: number;
  nodeLane: number;
  lanesBefore: string[];
  lanesAfter: string[];
  commit: LogEntry;
};

function xFor(lane: number) {
  return PAD_X + lane * COL_W * 3;
}
function subject(msg: string) {
  const nl = msg.indexOf('\n');
  return (nl === -1 ? msg : msg.slice(0, nl)).trim();
}
function short(oid: string) {
  return oid.slice(0, 7);
}
function fmtWhen(sec: number) {
  return new Date(sec * 1000).toLocaleString();
}

/** Lane layout (classic active-lane algorithm) */
function layoutLanes(commits: LogEntry[]): RowLayout[] {
  const rows: RowLayout[] = [];
  const active: string[] = [];

  commits.forEach((c, idx) => {
    const parents = c.commit.parent ?? [];
    const before = active.slice();

    let nodeLane = active.indexOf(c.oid);
    if (nodeLane === -1) {
      nodeLane = 0; // new branch appears on the left
      active.splice(nodeLane, 0, c.oid);
    }

    if (parents.length > 0) {
      const [firstParent] = parents;
      active[nodeLane] = firstParent;
    } else {
      active.splice(nodeLane, 1);
    }
    for (let i = 1; i < parents.length; i += 1) {
      active.splice(nodeLane + i, 0, parents[i]);
    }

    const after = active.slice();
    rows.push({
      index: idx,
      nodeLane,
      lanesBefore: before,
      lanesAfter: after,
      commit: c,
    });
  });

  return rows;
}

function RowGraph({
  row,
  indexByOid,
}: {
  row: RowLayout;
  indexByOid: Map<string, number>;
}) {
  const yTop = 0;
  const yMid = ROW_H / 2;
  const yBot = ROW_H;

  const maxCols = Math.max(row.lanesBefore.length, row.lanesAfter.length);
  const svgW = PAD_X * 2 + maxCols * COL_W;

  const segs: JSX.Element[] = [];

  // CONTINUATIONS: only if this lane's oid occurs in a later row
  for (let j = 0; j < maxCols; j += 1) {
    const idBefore = row.lanesBefore[j];
    const idAfter = row.lanesAfter[j];
    if (!idBefore || !idAfter) continue;
    if (idBefore !== idAfter) continue;

    const nextIdx = indexByOid.get(idBefore);
    if (nextIdx === undefined || nextIdx <= row.index) continue; // 👈 no future dot → no rail

    const x = xFor(j);

    if (j !== row.nodeLane) {
      segs.push(
        <line
          key={`v-${j}`}
          x1={x}
          y1={yTop}
          x2={x}
          y2={yBot}
          stroke="#9aa0a6"
          strokeWidth={1.5}
        />,
      );
    } else if (idBefore === row.commit.oid) {
      // node lane: draw top-half so the column flows into the dot
      segs.push(
        <line
          key="v-node-top"
          x1={x}
          y1={yTop}
          x2={x}
          y2={yMid}
          stroke="#9aa0a6"
          strokeWidth={1.5}
        />,
      );
    }
  }

  // EDGES: from this dot to its parents (mid → bottom)
  const parents = row.commit.commit.parent ?? [];
  parents.forEach((p) => {
    const tgt = row.lanesAfter.indexOf(p);
    if (tgt === -1) return;
    const x0 = xFor(row.nodeLane);
    const x1 = xFor(tgt);
    if (x0 === x1) {
      segs.push(
        <line
          key={`p${p}`}
          x1={x0}
          y1={yMid}
          x2={x1}
          y2={yBot}
          stroke="#5f6368"
          strokeWidth={2}
        />,
      );
    } else {
      const cY = (yMid + yBot) / 2;
      segs.push(
        <path
          key={`p${p}`}
          d={`M ${x0} ${yMid} C ${x0} ${cY}, ${x1} ${cY}, ${x1} ${yBot}`}
          stroke="#5f6368"
          strokeWidth={2}
          fill="none"
        />,
      );
    }
  });

  // DOT
  const xNode = xFor(row.nodeLane);
  segs.push(
    <circle
      key="dot"
      cx={xNode}
      cy={yMid}
      r={DOT_R}
      fill="#1a73e8"
      stroke="#0b57d0"
      strokeWidth={1}
    />,
  );

  return (
    <svg
      width={svgW}
      height={ROW_H}
      style={{ display: 'block', flex: '0 0 auto' }}
    >
      {segs}
    </svg>
  );
}

export default function Commits() {
  const [commits, setCommits] = useState<LogEntry[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const rows = useMemo(() => layoutLanes(commits), [commits]);
  const indexByOid = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.commit.oid, r.index));
    return m;
  }, [rows]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await window.electron.ipcRenderer.invoke('get-commit-log');
        setCommits(data);
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={pad}>Loading commit history…</div>;
  if (err) return <div style={{ ...pad, color: '#a00' }}>Error: {err}</div>;
  if (!rows.length) return <div style={pad}>No commits.</div>;

  // compute max lanes once for consistent row graph width
  const maxCols = Math.max(
    ...rows.map((r) => Math.max(r.lanesBefore.length, r.lanesAfter.length)),
  );
  const graphWidth = PAD_X * 2 + maxCols * COL_W;

  return (
    <div style={card}>
      <div style={header}>Commit history</div>
      <div style={scroller}>
        {rows.map((r) => {
          const c = r.commit;
          const a = c.commit.author;
          return (
            <div key={c.oid} style={rowWrap}>
              {/* graph cell */}
              <div style={{ ...graphCell, width: graphWidth }}>
                <RowGraph row={r} indexByOid={indexByOid} />
              </div>

              {/* text cell */}
              <div style={textCell}>
                <div style={topLine}>
                  <code style={sha}>{short(c.oid)}</code>
                  <span style={subjectStyle} title={c.commit.message}>
                    {subject(c.commit.message)}
                  </span>
                </div>
                <div style={metaLine}>
                  <span>{a.name}</span>
                  <span style={dotSep}>•</span>
                  <span title={new Date(a.timestamp * 1000).toISOString()}>
                    {fmtWhen(a.timestamp)}
                  </span>
                  {c.commit.parent?.length ? (
                    <>
                      <span style={dotSep}>•</span>
                      <span title={c.commit.parent.join(', ')}>
                        {c.commit.parent.length} parent
                        {c.commit.parent.length > 1 ? 's' : ''}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
