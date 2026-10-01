import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx still selects a project through the legacy uppercase `-P`.
 *
 * Ttsx has always accepted `-P` and `-P=<file>`, and used to get them by
 * rewriting the token to `--project` textually before the engine saw argv,
 * because the exact-spelling index could not resolve an uppercase alias. The
 * engine now resolves a token to the flag the compiler resolves it to, so the
 * rewrite was removed as a second rule for a job the engine owns. That makes
 * this an end-to-end guard rather than a parser detail: the spelling has to
 * keep selecting the project through the real launcher.
 *
 * 1. Create a project whose `alt/tsconfig.json` is the only one that declares the
 *    entry's directory, and whose entry prints a recognisable line.
 * 2. Run ttsx with `-P alt/tsconfig.json`; verify both lexical forms directly in the parser unit.
 * 3. Assert the public selection reaches that project and runs the entry.
 *
 * @evidence contracts/testing.md#behavioral-verification The public launcher selects the only alternate config through uppercase -P and executes ENTRY with status zero; no default root config can silently supply this preparation.
 * @evidence contracts/testing.md#independent-expectations The fixture config explicitly owns ../src and the authored program prints ENTRY; choosing that config is required to prepare the entry, independently of the parser's internal projection.
 * @evidence contracts/testing.md#distinguishing-cases Uppercase spaced project selection exercises the real alternate-config connection. The actual parseTtsxCLI unit separately owns spaced and inline uppercase forms, exact selected path and absence of leaked compiler/program arguments.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry invokes one actual compiler-backed public launcher; the parser spelling matrix runs in the source-unit population.
 * @evidence contracts/e2e.md#necessary-boundary The parser's selected path must reach real project discovery, preparation and Node execution; returning a path from a unit call cannot prove that caller wiring.
 * @evidence contracts/e2e.md#shared-execution One alternate project preparation and one runtime host check selection assembly and the former long-project typed message; both fixtures use the same ES2022/CommonJS strict ../src and ../dist config profile. Repeating the same compiler program for the inline spelling adds no connection, so that lexical decision executes directly through the owning parser.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh fixture has only its alternate config and immutable source; no default config or prior output can satisfy the invocation. Synchronous spawn completes before TestProject releases fixture state.
 * @evidence contracts/e2e.md#preserved-coverage Original zero-exit and ENTRY assertions remain in this public host; both original -P argument forms and the original long --project configs/app.json request retain exact path, entry and forwarded-array assertions in the actual parser unit. The former separate explicit-project corpus typed message executes here as the exact second output line with the same alternate-config compiler profile.
 */
export function test_ttsx_selects_the_project_through_the_legacy_uppercase_p_flag() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_selects_the_project_through_the_legacy_uppercase_p_flag/inputs-1"));

    const args = ["-P", "alt/tsconfig.json"];
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, ...args, "src/main.ts"], { cwd: root });
    assert.equal(result.status, 0, `ttsx ${args.join(" ")}:\n${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /ENTRY/);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), ["ENTRY", "explicit-runner-project"]);
}
