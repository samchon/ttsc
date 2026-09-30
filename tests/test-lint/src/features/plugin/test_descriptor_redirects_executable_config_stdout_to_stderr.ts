import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";
import { createLintProject } from "../../internal/config-file";

/**
 * Verifies executable-config logs cannot corrupt a host machine protocol.
 *
 * The descriptor factory runs before the native `ttscserver` child starts, so
 * inherited config stdout would precede its first `Content-Length` frame. The
 * same leak would make JSON-only CLI output unparsable.
 *
 * 1. Create a TypeScript lint config that logs while selecting a contributor.
 * 2. Resolve the real descriptor in a child process and write only its result JSON
 *    to that process's stdout.
 * 3. Assert stdout is pure JSON and the config log was preserved on stderr.
 * 4. Repeat through a JSON string contributor that logs while being required.
 *
 * @evidence contracts/testing.md#behavioral-verification The real built factory evaluates a logging typed config and loads a logging JSON string contributor; both outer stdout payloads must parse as the exact contributor array and their logs must survive on stderr.
 * @evidence contracts/testing.md#independent-expectations Each fixture independently declares demo with one explicit source path and literal stream markers; JSON.parse and exact array comparison expose any extra machine-output bytes.
 * @evidence contracts/testing.md#distinguishing-cases Typed config top-level logging and JSON package require-time logging cover two different redirection connections; failure forwarding and envelope-less exit have separate owners.
 * @evidence contracts/testing.md#execution-ownership This named entry spawns the descriptor through the actual built package and supplied real launcher/compiler pair; each result's status, parsed payload and stderr are asserted.
 * @evidence contracts/e2e.md#necessary-boundary Real module-load logs must be redirected before the host machine protocol starts; source units cannot establish child stdout isolation or package require-time side effects.
 * @evidence contracts/e2e.md#shared-execution Both logging routes share one project, contributor source and emitted factory artifacts. Two separately captured outer stdout payloads preserve independent protocol assertions; neither invocation builds a Go binary or starts a native host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The second route names a separate JSON config and logging package, preventing the first config's module cache from deciding its logs; fixture ownership ends in finally and stream buffers remain invocation-local.
 * @evidence contracts/e2e.md#preserved-coverage Both original successful statuses, exact JSON contributor arrays and four preserved log markers remain executable, including JSON string package loading.
 */
export function test_descriptor_redirects_executable_config_stdout_to_stderr(): void {
    const project = createLintProject({
      name: "descriptor-machine-stdout",
      pluginConfig: { configFile: "./lint.config.ts" },
      source: "export const value = 1;\n",
    });
    try {
      const contributor = path.join(project.tmpdir, "contributor");
      fs.mkdirSync(contributor, { recursive: true });
      fs.writeFileSync(
        path.join(contributor, "rule.go"),
        "package contributor\n",
      );
      fs.writeFileSync(
        path.join(project.tmpdir, "lint.config.ts"),
        [
          'console.log("loading executable lint config");',
          'console.error("executable lint config warning");',
          `export default { plugins: { demo: { source: ${JSON.stringify(contributor)} } } };`,
          "",
        ].join("\n"),
        "utf8",
      );

      const context = {
        ...TestLintPlugin.factoryContext({
          configFile: "./lint.config.ts",
          transform: "@ttsc/lint",
        }),
        cwd: project.tmpdir,
        pluginConfigDir: project.tmpdir,
        projectRoot: project.tmpdir,
        tsconfig: path.join(project.tmpdir, "tsconfig.json"),
      };
      const result = runDescriptor(context);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), [
        { name: "demo", source: contributor },
      ]);
      assert.match(result.stderr, /loading executable lint config/);
      assert.match(result.stderr, /executable lint config warning/);

      const packageDir = path.join(
        project.tmpdir,
        "node_modules",
        "logging-contributor",
      );
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(
        path.join(packageDir, "package.json"),
        '{"main":"index.cjs"}\n',
      );
      fs.writeFileSync(
        path.join(packageDir, "index.cjs"),
        [
          'console.log("loading JSON contributor");',
          'console.error("JSON contributor warning");',
          `module.exports = { source: ${JSON.stringify(contributor)} };`,
          "",
        ].join("\n"),
      );
      fs.writeFileSync(
        path.join(project.tmpdir, "lint.config.json"),
        JSON.stringify({ plugins: { demo: "logging-contributor" } }),
      );
      const jsonResult = runDescriptor({
        ...context,
        plugin: {
          configFile: "./lint.config.json",
          transform: "@ttsc/lint",
        },
      });
      assert.equal(jsonResult.status, 0, jsonResult.stderr);
      assert.deepEqual(JSON.parse(jsonResult.stdout), [
        { name: "demo", source: contributor },
      ]);
      assert.match(jsonResult.stderr, /loading JSON contributor/);
      assert.match(jsonResult.stderr, /JSON contributor warning/);
    } finally {
      project.cleanup();
    }
  }

function runDescriptor(context: Record<string, unknown>) {
  const script = `
const mod = require(${JSON.stringify(TestLintPlugin.DESCRIPTOR_PATH)});
const factory = mod.createTtscPlugin ?? mod.default ?? mod;
const descriptor = factory(${JSON.stringify(context)});
process.stdout.write(JSON.stringify(descriptor.contributors ?? []));
`;
  return spawnSync(process.execPath, ["-e", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
      TTSC_TTSX_BINARY: TestProject.TTSX_BIN,
    },
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
}
