import Tab from './Tab';

export default function Tabs() {
  return (
    <div className="TabsContainer">
      <Tab name="OpenGit" active />
      <Tab name="OpenGit" active={false} />
    </div>
  );
}
