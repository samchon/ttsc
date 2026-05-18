"use client";

import FinalCta from "./FinalCta";
import Footer from "./Footer";
import Hero from "./Hero";
import InTheBrowser from "./InTheBrowser";
import LintAsCompileError from "./LintAsCompileError";
import OneCompilePass from "./OneCompilePass";
import PluginEcosystem from "./PluginEcosystem";
import RestOfToolchain from "./RestOfToolchain";
import Switching from "./Switching";

export default function TtscLandingMovie() {
  return (
    <div className="ttsc-landing text-white bg-neutral-950 min-h-screen">
      <Hero />
      <LintAsCompileError />
      <OneCompilePass />
      <PluginEcosystem />
      <RestOfToolchain />
      <InTheBrowser />
      <Switching />
      <FinalCta />
      <Footer />
    </div>
  );
}
