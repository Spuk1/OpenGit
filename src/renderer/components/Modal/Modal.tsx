import './Modal.css';

type Props = {
  children: any;
};

export default function Modal({ children }: Props) {
  return <div className="Modal">{children}</div>;
}
