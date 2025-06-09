/* eslint-disable react/no-unescaped-entities */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
// ContextMenu.tsx
import { useEffect } from 'react';
import './ContextMenu.css'; // Optional: for styling

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
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  const branch = uri.replace(/^\/(branches|remote)\//, '');

  const handleAction = (action: string) => {
    console.log(`${action} on ${uri}`);
    // Here you'd call ipcRenderer or your internal API
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
      <div onClick={() => handleAction('New Tag')}>New Tag...</div>
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
