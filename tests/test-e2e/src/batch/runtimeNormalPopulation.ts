import assert from "node:assert/strict";

/**
 * Compares seven normal value and physical-edge contributions in one payload.
 *
 * 1. Read the actual shared Runtime's labeled module results.
 * 2. Compare every independent value before reporting collected failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native-loaded flat/nested helper edges, distinct same-basename modules, raw .ts require and app/scripts-to-shared edge supply seven labeled values. Every assertion has its own collected error so one module's wrong value does not hide another successful observation.
 * @evidence contracts/testing.md#independent-expectations Authored no-rootdir-flat/no-rootdir-nested, cleared/released, scripts/src identities, other=other, lib+shared and nested-tsconfig-ok literals are independent of the compiler output and resolver. No native snapshot is converted into the expected object.
 * @evidence contracts/testing.md#distinguishing-cases Flat and nested relative imports contrast, both same-basename source bodies remain distinguishable, and the required .ts edge retains its authored specifier rather than being replaced by an emitted-JS-only control.
 * @evidence contracts/testing.md#execution-ownership The existing Runtime E2E entry calls this assertion helper once after its single host. This helper starts no native compiler, process, project or legacy test function.
 * @evidence contracts/e2e.md#necessary-boundary Public Runtime owns actual native loading of these physical source edges; this helper only compares its resulting values. Actual locator, requested-source ownership, private-output arguments and single-root overlay units own their separate selection/projection decisions. The public carrier clears inherited rootDir and executes its real native pin path; native inferred-root metadata itself is not asserted by these values.
 * @evidence contracts/e2e.md#shared-execution All seven contributions are authored before one common Program and Runtime request. Additional config owners or per-source fallback profiles are not prepared for them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint source paths separate the identities while shared/lib relative edges deliberately cross their authored subtrees. The shared owner compares all input bytes after Runtime closure to reject leaked output or mutation. No cold/warm or changing-source claim is made.
 * @evidence contracts/e2e.md#preserved-coverage All seven exact values compose with actual EmitOwnershipIndex, OwnedProjectSource, locator, TsgoArguments and singleRootProjectConfig owners. The retained public-register Mocha boundary owns excluded same-basename roots and exit cleanup. Real source/root and configured-owner tree equality owns public-output nonmutation; the existing empty-owner native fallback exercises the actual overlay connection without per-source requests. MIGRATION.md records the split and unmeasured producer costs rather than treating values as option metadata.
 */
export function assertRuntimeNormalPopulation(input: unknown): void {
  assert.ok(input !== null && typeof input === "object");
  const actual = input as Record<string, unknown>;
  const expected: Record<string, unknown> = {
    flat: "no-rootdir-flat",
    nested: "no-rootdir-nested",
    include: ["cleared", "released"],
    sameName: ["ran scripts/index.ts", "ran src/index.ts"],
    required: "other=other",
    composite: "lib+shared",
    nestedPackage: "nested-tsconfig-ok",
  };
  const failures: Error[] = [];
  for (const [name, value] of Object.entries(expected)) {
    try {
      assert.deepEqual(actual[name], value);
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Shared Runtime normal population");
}
