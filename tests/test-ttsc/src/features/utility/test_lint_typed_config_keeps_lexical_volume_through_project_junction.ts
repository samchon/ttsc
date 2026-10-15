import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type createTtscPlugin from "../../../../../packages/lint/src/createTtscPlugin";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a typed lint config still compiles from its lexical Windows drive
 * when a project junction points to another physical volume.
 *
 * 1. Put a typed config and its imported helper on the workspace volume, then
 *    expose them through a junction on another volume.
 * 2. Evaluate with TEMP on the lexical drive, then with TEMP on the physical drive
 *    and either lexical identities or a preexisting user temp directory.
 * 3. Compare a same-volume TEMP at the project root with preexisting identities,
 *    and assert selected scratch cleanup and an actionable unavailable error.
 *
 * @evidence contracts/testing.md#behavioral-verification The real allocator chooses lexical system temp, lexical identities or preexisting user temp, then the typed-config factory launches its evaluator with the junction path; each descriptor retains the independently hashed imported helper, and project metadata and temporary entries remain stable in these alias cases. A same-volume TEMP equal to the project root uses preexisting identities, and all-safe-owners-absent reports unavailable scratch instead of launching a doomed cross-drive compiler.
 * @evidence contracts/testing.md#independent-expectations Authored helper bytes define the SHA-256 digest; the config's lexical drive and physical project drive are checked independently of the allocator. A D-rooted loader would make TypeScript-Go reject the C-lexical config with TS6059.
 * @evidence contracts/testing.md#distinguishing-cases Physical-drive identities cannot override ordinary same-lexical-drive temp, lexical-drive identities win for cross-volume temp or same-volume project-root temp, and a preexisting user temp rescues absent authority; the no-candidate case rejects, while the separate allocator test owns nearest-cache choices.
 * @evidence contracts/testing.md#execution-ownership This selected Windows utility test calls the maintained descriptor factory and its typed-config evaluator only. It builds no native plugin or consumer project and skips when a second writable volume is unavailable; the suite runner discovers its named export.
 */
