import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Verifies typed lint, banner and strip configs leave the consumer root stable
 * during a real transform when the evaluators' system temporary directory is on
 * another volume.
 *
 * A descriptor's caught missing require depends on the project root's directory
 * metadata. The typed config evaluators must put their scratch below the
 * selected source cache, or their own create/remove cycle changes that
 * metadata.
 *
 * 1. Select separate writable Windows volumes and prepare one consumer with three
 *    typed native plugin configs, a same-volume banner config junction, a
 *    caught missing require and an external source cache.
 * 2. Transform twice with one cache and inspect the first generation's
 *    missing-input proof.
 * 3. Assert the lint warning, banner and strip output, stable root and removed
 *    cache scratch, then remove all owned directories after the child exits.
 *
 * @evidence contracts/testing.md#behavioral-verification Two real transformTtsc deliveries succeed; the first generation reports the configured no-var warning and null for the caught missing candidate. Its output contains the typed banner loaded through a same-volume junction, drops the configured strip target and retains an adjacent call. The consumer root sees no plugin scratch entries, events or metadata change, and the selected identities cache retains no evaluator scratch.
 * @evidence contracts/testing.md#independent-expectations Authored var source and warning rule require a no-var finding, the typed banner supplies an exact marker through its alias while a project-local decoy supplies a different marker, and the custom strip policy removes console.warn while preserving console.log. The absent require target requires null proof. The fixture writes no root entry during the watched interval; native root metadata and directory events reveal misplaced scratch, and an identities listing reveals failed cleanup.
 * @evidence contracts/testing.md#distinguishing-cases Cross-volume TEMP and project, a same-volume directory junction for one config, explicit same-volume external cache, inherited stale native record root, three typed native configs in one linked host, cold then repeated delivery, and no project-local node_modules cache distinguish the fallback and reuse paths. Portable allocator decisions have separate units.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch calls this Windows-only product-boundary case; it launches a real transform child and does not substitute a loader or filesystem provider.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor evaluation, ttsx typed config loading, all three Go config loaders and native envelope admission must run together to expose root-metadata churn; direct allocator units cannot verify their environment handoff.
 * @evidence contracts/e2e.md#shared-execution One consumer, source plugin artifact cache and transform cache serve the first and repeated deliveries; the second call proves reuse without a second project fixture.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Separate TestProject-owned project, cache, alias holder and temporary directories isolate all mutable inputs. The synchronous child ends before assertions; finally verifies and unlinks the junction before removing the four exact owned roots. TestProject also tracks them for process-exit cleanup after interruption.
 * @evidence contracts/e2e.md#preserved-coverage This case adds cross-volume typed lint, banner and strip assembly with root-stability assertions; existing portable allocator units and missing-candidate rejection cases retain their own assertions.
 */
