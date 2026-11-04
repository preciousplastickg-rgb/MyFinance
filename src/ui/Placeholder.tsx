export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-card bg-surface p-4">
      <h2 className="text-h2 font-semibold">{title}</h2>
      <p className="mt-1 text-caption text-muted">{text}</p>
    </div>
  );
}
