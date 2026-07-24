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
      const script = `
const mod = require(${JSON.stringify(TestLintPlugin.DESCRIPTOR_PATH)});
const factory = mod.createTtscPlugin ?? mod.default ?? mod;
const descriptor = factory(${JSON.stringify(context)});
process.stdout.write(JSON.stringify(descriptor.contributors ?? []));
`;
      const result = spawnSync(process.execPath, ["-e", script], {
        encoding: "utf8",
        env: process.env,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), [
        { name: "demo", source: contributor },
      ]);
      assert.match(result.stderr, /loading executable lint config/);
    } finally {
      project.cleanup();
    }
  };
