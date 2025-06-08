import { ReactElement } from 'react';
import './Modal.css';

type Props = {
  children: ReactElement[] | ReactElement;
};

export default function Modal({ children }: Props) {
  return <div className="Modal">{children}</div>;
}
