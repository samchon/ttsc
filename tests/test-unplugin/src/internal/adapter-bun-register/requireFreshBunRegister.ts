import { TestUnpluginRuntime } from "@ttsc/testing";
import { createRequire } from "node:module";

import type { BunRegister } from "./BunRegister";

const REQUIRE_FROM_TEST = createRequire(import.meta.url);

/** Freshly evaluate the CommonJS condition beside the ESM preload condition. */
export function requireFreshBunRegister(): BunRegister {
  const file = TestUnpluginRuntime.libPath("bun-register", "js");
  const resolved = REQUIRE_FROM_TEST.resolve(file);
  delete REQUIRE_FROM_TEST.cache[resolved];
  return (REQUIRE_FROM_TEST(file) as { default: BunRegister }).default;
}
