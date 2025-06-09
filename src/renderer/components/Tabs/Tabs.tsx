import { ReactNode, useEffect, useState } from 'react';
import { useGit } from '../../ContextManager/GitContext';
import Tab from './Tab';

export default function Tabs() {
  const { repositories, selectedRepository, setSelectedRepository } = useGit();
  const [tabs, setTabs] = useState<ReactNode[]>([]);

  useEffect(() => {
    setTabs(
      repositories.map((repo, i) => {
        return (
          <Tab
            key={repo.name}
            name={repo.name}
            active={selectedRepository.name === repo.name}
            onClick={() => {
              setSelectedRepository(i);
            }}
          />
        );
      }),
    );
  }, [repositories, selectedRepository, setSelectedRepository]);

  return <div className="TabsContainer">{tabs}</div>;
}
