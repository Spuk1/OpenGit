/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { useEffect, useState } from 'react';
import './CommitPanel.css';
import MonacoEditor, { monaco } from 'react-monaco-editor';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import toast from 'react-hot-toast';
import { GitAction, useGit } from '../../ContextManager/GitContext';

export default function CommitPanel() {
  const [staged, setStaged] = useState<string[]>([]);
  const [selectedUnstaged, setSelectedUnstaged] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<string>('');
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const {
    selectedRepository,
    selectedBranch,
    setAction,
    unstaged,
    setUnstaged,
    action,
  } = useGit();

  const loadChanges = async () => {
    try {
      const unstagedFiles: string[] =
        await window.electron.ipcRenderer.invoke('list-changes');
      const stagedFiles: string[] =
        await window.electron.ipcRenderer.invoke('list-staged');
      setUnstaged(unstagedFiles);
      setStaged(stagedFiles);
      if (selectedUnstaged) {
        // eslint-disable-next-line no-use-before-define
        loadDiff(selectedUnstaged);
      }
    } catch (err) {
      toast.error('Failed to load changes');
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
      toast.error('Failed to stage lines');
    }
  };

  const stageFile = async (file: string) => {
    try {
      await window.electron.ipcRenderer.invoke('stage-file', file);
      setSelectedLines(new Set());
      await loadChanges();
    } catch (err) {
      toast.error('Failed to stage file');
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
      toast.error('Failed to discard lines');
    }
  };

  const unstageFile = async (file: string) => {
    try {
      await window.electron.ipcRenderer.invoke('unstage-file', file);
      await loadChanges();
    } catch (err) {
      toast.error('Failed to unstage file');
    }
  };

  const discardFile = async (file: string) => {
    confirmAlert({
      title: 'Confirm to discard',
      message: 'This will delete all changes to this file.',
      buttons: [
        {
          label: 'Yes',
          onClick: async () => {
            try {
              await window.electron.ipcRenderer.invoke('discard-file', file);
              await loadChanges();
            } catch (err) {
              toast.error(`Failed to discard file ${err}`);
            }
          },
        },
        {
          label: 'No',
          onClick: () => {},
        },
      ],
    });
  };

  const handleCommit = async () => {
    if (!commitMessage) return;
    setAction(GitAction.Commit);
    try {
      await window.electron.ipcRenderer.invoke('commit', commitMessage);
      setCommitMessage('');
      setAction(GitAction.None);
      if (unstaged.length === 0) {
        setSelectedUnstaged(null);
      }
      await loadChanges();
    } catch (err) {
      toast.error('Failed to commit');
    }
  };

  const loadDiff = async (file: string) => {
    try {
      setDiffText('');
      const result = await window.electron.ipcRenderer.invoke('get-diff', {
        filepath: file,
      });
      setDiffText(result.patch);
    } catch (err) {
      toast.error('Failed to get diff');
    }
  };

  useEffect(() => {
    loadChanges();
  }, [selectedBranch, selectedRepository, action]);

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
                lineNumbers: 'off',
                glyphMargin: false,
                detectIndentation: true,
                minimap: { enabled: false },
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
          disabled={!commitMessage || staged.length === 0}
        >
          Commit
        </button>
      </div>
    </div>
  );
}
