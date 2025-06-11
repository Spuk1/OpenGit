/* eslint-disable react-hooks/exhaustive-deps */
import { ReactElement, useEffect, useRef, useState } from 'react';
import './SourceTree.css';
import {
  GoLog,
  GoQuote,
  GoArrowUp,
  GoFileDirectory,
  GoGitBranch,
  GoCheck,
  GoArrowDown,
} from 'react-icons/go';
import {
  FileTree,
  FileTreeProps,
  TreeNode,
  utils,
} from '@sinm/react-file-tree';
import '@sinm/react-file-tree/styles.css';
import '@sinm/react-file-tree/icons.css';
import { IconType } from 'react-icons';
import Divider from '../Divider/Divider';
import { useGit } from '../../ContextManager/GitContext';
import ContextMenu from '../ContextMenu/ContextMenu';

type TreeNodeGit = TreeNode<{ behind: number; ahead: number }>;

export default function SourceTree() {
  const [selected, SetSelected] = useState<Number>(1);
  const [tree, setTree] = useState<TreeNodeGit | undefined>(undefined);
  const {
    selectedRepository,
    setSelectedBranch,
    selectedBranch,
    action,
    unstaged,
  } = useGit();
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    uri: string;
  } | null>(null);

  const renderItem = (node: TreeNodeGit): ReactElement => {
    const label = node.uri.split('/').pop() || '';
    const Icon: IconType = node.uri.includes(selectedBranch)
      ? GoCheck
      : GoGitBranch;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {node.type === 'directory' ? <GoFileDirectory /> : <Icon />}
        <span>{label}</span>
        {node.behind > 0 && (
          <span>
            <span>
              <GoArrowDown />
            </span>
            <span>{node.behind}</span>
          </span>
        )}
        {node.ahead > 0 && (
          <span>
            <span>
              <GoArrowUp />
            </span>
            <span>{node.ahead}</span>
          </span>
        )}
      </div>
    );
  };

  async function branchesToTree(
    local: string[],
    remote: string[],
    stashes: string[],
  ): Promise<TreeNodeGit> {
    const createNode = (
      uri: string,
      ahead: number,
      behind: number,
      isFile = false,
    ): TreeNodeGit => ({
      type: isFile ? 'file' : 'directory',
      uri,
      expanded: selectedBranch.includes(uri), // still fine
      children: [],
      ahead: isFile ? ahead : 0,
      behind: isFile ? behind : 0,
    });

    const insertBranch = async (
      root: TreeNodeGit,
      branchPath: string,
      basePath: string,
    ) => {
      const refs: string = basePath.includes('branches')
        ? await window.electron.ipcRenderer.invoke(
            'get-branch-revs',
            branchPath,
          )
        : '0\t0';
      const [behind, ahead] = refs.split('\t').map(Number);
      const parts = branchPath.split('/');
      let current = root;
      let currentUri = basePath;

      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        currentUri += `/${part}`;
        let existing = current.children?.find(
          // eslint-disable-next-line no-loop-func
          (child) => child.uri === currentUri,
        );

        if (!existing) {
          existing = createNode(
            currentUri,
            ahead,
            behind,
            i === parts.length - 1,
          );
          current.children?.push(existing);
        }

        if (!existing.children) existing.children = [];
        current = existing;
      }
    };

    const localRoot: TreeNodeGit = {
      type: 'directory',
      uri: '/branches',
      children: [],
      behind: 0,
      ahead: 0,
      expanded: true,
    };

    const remoteRoot: TreeNodeGit = {
      type: 'directory',
      uri: '/remote',
      children: [],
      behind: 0,
      ahead: 0,
      expanded: true,
    };

    const stashRoot: TreeNodeGit = {
      type: 'directory',
      uri: '/stashes',
      behind: 0,
      ahead: 0,
      expanded: true,
      children: stashes.map((stash) => ({
        type: 'file',
        uri: `/stashes/${stash}`,
        expanded: false,
        behind: 0,
        ahead: 0,
        children: [],
      })),
    };

    // await all insertions
    await Promise.all([
      ...local.map((branch) => insertBranch(localRoot, branch, '/branches')),
      ...remote.map((branch) => insertBranch(remoteRoot, branch, '/remote')),
    ]);

    return {
      type: 'directory',
      uri: '/',
      expanded: true,
      behind: 0,
      ahead: 0,
      children: [localRoot, remoteRoot, stashRoot],
    };
  }

  const refreshBranches = async () => {
    try {
      const { local, remote } =
        await window.electron.ipcRenderer.invoke('list-branches');
      const stashes: string[] =
        await window.electron.ipcRenderer.invoke('list-stashes');

      const treeData = await branchesToTree(
        local,
        remote,
        stashes.filter((stash) => stash !== ''),
      );
      setTree(treeData);
    } catch (err) {
      console.error('Failed to load branches or stashes', err);
    }
  };

  const openStashModal = (stash: string) => {
    // eslint-disable-next-line no-alert, no-restricted-globals
    if (confirm(`Do you want to use stash ${stash}?`)) {
      const st: string = `stash@${stash.split(':')[0]}`;
      window.electron.ipcRenderer
        .invoke('use-stash', st)
        .then((resp) => {
          refreshBranches();
          return resp;
        })
        .catch((err) => {
          // eslint-disable-next-line no-alert
          alert(err);
        });
    }
  };

  const toggleExpanded: FileTreeProps['onItemClick'] = async (
    node: TreeNode,
  ) => {
    const treeNode = node as TreeNodeGit;
    if (treeNode.type !== 'directory') {
      if (treeNode.uri.split('/').includes('stashes')) {
        openStashModal(treeNode.uri.replace(/^\/stashes\//, ''));
        return;
      }
      return;
    }
    setTree(
      (_tree) =>
        utils.assignTreeNode(_tree, treeNode.uri, {
          expanded: !treeNode.expanded,
        }) as TreeNodeGit,
    );
  };

  useEffect(() => {
    const onFocus = () => {
      refreshBranches();
    };

    const container = containerRef.current;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const treeItem = target.closest('.file-tree__tree-item') as HTMLElement;
      if (!treeItem) return;

      const uri = treeItem.getAttribute('title');
      if (
        !uri ||
        (!uri.startsWith('/branches/') && !uri.startsWith('/remote/'))
      )
        return;

      e.preventDefault();
      setContextMenu({ x: e.pageX, y: e.pageY, uri });
    };

    const handleDoubleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const treeItem = target.closest('.file-tree__tree-item') as HTMLElement;
      if (!treeItem) return;

      const uri = treeItem.getAttribute('title');
      if (
        !uri ||
        (!uri.startsWith('/branches/') && !uri.startsWith('/remote/'))
      )
        return;

      e.preventDefault();

      // Call the branch checkout and set selected branch
      window.electron.ipcRenderer
        .invoke(
          'checkout-branch',
          uri.replace(/^\/branches\//, '').replace(/^\/remote\//, ''),
        )
        .then(() => {
          setSelectedBranch(uri);
          refreshBranches();
          return null;
        })
        .catch((err) => {
          alert(err);
        });
    };

    container?.addEventListener('contextmenu', handleContextMenu);
    container?.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('focus', onFocus);

    return () => {
      container?.removeEventListener('contextmenu', handleContextMenu);
      container?.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    // without timeout local branches are requested to early
    setTimeout(() => {
      refreshBranches();
    }, 100);
  }, [selectedRepository, action, unstaged]);

  return (
    <div className="SourceTreeContainer" ref={containerRef}>
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
        itemRenderer={(node) => {
          return renderItem(node as TreeNodeGit);
        }}
        activatedUri={selectedBranch}
        draggable
      />
      <Divider />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          uri={contextMenu.uri}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
