import { TestUnpluginRuntime } from "@ttsc/testing";

import type { BunRegister } from "./BunRegister";

/**
 * Freshly evaluate the built `bun-register` entry, so the module-level
 * auto-registration runs during import exactly as it would inside a Bun
 * preload. A unique query busts the ESM module cache so each call re-runs the
 * module's registration state. The caller must already have a Bun-like global
 * installed (see {@link withBunRuntime}).
 */
export async function importFreshBunRegister(): Promise<BunRegister> {
  const url = `${TestUnpluginRuntime.libUrl("bun-register")}?ra23=${Date.now()}-${Math.random()}`;
  const mod = await import(url);
  return mod.default as BunRegister;
}
