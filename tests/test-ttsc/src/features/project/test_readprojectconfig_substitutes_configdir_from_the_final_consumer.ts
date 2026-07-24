import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readProjectConfig } from "../../../../../packages/ttsc/lib/compiler/internal/project/readProjectConfig.js";

/**
 * Verifies `${configDir}` in an inherited preset uses the final consumer.
 *
 * Ordinary relative compiler paths stay relative to the config that declares
 * them. TypeScript's `${configDir}` template is deliberately different: it is
 * preserved through `extends` and substituted from the consuming tsconfig.
 */
export const test_readprojectconfig_substitutes_configdir_from_the_final_consumer =
  (): void => {
    const root = TestProject.tmpdir("ttsc-config-dir-template-");
    const preset = path.join(root, "presets", "base.json");
    fs.mkdirSync(path.dirname(preset), { recursive: true });
    fs.writeFileSync(
      preset,
      JSON.stringify({
        compilerOptions: {
          baseUrl: "${configDir}base",
          declarationDir: "${configDir}/types",
          outDir: "${configDir}/dist",
          outFile: "${configDir}/bundle/output.js",
          rootDir: "${configDir}C:\\sources",
          tsBuildInfoFile: "${configDir}\\cache\\build.tsbuildinfo",
        },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({ extends: "./presets/base.json" }),
      "utf8",
    );

    const project = readProjectConfig({
      cwd: root,
      tsconfig: path.join(root, "tsconfig.json"),
    });
    assert.equal(project.compilerOptions.baseUrl, path.join(root, "base"));
    assert.equal(
      project.compilerOptions.declarationDir,
      path.join(root, "types"),
    );
    assert.equal(project.compilerOptions.outDir, path.join(root, "dist"));
    assert.equal(
      project.compilerOptions.outFile,
      path.join(root, "bundle", "output.js"),
    );
    assert.equal(
      project.compilerOptions.rootDir,
      path.resolve(root, "./C:/sources"),
    );
    assert.equal(
      project.compilerOptions.tsBuildInfoFile,
      path.join(root, "cache", "build.tsbuildinfo"),
    );
  };
