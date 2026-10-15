import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type createTtscPlugin from "../../../../../packages/lint/src/createTtscPlugin";
import type { createConfigLoaderTempDirectory } from "../../../../../packages/lint/src/createTtscPlugin";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a TEMP junction cannot put a typed lint evaluator on another drive.
 *
 * 1. Create a project and a TEMP junction to the opposite Windows volume in each
 *    direction, with a preexisting descriptor identity directory.
 * 2. Run the built lint factory on a typed config that imports a helper and assert
 *    the selected canonical scratch stays with the lexical config.
 * 3. Repeat one direction without descriptor identities but with an existing
 *    same-drive user temp, then check the helper digest and scratch cleanup.
 *
 * @evidence contracts/testing.md#behavioral-verification The built lint factory evaluates typed configs through the real ttsx child in both junction directions and without selected identities in one direction; the returned helper digest, accepted scratch parent, stable project timestamps and empty scratch owners expose a wrong cross-drive choice or leaked evaluator.
 * @evidence contracts/testing.md#independent-expectations The authored helper bytes supply the expected SHA-256 digest, and independently resolved project, identity and TEMP volumes define the accepted parent without reading an implementation-derived result.
 * @evidence contracts/testing.md#distinguishing-cases Both physical TEMP drives opposite the lexical config drive are covered here, including a real factory fallback to an existing same-drive user temp without selected identities. The separate project-junction test covers an unavailable same-drive owner, while the allocator unit covers nearest-cache fallback.
 * @evidence contracts/testing.md#execution-ownership This selected Windows utility test calls the maintained built descriptor factory and typed-config evaluator only, without a native plugin build or product host; the suite runner discovers its named export and a missing second writable volume skips these cross-drive fixtures.
 */
