"use client";

interface TtscWebsiteLandingFadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export default function TtscWebsiteLandingFadeIn({
  children,
  className = "",
}: TtscWebsiteLandingFadeInProps) {
  return <div className={className}>{children}</div>;
}
