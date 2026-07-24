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
 */
export const test_descriptor_redirects_executable_config_stdout_to_stderr =
  (): void => {
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
  };

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
