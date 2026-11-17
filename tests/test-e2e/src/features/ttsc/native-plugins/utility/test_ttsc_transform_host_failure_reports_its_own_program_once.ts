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
 * Verifies a completed transform-host report suppresses another Program check,
 * while a crash after partial diagnostics still recovers source errors.
 *
 * The host's Program reads a referenced project's sources. A plain `tsgo
 * --noEmit` after the failure reads that project's declaration outputs, so with
 * the reference not built yet it appended TS6305 for every import after the
 * real error. A host that dies before reporting must still surface the
 * project's type errors through that check.
 *
 * 1. Prepare one referenced app and one sidecar with selectable partial output.
 * 2. Run both emitting and no-emit lanes with missing and stale declarations, then
 *    crash with no report, plugin/TypeScript errors, warnings, or completion of
 *    another project in this process or an inherited-token child.
 * 3. Assert complete reports contain only the host's TS2322, partial failures
 *    retain the panic and recover TS2322, and an empty completed report
 *    followed by an emit failure adds no stale-reference diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs the public CLI through the real linked utility host and a real panicking sidecar; appending the plain recheck after a reporting host, or dropping it after a crashed one, fails an assertion.
 * @evidence contracts/testing.md#independent-expectations TypeScript itself defines TS2322 for the assignment and TS6305 for a reference whose outputs are missing; the host's Program reads sources, so only TS2322 is a real error in the first project.
 * @evidence contracts/testing.md#distinguishing-cases Covers both command lanes, unbuilt/stale references, Unicode and spaces in native paths, valid source, empty diagnostics before emit failure, partial reports and completion of another project in-process or in a descendant. Token/PID/command validation and phase ownership belong to the source unit; check-stage deduplication has its separate corpus scene.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch registers this export; it needs the built CLI, the utility host and a Go toolchain.
 * @evidence contracts/e2e.md#necessary-boundary Only a real host process shows which Program reported and whether the build lane appended a second check.
 * @evidence contracts/e2e.md#shared-execution One banner preparation serves both lanes and declaration states through shared caches. One changed panicking source and private plugin cache serve every partial-output variant and both lanes, sharing Go objects with the suite.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each project is a fresh temporary root the suite removes; the panicking source never shares a plugin cache with the unmodified fixture.
 * @evidence contracts/e2e.md#preserved-coverage The crash case keeps the independent check's purpose observable beside the new skip.
 */
