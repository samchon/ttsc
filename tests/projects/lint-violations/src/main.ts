// Sample source for the lint-violations smoke fixture.
//
// Each `// expects:` comment annotates the rule we expect the lint pass
// to fire for this site. Test assertions live in
// tests/smoke/test/plugin-corpus.test.cjs and only check the rule name +
// severity; the exact message text is allowed to evolve.

// expects: no-var (error)
var legacy = 1;

// expects: no-explicit-any (warn)
function takesAny(x: any): any {
  return x;
}

// expects: no-debugger (error)
function debugMe(): void {
  debugger;
}

// expects: eqeqeq (error)
function loose(x: number, y: number): boolean {
  return x == y;
}

// expects: no-empty-interface (warn)
interface Empty {}

// `no-non-null-assertion` is configured "off" in tsconfig.json — this
// site is intentionally OK.
function probe(x: number | null): number {
  return x!;
}

// Touch every export so tsgo doesn't trim the file.
console.log(legacy, takesAny(0), loose(1, 2), debugMe, probe);
const _empty: Empty = {};
void _empty;
