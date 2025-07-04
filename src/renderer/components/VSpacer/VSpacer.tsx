type Props = {
  size: number;
};

export default function VSpacer({ size }: Props) {
  return <div style={{ width: `${size * 0.5}vw` }} />;
}
