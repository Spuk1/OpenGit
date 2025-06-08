import { useState, useEffect } from 'react';
import './CommitPanel.css';
import { useGit } from '../../ContextManager/GitContext';

export default function CommitPanel() {
  const [changes, setChanges] = useState<string[]>([]);
  const [staged, setStaged] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const { selectedBranch, selectedRepository } = useGit();

  const loadChanges = async () => {
    try {
      const files: string[] =
        await window.electron.ipcRenderer.invoke('list-changes');
      setChanges(files);
    } catch (err) {
      console.error('Failed to load changes', err);
    }
  };

  const toggleStage = async (file: string) => {
    try {
      const isStaged = staged.includes(file);
      if (isStaged) {
        await window.electron.ipcRenderer.invoke('unstage-file', file);
        setStaged(staged.filter((f) => f !== file));
      } else {
        await window.electron.ipcRenderer.invoke('stage-file', file);
        setStaged([...staged, file]);
      }
    } catch (err) {
      console.error('Failed to stage/unstage file', err);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    try {
      await window.electron.ipcRenderer.invoke('commit', commitMessage.trim());
      setCommitMessage('');
      setStaged([]);
      await loadChanges();
    } catch (err) {
      console.error('Failed to commit', err);
    }
  };

  useEffect(() => {
    loadChanges();
  }, [selectedBranch, selectedRepository]);

  return (
    <div className="CommitPanel">
      <h3>Changes</h3>
      <ul className="ChangeList">
        {changes.map((file) => (
          <li key={file}>
            <p>
              <input
                type="checkbox"
                checked={staged.includes(file)}
                onChange={() => toggleStage(file)}
              />
              {file}
            </p>
          </li>
        ))}
      </ul>
      <textarea
        placeholder="Commit message"
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
      />
      <button
        type="button"
        onClick={handleCommit}
        disabled={!commitMessage.trim() || staged.length === 0}
      >
        Commit
      </button>
    </div>
  );
}
