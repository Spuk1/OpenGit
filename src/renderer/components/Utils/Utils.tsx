/* eslint-disable no-alert */
import {
  GoArrowDownLeft,
  GoArrowDown,
  GoArrowUp,
  GoArchive,
} from 'react-icons/go';
import { LuGitBranchPlus } from 'react-icons/lu';
import { CiFolderOn } from 'react-icons/ci';
import { useState } from 'react';
import IconButton from '../IconButton/IconButton';
import './Utils.css';
import VSpacer from '../VSpacer/VSpacer';
import Header from '../Header/Header';
import { GitAction, useGit } from '../../ContextManager/GitContext';
import Modal from '../Modal/Modal';

type File = {
  file: string;
  checked: boolean;
};

export default function Utils() {
  const {
    setSelectedRepository,
    addRepository,
    setAction,
    repositories,
    action,
  } = useGit();
  const [unstagedFiles, setUnstagedFiles] = useState<File[]>([]);
  const [commitMessage, setCommitMessage] = useState<string>('');

  const handleSelectFile = async () => {
    window.electron.ipcRenderer
      .invoke('open-file-dialog')
      .then((resp) => {
        if (resp?.length) {
          addRepository(resp[0]);
          setSelectedRepository(repositories.length);
        }
        return null;
      })
      .catch(() => alert('Directory is not a valid git repository!'));
  };

  const handleFetch = async () => {
    setAction(GitAction.Fetch);
    window.electron.ipcRenderer
      .invoke('fetch')
      .then(() => {
        setAction(GitAction.FetchFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 500);
        return null;
      })
      .catch((error) => {
        alert(error);
        setAction(GitAction.FetchFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 500);
      });
  };

  const handlePull = async () => {
    setAction(GitAction.Pull);
    window.electron.ipcRenderer
      .invoke('pull')
      .then(() => {
        setAction(GitAction.PullFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 500);
        return null;
      })
      .catch((error) => {
        alert(error);
        setAction(GitAction.PullFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 500);
      });
    setAction(GitAction.None);
  };

  const handlePush = async () => {
    setAction(GitAction.Push);
    window.electron.ipcRenderer
      .invoke('push')
      .then(() => {
        setAction(GitAction.PushFinshed);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 500);
        return null;
      })
      .catch((error) => {
        alert(error);
        setAction(GitAction.PushFinshed);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 500);
      });
    setAction(GitAction.None);
  };

  const prepareStash = async () => {
    const unstaged = await window.electron.ipcRenderer.invoke('list-changes');
    setUnstagedFiles(
      unstaged.map((file: string) => {
        return { file } as File;
      }),
    );
    setAction(GitAction.Stash);
  };

  const handleStash = async () => {
    if (commitMessage.length === 0) {
      alert('Please enter a commit message');
      return;
    }
    const files = unstagedFiles
      .filter((file) => file.checked)
      .map((file) => file.file);
    if (files.length === 0) {
      alert('Please select files to stash');
      return;
    }
    window.electron.ipcRenderer
      .invoke('stash', commitMessage, files)
      .then(() => {
        setAction(GitAction.StashFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 500);
        return null;
      })
      .catch((error) => {
        alert(error);
        setAction(GitAction.StashFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 500);
      });
    setAction(GitAction.None);
  };

  const handleAddBranch = async () => {
    // await window.electron.ipcRenderer.invoke('add-branch');
  };

  return (
    <div className="UtilsContainer">
      <VSpacer size={3} />
      <IconButton title="Open" Icon={CiFolderOn} onClick={handleSelectFile} />
      <VSpacer size={10} />
      <IconButton title="Fetch" Icon={GoArrowDownLeft} onClick={handleFetch} />
      <VSpacer size={2} />
      <IconButton title="Pull" Icon={GoArrowDown} onClick={handlePull} />
      <VSpacer size={2} />
      <IconButton title="Push" Icon={GoArrowUp} onClick={handlePush} />
      <VSpacer size={8} />
      <IconButton title="Stash" Icon={GoArchive} onClick={prepareStash} />
      <VSpacer size={15} />
      <Header />
      <VSpacer size={10} />
      <IconButton
        title="Add Branch"
        Icon={LuGitBranchPlus}
        onClick={handleAddBranch}
      />
      {action !== GitAction.None && (
        <Modal>
          {action === GitAction.Stash && (
            <div className="StashModal">
              <h1>Stash</h1>
              {unstagedFiles.map((file, i) => (
                <div>
                  <input
                    type="checkbox"
                    key={file.file}
                    value={file.file}
                    checked={file.checked}
                    onChange={(e) => {
                      const files = [...unstagedFiles];
                      files[i].checked = e.target.checked;
                      setUnstagedFiles(files);
                    }}
                  />
                  <span>{file.file}</span>
                </div>
              ))}
              <input
                type="text"
                placeholder="Stash message"
                onChange={(e) => {
                  setCommitMessage(e.target.value);
                }}
              />
              <button type="button" onClick={handleStash}>
                Stash
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
