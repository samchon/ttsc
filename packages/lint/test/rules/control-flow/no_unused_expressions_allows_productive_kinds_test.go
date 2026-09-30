package linthost

import "testing"

// TestNoUnusedExpressionsAllowsProductiveKinds verifies no-unused-expressions ignores every productive statement shape.
//
// Locks the disallow-list polarity of `noUnusedExpressionsDisallows`: upstream
// ESLint flags only a fixed list of side-effect-free shapes and ignores
// everything else, so calls, optional calls, `new`, plain/compound/logical
// assignments, prefix and postfix updates, `delete`, `void`, dynamic
// `import()`, `await`, `yield`, `yield*`, and `satisfies` (absent from the
// upstream Checker map, hence never reported) must all stay silent. The
// TypeScript wrappers around calls inherit the call's classification.
//
// 1. Parse a TypeScript file containing one statement per productive shape.
// 2. Run the native Engine with only no-unused-expressions enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for every original supported productive or delegated-syntax form.
// @evidence contracts/testing.md#independent-expectations Authored call/new/assignment/update/delete/void/import/await/yield operations satisfy the supported statement policy. The retained satisfies expressions are syntax-policy exclusions, not a proof of runtime effects for a pure value.
// @evidence contracts/testing.md#distinguishing-cases Optional/generic calls, modifying forms, TS-wrapped calls, dynamic import and suspension forms stay clean; SideEffectFreeKinds owns default reports and TsWrappersInheritClassification owns wrapped value negatives.
// @evidence contracts/testing.md#execution-ownership TestNoUnusedExpressionsAllowsProductiveKinds is selected in the shared Go unit population. It calls assertRuleSkipsSource for the complete original no-unused-expressions source through the AST Engine. No installed consumer, native artifact build or real product host runs.
func TestNoUnusedExpressionsAllowsProductiveKinds(t *testing.T) {
  assertRuleSkipsSource(t, "no-unused-expressions", `declare function run(): number;
declare function generic<T>(value: T): T;
declare const maybe: (() => number) | undefined;
declare const box: { value?: number };
let counter = 0;

run();
maybe?.();
new Error("side effect");
counter = 1;
counter += 2;
counter ||= 5;
counter++;
counter--;
++counter;
--counter;
delete box.value;
void run();
void 0;
import("node:path");
run() as unknown;
<unknown>run();
run()!;
run() satisfies unknown;
counter satisfies number;
generic(run());

async function later(): Promise<void> {
  await run();
}
function* sequence(): Generator<number> {
  yield run();
  yield* sequence();
}
void later;
void sequence;
`)
}
