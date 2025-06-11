import './Modal.css';

type Props = {
  children: any;
};

export default function Modal({ children }: Props) {
  return (
    <div className="Modal">
      <div style={{ overflowY: 'scroll', paddingRight: '10px' }}>
        {children}
      </div>
    </div>
  );
}
