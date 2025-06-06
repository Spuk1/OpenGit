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
  return (
    <div className="UtilsContainer">
      <VSpacer size={2} />
      <IconButton title="Quick launch" Icon={CiFolderOn} onClick={() => {}} />
      <VSpacer size={10} />
      <IconButton title="Fetch" Icon={GoArrowDownLeft} onClick={() => {}} />
      <VSpacer size={2} />
      <IconButton title="Pull" Icon={GoArrowDown} onClick={() => {}} />
      <VSpacer size={2} />
      <IconButton title="Push" Icon={GoArrowUp} onClick={() => {}} />
      <VSpacer size={8} />
      <IconButton title="Stash" Icon={GoArchive} onClick={() => {}} />
      <VSpacer size={15} />
      <Header />
      <VSpacer size={10} />
      <IconButton title="Stash" Icon={LuGitBranchPlus} onClick={() => {}} />
    </div>
  );
}
