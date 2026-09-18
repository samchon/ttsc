import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";

import { LOADER } from "./LOADER";

/**
 * The loader's package specifier, its resolved CommonJS path, and its built ESM
 * path, which must all be recognized as this loader.
 */
export const LOADER_IDENTITIES = [
  LOADER,
  TestUnpluginProject.REQUIRE_FROM_UNPLUGIN.resolve(LOADER),
  TestUnpluginRuntime.libPath("turbopack", "mjs"),
];
