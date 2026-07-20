export function ActionFeedback({
  state,
  compact = false,
}: {
  state: { ok: boolean; message: string };
  compact?: boolean;
}) {
  if (!state.message) return null;

  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`${compact ? "text-xs" : "text-sm"} ${
        state.ok ? "text-[#15803d]" : "text-[#b91c1c]"
      }`}
    >
      {state.message}
    </p>
  );
}
