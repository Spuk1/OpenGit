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

export default function Utils() {
  const handleSelectFile = async () => {
    const filePaths =
      await window.electron.ipcRenderer.invoke('open-file-dialog');
    if (filePaths?.length) {
      console.log('Selected:', filePaths);
    }
  };

  const handleFetch = async () => {
    await window.electron.ipcRenderer.invoke('fetch');
  };

  const handlePull = async () => {
    await window.electron.ipcRenderer.invoke('pull');
  };

  const handlePush = async () => {
    await window.electron.ipcRenderer.invoke('push');
  };

  const handleStash = async () => {
    await window.electron.ipcRenderer.invoke('stash');
  };

  const handleAddBranch = async () => {
    await window.electron.ipcRenderer.invoke('add-branch');
  };

  return (
    <div className="UtilsContainer">
      <VSpacer size={2} />
      <IconButton
        title="Quick launch"
        Icon={CiFolderOn}
        onClick={handleSelectFile}
      />
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
    </div>
  );
}
