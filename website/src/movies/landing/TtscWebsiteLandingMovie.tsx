"use client";

import TtscWebsiteLandingFooter from "./TtscWebsiteLandingFooter";
import TtscWebsiteLandingHero from "./TtscWebsiteLandingHero";
import TtscWebsiteLandingInTheBrowser from "./TtscWebsiteLandingInTheBrowser";
import TtscWebsiteLandingLintAsCompileError from "./TtscWebsiteLandingLintAsCompileError";
import TtscWebsiteLandingPluginEcosystem from "./TtscWebsiteLandingPluginEcosystem";
import TtscWebsiteLandingRestOfToolchain from "./TtscWebsiteLandingRestOfToolchain";
import TtscWebsiteLandingSponsors from "./TtscWebsiteLandingSponsors";

export default function TtscWebsiteLandingMovie() {
  return (
    <div className="ttsc-landing text-white bg-neutral-950 min-h-screen">
      <TtscWebsiteLandingHero />
      <TtscWebsiteLandingRestOfToolchain />
      <TtscWebsiteLandingLintAsCompileError />
      <TtscWebsiteLandingPluginEcosystem />
      <TtscWebsiteLandingInTheBrowser />
      <TtscWebsiteLandingSponsors />
      <TtscWebsiteLandingFooter />
    </div>
  );
}
