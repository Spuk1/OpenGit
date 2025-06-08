import './Tabs.css';

type Props = {
  name: string;
  active: boolean;
  onClick: CallableFunction;
};

export default function Tab({ name, active, onClick }: Props) {
  return (
    <div
      className="TabContainer"
      tabIndex={0}
      role="button"
      onKeyDown={() => {}}
      style={{ backgroundColor: active ? '#2c323a' : '#222831' }}
      onClick={() => {
        onClick();
      }}
    >
      <div>{name}</div>
    </div>
  );
}
