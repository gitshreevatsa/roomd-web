/** Remounts on each navigation so enter animation runs. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="roomd-page-enter">{children}</div>;
}
