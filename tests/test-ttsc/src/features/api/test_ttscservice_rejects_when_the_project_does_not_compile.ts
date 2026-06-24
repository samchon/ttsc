import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscService } from "../../../../../packages/ttsc/lib/index.js";
import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { tsgo } from "../../internal/compiler";

/**
 * Verifies TtscService.transformFile rejects when the project does not compile.
 *
 * The documented contract: a transform request rejects (rather than resolving
 * to an empty or stale result) when the resident host failed to compile the
 * project, so a real build error reaches the caller. The host exits non-zero at
 * startup on a type error, and the client surfaces that as a rejected request.
 *
 * Uses the shared utility-plugins fixture (so the constructor's plugin build
 * succeeds and the only failure is the type error), then breaks one source
 * file. Exercises the real native compiler and a Go linked host, so it runs in
 * CI.
 *
 * 1. Copy the fixture and replace src/main.ts with a non-compiling source.
 * 2. Construct a TtscService (the plugin build still succeeds).
 * 3. Assert transformFile rejects.
 */
export const test_ttscservice_rejects_when_the_project_does_not_compile =
  async () => {
    const root = TestProject.copyProject("ttsc-utility-plugins");
    TestUtilityPlugins.seedPackages(root);
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      'export const broken: number = "not a number";\n',
      "utf8",
    );
    const service = new TtscService({
      binary: tsgo,
      cwd: root,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-resident-fail-"),
      },
    });
    try {
      await assert.rejects(() => service.transformFile("src/main.ts"));
    } finally {
      service.dispose();
    }
  };
