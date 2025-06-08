import { ReactNode, useEffect, useState } from 'react';
import { useGit } from '../../ContextManager/GitContext';
import Tab from './Tab';

export default function Tabs() {
  const { repositories, selectedRepository, setSelectedRepository } = useGit();
  const [tabs, setTabs] = useState<ReactNode[]>([]);

  useEffect(() => {
    setTabs(
      repositories.map((repo) => {
        const arr = repo.split('/');
        return (
          <Tab
            key={repo}
            name={arr[arr.length - 1]}
            active={selectedRepository === arr[arr.length - 1]}
            onClick={() => {
              setSelectedRepository(repo);
            }}
          />
        );
      }),
    );
  }, [repositories, selectedRepository, setSelectedRepository]);

  return <div className="TabsContainer">{tabs}</div>;
}
