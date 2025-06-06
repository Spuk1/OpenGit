import { useEffect, useState } from 'react';
import SourceTree from '../SourceTree/SourceTree';
import Commits from '../Commits/Commits';

export default function PanelContainer() {
  const [Panels, setPanels] = useState<{
    Panel: any;
    PanelGroup: any;
    PanelResizeHandle: any;
  } | null>(null);

  useEffect(() => {
    import('react-resizable-panels')
      .then((mod) => {
        setPanels(mod);
        return mod;
      })
      .catch(() => {});
  }, []);

  if (!Panels) {
    return null;
  } // Or a loading spinner if you like

  const { PanelGroup, Panel, PanelResizeHandle } = Panels;

  return (
    <PanelGroup direction="horizontal">
      <Panel id="sourcetree" minSize={10} defaultSize={25} order={1}>
        <SourceTree />
      </Panel>
      <PanelResizeHandle id="hello">
        <div
          style={{ width: '3px', height: '100%', backgroundColor: 'gray' }}
        />
      </PanelResizeHandle>
      <Panel id="commits" minSize={25} order={2}>
        <Commits />
      </Panel>
    </PanelGroup>
  );
}