export function test_transformttsc_typed_native_configs_keep_project_root_stable(): void {
  if (process.platform !== "win32") return;

  const projectParent = fs.realpathSync.native(
    path.dirname(TestProject.WORKSPACE_ROOT),
  );
  const projectVolume = path.parse(projectParent).root.toLowerCase();
  const candidates = [
    process.env.E2E_INHERITED_TMPDIR,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Temp"),
    process.env.RUNNER_TEMP,
    os.tmpdir(),
  ];
  let tempParent: string | undefined;
  for (const candidate of candidates) {
    if (!candidate) continue;
    let probe: string | undefined;
    try {
      const physical = fs.realpathSync.native(candidate);
      if (path.parse(physical).root.toLowerCase() === projectVolume) continue;
      probe = fs.mkdtempSync(path.join(physical, "ttsc-lint-volume-"));
      tempParent = physical;
      break;
    } catch {
      // The next candidate may be writable on another volume.
    } finally {
      if (probe !== undefined) fs.rmSync(probe, { recursive: true });
    }
  }
  if (tempParent === undefined) {
    process.stdout.write(
      "cross-volume typed native configs scenario: no second writable volume\n",
    );
    return;
  }

  const owned: Array<readonly [string, string]> = [];
  let aliasLink: string | undefined;
  let aliasRootForCleanup: string | undefined;
  let aliasTargetForCleanup: string | undefined;
  try {
    const project = TestProject.tmpdir(
      "ttsc-lint-cross-volume-project-",
      projectParent,
    );
    owned.push([project, projectParent]);
    const cache = TestProject.tmpdir(
      "ttsc-lint-cross-volume-cache-",
      projectParent,
    );
    owned.push([cache, projectParent]);
    const temp = TestProject.tmpdir("ttsc-lint-cross-volume-temp-", tempParent);
    owned.push([temp, tempParent]);
    const aliasRoot = TestProject.tmpdir(
      "ttsc-lint-cross-volume-alias-",
      projectParent,
    );
    owned.push([aliasRoot, projectParent]);
    aliasRootForCleanup = aliasRoot;
    const aliasTarget = path.join(aliasRoot, "real");
    fs.mkdirSync(aliasTarget);
    aliasTargetForCleanup = aliasTarget;
    fs.writeFileSync(
      path.join(aliasTarget, "banner.config.ts"),
      'export default { text: "BANNER_FROM_TYPED_CONFIG" };\n',
    );
    aliasLink = path.join(aliasRoot, "project");
    fs.symlinkSync(aliasTarget, aliasLink, "junction");
    assert.equal(
      fs.realpathSync.native(aliasLink),
      fs.realpathSync.native(aliasTarget),
    );
    const bannerConfigAlias = path.join(aliasLink, "banner.config.ts");
    fs.mkdirSync(path.join(project, "src"));
    fs.writeFileSync(
      path.join(project, "src", "main.ts"),
      'var legacy: number = 1;\nconsole.warn("STRIP_TARGET");\nconsole.log("STRIP_KEEP");\nexport const value: number = legacy;\n',
    );
    fs.writeFileSync(
      path.join(project, "lint.config.ts"),
      'export default { rules: { "no-var": "warning" } };\n',
    );
    fs.writeFileSync(
      path.join(project, "banner.config.ts"),
      'export default { text: "BANNER_WRONG_DISCOVERY" };\n',
    );
    fs.writeFileSync(
      path.join(project, "strip.config.ts"),
      'export default { calls: ["console.warn"], statements: [] };\n',
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "preserve",
          moduleResolution: "bundler",
          outDir: "dist",
          rootDir: "src",
          target: "ES2022",
        },
        include: ["src"],
      }),
    );
    for (const name of ["lint", "banner", "strip"] as const) {
      const entry = path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        name,
        "lib",
        "index.js",
      );
      fs.writeFileSync(
        path.join(project, `${name}-plugin.cjs`),
        [
          'const path = require("node:path");',
          "module.exports = (context) => {",
          "  try { require('./missing'); } catch (error) {",
          "    if (error.code !== 'MODULE_NOT_FOUND') throw error;",
          "  }",
          `  const entry = ${JSON.stringify(entry)};`,
          "  return require(entry).default({",
          "    ...context,",
          "    dirname: path.dirname(entry),",
          "    filename: entry,",
          `    plugin: { transform: '@ttsc/${name}', configFile: ${JSON.stringify(name === "banner" ? bannerConfigAlias : path.join(project, `${name}.config.ts`))} },`,
          "  });",
          "};",
          "",
        ].join("\n"),
      );
    }

    const script = [
      'const assert = require("node:assert/strict");',
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      `const api = require(${JSON.stringify(path.join(TestProject.WORKSPACE_ROOT, "packages", "unplugin", "lib", "core", "index.js"))});`,
      "const [project, bannerConfigAlias] = process.argv.slice(1);",
      "const source = path.join(project, 'src', 'main.ts');",
      "const plugins = [{ transform: './lint-plugin.cjs' }, { transform: './banner-plugin.cjs', configFile: bannerConfigAlias }, { transform: './strip-plugin.cjs' }];",
      "const options = api.resolveOptions({ project: path.join(project, 'tsconfig.json'), plugins });",
      "const before = fs.statSync(project, { bigint: true });",
      "const events = [];",
      "const watcher = fs.watch(project, (kind, name) => events.push(`${kind}:${name}`));",
      "const transformCache = api.createTtscTransformCache();",
      "(async () => {",
      "  try {",
      "    const first = await api.transformTtsc(source, fs.readFileSync(source, 'utf8'), options, undefined, transformCache);",
      "    assert.equal(transformCache.size, 1, 'one admitted generation');",
      "    const generation = await [...transformCache.values()][0];",
      "    assert.equal(generation.result.type, 'success', 'all native transforms completed');",
      "    assert.ok(generation.result.diagnostics?.some((diagnostic) => diagnostic.category === 'warning' && diagnostic.file === source && diagnostic.messageText.includes('[no-var]')), `typed lint config did not report no-var: ${JSON.stringify(generation.result.diagnostics)}`);",
      "    assert.ok(first && typeof first.code === 'string', 'native transform returned source code');",
      "    assert.match(first.code, /BANNER_FROM_TYPED_CONFIG/, 'typed banner config applied');",
      "    assert.doesNotMatch(first.code, /BANNER_WRONG_DISCOVERY/, 'project-local banner decoy was not loaded');",
      "    assert.doesNotMatch(first.code, /STRIP_TARGET/, 'typed strip config removed console.warn');",
      "    assert.match(first.code, /STRIP_KEEP/, 'typed strip config retained console.log');",
      "    const missing = path.join(project, 'missing');",
      "    assert.equal(generation.result.hostInputHashes?.[missing], null, 'caught missing candidate keeps its absence proof');",
      "    const second = await api.transformTtsc(source, fs.readFileSync(source, 'utf8'), options, undefined, transformCache);",
      "    assert.deepEqual(second, first, 'repeated delivery agrees with the first');",
      "    assert.equal(await [...transformCache.values()][0], generation, 'repeated delivery reuses its admitted generation');",
      "    await new Promise((resolve) => setTimeout(resolve, 50));",
      "    const after = fs.statSync(project, { bigint: true });",
      "    const entries = fs.readdirSync(project);",
      "    assert.equal(after.mtimeNs, before.mtimeNs, `consumer root metadata changed; events: ${events.join(', ')}`);",
      "    assert.equal(events.some((event) => /ttsc-(?:lint|banner|strip)-|\\.ttsx-/.test(event)), false, `root scratch event: ${events.join(', ')}`);",
      "    assert.equal(entries.some((entry) => /^(ttsc-(?:lint|banner|strip)-|\\.ttsx-)/.test(entry)), false, 'root scratch remains');",
      "    const identities = path.join(process.env.TTSC_CACHE_DIR, 'identities');",
      "    assert.equal(fs.statSync(identities).isDirectory(), true, 'selected identities cache exists');",
      "    assert.deepEqual(fs.readdirSync(identities).filter((entry) => /^ttsc-(?:lint|banner|strip)-/.test(entry)), [], 'typed evaluator scratch was removed from identities cache');",
      "    console.log(JSON.stringify({ missing: true, rootStable: true, typedConfigs: 3, deliveries: 2 }));",
      "  } finally { try { api.resetTtscTransformCache(transformCache); } finally { watcher.close(); } }",
      "})().catch((error) => { console.error(error); process.exitCode = 1; });",
    ].join("\n");
    const result = spawnSync(
      process.execPath,
      ["-e", script, project, bannerConfigAlias],
      {
        cwd: project,
        encoding: "utf8",
        env: {
          ...process.env,
          TEMP: temp,
          TMP: temp,
          TMPDIR: temp,
          TTSC_BINARY: TestProject.NATIVE_BINARY,
          TTSC_CACHE_DIR: cache,
          TTSC_LINT_DISABLE_CONFIG_CACHE: "1",
          TTSC_NATIVE_PLUGIN_RECORD_ROOT: project,
          TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
          TTSC_TTSX_BINARY: TestProject.TTSX_BIN,
        },
        maxBuffer: 4 * 1024 * 1024,
        timeout: 25 * 60_000,
        windowsHide: true,
      },
    );
    assert.equal(result.error, undefined, String(result.error));
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /"rootStable":true/);
    process.stdout.write(
      `cross-volume typed native configs scenario: ${projectVolume} project, ${path.parse(tempParent).root} temporary; passed\n`,
    );
  } finally {
    const cleanupErrors: unknown[] = [];
    let aliasRemoved = aliasLink === undefined;
    if (aliasLink !== undefined) {
      try {
        const stats = fs.lstatSync(aliasLink);
        assert.equal(stats.isSymbolicLink(), true, "owned alias is a junction");
        assert.ok(aliasTargetForCleanup, "owned alias has a fixture target");
        assert.equal(
          fs.realpathSync.native(aliasLink),
          fs.realpathSync.native(aliasTargetForCleanup),
          "owned alias still targets the fixture config directory",
        );
        fs.unlinkSync(aliasLink);
        aliasRemoved = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          aliasRemoved = true;
        else cleanupErrors.push(error);
      }
    }
    for (const [root, parent] of owned.reverse()) {
      if (!aliasRemoved && root === aliasRootForCleanup) continue;
      try {
        assert.equal(fs.realpathSync.native(path.dirname(root)), parent);
        fs.rmSync(root, { recursive: true, force: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length !== 0)
      throw new AggregateError(
        cleanupErrors,
        "cross-volume native config scratch cleanup failed",
      );
  }
}
