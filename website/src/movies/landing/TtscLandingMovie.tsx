"use client";

import Footer from "./Footer";
import Hero from "./Hero";
import InTheBrowser from "./InTheBrowser";
import LintAsCompileError from "./LintAsCompileError";
import PluginEcosystem from "./PluginEcosystem";
import RestOfToolchain from "./RestOfToolchain";
import Sponsors from "./Sponsors";

export default function TtscLandingMovie() {
  return (
    <div className="ttsc-landing text-white bg-neutral-950 min-h-screen">
      <Hero />
      <RestOfToolchain />
      <LintAsCompileError />
      <PluginEcosystem />
      <InTheBrowser />
      <Sponsors />
      <Footer />
    </div>
  );
}
