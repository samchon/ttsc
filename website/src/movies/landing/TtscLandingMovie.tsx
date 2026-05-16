"use client";

import FadeIn from "./FadeIn";
import TtscLandingCliMovie from "./TtscLandingCliMovie";
import TtscLandingCtaMovie from "./TtscLandingCtaMovie";
import TtscLandingFeaturesMovie from "./TtscLandingFeaturesMovie";
import TtscLandingHeroMovie from "./TtscLandingHeroMovie";
import TtscLandingPluginsMovie from "./TtscLandingPluginsMovie";
import TtscLandingTransformMovie from "./TtscLandingTransformMovie";

function SectionDivider() {
  return (
    <div className="max-w-6xl mx-auto px-6">
      <div className="h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />
    </div>
  );
}

export default function TtscLandingMovie() {
  return (
    <div className="ttsc-landing text-white bg-neutral-950 min-h-screen">
      <TtscLandingHeroMovie />
      <SectionDivider />
      <TtscLandingCliMovie />
      <SectionDivider />
      <TtscLandingTransformMovie />
      <SectionDivider />
      <TtscLandingPluginsMovie />
      <SectionDivider />
      <TtscLandingFeaturesMovie />
      <SectionDivider />
      <TtscLandingCtaMovie />
    </div>
  );
}
