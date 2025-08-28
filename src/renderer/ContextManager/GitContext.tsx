/* eslint-disable no-alert */
/* eslint-disable react/jsx-no-constructed-context-values */
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import toast from 'react-hot-toast';

export enum GitAction {
  Commit = 'comitting',
  CommitFinished = 'comit finsihed',
  Push = 'pushing',
  PushFinshed = 'push finished',
  Pull = 'pulling',
  PullFinished = 'pull finished',
  Fetch = 'fetching',
  FetchFinished = 'fetch finished',
  Stash = 'stashing',
  StashFinished = 'stash finished',
  AddBranch = 'adding branch',
  DeleteBranch = 'deleting',
  Pop = 'pop',
  None = 0,
}

export type Repository = {
  name: string;
  path: string;
  branch: string;
  group: number;
};

type GitContextType = {
  selectedRepository: Repository;
  setSelectedRepository: (repository: number) => void;
  repositories: Repository[];
  addRepository: (branch: string) => void;
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  action: GitAction | null;
  setAction: (action: GitAction) => void;
  handleSelectFile: () => void;
  handleFetch: () => void;
  handlePull: () => void;
  handlePush: () => void;
  prepareStash: (setUnstagedFiles: CallableFunction) => void;
  handleAddBranch: () => void;
  handleDeleteBranch: (branch: string, remote: boolean) => void;
  unstaged: string[];
  setUnstaged: (unstaged: string[]) => void;
  handleMerge: (fromFile: string, toFile: string) => void;
  setSelected: (value: number) => void;
  selected: number;
};

const GitContext = createContext<GitContextType | undefined>(undefined);

