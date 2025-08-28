/* eslint-disable no-alert */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
// ContextMenu.tsx
import { useEffect } from 'react';
import './ContextMenu.css';
import toast from 'react-hot-toast';
import { useGit } from '../../ContextManager/GitContext';

export default function ContextMenu({
  x,
  y,
  uri,
  onClose,
}: {
  x: number;
  y: number;
  uri: string;
  onClose: () => void;
}) {
  const {
    handleAddBranch,
    handlePull,
    handlePush,
    setSelectedBranch,
    handleDeleteBranch,
  } = useGit();
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  const branch = uri.replace(/^\/(branches|remote)\//, '');

  const handleAction = async (action: string) => {
    switch (action) {
      case 'Checkout':
        setSelectedBranch(branch);
        break;
      case 'Fast-Forward':
        // window.electron.ipcRenderer.invoke('fast-forward', branch);
        toast.error('Coming soon!');
        break;
      case 'Pull':
        handlePull();
        break;
      case 'Push':
        handlePush();
        break;
      case 'Create PR':
        toast('Coming soon!');
        // window.electron.ipcRenderer.invoke('create-pr', branch);
        break;
      case 'New Branch':
        handleAddBranch();
        // window.electron.ipcRenderer.invoke('new-branch', branch);
        break;
      case 'Rename':
        toast('Coming soon!');
        // window.electron.ipcRenderer.invoke('rename', branch);
        break;
      case 'Delete':
        handleDeleteBranch(branch, uri.includes('remote'));
        break;
      default:
        break;
    }
    onClose();
  };

  return (
    <div className="context-menu" style={{ top: y, left: x }}>
      <div onClick={() => handleAction('Checkout')}>Checkout '{branch}'</div>
      <div onClick={() => handleAction('Fast-Forward')}>
        Fast-Forward to 'origin/{branch}'
      </div>
      <div onClick={() => handleAction('Pull')}>Pull 'origin/{branch}'</div>
      <div onClick={() => handleAction('Push')}>
        Push '{branch}' to 'origin'
      </div>
      <div onClick={() => handleAction('Create PR')}>
        Create Pull Request on 'origin/{branch}'
      </div>
      <hr />
      <div onClick={() => handleAction('New Branch')}>New Branch...</div>
      <hr />
      <div onClick={() => handleAction('Rename')}>Rename '{branch}'</div>
      <div onClick={() => handleAction('Delete')}>Delete '{branch}'</div>
      <hr />
      <div
        onClick={() => {
          navigator.clipboard.writeText(branch);
          onClose();
        }}
      >
        Copy Branch Name
      </div>
    </div>
  );
}
