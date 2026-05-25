// Sample source for the lint-violations smoke fixture.
//
// Each `// expect: <rule> <severity>` line pins the diagnostic the
// lint pass MUST emit on the *next* non-comment, non-blank line. The
// plugin corpus feature in tests/test-ttsc parses these
// annotations and asserts the diagnostic set is exact — every
// annotated site fires, no extra sites fire, and the rendered
// line:column matches what the engine reports.

// expect: noVar error
var legacy = 1;

function takesAnyArg(
  // expect: noExplicitAny warn
  x: any,
): number {
  return Number(x);
}

// expect: noExplicitAny warn
function returnsAny(): any {
  return null;
}

function debugMe(): void {
  // expect: noDebugger error
  debugger;
}

function loose(x: number, y: number): boolean {
  // expect: eqeqeq error
  return x == y;
}

// expect: noEmptyInterface warn
interface Empty {}

function suspect(arr: number[]): void {
  // expect: preferForOf warn
  for (let i = 0; i < arr.length; i++) {
    console.log(arr[i]);
  }
}

function nullably(x: number | null, y: number): boolean {
  // expect: noConfusingNonNullAssertion error
  return x! === y;
}

// `no-non-null-assertion` is configured "off" — `x!` below is silent.
function probe(x: number | null): number {
  return x!;
}

// Anchor every export so tsgo doesn't tree-shake the file.
console.log(
  legacy,
  takesAnyArg(0),
  returnsAny(),
  loose(1, 2),
  debugMe,
  suspect,
  nullably,
  probe,
);
const _empty: Empty = {};
void _empty;
