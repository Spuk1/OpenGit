import './Tabs.css';

type Props = {
  name: string;
  active: boolean;
};

export default function Tab({ name, active }: Props) {
  return (
    <div
      className="TabContainer"
      style={{ backgroundColor: active ? '#2c323a' : '#222831' }}
    >
      <div>{name}</div>
    </div>
  );
}
