/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { useEffect, useState } from 'react';
import './CommitPanel.css';
import { useGit } from '../../ContextManager/GitContext';

export default function CommitPanel() {
  const [staged, setStaged] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const { selectedRepository, selectedBranch, setUnstaged, unstaged } =
    useGit();

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

  const stageFile = async (file: string) => {
    try {
      await window.electron.ipcRenderer.invoke('stage-file', file);
      await loadChanges();
    } catch (err) {
      console.error('Failed to stage file', err);
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

  useEffect(() => {
    loadChanges();

    const onFocus = () => {
      loadChanges();
    };

    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
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
          <h3>Unstaged</h3>
          <ul className="ChangeList">
            {unstaged.map((file) => (
              <li
                key={file}
                onClick={() => stageFile(file)}
                className="ChangeItem"
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
                onClick={() => unstageFile(file)}
                className="ChangeItem"
              >
                {file}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="CommitBox">
        <textarea
          placeholder="Commit message"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
        />
        {
          // eslint-disable-next-line react/button-has-type
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || staged.length === 0}
          >
            Commit
          </button>
        }
      </div>
    </div>
  );
}
