import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import type { runCanonicalRuntimeProfiles } from "./runtime-canonical-profile-assembly";
import { STANDARD_DECORATOR_OUTPUT, STANDARD_DECORATOR_SOURCE } from "./ttsx-decorators";

/**
 * Stages the original five native response-file decorator requests on the
 * canonical root. Effective target and response order remain separate inputs;
 * the existing assembler joins each actual launcher before moving any input.
 *
 * @evidence contracts/common.md#principled-implementation Supplies the original response/config/source bytes and real TTSX argv to the existing process-owning assembler; no response expansion or emission is simulated.
 * @evidence contracts/common.md#clear-and-simple-design Five literal rows create five named profiles with one shared callback shape, original source witness and existing configuration serializer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid-target failure remains failure/TS6046/empty stdout, not a skipped request or forged successful emission.
 * @evidence contracts/common.md#meaningful-documentation States original five requests, separate effective options and actual launcher transition ownership.
 * @evidence contracts/portability.md#os-neutral-implementation Preserves native caller cwd and original response-file argument vectors through the owning spawn operation without shell/path rewriting or OS-derived output interpretation.
 * @evidence contracts/performance.md#efficient-algorithms Builds five source/config maps proportional to original authored bytes; each native compilation remains separately measured work.
 * @evidence contracts/performance.md#reuse-equivalent-work Borrows the existing canonical consumer allocation and shipped tools; five distinct effective option requests and their Program costs are not claimed reused.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Maps and callbacks transfer to the existing assembler; it owns launcher receipts, input holding and retained uncertainty before subsequent requests.
 * @evidence contracts/testing.md#behavioral-verification Four successful requests require the complete original decorator output plus optional-chain booleans; invalid response requires nonzero status, TS6046 and empty stdout.
 * @evidence contracts/testing.md#independent-expectations Original literal true/false/null rows and authored decorator output supply the expectations independently of actual native results.
 * @evidence contracts/testing.md#distinguishing-cases Response ESNext/ES2019, nested response before/after direct flags and invalid target retain their original five configurations and argv order.
 * @evidence contracts/testing.md#execution-ownership Only the consolidated Runtime parent requests these profiles; the original standalone five-root donor remains unchanged and no execution is certified by authoring.
 * @evidence contracts/e2e.md#necessary-boundary Real compiler response expansion reaches runtime adjustment and Node; a visible-token unit cannot establish this native connection.
 * @evidence contracts/e2e.md#shared-execution Five original roots become five staged profiles on the joined canonical root, with five real requests and unchanged shipped compiler preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The existing assembler holds prior sources/config/output/cache aliases, preserves completed observations and blocks later staging after unknown launcher results. Invalid ordinary exits still permit independent later profiles.
 * @evidence contracts/e2e.md#preserved-coverage Retains test_ttsx_standard_decorators_honor_response_file_options exact five row inputs, source suffix, four complete output/status assertions and invalid status/diagnostic/empty output. Remote surviving execution and donor removal remain pending.
 */
export function canonicalResponseDecoratorProfiles(): Parameters<typeof runCanonicalRuntimeProfiles>[1] {
  const profiles: Parameters<typeof runCanonicalRuntimeProfiles>[1][number][] = [];
  let index = 0;
  for (const [target, response, args, nativeOptionalChain] of [
    ["ES2022", "--target esnext\n", ["@args.txt"], true],
    ["ESNext", "--target es2019\n", ["@args.txt"], false],
    ["ESNext", "@inner.txt\n", ["--target", "es2019", "@args.txt"], true],
    ["ESNext", "@inner.txt\n", ["@args.txt", "--target", "es2019"], false],
    ["ESNext", "--target invalid\n", ["@args.txt"], null],
  ] as const) {
    profiles.push({
      name: "response-decorator-" + index++,
      files: {
        "tsconfig.json": TestProject.tsconfig({ target, module: "commonjs", strict: true, outDir: "dist", rootDir: "src" }),
        "args.txt": response,
        "inner.txt": "--target esnext\n",
        "src/main.ts": STANDARD_DECORATOR_SOURCE + '\nfunction optional(value?: { answer: number }) { return value?.answer; }\nconsole.log(optional.toString().includes("?."));',
      },
      run: (root, _persistent, spawn) => {
        const result = spawn(TestProject.TTSX_BIN, [...args, "src/main.ts"], { cwd: root });
        const failures: unknown[] = [];
        if (nativeOptionalChain === null) {
          try { assert.notEqual(result.status, 0); } catch (error) { failures.push(error); }
          try { assert.match(result.stderr, /TS6046/); } catch (error) { failures.push(error); }
          try { assert.equal(result.stdout, ""); } catch (error) { failures.push(error); }
        } else {
          try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
          try { assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT + "\n" + nativeOptionalChain); } catch (error) { failures.push(error); }
        }
        if (failures.length)
          throw new AggregateError(failures, "standard_decorators_honor_response_file_options assertions failed");
      },
    });
  }
  return profiles;
}
