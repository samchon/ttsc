import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a cold dependency build reaps a scratch directory left by a crashed
 * build whose process is no longer alive, while leaving a live owner's scratch
 * untouched.
 *
 * Promotion uses `<cache>.<pid>.<n>.staging`/`.retired` scratch dirs; a build
 * killed mid-promotion leaks one. The next cold build removes scratch whose
 * embedded pid is dead, but must never delete one owned by a still-running
 * process (its own concurrent peer), or it would corrupt a live build.
 *
 * 1. Plant a `.staging` dir under the dependency cache parent named with a just
 *    exited (dead) pid, and another named with this process's (live) pid.
 * 2. Run ttsx, forcing a cold dependency build.
 * 3. Assert the dead-pid scratch was removed and the live-pid scratch survived.
 */
export const test_ttsx_reaps_a_dead_pid_scratch_directory_on_a_cold_dependency_build =
  async () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/reap-dep/package.json": JSON.stringify({
        name: "reap-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/reap-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/reap-dep/src/index.ts": `export const value = (): string => "reap-ok";\n`,
      "src/main.ts": `import { value } from "reap-dep";\nconsole.log(value());\n`,
    });

    const deadPid = await exitedPid();
    const cacheParent = path.join(
      root,
      "node_modules",
      "reap-dep",
      "node_modules",
      ".cache",
      "ttsc",
    );
    fs.mkdirSync(cacheParent, { recursive: true });
    const dead = path.join(cacheParent, `ttsx-deps.${deadPid}.1.staging`);
    const live = path.join(cacheParent, `ttsx-deps.${process.pid}.1.staging`);
    fs.mkdirSync(dead);
    fs.mkdirSync(live);

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "reap-ok");
    assert.equal(
      fs.existsSync(dead),
      false,
      "a dead-pid scratch directory is reaped",
    );
    assert.equal(
      fs.existsSync(live),
      true,
      "a live-pid scratch directory is preserved",
    );
  };

/** Spawn a throwaway process and return its now-guaranteed-dead pid. */
function exitedPid(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(process.execPath, ["-e", ""], {
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", () => resolve(child.pid!));
  });
}
