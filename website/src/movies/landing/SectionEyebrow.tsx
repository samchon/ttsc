interface SectionEyebrowProps {
  num: string;
  label: string;
}

export default function SectionEyebrow({ num, label }: SectionEyebrowProps) {
  return (
    <p className="font-mono text-[11px] tracking-[0.2em] mb-6">
      <span className="text-cyan-300">[ § {num}</span>
      <span className="text-neutral-600"> · </span>
      <span className="text-neutral-400 uppercase">{label}</span>
      <span className="text-cyan-300"> ]</span>
    </p>
  );
}
