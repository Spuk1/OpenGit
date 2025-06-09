import { GoGitBranch } from 'react-icons/go';
import { useGit } from '../../ContextManager/GitContext';

import './Header.css';

export default function Header() {
  const { selectedRepository, selectedBranch, action } = useGit();

  function getBranch(): string {
    const arr = selectedBranch.split('/');
    return arr[arr.length - 1];
  }

  return (
    <div className="Header">
      <div className="repository">{selectedRepository.name}</div>
      <div>
        <span>
          <GoGitBranch />
        </span>
        <span className="branch">{action || getBranch()}</span>
      </div>
    </div>
  );
}
