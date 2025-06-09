/* eslint-disable react/jsx-no-constructed-context-values */
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';

export enum GitAction {
  Commit = 'comitting',
  Push = 'pushing',
  Pull = 'pulling',
  Fetch = 'fetching',
  Stash = 'stashing',
  None = 0,
}

export type Repository = {
  name: string;
  path: string;
  branch: string;
};

type GitContextType = {
  selectedRepository: Repository;
  setSelectedRepository: (repository: number) => void;
  repositories: Repository[];
  addRepository: (branch: string) => void;
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  action: GitAction | null;
  setAction: (action: GitAction | null) => void;
};

const GitContext = createContext<GitContextType | undefined>(undefined);

export function GitProvider({ children }: { children: ReactNode }) {
  const [selectedRepository, setSelectedRepository] = useState<number>(0);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [action, setAction] = useState<GitAction | null>(null);

  function getSelectedRepository() {
    const repository = localStorage.getItem('selectedRepository');
    if (repository) {
      setSelectedRepository(Number(repository));
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
        repositories.length ? repositories[selectedRepository].path : '',
      );
    }
    syncRepository();
    localStorage.setItem(
      'selectedRepository',
      JSON.stringify(selectedRepository),
    );
  }, [repositories, selectedRepository]);

  function addRepository(repo: string) {
    if (
      repositories.findIndex((repository: Repository) => {
        return repository.path === repo;
      }) >= 0
    ) {
      return;
    }
    const split = repo.split('/');
    const newRepos = [
      ...repositories,
      {
        path: repo,
        name: split[split.length - 1],
        branch: '/branches/main',
      } as Repository,
    ];
    setRepositories(newRepos);
    localStorage.setItem('repositories', JSON.stringify(newRepos));
  }

  function getSelectedRepositoryFromIndex(): Repository {
    if (repositories.length === 0) {
      return {
        name: '',
        path: '',
        branch: '',
      };
    }
    return repositories[selectedRepository];
  }

  function setSelectedBranch(branch: string) {
    const newRepos = [...repositories];
    newRepos[selectedRepository].branch = branch;
    setRepositories(newRepos);
    localStorage.setItem('repositories', JSON.stringify(newRepos));
  }

  return (
    <GitContext.Provider
      value={{
        selectedRepository: getSelectedRepositoryFromIndex(),
        setSelectedRepository,
        repositories,
        addRepository,
        selectedBranch: getSelectedRepositoryFromIndex().branch
          ? getSelectedRepositoryFromIndex().branch
          : '',
        setSelectedBranch,
        action,
        setAction,
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
