import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { STRIP_CONFIG } from "../../internal/transform-utility-plugin-config/STRIP_CONFIG";
import { STRIP_SOURCE } from "../../internal/transform-utility-plugin-config/STRIP_SOURCE";
import { aliasFor } from "../../internal/transform-utility-plugin-config/aliasFor";
import { createUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createUtilityPluginProject";

/**
 * Verifies the temp-walk hazard guard: a `strip.config.json` planted in the
 * directory that holds the generated tsconfig's temp tree must NOT be honored —
 * the project's own config wins.
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
