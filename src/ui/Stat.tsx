type Props = {
  label: string;
  value: number;
  accent: string;
};

export default function Stat({ label, value, accent }: Props) {
  return (
    <div className="flex min-w-[78px] flex-col items-center px-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg/55">
        {label}
      </span>
      <span
        className="font-mono mt-1 text-2xl font-semibold leading-tight tabular-nums"
        style={{ color: accent, textShadow: `0 0 14px ${accent}aa` }}
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}
