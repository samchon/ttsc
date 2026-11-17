import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ProjectFixtures } from "../../../../internal/ttsc/internal/ProjectFixtures";
import { TestUtilityPlugins } from "../../../../internal/ttsc/internal/TestUtilityPlugins";
import {
  SHARED_GO_BUILD_CACHE_DIR,
  SHARED_PLUGIN_CACHE_DIR,
} from "../../../../internal/ttsc/internal/plugin-cache";

/**
 * Verifies a failed transform host reports its own Program once, and a host
 * that crashed still gets the independent TypeScript check.
 *
 * The host's Program reads a referenced project's sources. A plain `tsgo
 * --noEmit` after the failure reads that project's declaration outputs, so with
 * the reference not built yet it appended TS6305 for every import after the
 * real error. A host that dies before reporting must still surface the
 * project's type errors through that check.
 *
 * 1. Build an app with `@ttsc/banner` that references an unbuilt project and holds
 *    one TS2322, then a Go transform plugin that panics beside a TS2322.
 * 2. Run `ttsc --noEmit` on each.
 * 3. Assert the first reports TS2322 once and no TS6305, and the second reports
 *    the panic and TS2322 once.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs the public CLI through the real linked utility host and a real panicking sidecar; appending the plain recheck after a reporting host, or dropping it after a crashed one, fails an assertion.
 * @evidence contracts/testing.md#independent-expectations TypeScript itself defines TS2322 for the assignment and TS6305 for a reference whose outputs are missing; the host's Program reads sources, so only TS2322 is a real error in the first project.
 * @evidence contracts/testing.md#distinguishing-cases Owns a reporting transform host with a stale reference and a crashed transform host with a type error. Category and format decisions belong to test_plugin_failure_recheck_follows_the_transform_host_report; check-stage duplicate suppression belongs to test_plugin_corpus_ttsc_lint_failure_does_not_duplicate_typescript_diagnostics.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch registers this export; it needs the built CLI, the utility host and a Go toolchain.
 * @evidence contracts/e2e.md#necessary-boundary Only a real host process shows which Program reported and whether the build lane appended a second check.
 * @evidence contracts/e2e.md#shared-execution The banner case reuses the suite's plugin and Go build caches; the panicking sidecar is a changed source, so it builds into its own cache.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each project is a fresh temporary root the suite removes; the panicking source never shares a plugin cache with the unmodified fixture.
 * @evidence contracts/e2e.md#preserved-coverage The crash case keeps the independent check's purpose observable beside the new skip.
 */
export function test_ttsc_transform_host_failure_reports_its_own_program_once(): void {
  const root = TestProject.tmpdir("ttsc-transform-host-reference-");
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  write(
    "lib/tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        composite: true,
        target: "ES2022",
        module: "commonjs",
        strict: true,
        rootDir: "src",
        outDir: "dist",
      },
      include: ["src"],
    }),
  );
  write("lib/src/index.ts", 'export const greeting: string = "hello";\n');
  write(
    "app/tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        rootDir: "src",
        outDir: "dist",
        plugins: [{ transform: "@ttsc/banner" }],
      },
      references: [{ path: "../lib" }],
      include: ["src"],
    }),
  );
  write("app/banner.config.json", JSON.stringify({ text: "reference" }));
  write(
    "app/src/main.ts",
    'import { greeting } from "../../lib/src/index";\n\nexport const length: number = greeting;\n',
  );
  const app = path.join(root, "app");
  TestUtilityPlugins.seedPackages(app, ["banner"]);
  const reported = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", app, "--noEmit"],
    {
      cwd: app,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
      },
    },
  );
  assert.equal(reported.error, undefined);
  assert.equal(reported.signal, null);
  assert.notEqual(reported.status, 0);
  assert.equal(reported.stderr.match(/TS2322/g)?.length, 1, reported.stderr);
  assert.doesNotMatch(reported.stderr, /TS6305/);

  const crashed = ProjectFixtures.copy("go-source-plugin");
  const main = path.join(crashed, "go-plugin", "main.go");
  const source = fs.readFileSync(main, "utf8");
  const panicking = source.replace(
    "func main() {",
    'func main() {\n  panic("transform host crashed")',
  );
  assert.notEqual(panicking, source, "expected to inject the panic");
  fs.writeFileSync(main, panicking);
  fs.appendFileSync(
    path.join(crashed, "src", "main.ts"),
    '\nconst wrong: number = "type-error";\nvoid wrong;\n',
  );
  const recovered = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", crashed, "--noEmit"],
    {
      cwd: crashed,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-transform-host-panic-"),
        TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
      },
    },
  );
  assert.equal(recovered.error, undefined);
  assert.equal(recovered.signal, null);
  assert.notEqual(recovered.status, 0);
  assert.match(recovered.stderr, /panic: transform host crashed/);
  assert.equal(recovered.stderr.match(/TS2322/g)?.length, 1, recovered.stderr);
}
