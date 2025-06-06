import { useState } from 'react';
import './SourceTree.css';
import { GoLog, GoQuote } from 'react-icons/go';
import {
  FileTree,
  FileTreeProps,
  TreeNode,
  utils,
} from '@sinm/react-file-tree';
import '@sinm/react-file-tree/styles.css';
import FileItemWithFileIcon from '@sinm/react-file-tree/lib/FileItemWithFileIcon';
import '@sinm/react-file-tree/icons.css';
import Divider from '../Divider/Divider';

const itemRenderer = (treeNode: TreeNode) => (
  <FileItemWithFileIcon treeNode={treeNode} />
);

const gitRepoTree: TreeNode = {
  type: 'directory',
  uri: '/',
  expanded: true,
  children: [
    {
      type: 'directory',
      uri: '/branches',
      expanded: true,
      children: [
        {
          type: 'directory',
          uri: '/branches/release',
          expanded: false,
          children: [
            { type: 'file', uri: '/branches/release/v1.0.0' },
            { type: 'file', uri: '/branches/release/v1.1.0' },
            { type: 'file', uri: '/branches/release/v2.0.0' },
          ],
        },
        {
          type: 'directory',
          uri: '/branches/feature',
          expanded: false,
          children: [
            { type: 'file', uri: '/branches/feature/login-refactor' },
            { type: 'file', uri: '/branches/feature/add-dark-mode' },
            { type: 'file', uri: '/branches/feature/improve-performance' },
          ],
        },
        { type: 'file', uri: '/branches/main' },
        { type: 'file', uri: '/branches/develop' },
      ],
    },
    {
      type: 'directory',
      uri: '/remote',
      expanded: true,
      children: [
        {
          type: 'directory',
          uri: '/remote/release',
          expanded: false,
          children: [
            { type: 'file', uri: '/remote/release/v1.0.0' },
            { type: 'file', uri: '/remote/release/v1.1.0' },
            { type: 'file', uri: '/remote/release/v2.0.0' },
          ],
        },
        {
          type: 'directory',
          uri: '/remote/feature',
          expanded: false,
          children: [
            { type: 'file', uri: '/remote/feature/login-refactor' },
            { type: 'file', uri: '/remote/feature/add-dark-mode' },
            { type: 'file', uri: '/remote/feature/improve-performance' },
          ],
        },
        { type: 'file', uri: '/remote/main' },
        { type: 'file', uri: '/remote/develop' },
      ],
    },
  ],
};

export default function SourceTree() {
  const [selected, SetSelected] = useState<Number>(1);
  const [tree, setTree] = useState<TreeNode | undefined>(gitRepoTree);
  const [selectedBranch, SetSelectedBranch] =
    useState<string>('/release/v2.0.0');

  const toggleExpanded: FileTreeProps['onItemClick'] = (treeNode: TreeNode) => {
    if (treeNode.type !== 'directory') {
      SetSelectedBranch(treeNode.uri);
      return;
    }
    setTree((_tree) =>
      utils.assignTreeNode(_tree, treeNode.uri, {
        expanded: !treeNode.expanded,
      }),
    );
  };

  return (
    <div className="SourceTreeContainer">
      <div className="ChangesContainer">
        <div
          className="Changes"
          onClick={() => SetSelected(1)}
          onKeyDown={() => {}}
          role="button"
          tabIndex={0}
          style={{ backgroundColor: selected === 1 ? '#393E46' : '#222831' }}
        >
          <span style={{ marginRight: '10px' }}>
            <GoLog />
          </span>
          <span>Changes</span>
        </div>
        <div
          className="Changes"
          onClick={() => SetSelected(2)}
          onKeyDown={() => {}}
          role="button"
          tabIndex={0}
          style={{ backgroundColor: selected === 2 ? '#393E46' : '#222831' }}
        >
          <span style={{ marginRight: '10px' }}>
            <GoQuote />
          </span>
          <span>All Commits</span>
        </div>
      </div>
      <Divider />
      <FileTree
        tree={tree}
        onItemClick={toggleExpanded}
        itemRenderer={itemRenderer}
        activatedUri={selectedBranch}
        draggable // TODO: open context menu on release
      />
      <Divider />
    </div>
  );
}
