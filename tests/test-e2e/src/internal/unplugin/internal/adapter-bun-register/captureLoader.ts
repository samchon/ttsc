import assert from "node:assert/strict";

import type { CapturedPlugin } from "./CapturedPlugin";

/** Minimal Bun load handler shape: path in, transformed contents + loader out. */
type BunLoader = (args: {
  path: string;
}) => Promise<{ contents: string; loader: string }>;

/** Set up one captured runtime plugin and return its persistent load handler. */
export async function captureLoader(
  plugin: CapturedPlugin,
): Promise<BunLoader> {
  let loader: BunLoader | undefined;
  await plugin.setup({
    onLoad(_options: { filter: RegExp }, handler: BunLoader) {
      loader = handler;
    },
  });
  assert.ok(loader, "captured plugin registered no onLoad handler");
  return loader;
}
