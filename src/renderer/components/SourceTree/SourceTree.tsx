import { useEffect, useState } from 'react';
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

function branchesToTree(local: string[], remote: string[]): TreeNode {
  const createNode = (uri: string, isFile = false): TreeNode => ({
    type: isFile ? 'file' : 'directory',
    uri,
    expanded: false,
    children: [],
  });

  const insertBranch = (
    root: TreeNode,
    branchPath: string,
    basePath: string,
  ) => {
    const parts = branchPath.split('/');
    let current = root;
    let currentUri = basePath;

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      currentUri += `/${part}`;
      let existing = null;
      if (current && current.children) {
        // eslint-disable-next-line no-loop-func
        existing = current.children.find((child) => child.uri === currentUri);
      }
      if (!existing) {
        existing = createNode(currentUri, i === parts.length - 1);
        current.children?.push(existing);
      }

      if (!existing.children) {
        existing.children = [];
      }

      current = existing;
    }
  };

  const localRoot: TreeNode = {
    type: 'directory',
    uri: '/branches',
    expanded: true,
    children: [],
  };

  const remoteRoot: TreeNode = {
    type: 'directory',
    uri: '/remote',
    expanded: true,
    children: [],
  };

  local.forEach((branch) => insertBranch(localRoot, branch, '/branches'));
  remote.forEach((branch) => insertBranch(remoteRoot, branch, '/remote'));

  return {
    type: 'directory',
    uri: '/',
    expanded: true,
    children: [localRoot, remoteRoot],
  };
}

export default function SourceTree() {
  const [selected, SetSelected] = useState<Number>(1);
  const [tree, setTree] = useState<TreeNode | undefined>(undefined);
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

  useEffect(() => {
    const loadBranches = async () => {
      try {
        // const repoPath: string =
        //   await window.electron.ipcRenderer.invoke('get-repo-path');
        const { local, remote } =
          await window.electron.ipcRenderer.invoke('list-branches');
        const treeData = branchesToTree(local, remote);
        setTree(treeData);
      } catch (err) {
        console.error('Failed to load branches', err);
      }
    };

    loadBranches();
  }, []);

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
