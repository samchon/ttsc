import assert from "node:assert/strict";

import { RuntimeIsolatedEmit } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeIsolatedEmit";

/**
 * Verifies isolated emit arguments preserve format, purpose and path tokens.
 *
 * Execution requests maps; export-name preparation omits them. Both use the
 * same config-free ES2022 isolation policy. These argument observations do not
 * certify compiler execution, input selection, source ownership or fallback.
 *
 * 1. Pass opaque input/output paths to the actual argument owner.
 * 2. Contrast module/CommonJS and execution/export-scan token lists.
 * 3. Check the literal cache discriminator and independent returned arrays.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual RuntimeIsolatedEmit.compilerArgs returns the ordered compiler tokens for each format/purpose pair; policyKey returns the base policy discriminator, and mutating a returned argv cannot change subsequent calls.
 * @evidence contracts/testing.md#independent-expectations Literal CommonJS/ESNext module spellings, ES2022 config-free isolation flags, execution-only map flags and an explicit NUL-separated discriminator describe the supported compiler argument contract independently of the builder output.
 * @evidence contracts/testing.md#distinguishing-cases CommonJS versus module and execution versus export-scan distinguish format and map policy; spaced input/output strings stay individual tokens, and mutated versus fresh argv distinguishes ownership without measuring compiler reuse.
 * @evidence contracts/testing.md#execution-ownership This named direct unit imports the production-used internal argument owner and makes in-process data calls only; no compiler, peer, installation, child or product host runs, and the cache hit/source identity/native emit remain caller-owned boundaries.
 */
export function test_runtime_isolated_emit_preserves_argument_policy(): void {
  const input = "/owned inputs/requested source.tsx";
  const output = "/owned outputs/private emit";
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(name, { cause })); }
  };
  for (const [format, module] of [["commonjs", "commonjs"], ["module", "esnext"]] as const) {
    for (const purpose of ["execution", "export-scan"] as const) {
      check(`${format}/${purpose}`, () => {
        const expected = [
          input, "--module", module,
          "--ignoreConfig", "--target", "es2022", "--jsx", "react-jsx",
          "--noCheck", "--skipLibCheck", "--noResolve", "--isolatedModules",
          ...(purpose === "execution" ? ["--sourceMap", "--inlineSources"] : []),
          "--outDir", output,
        ];
        const actual = RuntimeIsolatedEmit.compilerArgs(input, output, format, purpose);
        assert.deepEqual(actual, expected);
        actual[0] = "changed by caller";
        actual.push("--unexpected");
        assert.deepEqual(RuntimeIsolatedEmit.compilerArgs(input, output, format, purpose), expected);
      });
    }
  }
  check("base-policy-discriminator", () => assert.equal(
    RuntimeIsolatedEmit.policyKey(),
    "--ignoreConfig\0--target\0es2022\0--jsx\0react-jsx\0--noCheck\0--skipLibCheck\0--noResolve\0--isolatedModules",
  ));
  if (failures.length) throw new AggregateError(failures, "isolated emit argument policy failed");
}
