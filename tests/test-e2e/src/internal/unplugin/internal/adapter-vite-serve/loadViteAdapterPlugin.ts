import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/** Resolve the ttsc plugin object out of the Vite adapter's factory result. */
export async function loadViteAdapterPlugin(): Promise<any> {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const plugin: any = [unpluginVite()]
    .flat()
    .find((entry: any) => entry?.name === "ttsc-unplugin");
  assert.ok(plugin, "the vite adapter must expose the ttsc plugin object");
  return plugin;
}
