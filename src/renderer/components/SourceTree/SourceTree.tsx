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
  GoGitPullRequestClosed,
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
import { IoCloudOfflineOutline } from 'react-icons/io5';

import toast from 'react-hot-toast';
import Divider from '../Divider/Divider';
import { GitAction, useGit } from '../../ContextManager/GitContext';
import ContextMenu from '../ContextMenu/ContextMenu';

type TreeNodeGit = TreeNode<{
  hasRemote: boolean;
  behind: number;
  ahead: number;
}>;
type TreeExtendedData = {
  [key: string]: {
    extended: boolean;
  };
};

export function orderBy<T>(
  array: T[],
  iteratees: Array<(item: T) => any>,
  orders: Array<'asc' | 'desc'> = [],
): T[] {
  // Create a copy to avoid mutating the original
  return array.slice().sort((a, b) => {
    for (let i = 0; i < iteratees.length; i++) {
      const iteratee = iteratees[i];
      const order: 'asc' | 'desc' = orders[i] || 'asc';
      const valA = iteratee(a);
      const valB = iteratee(b);

      // Compare values
      let comparison = 0;

      // Handle undefined or null
      if (valA == null && valB != null) {
        comparison = -1;
      } else if (valA != null && valB == null) {
        comparison = 1;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }

      if (comparison !== 0) {
        return order === 'asc' ? comparison : -comparison;
      }
      // Otherwise, move to the next iteratee
    }
    return 0;
  });
}

const sorter = (treeNodes: TreeNode[]) =>
  orderBy(
    treeNodes,
    [
      (node) => (node.type === 'directory' ? 0 : 1),
      (node) => utils.getFileName(node.uri),
    ],
    ['asc', 'asc'],
  );

export default function SourceTree() {
  const [tree, setTree] = useState<TreeNodeGit | undefined>(undefined);
  const [treeExtended, setTreeExtended] = useState<TreeExtendedData>({});

  const {
    selectedRepository,
    setSelectedBranch,
    selectedBranch,
    action,
    unstaged,
    handleMerge,
    setAction,
    setSelected,
    selected,
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
        <span style={{ position: 'absolute', right: 15, top: 7 }}>
          {typeof node.behind === 'number' && node.behind > 0 && (
            <span>
              <span>
                <GoArrowDown />
              </span>
              <span>{node.behind}</span>
            </span>
          )}
          {typeof node.ahead === 'number' && node.ahead > 0 && (
            <span>
              <span>
                <GoArrowUp />
              </span>
              <span>{node.ahead}</span>
            </span>
          )}
          {!node.hasRemote && (
            <span>
              <span>
                <IoCloudOfflineOutline />
              </span>
            </span>
          )}
        </span>
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
      hasRemote: boolean,
      isFile = false,
    ): TreeNodeGit => ({
      type: isFile ? 'file' : 'directory',
      uri,
      expanded: treeExtended[uri]
        ? treeExtended[uri].extended
        : selectedBranch.includes(uri),
      children: [],
      ahead: isFile ? ahead : 0,
      behind: isFile ? behind : 0,
      hasRemote: isFile ? hasRemote : true,
    });

    const insertBranch = async (
      root: TreeNodeGit,
      branchPath: string,
      basePath: string,
      hasRemote: boolean = true,
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
            hasRemote,
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
      hasRemote: true,
    };

    const remoteRoot: TreeNodeGit = {
      type: 'directory',
      uri: '/remote',
      children: [],
      behind: 0,
      ahead: 0,
      expanded: true,
      hasRemote: true,
    };

    const stashRoot: TreeNodeGit = {
      type: 'directory',
      uri: '/stashes',
      behind: 0,
      ahead: 0,
      expanded: true,
      hasRemote: true,
      children: stashes.map((stash) => ({
        type: 'file',
        uri: `/stashes/${stash}`,
        expanded: false,
        behind: 0,
        ahead: 0,
        children: [],
        hasRemote: true,
      })),
    };

    // await all insertions
    await Promise.all([
      ...local.map((branch) =>
        insertBranch(
          localRoot,
          branch,
          '/branches',
          remote.findIndex((remoteBranch) => {
            return remoteBranch === branch;
          }) >= 0,
        ),
      ),
      ...remote.map((branch) => insertBranch(remoteRoot, branch, '/remote')),
    ]);

    return {
      type: 'directory',
      uri: '/',
      expanded: true,
      behind: 0,
      ahead: 0,
      children: [localRoot, remoteRoot, stashRoot],
      hasRemote: true,
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
      setAction(GitAction.Pop);
      const st: string = `stash@${stash.split(':')[0]}`;
      window.electron.ipcRenderer
        .invoke('use-stash', st)
        .then((resp) => {
          setAction(GitAction.None);
          refreshBranches();
          return resp;
        })
        .catch((err) => {
          // eslint-disable-next-line no-alert
          toast.error(err);
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
    const tmp = { ...treeExtended };
    tmp[node.uri] = { extended: !node.expanded };
    setTreeExtended(tmp);
    setTree(
      (_tree) =>
        utils.assignTreeNode(_tree, treeNode.uri, {
          expanded: !treeNode.expanded,
        }) as TreeNodeGit,
    );
  };

  useEffect(() => {
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
      setSelectedBranch(uri);
    };

    container?.addEventListener('contextmenu', handleContextMenu);
    container?.addEventListener('dblclick', handleDoubleClick);
    return () => {
      container?.removeEventListener('contextmenu', handleContextMenu);
      container?.removeEventListener('dblclick', handleDoubleClick);
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
          onClick={() => setSelected(1)}
          onKeyDown={() => {}}
          role="button"
          tabIndex={0}
          style={{ backgroundColor: selected === 1 ? '#393E46' : '#222831' }}
        >
          <span style={{ marginRight: '10px' }}>
            <GoLog />
          </span>
          <span>Changes</span>
          {unstaged.length > 0 && (
            <span style={{ marginLeft: '5px' }}>{`(${unstaged.length})`}</span>
          )}
        </div>
        <div
          className="Changes"
          onClick={() => setSelected(2)}
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
        onDrop={(_event, from, to) => {
          handleMerge(from, to);
        }}
        sorter={sorter}
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
