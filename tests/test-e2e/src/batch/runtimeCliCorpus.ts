import assert from "node:assert/strict";

/**
 * Verifies post-entry option-shaped arguments reach the shared runtime program.
 *
 * The runtime corpus imports one typed dependency in its existing NodeNext
 * host. Tokens after runtime.mts must remain program argv, including --help;
 * the imported dependency must not become the main module. The main-module
 * assertion on runtime.mts itself belongs to the shared entry's owner.
 *
 * 1. Borrow the cliPolicyRuntime value from the single runtime payload.
 * 2. Require every original post-entry token and the authored typed value.
 * 3. Distinguish an imported dependency from the owning entry where supported.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual installed launcher and typed dependency supply the payload; exact post-entry argv detects premature --help handling or compiler-flag consumption, and value typed detects a lost dependency result.
 * @evidence contracts/testing.md#independent-expectations The five argument literals and typed value are authored independently of launcher parsing; native test-host import.meta.main availability selects the false versus null expectation without trusting the returned capability.
 * @evidence contracts/testing.md#distinguishing-cases Option-shaped names alternate with literal values and end with --help; imported main metadata must be false where the native host exposes it. This helper does not assert the owning entry's main metadata, fatal exits or CommonJS-frontdoor behavior.
 * @evidence contracts/testing.md#execution-ownership The existing runtime batch calls this assertion on its single JSON payload; this helper creates no fixture, compiler Program, process or independently discoverable test entry.
 * @evidence contracts/e2e.md#necessary-boundary Actual launcher tail forwarding and executed typed-module loading cannot be established by portable parseFlags or runtimeCompilerArgs calls alone.
 * @evidence contracts/e2e.md#shared-execution These observations consume the existing runtime.mts NodeNext Program and host alongside the decorator and module corpus, without a second launch or preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture copies argv into a fresh record and reads an immutable typed literal and its own module metadata; this assertion changes no process or cache state, and the parent batch owns host and workspace cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The original JavaScript-entry donor's five argv tokens and typed value survive here in the shared typed-entry connection; its CommonJS-main frontdoor is not certified by this dependency. Portable option partition and runtime suffix decisions remain in the two existing test-ttsc argument units; response expansion, main startup and fatal exit lifetimes are not certified by those units or this assertion.
 */
export function assertRuntimeCliCorpus(actual: unknown): void {
  assert.ok(
    actual !== null && typeof actual === "object",
    "cli policy payload is required",
  );
  const observed = actual as Record<string, unknown>;
  const failures: Error[] = [];
  const check = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  check("post-entry option-shaped argv", () =>
    assert.deepEqual(observed.argv, ["--config", "x", "--port", "3", "--help"]),
  );
  check("typed dependency value", () => assert.equal(observed.value, "typed"));
  check("imported dependency is not the main module", () =>
    assert.equal(observed.dependencyMain, "main" in import.meta ? false : null),
  );
  if (failures.length)
    throw new AggregateError(failures, "Shared runtime CLI corpus failed");
}