export function GitProvider({ children }: { children: ReactNode }) {
  const [selectedRepository, setSelectedRepository] = useState<number>(0);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [action, setAction] = useState<GitAction>(GitAction.None);
  const [unstaged, setUnstaged] = useState<string[]>([]);
  const [selected, setSelected] = useState<number>(1);

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
        group: 0,
      } as Repository,
    ];
    setRepositories(newRepos);
    window.electron.ipcRenderer.invoke('save-repositories', newRepos);
  }

  async function setSelectedRepositoryWrapper(repository: number) {
    if (repository >= repositories.length) {
      return;
    }
    await window.electron.ipcRenderer.invoke(
      'set-selected-repository',
      repositories[repository].path,
    );
    const resp = await window.electron.ipcRenderer.invoke('get-branch');
    repositories[repository].branch = `/branches/${resp}`;
    localStorage.setItem('selectedRepository', JSON.stringify(repository));
    setSelectedRepository(repository);
  }

  async function getSelectedRepository() {
    const repos = await window.electron.ipcRenderer.invoke('get-repositories');
    if (repos) {
      const tmpRepositories = JSON.parse(repos);
      const repository = localStorage.getItem('selectedRepository');
      if (repository) {
        window.electron.ipcRenderer
          .invoke(
            'set-selected-repository',
            tmpRepositories[Number(repository)]
              ? tmpRepositories[Number(repository)].path
              : '',
          )
          .then(async () => {
            const resp = await window.electron.ipcRenderer.invoke('get-branch');
            tmpRepositories[Number(repository)].branch = `/branches/${resp}`;
            setSelectedRepository(Number(repository));
            return resp;
          })
          .catch((error) => {
            console.log(error);
          });

        setRepositories(tmpRepositories);
      }
    }
  }

  function handleMerge(fromFile: string, toFile: string) {
    setAction(GitAction.Commit);
    window.electron.ipcRenderer
      .invoke(
        'merge-branch',
        fromFile.replace('/branches/', ''),
        toFile.replace('/branches/', ''),
      )
      .then(() => {
        setAction(GitAction.CommitFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 100);
        return null;
      })
      .catch((error) => {
        toast.error(error);
        setAction(GitAction.CommitFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 100);
      });
  }

  // TODO: add source branch
  const handleAddBranch = () => {
    setAction(GitAction.AddBranch);
  };

  const handleSelectFile = () => {
    window.electron.ipcRenderer
      .invoke('open-file-dialog')
      .then((resp) => {
        if (resp?.length) {
          addRepository(resp[0]);
          setSelectedRepository(repositories.length);
        }
        return null;
      })
      .catch(() => toast.error('Directory is not a valid git repository!'));
  };

  const handleFetch = () => {
    if (action !== GitAction.None) return;
    setAction(GitAction.Fetch);
    window.electron.ipcRenderer
      .invoke('fetch')
      .then(() => {
        setAction(GitAction.FetchFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 100);
        return null;
      })
      .catch((error) => {
        toast.error(error);
        setAction(GitAction.FetchFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 100);
      });
  };

  const handlePull = () => {
    setAction(GitAction.Pull);
    window.electron.ipcRenderer
      .invoke('pull')
      .then(() => {
        setAction(GitAction.PullFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 100);
        return null;
      })
      .catch((error) => {
        toast.error(error);
        setAction(GitAction.PullFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 100);
      });
    setAction(GitAction.None);
  };

  const handlePush = (setUpstream = false) => {
    setAction(GitAction.Push);
    window.electron.ipcRenderer
      .invoke('push', setUpstream)
      .then(() => {
        setAction(GitAction.PushFinshed);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 100);
        return null;
      })
      .catch((error: Error) => {
        if (error.message.includes('--set-upstream')) {
          if (
            window.confirm(
              'Do you want to set upstream? (git push --set-upstream origin <branch>)',
            )
          ) {
            handlePush(true);
          }
          setAction(GitAction.PushFinshed);
          setTimeout(() => {
            setAction(GitAction.None);
          }, 100);
          return;
        }
        toast.error(error);
        setAction(GitAction.PushFinshed);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 100);
      });
    setAction(GitAction.None);
  };

  const prepareStash = (setUnstagedFiles: CallableFunction) => {
    window.electron.ipcRenderer
      .invoke('list-changes')
      .then((unstagedFiles) => {
        setUnstagedFiles(
          unstagedFiles.map((file: string) => {
            return { file } as unknown as File;
          }),
        );
        return null;
      })
      .catch((error) => {
        toast.error(error);
      });

    setAction(GitAction.Stash);
  };

  function handleDeleteBranch(branch: string, remote: boolean = false) {
    setAction(GitAction.DeleteBranch);
    if (window.confirm(`Are you sure you want to delete '${branch}'?`)) {
      window.electron.ipcRenderer
        .invoke('delete-branch', branch, remote)
        .then(() => {
          setAction(GitAction.None);
          return null;
        })
        .catch((err) => {
          setAction(GitAction.None);
          toast.error(err);
        });
    }
  }

  function getSelectedRepositoryFromIndex(): Repository {
    if (repositories.length === 0) {
      return {
        name: '',
        path: '',
        branch: '',
        group: 0,
      };
    }
    return repositories[selectedRepository];
  }

  function setSelectedBranch(branch: string) {
    if (!branch) {
      return;
    }
    const branchPath = branch.replace(/^\/(branches|remote)\//, '');
    const newRepos = [...repositories];
    if (newRepos.length > 0) {
      newRepos[selectedRepository].branch = branch;
    }
    window.electron.ipcRenderer
      .invoke('checkout-branch', branchPath)
      .then(() => {
        setRepositories(newRepos);
        localStorage.setItem('repositories', JSON.stringify(newRepos));
        return null;
      })
      .catch((err) => toast.error(err));
  }

  useEffect(() => {
    getSelectedRepository();
    setTimeout(() => {
      handleFetch();
    }, 30000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GitContext.Provider
      value={{
        selectedRepository: getSelectedRepositoryFromIndex(),
        setSelectedRepository: setSelectedRepositoryWrapper,
        repositories,
        addRepository,
        selectedBranch: getSelectedRepositoryFromIndex().branch
          ? getSelectedRepositoryFromIndex().branch
          : '',
        setSelectedBranch,
        action,
        setAction,
        handleSelectFile,
        handleFetch,
        handlePull,
        handlePush,
        prepareStash,
        handleAddBranch,
        handleDeleteBranch,
        unstaged,
        setUnstaged,
        handleMerge,
        setSelected,
        selected,
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
