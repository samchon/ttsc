import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";

import { LOADER } from "./LOADER";

export const LOADER_IDENTITIES = [
  LOADER,
  TestUnpluginProject.REQUIRE_FROM_UNPLUGIN.resolve(LOADER),
  TestUnpluginRuntime.libPath("turbopack", "mjs"),
];
