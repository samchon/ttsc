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
