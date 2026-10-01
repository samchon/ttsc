import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchSession } from "../../../internal/ttsc/internal/watch";

/**
 * Verifies project-mode output inference against files tsgo actually writes.
 *
 * Adjacent products matter most at input boundaries: a source outside the
 * project root and an `allowJs` `.jsx` source both live outside the ordinary
 * TypeScript source assumptions. The incremental bundle case pins tsgo's
 * config-based default build-info path.
 *
 * 1. Watch external declaration-only output and require quiet.
 * 2. Repeat for allowJs JSX adjacent JavaScript.
 * 3. Check incremental default build-info placement and require quiet.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs three WatchSessions: external declaration-only source, allowJs JSX and incremental outFile; asserts their actual adjacent/config-default outputs, wrong bundle build-info absence and no additional build/start during quiet.
 * @evidence contracts/testing.md#independent-expectations TypeScript emission rules independently determine adjacent d.ts/JS and config-based build-info paths. Authored paths plus build/start counts distinguish native output inference from guessed names.
 * @evidence contracts/testing.md#distinguishing-cases Owns outside-root declaration output, JSX output and default/incorrect build-info locations. Each quiet observation lasts 900ms and does not prove permanent silence.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_ignores_actual_project_outputs_at_input_boundaries is discovered under src/features/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary Native producer output must pass the running watcher exclusion so actual filesystem callbacks do not feed an emit loop. Pure filename inference cannot establish producer-to-watch transport.
 * @evidence contracts/e2e.md#shared-execution Three incompatible option/input layouts use three sessions; each batches actual emit-path and idle assertions in one child. Shared launcher/compiler preparation avoids native producer rebuilding.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each session closes in finally with WatchSession 30-second escalation; TestProject owns the external and project roots until exit. Distinct roots prevent adjacent products contaminating another layout.
 * @evidence contracts/e2e.md#preserved-coverage All three output presence checks, wrong build-info absence and quiet assertions remain. The sequential local batch skips later layouts after a failure and does not inspect output content.
 */
export const test_ttsc_watch_ignores_actual_project_outputs_at_input_boundaries =
  async (): Promise<void> => {
    const externalRoot = TestProject.tmpdir("ttsc-external-project-output-");
    const externalSource = path.join(externalRoot, "input.ts");
    fs.writeFileSync(externalSource, "export const external = 1;\n", "utf8");
    const externalProject = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          declaration: true,
          emitDeclarationOnly: true,
        },
        files: [externalSource],
      }),
    });
    const external = new WatchSession(externalProject);
    try {
      await external.waitForBuilds(1);
      assert.equal(
        fs.existsSync(path.join(externalRoot, "input.d.ts")),
        true,
        external.transcript(),
      );
      await external.waitForQuiet();
    } finally {
      await external.close();
    }

    const jsxProject = TestProject.createProject(FixtureFiles.read("ttsc/ttsc_watch_ignores_actual_project_outputs_at_input_boundaries/inputs-1"));
    const jsx = new WatchSession(jsxProject);
    try {
      await jsx.waitForBuilds(1);
      assert.equal(
        fs.existsSync(path.join(jsxProject, "src", "input.js")),
        true,
        jsx.transcript(),
      );
      await jsx.waitForQuiet();
    } finally {
      await jsx.close();
    }

    const incrementalProject = TestProject.createProject(FixtureFiles.read("ttsc/ttsc_watch_ignores_actual_project_outputs_at_input_boundaries/inputs-2"));
    const incremental = new WatchSession(incrementalProject);
    try {
      await incremental.waitForBuilds(1);
      assert.equal(
        fs.existsSync(path.join(incrementalProject, "tsconfig.tsbuildinfo")),
        true,
        incremental.transcript(),
      );
      assert.equal(
        fs.existsSync(
          path.join(incrementalProject, "dist", "bundle.tsbuildinfo"),
        ),
        false,
        incremental.transcript(),
      );
      await incremental.waitForQuiet();
    } finally {
      await incremental.close();
    }
  };
