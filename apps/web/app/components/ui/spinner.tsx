export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-600" role="status">
      <span
        aria-hidden="true"
        className="inline-block size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700"
      />
      <span>{label}</span>
    </div>
  );
}
