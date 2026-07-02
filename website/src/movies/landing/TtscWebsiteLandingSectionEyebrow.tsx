interface TtscWebsiteLandingSectionEyebrowProps {
  label: string;
}

export default function TtscWebsiteLandingSectionEyebrow({
  label,
}: TtscWebsiteLandingSectionEyebrowProps) {
  return (
    <p className="font-mono text-[11px] tracking-[0.2em] uppercase mb-6">
      <span className="text-cyan-300">[</span>
      <span className="text-neutral-400 mx-2">{label}</span>
      <span className="text-cyan-300">]</span>
    </p>
  );
}
