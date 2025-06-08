import { GoGitBranch } from 'react-icons/go';
import { useGit } from '../../ContextManager/GitContext';

import './Header.css';

export default function Header() {
  const { selectedRepository, selectedBranch } = useGit();

  function getRepoName(): string {
    const arr = selectedRepository.split('/');
    return arr[arr.length - 1];
  }

  function getBranch(): string {
    const arr = selectedBranch.split('/');
    return arr[arr.length - 1];
  }

  return (
    <div className="Header">
      <div className="repository">{getRepoName()}</div>
      <div>
        <span>
          <GoGitBranch />
        </span>
        <span className="branch">{getBranch()}</span>
      </div>
    </div>
  );
}
