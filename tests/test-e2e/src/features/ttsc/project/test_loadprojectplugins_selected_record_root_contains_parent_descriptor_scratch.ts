import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a selected descriptor record store contains its evaluator scratch
 * when the caller's TEMP names the consumer project root.
 *
 * The parent loader creates an evaluator directory before launching the
 * descriptor child. A caught missing import makes project-root metadata part of
 * that evaluation's input proof, so parent scratch must stay below the already
 * selected identities directory. A deliberate descriptor error stops this case
 * before a Go source plugin is built.
 *
 * 1. Prepare one CJS descriptor, an external cache and a project-root TEMP.
 * 2. Run real loadProjectPlugins in a child and verify its isolated descriptor
 *    sees the current record root and produces the authored error.
 * 3. Check project-root scratch events and selected identities cleanup, then
 *    remove the exact owned fixture directories.
 *
 * @evidence contracts/testing.md#behavioral-verification A real project loader and isolated CJS descriptor run with TEMP at the consumer root; the authored descriptor error reaches the parent, while ttsc-plugin-descriptor creates no project-root entry and no evaluator scratch remains in selected identities.
 * @evidence contracts/testing.md#independent-expectations The fixture writes a literal error sentinel and checks the child marker and chosen cache root; authored prefix names and fs.watch events expose a wrong root placement independently of the allocator's answer.
 * @evidence contracts/testing.md#distinguishing-cases A current external selected store overrides an inherited stale private root under project-root TEMP. The separate capture unit owns absent, missing and linked identities fallback, while the cross-volume three-plugin scenario owns successful native transform output.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch calls this real descriptor-process case; it does not replace filesystem or process methods and deliberately stops before Go plugin building.
 * @evidence contracts/e2e.md#necessary-boundary Parent loader selection, child environment handoff, isolated CJS evaluation and parent evaluator temporary placement must run together; a direct parent-selector unit cannot prove their connection.
 * @evidence contracts/e2e.md#shared-execution One project, one selected cache and one descriptor child exercise parent evaluator placement without a linked native host or repeated build; the separate capture unit covers child output capture.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Two TestProject-owned directories isolate the project and cache; a unique descriptor prevents cached evaluation from answering. The bounded child must exit before the watcher closes, and finally removes only verified owned roots after checking the selected cache has no scratch.
 * @evidence contracts/e2e.md#preserved-coverage This case adds project-root TEMP and current record-root handoff; the existing cross-volume native-config case retains typed lint, banner, strip, missing proof, root metadata and generation reuse assertions.
 */
export async function test_loadprojectplugins_selected_record_root_contains_parent_descriptor_scratch(): Promise<void> {
  const parent = fs.realpathSync.native(
    path.dirname(TestProject.WORKSPACE_ROOT),
  );
  const prefix = "ttsc-selected-descriptor-scratch-";
  const project = TestProject.tmpdir(`${prefix}project-`, parent);
  const roots = [project];
  let watcher: fs.FSWatcher | undefined;
  try {
    const cache = TestProject.tmpdir(`${prefix}cache-`, parent);
    roots.push(cache);
    fs.mkdirSync(path.join(project, "src"));
    fs.writeFileSync(
      path.join(project, "src", "main.ts"),
      "export const value = 1;\n",
    );
    fs.writeFileSync(
      path.join(project, "plugin.cjs"),
      [
        'const fs = require("node:fs");',
        "module.exports = () => {",
        "  if (process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD !== '1') throw new Error('DESCRIPTOR_MARKER_MISSING');",
        `  if (fs.realpathSync.native(process.env.TTSC_PLUGIN_RECORD_ROOT) !== ${JSON.stringify(fs.realpathSync.native(cache))}) throw new Error('SELECTED_RECORD_ROOT_MISSING');`,
        "  try { require('./missing'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }",
        "  throw new Error('EXPECTED_DESCRIPTOR_STOP');",
        "};",
        "",
      ].join("\n"),
    );
    const tsconfig = path.join(project, "tsconfig.json");
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: {
          module: "preserve",
          moduleResolution: "bundler",
          plugins: [{ transform: "./plugin.cjs" }],
          target: "ES2022",
        },
        include: ["src"],
      }),
    );
    const events: string[] = [];
    watcher = fs.watch(project, (kind, name) => events.push(`${kind}:${name}`));
    const script = [
      'const assert = require("node:assert/strict");',
      'const path = require("node:path");',
      `const { loadProjectPlugins } = require(${JSON.stringify(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "plugin", "internal", "load", "loadProjectPlugins.js"))});`,
      "const [project, cache] = process.argv.slice(1);",
      "(async () => {",
      "  await assert.rejects(async () => loadProjectPlugins({ binary: '', cwd: project, projectRoot: project, tsconfig: path.join(project, 'tsconfig.json'), cacheDir: cache, env: process.env }), /EXPECTED_DESCRIPTOR_STOP/);",
      "  process.stdout.write('EXPECTED_DESCRIPTOR_STOP_OBSERVED');",
      "})().catch((error) => { console.error(error); process.exitCode = 1; });",
    ].join("\n");
    const output = await new Promise<{
      status: number | null;
      stderr: string;
      stdout: string;
    }>((resolve, reject) => {
      const child = spawn(process.execPath, ["-e", script, project, cache], {
        cwd: project,
        env: {
          ...process.env,
          TEMP: project,
          TMP: project,
          TMPDIR: project,
          TTSC_NODE_BINARY: process.execPath,
          TTSC_PLUGIN_RECORD_ROOT: project,
          TTSC_TTSX_BINARY: TestProject.TTSX_BIN,
        },
        signal: AbortSignal.timeout(120_000),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let stderr = "";
      let stdout = "";
      child.stderr.setEncoding("utf8");
      child.stdout.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => (stderr += chunk));
      child.stdout.on("data", (chunk: string) => (stdout += chunk));
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stderr, stdout }));
    });
    assert.equal(output.status, 0, output.stderr);
    assert.match(output.stdout, /EXPECTED_DESCRIPTOR_STOP_OBSERVED/);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const scratchPattern = /^ttsc-plugin-descriptor-/;
    assert.deepEqual(
      events.filter((event) => /ttsc-plugin-descriptor-/.test(event)),
      [],
      "selected descriptor scratch did not touch the project root",
    );
    assert.deepEqual(
      fs.readdirSync(project).filter((name) => scratchPattern.test(name)),
      [],
      "no descriptor scratch remains at the project root",
    );
    const identities = path.join(cache, "identities");
    assert.equal(fs.statSync(identities).isDirectory(), true);
    assert.deepEqual(
      fs.readdirSync(identities).filter((name) => scratchPattern.test(name)),
      [],
      "selected identities evaluator scratch was removed",
    );
  } finally {
    watcher?.close();
    for (const root of roots.reverse()) {
      assert.equal(fs.realpathSync.native(path.dirname(root)), parent);
      assert.ok(path.basename(root).startsWith(prefix));
      assert.equal(fs.lstatSync(root).isDirectory(), true);
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}