export function test_lint_typed_config_uses_lexical_volume_when_temp_junction_crosses_drive(): void {
  if (process.platform !== "win32") return;

  const workspaceParent = fs.realpathSync.native(
    path.dirname(TestProject.WORKSPACE_ROOT),
  );
  let otherParent: string | undefined;
  for (const candidate of [
    process.env.LOCALAPPDATA,
    process.env.RUNNER_TEMP,
    os.tmpdir(),
  ]) {
    if (!candidate) continue;
    let probe: string | undefined;
    try {
      const physical = fs.realpathSync.native(candidate);
      if (
        path.parse(physical).root.toLowerCase() ===
        path.parse(workspaceParent).root.toLowerCase()
      ) {
        continue;
      }
      probe = fs.mkdtempSync(
        path.join(physical, "ttsc-lint-temp-volume-probe-"),
      );
      otherParent = physical;
      break;
    } catch {
      // Another candidate may provide a writable second volume.
    } finally {
      if (probe !== undefined) {
        assert.equal(
          fs.realpathSync.native(path.dirname(probe)),
          path.dirname(probe),
        );
        assert.ok(
          path.basename(probe).startsWith("ttsc-lint-temp-volume-probe-"),
        );
        fs.rmdirSync(probe);
      }
    }
  }
  if (otherParent === undefined) return;

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
      createConfigLoaderTempDirectory: typeof createConfigLoaderTempDirectory;
    }
  ).createConfigLoaderTempDirectory;
  const environmentKeys = [
    "TEMP",
    "TMP",
    "TMPDIR",
    "TTSC_BINARY",
    "TTSC_TSGO_BINARY",
    "TTSC_TTSX_BINARY",
    "TTSC_PLUGIN_RECORD_ROOT",
    "TTSC_LINT_DISABLE_CONFIG_CACHE",
    "LOCALAPPDATA",
  ] as const;
  const prior = environmentKeys.map((key) => process.env[key]);
  try {
    for (const [projectParent, tempTargetParent] of [
      [workspaceParent, otherParent],
      [otherParent, workspaceParent],
    ] as const) {
      const project = TestProject.tmpdir(
        "ttsc-lint-temp-volume-project-",
        projectParent,
      );
      const target = TestProject.tmpdir(
        "ttsc-lint-temp-volume-target-",
        tempTargetParent,
      );
      let alternate: string | undefined;
      const alias = path.join(project, "temp-alias");
      try {
        if (projectParent === workspaceParent)
          alternate = TestProject.tmpdir(
            "ttsc-lint-temp-volume-alternate-",
            projectParent,
          );
        const identities = path.join(project, "identities");
        const config = path.join(project, "lint.config.ts");
        const helper = 'export default "warning";\n';
        fs.mkdirSync(identities);
        fs.writeFileSync(
          path.join(project, "package.json"),
          '{"type":"module"}\n',
        );
        fs.writeFileSync(path.join(project, "severity.js"), helper);
        fs.writeFileSync(
          config,
          'import severity from "./severity.js";\nexport default { rules: { "no-var": severity } };\n',
        );
        fs.symlinkSync(target, alias, "junction");

        process.env.TEMP = alias;
        process.env.TMP = alias;
        process.env.TMPDIR = alias;
        process.env.TTSC_BINARY = TestProject.NATIVE_BINARY;
        process.env.TTSC_TSGO_BINARY = TestProject.TSGO_BINARY;
        process.env.TTSC_TTSX_BINARY = TestProject.TTSX_BIN;
        process.env.TTSC_PLUGIN_RECORD_ROOT = project;
        process.env.TTSC_LINT_DISABLE_CONFIG_CACHE = "1";

        const scratch = allocate(config, alias, project);
        try {
          assert.equal(
            path.dirname(scratch),
            fs.realpathSync.native(identities),
          );
        } finally {
          fs.rmdirSync(scratch);
        }
        const before = fs.statSync(project, { bigint: true });
        const descriptor = factory({
          binary: TestProject.NATIVE_BINARY,
          cwd: project,
          dirname: path.dirname(entry),
          filename: entry,
          plugin: { transform: "@ttsc/lint", configFile: config },
          pluginConfigDir: project,
          projectRoot: project,
          tsconfig: path.join(project, "tsconfig.json"),
        });
        assert.ok(
          Object.values(descriptor.hostInputHashes ?? {}).includes(
            createHash("sha256").update(helper).digest("hex"),
          ),
        );
        const after = fs.statSync(project, { bigint: true });
        assert.equal(after.mtimeNs, before.mtimeNs);
        assert.equal(after.ctimeNs, before.ctimeNs);
        assert.deepEqual(fs.readdirSync(identities), []);
        assert.deepEqual(fs.readdirSync(target), []);

        if (alternate !== undefined) {
          const userTemp = path.join(alternate, "Temp");
          fs.mkdirSync(userTemp);
          process.env.TTSC_PLUGIN_RECORD_ROOT = "";
          process.env.LOCALAPPDATA = alternate;
          const fallbackScratch = allocate(config, alias, "");
          try {
            assert.equal(
              path.dirname(fallbackScratch),
              fs.realpathSync.native(userTemp),
            );
          } finally {
            fs.rmdirSync(fallbackScratch);
          }
          const beforeFallback = fs.statSync(project, { bigint: true });
          const fallbackDescriptor = factory({
            binary: TestProject.NATIVE_BINARY,
            cwd: project,
            dirname: path.dirname(entry),
            filename: entry,
            plugin: { transform: "@ttsc/lint", configFile: config },
            pluginConfigDir: project,
            projectRoot: project,
            tsconfig: path.join(project, "tsconfig.json"),
          });
          assert.ok(
            Object.values(fallbackDescriptor.hostInputHashes ?? {}).includes(
              createHash("sha256").update(helper).digest("hex"),
            ),
          );
          const afterFallback = fs.statSync(project, { bigint: true });
          assert.equal(afterFallback.mtimeNs, beforeFallback.mtimeNs);
          assert.equal(afterFallback.ctimeNs, beforeFallback.ctimeNs);
          assert.deepEqual(fs.readdirSync(userTemp), []);
          assert.deepEqual(fs.readdirSync(target), []);
          assert.deepEqual(fs.readdirSync(identities), []);
        }
      } finally {
        if (fs.existsSync(alias)) fs.unlinkSync(alias);
        for (const [root, parent, prefix] of [
          [target, tempTargetParent, "ttsc-lint-temp-volume-target-"],
          [project, projectParent, "ttsc-lint-temp-volume-project-"],
        ] as const) {
          assert.equal(fs.realpathSync.native(path.dirname(root)), parent);
          assert.equal(path.dirname(fs.realpathSync.native(root)), parent);
          assert.ok(path.basename(root).startsWith(prefix));
          fs.rmSync(root, { recursive: true, force: true });
        }
        if (alternate !== undefined) {
          assert.equal(
            fs.realpathSync.native(path.dirname(alternate)),
            projectParent,
          );
          assert.equal(
            path.dirname(fs.realpathSync.native(alternate)),
            projectParent,
          );
          assert.ok(
            path
              .basename(alternate)
              .startsWith("ttsc-lint-temp-volume-alternate-"),
          );
          fs.rmSync(alternate, { recursive: true, force: true });
        }
      }
    }
  } finally {
    environmentKeys.forEach((key, index) => {
      if (prior[index] === undefined) delete process.env[key];
      else process.env[key] = prior[index];
    });
  }
}
