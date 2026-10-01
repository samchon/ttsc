import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../../internal/ttsc/internal/ttsx-decorators";

/**
 * Verifies decorator runtime targets follow compiler response-file precedence.
 *
 * A scan of visible CLI flags misses targets inside response files, leaving
 * decorators intact or replacing an explicitly requested lower target.
 *
 * 1. Select ESNext or ES2019 using nested response files and direct CLI flags.
 * 2. Run decorated code which exposes whether optional chaining was lowered.
 * 3. Assert the compiler's last effective target controls both behaviors.
 * @evidence contracts/testing.md#behavioral-verification Actual nested response precedence controls executable decorators and optional-chain preservation; an invalid target requires TS6046, failure and empty stdout.
 * @evidence contracts/testing.md#independent-expectations Supported ESNext/ES2019 emission determines literal optional-chain booleans, authored decorators determine effects and invalid-target diagnostics specify TS6046.
 * @evidence contracts/testing.md#distinguishing-cases Response ESNext/ES2019, nested response before/after direct flags and invalid response distinguish native expansion/order. Visible-token policy has direct units.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns five actual native response/compiler/runtime requests.
 * @evidence contracts/e2e.md#necessary-boundary Compiler-owned response expansion must reach runtime adjustment and Node; JavaScript visible-token units cannot establish that transport.
 * @evidence contracts/e2e.md#shared-execution Changed response/target ordering requires distinct native option interpretation. Invalid target cannot host other cases, and shipped compiler/launcher artifacts are reused.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each immutable effective-option input owns a tracked root; completed hosts reset module state and no differing producer config aliases a cache.
 * @evidence contracts/e2e.md#preserved-coverage Four original success/effect/optional-chain outcomes and invalid status/diagnostic/empty stdout remain. Every response request executes before collected assertion failures are thrown.
 */
export function test_ttsx_standard_decorators_honor_response_file_options() {
  const failures: unknown[] = [];
  for (const [target, response, args, nativeOptionalChain] of [
    ["ES2022", "--target esnext\n", ["@args.txt"], true],
    ["ESNext", "--target es2019\n", ["@args.txt"], false],
    ["ESNext", "@inner.txt\n", ["--target", "es2019", "@args.txt"], true],
    ["ESNext", "@inner.txt\n", ["@args.txt", "--target", "es2019"], false],
    ["ESNext", "--target invalid\n", ["@args.txt"], null],
  ] as const) {
    const root = TestProject.commonJsProject(
      {
        "args.txt": response,
        "inner.txt": "--target esnext\n",
        "src/main.ts":
          STANDARD_DECORATOR_SOURCE +
          '\nfunction optional(value?: { answer: number }) { return value?.answer; }\nconsole.log(optional.toString().includes("?."));',
      },
      { compilerOptions: { target } },
    );
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      [...args, "src/main.ts"],
      { cwd: root },
    );
    if (nativeOptionalChain === null) {
      try { assert.notEqual(result.status, 0); } catch (error) { failures.push(error); }
      try { assert.match(result.stderr, /TS6046/); } catch (error) { failures.push(error); }
      try { assert.equal(result.stdout, ""); } catch (error) { failures.push(error); }
    } else {
      try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
      try { assert.equal(
        result.stdout.trim(),
        STANDARD_DECORATOR_OUTPUT + "\n" + nativeOptionalChain,
      ); } catch (error) { failures.push(error); }
    }
  }

  if (failures.length) throw new AggregateError(failures, "standard_decorators_honor_response_file_options assertions failed");
}
