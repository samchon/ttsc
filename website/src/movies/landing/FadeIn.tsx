"use client";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export default function FadeIn({ children, className = "" }: FadeInProps) {
  return <div className={className}>{children}</div>;
}
