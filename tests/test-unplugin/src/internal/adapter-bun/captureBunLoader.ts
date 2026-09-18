import assert from "node:assert/strict";

import type { BunLoadOptions } from "./BunLoadOptions";
import type { BunLoader } from "./BunLoader";

type BunBuildConfig = {
  files?: Readonly<Record<string, unknown>>;
  root?: string;
};

/**
 * Register the Bun adapter against a capturing `setup` stub and return the
 * first `onLoad` handler plus its filter, mirroring how Bun drives the plugin.
 * No real Bun runtime is required.
 */
export async function captureBunLoader(
  plugin: {
    setup(build: unknown): void;
  },
  mode: "bundler" | "runtime" = "runtime",
  config?: BunBuildConfig,
): Promise<{
  loader: BunLoader;
  options: BunLoadOptions;
}> {
  const loaders: { loader: BunLoader; options: BunLoadOptions }[] = [];
  const build = {
    config,
    onLoad(options: BunLoadOptions, loader: BunLoader) {
      loaders.push({ loader, options });
    },
  } as {
    config?: BunBuildConfig;
    onLoad(options: BunLoadOptions, loader: BunLoader): void;
    onStart?: (callback: () => void | Promise<void>) => void;
  };
  if (mode === "bundler") build.onStart = () => undefined;
  plugin.setup(build);
  const registration = loaders[0];
  assert.ok(registration, "Bun adapter did not register an onLoad handler");
  return registration;
}
