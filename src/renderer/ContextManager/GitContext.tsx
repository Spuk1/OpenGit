/* eslint-disable react/jsx-no-constructed-context-values */
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';

type GitContextType = {
  selectedRepository: string;
  setSelectedRepository: (branch: string) => void;
  repositories: string[];
  addRepository: (branch: string) => void;
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
};

const GitContext = createContext<GitContextType | undefined>(undefined);

export function GitProvider({ children }: { children: ReactNode }) {
  const [selectedRepository, setSelectedRepository] = useState('');
  const [repositories, setRepositories] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');

  function getSelectedRepository() {
    const repository = localStorage.getItem('selectedRepository');
    if (repository) {
      setSelectedRepository(repository);
    }
    const repos = localStorage.getItem('repositories');
    if (repos) {
      setRepositories(JSON.parse(repos));
    }
  }

  useEffect(() => {
    getSelectedRepository();
  }, []);

  useEffect(() => {
    async function syncRepository() {
      await window.electron.ipcRenderer.invoke(
        'set-selected-repository',
        selectedRepository,
      );
    }
    syncRepository();
    localStorage.setItem('selectedRepository', selectedRepository);
  }, [selectedRepository]);

  function addRepository(repo: string) {
    if (repositories.includes(repo)) return;
    const newRepos = [...repositories, repo];
    setRepositories(newRepos);
    localStorage.setItem('repositories', JSON.stringify(newRepos));
  }

  useEffect(() => {
    localStorage.setItem('selectedBranch', selectedBranch);
  }, [selectedBranch]);

  return (
    <GitContext.Provider
      value={{
        selectedRepository,
        setSelectedRepository,
        repositories,
        addRepository,
        selectedBranch,
        setSelectedBranch,
      }}
    >
      {children}
    </GitContext.Provider>
  );
}

export const useGit = () => {
  const context = useContext(GitContext);
  if (!context) throw new Error('useGit must be used within a GitProvider');
  return context;
};
