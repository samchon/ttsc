import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { hostToolDirectory } from "../../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.js";
import { projectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/writeProjectRecordFile.js";

/**
 * Verifies a one-shot Turbopack worker proves the records below the root
 * Turbopack gave it, even when `withTtsc` opened a session for the pool.
 *
 * The worker used to leave that proof to the wrapper, which knows only the
 * directory Next was started in, while a loader's records live below the root
 * Turbopack resolved. A `turbopack.root` above the app, which is how a
 * monorepo names its workspace, makes those two different directories, and
 * nothing then proved what the loader reads: a project whose state moved while
 * nothing ran was served from Turbopack's persistent cache. A record the
 * worker compiles for would hide the difference, since its delivery writes the
 * record whole either way, so the one proven here belongs to a second project
 * of the same tool directory, which the worker never compiles.
 *
 * 1. Write a second project's record into the tool directory of the one the
 *    worker loads, naming an input state that project's disk never held.
 * 2. Run the loader in a worker whose environment names a session and a
 *    production build, the one-shot path the wrapper used to stand in for.
 * 3. Assert that record moved, and that it is still there for a delivery of
 *    its own project to write.
 */
export async function test_turbopack_loader_proves_its_own_records_under_a_session(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const sibling = path.join(root, "sibling");
  fs.mkdirSync(path.join(sibling, "src"), { recursive: true });
  const siblingTsconfig = path.join(sibling, "tsconfig.json");
  fs.writeFileSync(siblingTsconfig, JSON.stringify({ include: ["src"] }));
  const siblingInput = path.join(sibling, "src", "model.ts");
  fs.writeFileSync(siblingInput, "export type Model = 1;\n");

  const record = projectRecordFile(hostToolDirectory(root), siblingTsconfig);
  writeProjectRecordFile(record, {
    inputs: {
      [siblingInput]: {
        identity: siblingInput,
        missing: false,
        state: { codec: "host", hash: "a state the disk never held" },
      },
    },
    membership: null,
    root: sibling,
    signal: 0,
    tsconfig: siblingTsconfig,
  });

  const session = TestProject.tmpdir("ttsc-unplugin-turbopack-proof-session-");
  const script = [
    `const loader = (await import(${JSON.stringify(TestUnpluginRuntime.libUrl("turbopack"))})).default;`,
    'const fs = await import("node:fs");',
    "const file = process.argv[1];",
    "await new Promise((resolve, reject) => loader.call({",
    "  async: () => (error) => (error ? reject(error) : resolve()),",
    "  getOptions: () => ({}),",
    "  addDependency: () => undefined,",
    "  resourcePath: file,",
    `  rootContext: ${JSON.stringify(root)},`,
    '}, fs.readFileSync(file, "utf8")));',
  ].join("\n");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", script, TestUnpluginProject.mainFile(root)],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          TTSC_UNPLUGIN_TRANSFORM_SESSION: session,
        },
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.once("error", reject);
    child.once("close", (status) =>
      status === 0 ? resolve() : reject(new Error(stderr)),
    );
  });

  assert.equal(
    fs.existsSync(record),
    true,
    "a project that still has a tsconfig keeps its record",
  );
  assert.notEqual(
    readProjectRecordFile(record)?.signal,
    0,
    "the worker proved the records below the root Turbopack gave it",
  );
}
