/* eslint-disable no-alert */
import {
  GoArrowDownLeft,
  GoArrowDown,
  GoArrowUp,
  GoArchive,
} from 'react-icons/go';
import { LuGitBranchPlus } from 'react-icons/lu';
import { CiFolderOn } from 'react-icons/ci';
import IconButton from '../IconButton/IconButton';
import './Utils.css';
import VSpacer from '../VSpacer/VSpacer';
import Header from '../Header/Header';
import { GitAction, useGit } from '../../ContextManager/GitContext';
import Modal from '../Modal/Modal';

export default function Utils() {
  const { setSelectedRepository, addRepository, setAction, repositories } =
    useGit();

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
        setAction(GitAction.None);
        return null;
      })
      .catch((error) => {
        alert(error);
        setAction(GitAction.None);
      });
  };

  const handlePull = async () => {
    setAction(GitAction.Pull);
    window.electron.ipcRenderer
      .invoke('pull')
      .then(() => {
        setAction(GitAction.None);
        return null;
      })
      .catch((error) => {
        alert(error);
        setAction(GitAction.None);
      });
    setAction(GitAction.None);
  };

  const handlePush = async () => {
    setAction(GitAction.Push);
    window.electron.ipcRenderer
      .invoke('push')
      .then(() => {
        setAction(GitAction.None);
        return null;
      })
      .catch((error) => {
        alert(error);
        setAction(GitAction.None);
      });
    setAction(GitAction.None);
  };

  const handleStash = async () => {
    setAction(GitAction.Stash);
    window.electron.ipcRenderer
      .invoke('stash')
      .then(() => {
        setAction(GitAction.None);
        return null;
      })
      .catch((error) => {
        alert(error);
        setAction(GitAction.None);
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
      <IconButton title="Stash" Icon={GoArchive} onClick={handleStash} />
      <VSpacer size={15} />
      <Header />
      <VSpacer size={10} />
      <IconButton
        title="Add Branch"
        Icon={LuGitBranchPlus}
        onClick={handleAddBranch}
      />
      {false && (
        <Modal>
          {/* TODO: fill with data depending on the action */}
          <div className="alert" />
        </Modal>
      )}
    </div>
  );
}
