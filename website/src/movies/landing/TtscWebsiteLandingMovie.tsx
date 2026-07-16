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
    <div className="ttsc-landing min-h-screen bg-white text-[#102a43]">
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
