import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies `${configDir}` in an inherited preset uses the final consumer.
 *
 * Ordinary relative compiler paths stay relative to the config that declares
 * them. TypeScript's `${configDir}` template is deliberately different: it is
 * preserved through `extends` and substituted from the consuming tsconfig.
 *
 * 1. Write a preset using the configDir template in base, declaration, output,
 *    bundle, root and build-info options, and extend it from a consumer.
 * 2. Require every path to be anchored on the consuming config, including
 *    drive-shaped and backslash spellings.
 * 3. Write a mis-cased template and require it to anchor on the consumer but stay
 *    as written.
 *
 * @evidence contracts/testing.md#behavioral-verification Checks six inherited path options and a mis-cased configDir spelling, detecting preset-relative substitution, separator loss or incorrect rewriting of the mis-cased literal.
 * @evidence contracts/testing.md#independent-expectations Expected paths are built from the authored consumer directory with path.join or path.resolve according to the compiler's template rule (the template is replaced only in its exact spelling and anchors at the consuming config), including the mis-cased literal being retained; the drive-shaped rootDir row uses path.resolve(root, './C:/sources'), which is the same resolution the reader applies, so that single row only pins the relative anchoring.
 * @evidence contracts/testing.md#distinguishing-cases Bare, slash, backslash, output-file and drive-looking suffixes contrast with the mis-cased token; resolves_inherited_relative_path_options_from_the_declaring_file owns ordinary preset-relative paths.
 * @evidence contracts/testing.md#execution-ownership A unit test calling readProjectConfig directly on a preset using ${configDir} in six path options, extended by a consumer, plus a mis-cased template in a private temp directory; no install, native build, compiler process or CLI is involved.
 */
export const test_readprojectconfig_substitutes_configdir_from_the_final_consumer =
  (): void => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-config-dir-template-"),
    );
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

    // The compiler recognizes the template without regard to case but rewrites
    // only the exact spelling, so a mis-cased one anchors on the consuming
    // config and then stays in the path exactly as written. This function
    // reports where the compiler will put the file, so it reproduces both
    // halves rather than the half that reads like the intent.
    const miscased = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-config-dir-miscased-"),
    );
    fs.writeFileSync(
      path.join(miscased, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { outDir: "${ConfigDir}/dist" } }),
      "utf8",
    );
    assert.equal(
      readProjectConfig({
        cwd: miscased,
        tsconfig: path.join(miscased, "tsconfig.json"),
      }).compilerOptions.outDir,
      path.resolve(miscased, "${ConfigDir}/dist"),
    );
  };
