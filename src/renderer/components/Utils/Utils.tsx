/* eslint-disable no-alert */
import {
  GoArrowDownLeft,
  GoArrowDown,
  GoArrowUp,
  GoArchive,
  GoGitBranch,
} from 'react-icons/go';
import { LuGitBranchPlus, LuGithub } from 'react-icons/lu';
import { CiFolderOn } from 'react-icons/ci';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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
    setAction,
    selectedRepository,
    action,
    handleSelectFile,
    handleFetch,
    handlePull,
    handlePush,
    prepareStash,
    handleAddBranch,
    cloneRepo,
  } = useGit();
  const [unstagedFiles, setUnstagedFiles] = useState<File[]>([]);
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [newBranchName, setNewBranchName] = useState<string>('');
  const [cloneLink, setCloneLink] = useState<string>('');

  const handleStash = async () => {
    const files = unstagedFiles
      .filter((file) => file.checked)
      .map((file) => file.file);
    if (files.length === 0) {
      files.push('*');
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
        toast.error(error);
        setAction(GitAction.StashFinished);
        setTimeout(() => {
          setAction(GitAction.None);
        }, 500);
      });
    setAction(GitAction.None);
  };

  const addBranch = () => {
    if (newBranchName.length === 0) {
      toast.error('Please enter a branch name');
      return;
    }
    window.electron.ipcRenderer
      .invoke('add-branch', newBranchName)
      .then(() => {
        setAction(GitAction.None);
        return null;
      })
      .catch((error) => {
        toast.error(error);
        setAction(GitAction.None);
      });
    setAction(GitAction.None);
  };

  const navigate = useNavigate();
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
      <IconButton
        title="Stash"
        Icon={GoArchive}
        onClick={() => prepareStash(setUnstagedFiles)}
      />
      <VSpacer size={15} />
      <Header />
      <VSpacer size={10} />
      <IconButton
        title="Add Branch"
        Icon={LuGitBranchPlus}
        onClick={handleAddBranch}
      />
      <VSpacer size={10} />
      <IconButton
        title="Settings"
        Icon={LuGithub}
        onClick={() => {
          navigate('/settings');
        }}
      />
      {action === GitAction.Stash && (
        <Modal>
          <div className="StashModal">
            <h2>Stash</h2>
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
              style={{ marginTop: '10px' }}
              type="text"
              placeholder="Stash message"
              onChange={(e) => {
                setCommitMessage(e.target.value);
              }}
            />
            <button type="button" className="button" onClick={handleStash}>
              Stash
            </button>
            <button
              className="button"
              type="button"
              onClick={() => setAction(GitAction.None)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
      {action === GitAction.AddBranch && (
        <Modal>
          <div className="AddBranchModal">
            <h1>Add Branch</h1>
            <span>Created at: </span>
            <span>
              <GoGitBranch style={{ marginRight: '5px', marginLeft: '5px' }} />
              {selectedRepository.branch.replace('/branches/', '')}
            </span>
            <br />
            <span>Branch name: </span>
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => {
                const string = e.target.value.replaceAll(' ', '-');
                setNewBranchName(string);
              }}
              placeholder="Branch name"
            />
            <br />
            <div className="AddBranchButtonContainer">
              <button
                className="button"
                type="button"
                onClick={() => {
                  addBranch();
                }}
              >
                Add
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setAction(GitAction.None)}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
      {action === GitAction.Clone && (
        <Modal>
          <div className="AddBranchModal">
            <h1>Clone Repository</h1>
            <span>Created at: </span>
            <br />
            <span>Link: </span>
            <input
              type="text"
              value={cloneLink}
              onChange={(e) => {
                setCloneLink(e.target.value);
              }}
              placeholder="Branch name"
            />
            <br />
            <div className="AddBranchButtonContainer">
              <button
                className="button"
                type="button"
                onClick={() => {
                  cloneRepo(cloneLink);
                }}
              >
                Add
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setAction(GitAction.None)}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
