/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { useEffect, useState } from 'react';
import './CommitPanel.css';
import MonacoEditor, { monaco } from 'react-monaco-editor';
import { useGit } from '../../ContextManager/GitContext';

export default function CommitPanel() {
  const [staged, setStaged] = useState<string[]>([]);
  const [unstaged, setUnstaged] = useState<string[]>([]);
  const [selectedUnstaged, setSelectedUnstaged] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<string>('');
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const { selectedRepository, selectedBranch } = useGit();

  const loadChanges = async () => {
    try {
      const unstagedFiles: string[] =
        await window.electron.ipcRenderer.invoke('list-changes');
      const stagedFiles: string[] =
        await window.electron.ipcRenderer.invoke('list-staged');
      setUnstaged(unstagedFiles);
      setStaged(stagedFiles);
    } catch (err) {
      console.error('Failed to load changes', err);
    }
  };

  const stageSelectedLines = async () => {
    if (!selectedUnstaged || selectedLines.size === 0) return;
    try {
      await window.electron.ipcRenderer.invoke(
        'stage-lines',
        selectedUnstaged,
        Array.from(selectedLines),
      );
      setSelectedUnstaged(null);
      setDiffText('');
      setSelectedLines(new Set());
      await loadChanges();
    } catch (err) {
      console.error('Failed to stage lines', err);
    }
  };

  const stageFile = async (file: string) => {
    try {
      await window.electron.ipcRenderer.invoke('stage-file', file);
      setSelectedLines(new Set());
      await loadChanges();
    } catch (err) {
      console.error('Failed to stage file', err);
    }
  };

  const discardSelectedLines = async () => {
    if (!selectedUnstaged || selectedLines.size === 0) return;
    try {
      await window.electron.ipcRenderer.invoke(
        'discard-lines',
        selectedUnstaged,
        Array.from(selectedLines),
      );
      setSelectedUnstaged(null);
      setDiffText('');
      setSelectedLines(new Set());
      await loadChanges();
    } catch (err) {
      console.error('Failed to discard lines', err);
    }
  };

  const unstageFile = async (file: string) => {
    try {
      await window.electron.ipcRenderer.invoke('unstage-file', file);
      await loadChanges();
    } catch (err) {
      console.error('Failed to unstage file', err);
    }
  };

  const discardFile = async (file: string) => {
    if (!window.confirm(`Discard all changes in ${file}?`)) return;
    try {
      await window.electron.ipcRenderer.invoke('discard-file', file);
      await loadChanges();
    } catch (err) {
      console.error('Failed to discard file', err);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    try {
      await window.electron.ipcRenderer.invoke('commit', commitMessage.trim());
      setCommitMessage('');
      await loadChanges();
    } catch (err) {
      console.error('Failed to commit', err);
    }
  };

  const loadDiff = async (file: string) => {
    try {
      setDiffText('');
      const result = await window.electron.ipcRenderer.invoke('get-diff', file);
      setDiffText(result);
    } catch (err) {
      console.error('Failed to get diff', err);
    }
  };

  useEffect(() => {
    loadChanges();
    const onFocus = () => loadChanges();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      loadChanges();
    }, 100);
  }, [selectedBranch, selectedRepository]);

  return (
    <div className="CommitPanel">
      <div className="ChangesSection">
        <div className="ChangesGroup">
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <h3>Unstaged</h3>
            <span>
              <button
                type="button"
                style={{
                  padding: 0,
                  paddingLeft: 5,
                  paddingRight: 5,
                  fontSize: '0.9rem',
                }}
                disabled={selectedUnstaged == null}
                onClick={() => {
                  stageFile(selectedUnstaged!);
                }}
              >
                stage
              </button>
            </span>
          </div>
          <ul className="ChangeList">
            {unstaged.map((file) => (
              <li
                key={file}
                onKeyDown={() => {}}
                onClick={() => {
                  setSelectedUnstaged(file);
                  loadDiff(file);
                }}
                onDoubleClick={() => stageFile(file)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  discardFile(file);
                }}
                className={`ChangeItem ${selectedUnstaged === file ? 'selected' : ''}`}
              >
                {file}
              </li>
            ))}
          </ul>
        </div>
        <div className="ChangesGroup">
          <h3>Staged</h3>
          <ul className="ChangeList">
            {staged.map((file) => (
              <li
                key={file}
                onKeyDown={() => {}}
                onDoubleClick={() => unstageFile(file)}
                onClick={() => {
                  setSelectedUnstaged(file);
                  loadDiff(file);
                }}
                className={`ChangeItem ${selectedUnstaged === file ? 'selected' : ''}`}
              >
                {file}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="DiffSection">
        {selectedUnstaged && diffText && (
          <div className="DiffViewer">
            <MonacoEditor
              height="400"
              theme="vs-dark"
              language="diff"
              value={diffText}
              options={{
                readOnly: true,
                lineNumbers: 'on',
                glyphMargin: false,
                detectIndentation: true,
                fontSize: 10,
              }}
              editorDidMount={(editor) => {
                const decorations: monaco.editor.IModelDeltaDecoration[] = [];
                const lines = diffText.split('\n');
                lines.forEach((line, index) => {
                  if (line.startsWith('+')) {
                    decorations.push({
                      range: new monaco.Range(index + 1, 1, index + 1, 1),
                      options: { isWholeLine: true, className: 'line-added' },
                    });
                  } else if (line.startsWith('-')) {
                    decorations.push({
                      range: new monaco.Range(index + 1, 1, index + 1, 1),
                      options: { isWholeLine: true, className: 'line-removed' },
                    });
                  }
                });
                editor.createDecorationsCollection(decorations);
                // editor.onMouseDown((e) => {
                //   const lineNumber = e.target.position?.lineNumber;
                //   if (lineNumber) {
                //     setSelectedLines((prev) => {
                //       const newSet = new Set(prev);
                //       if (newSet.has(lineNumber)) newSet.delete(lineNumber);
                //       else newSet.add(lineNumber);
                //       console.log(newSet);
                //       return newSet;
                //     });
                //   }
                // });
                // editor.onContextMenu((e) => {
                //   const lineNumber = e.target.position?.lineNumber;
                //   if (lineNumber && selectedUnstaged) {
                //     const action = window.confirm('Discard selected lines?')
                //       ? discardSelectedLines
                //       : () => {};
                //     action();
                //   }
                // });
              }}
            />
          </div>
        )}
      </div>
      <div className="CommitBox">
        <textarea
          placeholder="Commit message"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
        />
        <button
          type="button"
          onKeyDown={() => {}}
          tabIndex={0}
          onClick={handleCommit}
          disabled={!commitMessage.trim() || staged.length === 0}
        >
          Commit
        </button>
      </div>
    </div>
  );
}
