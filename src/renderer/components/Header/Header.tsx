import './Header.css';
import { GoGitBranch } from 'react-icons/go';

export default function Header() {
  return (
    <div className="Header">
      <div className="repository">OpenGit</div>
      <div>
        <span>
          <GoGitBranch />
        </span>
        <span className="branch">main</span>
      </div>
    </div>
  );
}
