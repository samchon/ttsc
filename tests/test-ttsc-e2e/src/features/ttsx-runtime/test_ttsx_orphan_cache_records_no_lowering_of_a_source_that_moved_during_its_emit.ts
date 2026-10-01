import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const { resolveGoCompiler } = require_(
  path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "plugin",
    "internal",
    "source",
    "resolveGoCompiler.js",
  ),
) as {
  resolveGoCompiler(env: NodeJS.ProcessEnv): { binary: string };
};

/**
 * Verifies the persistent orphan lowering cache records no lowering of a source
 * that changed between the read that keyed it and the emit that lowered it.
 *
 * `ttsx` lowers raw TypeScript that no project owns with an isolated `tsgo`
 * emit, and caches the result across runs under a key of the source's bytes.
 * The key read the file, and the emit read it again, so an edit landing in
 * between stored the newer source's lowering under the older bytes' key. Once
 * the file held the older bytes again, every run executed the other version's
 * code (samchon/ttsc#1508). An entry is now recorded only for a source that
 * held still across both reads.
 *
 * 1. Build a compiler wrapper that rewrites the orphan source to `"two"` when, and
 *    only when, it is asked to emit that source, then runs the real compiler.
 * 2. Run an entry that requires the orphan through the wrapper, with a private
 *    `TTSC_CACHE_DIR`: it prints `two`, the text the emit read.
 * 3. Write the orphan back to `"one"` and run again.
 * 4. Assert the second run prints `one`.
 * @evidence contracts/testing.md#behavioral-verification An actual Go compiler wrapper changes rawpkg source from one to two exactly when that source emit starts; first ttsx prints two, then restoring one must make the next run print one.
 * @evidence contracts/testing.md#independent-expectations Authored one/two versions independently identify which bytes ran. os.SameFile selects the real orphan emit and a done marker allows only the first mutation.
 * @evidence contracts/testing.md#distinguishing-cases Key-read source differs from emit-read source in the first run; restored original bytes must not hit a cache entry containing the newer lowering. The wrapper delegates all compilations to real tsgo.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_orphan_cache_records_no_lowering_of_a_source_that_moved_during_its_emit E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary The source-key/real compiler-read/publication connection must resist a timed filesystem edit. Direct stable-snapshot units cannot prove this exact compiler process window and later served result.
 * @evidence contracts/e2e.md#shared-execution One dedicated Go wrapper is built from fixture source, then two ttsx hosts share it, the real compiler and private cache. This per-entry wrapper producer is still separate from other native preparation; reusable runtime-driven wrapper assembly is a consolidation candidate.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only fixture orphan bytes and done marker mutate. The Go build and both host lifetimes are synchronous; TestProject owns wrapper/project/cache directories. No global function or product method is replaced.
 * @evidence contracts/e2e.md#preserved-coverage Original wrapper build status, first two and restored second one assertions remain. The cache is not cleared between runs, preserving the actual race and invalidation distinction.
 */
export function test_ttsx_orphan_cache_records_no_lowering_of_a_source_that_moved_during_its_emit() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "orphan-race", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const require: (id: string) => { value: string };`,
        `console.log(require("rawpkg").value);`,
        `export {};`,
        ``,
      ].join("\n"),
      "node_modules/rawpkg/package.json": JSON.stringify({
        name: "rawpkg",
        version: "1.0.0",
        main: "index.ts",
      }),
      "node_modules/rawpkg/index.ts": `export const value: string = "one";\n`,
    });
    const orphan = path.join(root, "node_modules", "rawpkg", "index.ts");
    const wrapperModule = path.join(root, "compiler-wrapper");
    fs.mkdirSync(wrapperModule, { recursive: true });
    fs.writeFileSync(
      path.join(wrapperModule, "go.mod"),
      "module example.com/wrapper\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(wrapperModule, "main.go"),
      [
        "package main",
        "",
        "import (",
        '  "os"',
        '  "os/exec"',
        ")",
        "",
        "// Rewrites the orphan once, when the emit of that very file starts, as an",
        "// editor saving at that moment would, then runs the real compiler.",
        "func main() {",
        '  source := os.Getenv("ORPHAN_RACE_SOURCE")',
        '  done := os.Getenv("ORPHAN_RACE_DONE")',
        "  if len(os.Args) > 1 {",
        "    first, errFirst := os.Stat(os.Args[1])",
        "    target, errTarget := os.Stat(source)",
        "    _, errDone := os.Stat(done)",
        "    if errFirst == nil && errTarget == nil && os.SameFile(first, target) && os.IsNotExist(errDone) {",
        '      os.WriteFile(source, []byte("export const value: string = \\"two\\";\\n"), 0o644)',
        "      os.WriteFile(done, nil, 0o644)",
        "    }",
        "  }",
        '  command := exec.Command(os.Getenv("ORPHAN_RACE_COMPILER"), os.Args[1:]...)',
        "  command.Stdin, command.Stdout, command.Stderr = os.Stdin, os.Stdout, os.Stderr",
        "  if err := command.Run(); err != nil {",
        "    if exit, ok := err.(*exec.ExitError); ok {",
        "      os.Exit(exit.ExitCode())",
        "    }",
        "    os.Exit(1)",
        "  }",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
    const wrapper = path.join(
      wrapperModule,
      process.platform === "win32" ? "tsgo.exe" : "tsgo",
    );
    const built = child_process.spawnSync(
      resolveGoCompiler(process.env).binary,
      ["build", "-o", wrapper, "."],
      { cwd: wrapperModule, encoding: "utf8" },
    );
    assert.equal(built.status, 0, built.stderr);

    const env = {
      ORPHAN_RACE_COMPILER: TestProject.TSGO_BINARY,
      ORPHAN_RACE_DONE: path.join(root, "rewritten"),
      ORPHAN_RACE_SOURCE: orphan,
      TTSC_CACHE_DIR: path.join(root, "orphan-cache"),
      TTSC_TSGO_BINARY: wrapper,
    };
    const run = () =>
      TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
        cwd: root,
        env,
      });

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(
      first.stdout.trim(),
      "two",
      "the emit read the rewritten source",
    );

    fs.writeFileSync(orphan, `export const value: string = "one";\n`, "utf8");
    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(
      second.stdout.trim(),
      "one",
      "the key of the first bytes served the lowering of other bytes",
    );
  }
