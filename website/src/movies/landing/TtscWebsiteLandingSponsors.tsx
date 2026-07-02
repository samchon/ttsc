"use client";

import TtscWebsiteLandingFadeIn from "./TtscWebsiteLandingFadeIn";
import TtscWebsiteLandingSectionEyebrow from "./TtscWebsiteLandingSectionEyebrow";

const SPONSORS_IMAGE =
  "https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg";
const SPONSORS_URL = "https://github.com/sponsors/samchon";

export default function TtscWebsiteLandingSponsors() {
  return (
    <section className="relative overflow-hidden border-t border-neutral-900 bg-neutral-950 px-6 py-24 md:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

      <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <TtscWebsiteLandingFadeIn>
          <TtscWebsiteLandingSectionEyebrow label="Sponsors" />
          <h2 className="max-w-xl text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
            Built with help from people who keep the work moving.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-400">
            Sponsor support funds the quiet work behind ttsc: TypeScript-Go
            upgrades, platform binaries, plugin compatibility, documentation,
            and the playground.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={SPONSORS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-all duration-300 hover:shadow-[0_0_44px_rgba(54,226,238,0.28)]"
            >
              Sponsor ttsc
            </a>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-600">
              Thank you for your support
            </p>
          </div>
        </TtscWebsiteLandingFadeIn>

        <TtscWebsiteLandingFadeIn delay={120}>
          <a
            href={SPONSORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-neutral-800 bg-black/35 p-5 transition-colors hover:border-cyan-300/45"
            aria-label="View ttsc sponsors on GitHub Sponsors"
          >
            <img
              src={SPONSORS_IMAGE}
              alt="ttsc sponsors"
              className="mx-auto w-full max-w-[620px]"
              loading="lazy"
            />
          </a>
        </TtscWebsiteLandingFadeIn>
      </div>
    </section>
  );
}
