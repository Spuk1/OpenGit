import { IconType } from 'react-icons';
import './IconButton.css';

type Props = {
  Icon: IconType;
  title: string;
  onClick: CallableFunction;
};

export default function IconButton({ Icon, title, onClick }: Props) {
  return (
    <div
      onClick={() => {
        onClick();
      }}
      onKeyDown={() => {}}
      className="IconButtonContainer"
      role="button"
      tabIndex={0}
    >
      <Icon className="IconButtonIcon" />
      <div>{title}</div>
    </div>
  );
}
