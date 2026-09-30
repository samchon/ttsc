import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx still runs the entry when a flag that suppresses JavaScript
 * output is forwarded to its type-check.
 *
 * Flags before the entry go to the type-check, and `--noEmit` or
 * `--emitDeclarationOnly` changes nothing about that check. The runtime build
 * is the same compiler pass, though, and the forwarded flag came after ttsx's
 * own `--noEmit false`, so the build wrote no JavaScript and the run ended with
 * `emitted entry not found`. The runtime build now switches both back off after
 * every forwarded flag.
 *
 * 1. Create a project whose entry prints a line.
 * 2. Run it with both `--noEmit` and `--emitDeclarationOnly --declaration`.
 * 3. Assert the shared run prints the line and exits 0; units own each switch alone.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual launcher must execute entry-ran under forwarded noEmit and forwarded emitDeclarationOnly plus declaration; both switches together require zero status and exact output; individual and combined exact argument suffixes are owned by the runtimeCompilerArgs source unit.
 * @evidence contracts/testing.md#independent-expectations The authored entry marker requires real JavaScript execution; runtime builds must override user check-only emission suppression so a successful check is not mistaken for executable output.
 * @evidence contracts/testing.md#distinguishing-cases Both independent suppression flags retain their individual and combined source-unit inputs. runtimeCompilerArgs source units own token ordering and exact false suffixes; they do not prove the native emitter and Node handoff.
 * @evidence contracts/testing.md#execution-ownership The named E2E export owns one real combined request; individually forwarded switches and their original token preservation execute in the direct source unit, so no independent E2E case is hidden by a fail-fast loop.
 * @evidence contracts/e2e.md#necessary-boundary Actual emitter suppression flags and runtime executable publication must connect; an argument-array assertion cannot prove JavaScript was emitted and served.
 * @evidence contracts/e2e.md#shared-execution Both runtime emission overrides share one root preparation and host instead of two duplicate launchers; exact single-option policy requests execute in the source unit without an external compiler.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The host reads immutable source/config bytes and completes synchronously. TestProject owns fixture retention; no cold-cache or source-invalidation behavior is claimed.
 * @evidence contracts/e2e.md#preserved-coverage The original successful execution and exact entry-ran value remain under both switches together; the two individual flag inputs and unconditional false suffixes are explicit runtimeCompilerArgs source-unit assertions rather than duplicated hosts.
 */
export function test_ttsx_runs_the_entry_when_emit_suppressing_flags_are_forwarded() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "emitflags", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": `const ran: string = "entry-ran";\nconsole.log(ran);\n`,
    });

    const result = TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "--noEmit", "--emitDeclarationOnly", "--declaration", "src/main.ts"], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "entry-ran");
}
