import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { STRIP_CONFIG } from "../../../internal/transform-utility-plugin-config/STRIP_CONFIG";
import { STRIP_SOURCE } from "../../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { aliasFor } from "../../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies a `strip.config.json` planted in the system temp directory is never
 * honored.
 *
 * The generated tsconfig lives under the temp directory. A plugin that
 * discovered its config by walking up from there would read whatever another
 * process left behind instead of the project's own file.
 *
 * 1. Create a strip project, and plant a conflicting `strip.config.json` in a temp
 *    directory.
 * 2. Point `TMPDIR`, `TEMP`, and `TMP` at it and transform with a bundler alias.
 * 3. Assert the project's config wins, then restore the environment.
 *
 * @evidence contracts/testing.md#behavioral-verification After TMPDIR/TEMP/TMP point at a directory containing hostile console.log strip config, the aliased transform must still remove project-selected logger.trace and keep console.log. This catches wrapper-root discovery importing another process's config.
 * @evidence contracts/testing.md#independent-expectations The project and hostile configs deliberately select opposite calls. Literal removal/preservation assertions independently require the project choice without reproducing discovery; source contains both calls so either wrong root or no stripping is distinguishable.
 * @evidence contracts/testing.md#distinguishing-cases Project config competes with an actual conflicting config above the generated wrapper, rather than merely an absent temp config. The ordinary project-strip entry owns the unopposed alias baseline.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_alias_overlay_ignores_strip_config_planted_in_temp_dir in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The generated JS tsconfig wrapper and real first-party native utility host must preserve project-based config discovery. Direct config parsing cannot detect the compiler/plugin using the temporary wrapper directory as its discovery root.
 * @evidence contracts/e2e.md#shared-execution createUtilityPluginProject allocates this consumer and seeds the existing first-party plugin; native producer/build preparation is shared through TestUnpluginProject. The aliasFor map changes generated wrapper input while keeping the authored source/config identity fixed; no separate installation is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique project and planted-temp roots isolate both candidate configs. All three temp environment variables are saved and restored in finally, including originally absent values. The shared plugin source stays fixed and TestProject owns temporary roots through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_alias_overlay_ignores_strip_config_planted_in_temp_dir; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_alias_overlay_ignores_strip_config_planted_in_temp_dir(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    files: { "strip.config.json": STRIP_CONFIG },
    plugin: "strip",
    source: STRIP_SOURCE,
  });
  // Redirect the OS temp dir so the generated tsconfig lands under a
  // directory we control, with a hostile strip config planted one level
  // above the generated tree (i.e. exactly on the old discovery walk).
  const plantedTemp = TestProject.tmpdir("ttsc-unplugin-planted-");
  fs.writeFileSync(
    path.join(plantedTemp, "strip.config.json"),
    JSON.stringify({ calls: ["console.log"], statements: [] }),
    "utf8",
  );
  const previous = {
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
  };
  process.env.TMPDIR = plantedTemp;
  process.env.TEMP = plantedTemp;
  process.env.TMP = plantedTemp;
  try {
    const result = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      resolveOptions(),
      aliasFor(root),
    );

    assert.ok(result);
    // The planted config strips console.log; the project config keeps it and
    // strips logger.trace instead.
    assert.doesNotMatch(result.code, /logger\.trace\("drop"\)/);
    assert.match(result.code, /console\.log\("kept"\)/);
  } finally {
    restoreEnv("TEMP", previous.TEMP);
    restoreEnv("TMP", previous.TMP);
    restoreEnv("TMPDIR", previous.TMPDIR);
  }
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