export function test_lint_typed_config_keeps_lexical_volume_through_project_junction(): void {
  if (process.platform !== "win32") return;

  const projectParent = fs.realpathSync.native(
    path.join(TestProject.WORKSPACE_ROOT, "node_modules", ".cache"),
  );
  const projectVolume = path.parse(projectParent).root.toLowerCase();
  let aliasParent: string | undefined;
  for (const candidate of [
    process.env.LOCALAPPDATA,
    process.env.RUNNER_TEMP,
    os.tmpdir(),
  ]) {
    if (!candidate) continue;
    let probe: string | undefined;
    try {
      const physical = fs.realpathSync.native(candidate);
      if (path.parse(physical).root.toLowerCase() === projectVolume) continue;
      probe = fs.mkdtempSync(path.join(physical, "ttsc-lint-volume-probe-"));
      aliasParent = physical;
      break;
    } catch {
      // Another candidate may provide a writable second volume.
    } finally {
      if (probe !== undefined) {
        assert.equal(
          fs.realpathSync.native(path.dirname(probe)),
          path.dirname(probe),
        );
        assert.ok(path.basename(probe).startsWith("ttsc-lint-volume-probe-"));
        fs.rmdirSync(probe);
      }
    }
  }
  if (aliasParent === undefined) return;

  const project = TestProject.tmpdir(
    "ttsc-lint-lexical-project-",
    projectParent,
  );
  const aliasRoot = TestProject.tmpdir("ttsc-lint-lexical-alias-", aliasParent);
  const temp = TestProject.tmpdir("ttsc-lint-lexical-temp-", aliasParent);
  const crossTemp = TestProject.tmpdir(
    "ttsc-lint-lexical-cross-temp-",
    projectParent,
  );
  const alias = path.join(aliasRoot, "linked-project");
  const environmentKeys = [
    "TEMP",
    "TMP",
    "TMPDIR",
    "LOCALAPPDATA",
    "TTSC_BINARY",
    "TTSC_TSGO_BINARY",
    "TTSC_TTSX_BINARY",
    "TTSC_PLUGIN_RECORD_ROOT",
    "TTSC_LINT_DISABLE_CONFIG_CACHE",
  ] as const;
  const prior = environmentKeys.map((key) => process.env[key]);
  try {
    fs.mkdirSync(path.join(project, "identities"));
    fs.writeFileSync(path.join(project, "package.json"), '{"type":"module"}\n');
    const helper = 'export default "warning";\n';
    fs.writeFileSync(path.join(project, "severity.js"), helper);
    fs.writeFileSync(
      path.join(project, "lint.config.ts"),
      'import severity from "./severity.js";\nexport default { rules: { "no-var": severity } };\n',
    );
    fs.symlinkSync(project, alias, "junction");

    process.env.TEMP = temp;
    process.env.TMP = temp;
    process.env.TMPDIR = temp;
    process.env.TTSC_BINARY = TestProject.NATIVE_BINARY;
    process.env.TTSC_TSGO_BINARY = TestProject.TSGO_BINARY;
    process.env.TTSC_TTSX_BINARY = TestProject.TTSX_BIN;
    process.env.TTSC_PLUGIN_RECORD_ROOT = project;
    process.env.TTSC_LINT_DISABLE_CONFIG_CACHE = "1";

    const entry = TestProject.REQUIRE_FROM_TEST.resolve(
      path.join(TestProject.WORKSPACE_ROOT, "packages", "lint"),
    );
    const factory = (
      TestProject.REQUIRE_FROM_TEST(entry) as {
        default: typeof createTtscPlugin;
      }
    ).default;
    const allocate = (
      TestProject.REQUIRE_FROM_TEST(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages",
          "lint",
          "lib",
          "createTtscPlugin.js",
        ),
      ) as {
        createConfigLoaderTempDirectory: typeof import("../../../../../packages/lint/src/createTtscPlugin").createConfigLoaderTempDirectory;
      }
    ).createConfigLoaderTempDirectory;
    const scratch = allocate(path.join(alias, "lint.config.ts"), temp, project);
    try {
      assert.equal(path.dirname(scratch), fs.realpathSync.native(temp));
    } finally {
      fs.rmdirSync(scratch);
    }
    const beforeProject = fs.statSync(project, { bigint: true });
    const beforeTemp = fs.readdirSync(temp);
    const descriptor = factory({
      binary: TestProject.NATIVE_BINARY,
      cwd: alias,
      dirname: path.dirname(entry),
      filename: entry,
      plugin: {
        transform: "@ttsc/lint",
        configFile: path.join(alias, "lint.config.ts"),
      },
      pluginConfigDir: alias,
      projectRoot: alias,
      tsconfig: path.join(alias, "tsconfig.json"),
    });
    const digest = createHash("sha256").update(helper).digest("hex");
    assert.ok(Object.values(descriptor.hostInputHashes ?? {}).includes(digest));
    assert.deepEqual(fs.readdirSync(temp), beforeTemp);
    const afterProject = fs.statSync(project, { bigint: true });
    assert.equal(afterProject.mtimeNs, beforeProject.mtimeNs);
    assert.equal(afterProject.ctimeNs, beforeProject.ctimeNs);

    const lexicalIdentities = path.join(aliasRoot, "identities");
    fs.mkdirSync(lexicalIdentities);
    process.env.TEMP = crossTemp;
    process.env.TMP = crossTemp;
    process.env.TMPDIR = crossTemp;
    process.env.TTSC_PLUGIN_RECORD_ROOT = aliasRoot;
    const crossScratch = allocate(
      path.join(alias, "lint.config.ts"),
      crossTemp,
      aliasRoot,
    );
    try {
      assert.equal(
        path.dirname(crossScratch),
        fs.realpathSync.native(lexicalIdentities),
      );
    } finally {
      fs.rmdirSync(crossScratch);
    }
    const beforeCross = fs.statSync(project, { bigint: true });
    const crossDescriptor = factory({
      binary: TestProject.NATIVE_BINARY,
      cwd: alias,
      dirname: path.dirname(entry),
      filename: entry,
      plugin: {
        transform: "@ttsc/lint",
        configFile: path.join(alias, "lint.config.ts"),
      },
      pluginConfigDir: alias,
      projectRoot: alias,
      tsconfig: path.join(alias, "tsconfig.json"),
    });
    assert.ok(
      Object.values(crossDescriptor.hostInputHashes ?? {}).includes(digest),
    );
    const afterCross = fs.statSync(project, { bigint: true });
    assert.equal(afterCross.mtimeNs, beforeCross.mtimeNs);
    assert.equal(afterCross.ctimeNs, beforeCross.ctimeNs);
    assert.deepEqual(fs.readdirSync(lexicalIdentities), []);
    assert.deepEqual(fs.readdirSync(crossTemp), []);

    const userTemp = path.join(aliasRoot, "Temp");
    fs.mkdirSync(userTemp);
    process.env.TTSC_PLUGIN_RECORD_ROOT = "";
    process.env.LOCALAPPDATA = aliasRoot;
    const alternateScratch = allocate(
      path.join(alias, "lint.config.ts"),
      crossTemp,
      "",
    );
    try {
      assert.equal(
        path.dirname(alternateScratch),
        fs.realpathSync.native(userTemp),
      );
    } finally {
      fs.rmdirSync(alternateScratch);
    }
    const beforeAlternate = fs.statSync(project, { bigint: true });
    const alternateDescriptor = factory({
      binary: TestProject.NATIVE_BINARY,
      cwd: alias,
      dirname: path.dirname(entry),
      filename: entry,
      plugin: {
        transform: "@ttsc/lint",
        configFile: path.join(alias, "lint.config.ts"),
      },
      pluginConfigDir: alias,
      projectRoot: alias,
      tsconfig: path.join(alias, "tsconfig.json"),
    });
    assert.ok(
      Object.values(alternateDescriptor.hostInputHashes ?? {}).includes(digest),
    );
    const afterAlternate = fs.statSync(project, { bigint: true });
    assert.equal(afterAlternate.mtimeNs, beforeAlternate.mtimeNs);
    assert.equal(afterAlternate.ctimeNs, beforeAlternate.ctimeNs);
    assert.deepEqual(fs.readdirSync(userTemp), []);
    assert.deepEqual(fs.readdirSync(crossTemp), []);

    process.env.LOCALAPPDATA = crossTemp;
    const beforeUnavailable = fs.statSync(project, { bigint: true });
    assert.throws(
      () => allocate(path.join(alias, "lint.config.ts"), crossTemp, ""),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes(
          `no writable temporary directory on ${path.parse(alias).root}`,
        ) &&
        error.message.includes("set TEMP, TMP, or TMPDIR"),
    );
    assert.throws(
      () =>
        factory({
          binary: TestProject.NATIVE_BINARY,
          cwd: alias,
          dirname: path.dirname(entry),
          filename: entry,
          plugin: {
            transform: "@ttsc/lint",
            configFile: path.join(alias, "lint.config.ts"),
          },
          pluginConfigDir: alias,
          projectRoot: alias,
          tsconfig: path.join(alias, "tsconfig.json"),
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes(
          `no writable temporary directory on ${path.parse(alias).root}`,
        ) &&
        error.message.includes("set TEMP, TMP, or TMPDIR"),
    );
    const afterUnavailable = fs.statSync(project, { bigint: true });
    assert.equal(afterUnavailable.mtimeNs, beforeUnavailable.mtimeNs);
    assert.equal(afterUnavailable.ctimeNs, beforeUnavailable.ctimeNs);
    assert.deepEqual(fs.readdirSync(crossTemp), []);

    process.env.TEMP = project;
    process.env.TMP = project;
    process.env.TMPDIR = project;
    process.env.TTSC_PLUGIN_RECORD_ROOT = project;
    const projectIdentities = path.join(project, "identities");
    const sameScratch = allocate(
      path.join(project, "lint.config.ts"),
      project,
      project,
    );
    try {
      assert.equal(
        path.dirname(sameScratch),
        fs.realpathSync.native(projectIdentities),
      );
    } finally {
      fs.rmdirSync(sameScratch);
    }
    const sameDescriptor = factory({
      binary: TestProject.NATIVE_BINARY,
      cwd: project,
      dirname: path.dirname(entry),
      filename: entry,
      plugin: {
        transform: "@ttsc/lint",
        configFile: path.join(project, "lint.config.ts"),
      },
      pluginConfigDir: project,
      projectRoot: project,
      tsconfig: path.join(project, "tsconfig.json"),
    });
    assert.ok(
      Object.values(sameDescriptor.hostInputHashes ?? {}).includes(digest),
    );
    assert.deepEqual(fs.readdirSync(projectIdentities), []);
  } finally {
    environmentKeys.forEach((key, index) => {
      if (prior[index] === undefined) delete process.env[key];
      else process.env[key] = prior[index];
    });
    if (fs.existsSync(alias)) fs.unlinkSync(alias);
    for (const [root, parent, prefix] of [
      [temp, aliasParent, "ttsc-lint-lexical-temp-"],
      [aliasRoot, aliasParent, "ttsc-lint-lexical-alias-"],
      [crossTemp, projectParent, "ttsc-lint-lexical-cross-temp-"],
      [project, projectParent, "ttsc-lint-lexical-project-"],
    ] as const) {
      assert.equal(fs.realpathSync.native(path.dirname(root)), parent);
      assert.equal(path.dirname(fs.realpathSync.native(root)), parent);
      assert.ok(path.basename(root).startsWith(prefix));
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}