export function test_ttsc_transform_host_failure_reports_its_own_program_once(): void {
  const failures: unknown[] = [];
  const scenario = (name: string, check: () => void) => {
    try {
      check();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const root = TestProject.tmpdir(
    "ttsc-transform-host-reference-\ud55c\uae00 ",
  );
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
  const run = (args: string[]) =>
    TestProject.spawn(TestProject.TTSC_BIN, ["--cwd", app, ...args], {
      cwd: app,
      env: {
        PATH: TestUtilityPlugins.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
      },
    });
  const lanes = [["--noEmit"], []];
  for (const declarations of ["missing", "stale"]) {
    if (declarations === "stale")
      write("lib/dist/index.d.ts", "export declare const stale: boolean;\n");
    for (const args of lanes) {
      scenario(`${declarations} reference ${args.join(" ") || "build"}`, () => {
        const reported = run(args);
        assert.equal(reported.error, undefined);
        assert.equal(reported.signal, null);
        assert.equal(reported.status, 2, reported.stderr);
        assert.deepEqual(
          reported.stderr.match(/TS\d+/g),
          ["TS2322"],
          reported.stderr,
        );
        assert.doesNotMatch(
          reported.stdout + reported.stderr,
          /ttsc:diagnostics-complete:/,
        );
      });
    }
  }
  write(
    "app/src/main.ts",
    'import { greeting } from "../../lib/src/index";\nexport const length: number = greeting.length;\n',
  );
  for (const args of lanes) {
    scenario(`valid source ${args.join(" ") || "build"}`, () => {
      const valid = run(args);
      assert.equal(valid.error, undefined);
      assert.equal(valid.signal, null);
      assert.equal(valid.status, 0, valid.stderr);
      assert.doesNotMatch(
        valid.stdout + valid.stderr,
        /ttsc:diagnostics-complete:/,
      );
    });
  }
  write("app/blocked-output", "not a directory\n");
  scenario("empty completed report before emit failure", () => {
    const emitFailed = run(["--outDir", path.join(app, "blocked-output")]);
    assert.equal(emitFailed.error, undefined);
    assert.equal(emitFailed.signal, null);
    assert.notEqual(emitFailed.status, 0);
    assert.match(emitFailed.stderr, /emit failed/);
    assert.doesNotMatch(
      emitFailed.stderr,
      /TS2305|TS6305|ttsc:diagnostics-complete:/,
    );
  });

  const crashed = ProjectFixtures.copy("go-source-plugin");
  write(
    "other/tsconfig.json",
    JSON.stringify({
      compilerOptions: { strict: true, target: "ES2022", module: "commonjs" },
      files: ["index.ts"],
    }),
  );
  write("other/index.ts", "export const healthy: number = 1;\n");
  fs.appendFileSync(
    path.join(crashed, "go-plugin", "go.mod"),
    "\nrequire github.com/samchon/ttsc/packages/ttsc v0.0.0\n",
  );
  const main = path.join(crashed, "go-plugin", "main.go");
  const source = fs.readFileSync(main, "utf8");
  const panicking = source
    .replace(
      "func main() {",
      `func main() {
  other := os.Getenv("TTSC_TEST_OTHER_PROJECT")
  if os.Getenv("TTSC_TEST_OTHER_CHILD") == "1" {
    os.Exit(utility.RunCheck([]string{"--cwd", other}))
  }
  switch os.Getenv("TTSC_TEST_EARLY_REPORT") {
  case "plugin":
    fmt.Fprintln(os.Stderr, "error HOST_SETUP: failed before Program loading")
  case "typescript":
    fmt.Fprintln(os.Stderr, "src/main.ts:1:1 - error TS2304: Cannot find name 'missing'.")
  case "warning":
    fmt.Fprintln(os.Stderr, "warning HOST_SETUP: host has not loaded the Program")
  case "other-program":
    if utility.RunCheck([]string{"--cwd", other}) != 0 {
      panic("secondary program failed")
    }
  case "child":
    child := exec.Command(os.Args[0], os.Args[1:]...)
    child.Env = append(os.Environ(), "TTSC_TEST_OTHER_CHILD=1")
    child.Stdout = os.Stdout
    child.Stderr = os.Stderr
    if err := child.Run(); err != nil {
      panic(err)
    }
  }
  panic("transform host crashed")`,
    )
    .replace(
      '"os"',
      '"os"\n "os/exec"\n "github.com/samchon/ttsc/packages/ttsc/utility"',
    );
  assert.notEqual(panicking, source, "expected to inject the panic");
  fs.writeFileSync(main, panicking);
  fs.appendFileSync(
    path.join(crashed, "src", "main.ts"),
    '\nconst wrong: number = "type-error";\nvoid wrong;\n',
  );
  const panicCache = TestProject.tmpdir("ttsc-transform-host-panic-");
  for (const earlyReport of [
    "",
    "plugin",
    "typescript",
    "warning",
    "other-program",
    "child",
  ])
    for (const args of lanes) {
      scenario(
        `partial ${earlyReport || "empty"} report ${args.join(" ") || "build"}`,
        () => {
          const recovered = TestProject.spawn(
            TestProject.TTSC_BIN,
            ["--cwd", crashed, ...args],
            {
              cwd: crashed,
              env: {
                PATH: TestUtilityPlugins.goPath(),
                TTSC_CACHE_DIR: panicCache,
                TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
                TTSC_TEST_EARLY_REPORT: earlyReport,
                TTSC_TEST_OTHER_PROJECT: path.join(root, "other"),
              },
            },
          );
          assert.equal(recovered.error, undefined);
          assert.equal(recovered.signal, null);
          assert.notEqual(recovered.status, 0);
          assert.match(recovered.stderr, /panic: transform host crashed/);
          assert.equal(
            recovered.stderr.match(/TS2322/g)?.length,
            1,
            recovered.stderr,
          );
          if (earlyReport === "plugin" || earlyReport === "warning")
            assert.match(recovered.stderr, /HOST_SETUP/);
          if (earlyReport === "typescript")
            assert.match(recovered.stderr, /TS2304/);
          assert.doesNotMatch(
            recovered.stdout + recovered.stderr,
            /ttsc:diagnostics-complete:/,
          );
        },
      );
    }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "Transform-host diagnostic recovery failed",
    );
}
