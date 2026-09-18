import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies Turbopack's loader workers share each compile through the session
 * they inherit (samchon/ttsc#1390).
 *
 * `next build --turbopack` ran the loader in five processes for a 61-module
 * app, and each compiled the whole project. The loader module declares its
 * cache shared with the session named in its environment, which `withTtsc`
 * opens before Turbopack forks the workers.
 *
 * 1. Run the built loader in two processes at once, one module each, with a
 *    session in their environment.
 * 2. Assert both modules are transformed by one compile.
 */
export async function test_turbopack_loader_workers_share_one_compile(): Promise<void> {
  const project = createCacheProject({ fileCount: 2 });
  const session = TestProject.tmpdir("ttsc-unplugin-turbopack-session-");
  const worker = (file: string) => {
    const script = [
      `const loader = (await import(${JSON.stringify(TestUnpluginRuntime.libUrl("turbopack"))})).default;`,
      'const fs = await import("node:fs");',
      "const file = process.argv[1];",
      "const content = await new Promise((resolve, reject) => loader.call({",
      "  async: () => (error, content) => (error ? reject(error) : resolve(content)),",
      "  getOptions: () => ({}),",
      "  resourcePath: file,",
      '}, fs.readFileSync(file, "utf8")));',
      "process.stdout.write(content);",
    ].join("\n");
    return new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--input-type=module", "-e", script, file],
        {
          env: {
            ...process.env,
            TTSC_UNPLUGIN_TRANSFORM_SESSION: session,
          },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.once("error", reject);
      child.once("close", (status) =>
        status === 0 ? resolve(stdout) : reject(new Error(stderr)),
      );
    });
  };

  const outputs = await Promise.all(projectModules(project.root).map(worker));
  for (const output of outputs) assert.match(output, /PROBED/);
  assert.equal(
    fs.statSync(project.runLog).size,
    1,
    "the workers compiled once",
  );
}
