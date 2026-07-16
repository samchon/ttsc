interface TtscWebsiteLandingSectionEyebrowProps {
  label: string;
}

export default function TtscWebsiteLandingSectionEyebrow({
  label,
}: TtscWebsiteLandingSectionEyebrowProps) {
  return (
    <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em]">
      <span className="text-[#3178c6]">[</span>
      <span className="mx-2 text-[#526b82]">{label}</span>
      <span className="text-[#3178c6]">]</span>
    </p>
  );
}
