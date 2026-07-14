package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

const unicornConsistentFunctionScopingRuleName = "unicorn/consistent-function-scoping"

func TestRuleCorpusUnicornConsistentFunctionScoping(t *testing.T) {
  source := `export function formatNames(names: string[]): string[] {
  // expect: unicorn/consistent-function-scoping error
  function normalize(name: string): string {
    return name.trim().toLowerCase();
  }

  return names.map(normalize);
}
`
  expected := parseRuleExpectations(t, source)
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  if len(findings) == 0 {
    t.Fatalf("want %v, got no findings", expected)
  }
  actual := normalizeRuleFindings(findings[0].File, findings)
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for index := range expected {
    if actual[index] != expected[index] {
      t.Fatalf("finding[%d]: want %+v, got %+v", index, expected[index], actual[index])
    }
  }
}

func TestUnicornConsistentFunctionScopingUsesBindingIdentityAndIgnoresSelfRecursion(t *testing.T) {
  source := `function outer(captured: number): void {
  const local = captured;
  type Local = { value: number };
  function capturesParameter(): number { return captured; }
  function capturesLocal(): number { return local; }
  function capturesType(input: Local): number { return input.value; }
  function movable(value: number): number {
    return value === 0 ? 0 : movable(value - 1);
  }
  {
    const blockLocal = 1;
    function capturesBlock(): number { return blockLocal; }
    void capturesBlock;
  }
  void [capturesParameter, capturesLocal, capturesType];
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  if len(findings) != 1 || findings[0].Message != "Move function 'movable' to the outer scope." {
    t.Fatalf("want only the recursive movable function, got %+v", findings)
  }
}

func TestUnicornConsistentFunctionScopingOuterReferencePinsRecursiveFunction(t *testing.T) {
  // Upstream applies the parent-scope reference check before the recursive
  // function-name exemption: once the surrounding scope calls or reads the
  // recursive function directly, the definition must stay beside that use.
  source := `function outer(): void {
  function movable(value: number): number {
    return value === 0 ? 0 : movable(value - 1);
  }
  void movable;
}
void outer;
`
  assertRuleSkipsSource(t, unicornConsistentFunctionScopingRuleName, source)
}

func TestUnicornConsistentFunctionScopingKeepsSharedOuterReferencesTogether(t *testing.T) {
  source := `let shared = 0;
function outer(): number {
  shared += 1;
  function readsShared(): number { return shared; }
  return shared + readsShared();
}
void outer;
`
  assertRuleSkipsSource(t, unicornConsistentFunctionScopingRuleName, source)
}

func TestUnicornConsistentFunctionScopingResolvesJSXComponentCaptures(t *testing.T) {
  source := `declare namespace JSX {
  interface Element {}
  interface IntrinsicElements { section: {}; }
}
function capturesComponent(Component: () => JSX.Element): () => JSX.Element {
  function render(): JSX.Element { return <Component />; }
  return render;
}
function ignoresIntrinsicTag(): () => JSX.Element {
  function movable(): JSX.Element { return <section />; }
  return movable;
}
void [capturesComponent, ignoresIntrinsicTag];
`
  _, _, findings := runRuleFindingsSnapshotFile(
    t,
    unicornConsistentFunctionScopingRuleName,
    "main.tsx",
    source,
    nil,
  )
  if len(findings) != 1 || findings[0].Message != "Move function 'movable' to the outer scope." {
    t.Fatalf("JSX reference analysis mismatch: %+v", findings)
  }
}

func TestUnicornConsistentFunctionScopingChecksArrowLexicalEnvironment(t *testing.T) {
  source := `function outer(value: number): void {
  const movable = (input: number): number => input + 1;
  const capturesValue = (input: number): number => input + value;
  const capturesThis = (): unknown => this;
  const capturesArguments = (): IArguments => arguments;
  function ordinaryThis(): unknown { return this; }
  function ordinaryArguments(): IArguments { return arguments; }
  void [movable, capturesValue, capturesThis, capturesArguments, ordinaryThis, ordinaryArguments];
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  if len(findings) != 3 {
    t.Fatalf("want movable arrow plus two ordinary functions, got %+v", findings)
  }
  messages := map[string]bool{}
  for _, finding := range findings {
    messages[finding.Message] = true
  }
  for _, message := range []string{
    "Move arrow function 'movable' to the outer scope.",
    "Move function 'ordinaryThis' to the outer scope.",
    "Move function 'ordinaryArguments' to the outer scope.",
  } {
    if !messages[message] {
      t.Fatalf("missing %q in %+v", message, findings)
    }
  }
}

func TestUnicornConsistentFunctionScopingHonorsCheckArrowFunctions(t *testing.T) {
  source := `function outer(): void {
  const arrow = (): number => 1;
  function declaration(): number { return 1; }
  void [arrow, declaration];
}
void outer;
`
  _, _, defaults := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  if len(defaults) != 2 {
    t.Fatalf("default options should check both definitions, got %+v", defaults)
  }
  _, _, configured := runRuleFindingsSnapshot(
    t,
    unicornConsistentFunctionScopingRuleName,
    source,
    json.RawMessage(`{"checkArrowFunctions":false}`),
  )
  if len(configured) != 1 || configured[0].Message != "Move function 'declaration' to the outer scope." {
    t.Fatalf("disabled arrow checking mismatch: %+v", configured)
  }
}

func TestUnicornConsistentFunctionScopingTreatsLoopScopesAsOneBoundary(t *testing.T) {
  source := `declare const values: readonly number[];
function outer(): void {
  for (const value of values) {
    const local = value;
    const capturesHeader = (): number => value;
    const capturesBody = (): number => local;
    const movable = (): boolean => true;
    void [capturesHeader, capturesBody, movable];
  }
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  if len(findings) != 1 || findings[0].Message != "Move arrow function 'movable' to the outer scope." {
    t.Fatalf("loop scope analysis mismatch: %+v", findings)
  }
}

func TestUnicornConsistentFunctionScopingPreservesUpstreamFactoryExceptions(t *testing.T) {
  t.Run("React hook and IIFE only exempt immediate children", func(t *testing.T) {
    source := `declare function useEffect(callback: () => void, dependencies: readonly unknown[]): void;
useEffect(() => {
  function immediate(): void {
    function nested(): void {}
    void nested;
  }
  void immediate;
}, []);
(function (): void {
  function immediateIIFE(): void {
    function nestedIIFE(): void {}
    void nestedIIFE;
  }
  void immediateIIFE;
})();
`
    _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
    if len(findings) != 2 {
      t.Fatalf("want only the two deeply nested functions, got %+v", findings)
    }
    if findings[0].Message != "Move function 'nested' to the outer scope." ||
      findings[1].Message != "Move function 'nestedIIFE' to the outer scope." {
      t.Fatalf("factory exception messages mismatch: %+v", findings)
    }
  })

  t.Run("Jest mock factory excludes every depth", func(t *testing.T) {
    source := `declare const jest: { mock(name: string, factory: () => unknown): void };
jest.mock("module", () => {
  function createMock(): string {
    const nested = (): string => "mock";
    return nested();
  }
  return createMock;
});
`
    assertRuleSkipsSource(t, unicornConsistentFunctionScopingRuleName, source)
  })
}

func TestUnicornConsistentFunctionScopingChainsBlocksInsideLoopBodies(t *testing.T) {
  // Loop bodies live in IterationStatementBase.Statement, so the loop-body
  // chain must not rely on Node.Body(). Upstream reports definitions at the
  // top of while/do bodies yet keeps ones whose captures live anywhere on
  // the block chain inside the loop body.
  source := `declare const condition: boolean;
declare function consume(value: unknown): void;
while (condition) {
  const movableWhile = (): boolean => true;
  consume(movableWhile);
}
do {
  const movableDo = (): boolean => true;
  consume(movableDo);
} while (condition);
function outer(): void {
  for (;;) {
    const pinned = 1;
    {
      {
        const capturesLoopBody = (): number => pinned;
        consume(capturesLoopBody);
      }
    }
  }
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  if len(findings) != 2 ||
    findings[0].Message != "Move arrow function 'movableWhile' to the outer scope." ||
    findings[1].Message != "Move arrow function 'movableDo' to the outer scope." {
    t.Fatalf("loop body chain mismatch: %+v", findings)
  }
}

func TestUnicornConsistentFunctionScopingReadsClassHeadPositionsAsLexicalEnvironment(t *testing.T) {
  // Computed member keys and heritage expressions of a class evaluate in the
  // enclosing lexical environment, while field initializers and method bodies
  // rebind `this`. Upstream keeps the first two arrows and reports the third.
  source := `function outer(): void {
  const capturesComputedKey = () =>
    class WithKey {
      [this.x](): void {}
    };
  const capturesHeritage = () => class WithBase extends (this.Base as new () => object) {};
  const rebindsThis = () =>
    class WithField {
      value = this;
    };
  void [capturesComputedKey, capturesHeritage, rebindsThis];
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  if len(findings) != 1 ||
    findings[0].Message != "Move arrow function 'rebindsThis' to the outer scope." {
    t.Fatalf("class head position mismatch: %+v", findings)
  }
}

func TestUnicornConsistentFunctionScopingProtectsSuperAndPrivateNames(t *testing.T) {
  source := `class Base {
  protected read(): number { return 1; }
}
class Derived extends Base {
  #value = 1;
  method(other: Derived): void {
    const capturesThis = (): number => this.#value;
    const capturesSuper = (): number => super.read();
    const capturesPrivate = (): number => other.#value;
    function movable(): number { return 1; }
    void [capturesThis, capturesSuper, capturesPrivate, movable];
  }
}
void Derived;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  if len(findings) != 1 || findings[0].Message != "Move function 'movable' to the outer scope." {
    t.Fatalf("class lexical environment mismatch: %+v", findings)
  }
}

func TestUnicornConsistentFunctionScopingChecksReturnedArrowChains(t *testing.T) {
  source := `function middleware() {
  return (next: (value: string) => string) => (value: string) => next(value);
}
void middleware;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  if len(findings) != 2 {
    t.Fatalf("both returned arrow definitions should be checked, got %+v", findings)
  }
}

func TestUnicornConsistentFunctionScopingReportsCanonicalHeadRanges(t *testing.T) {
  source := `function outer(): void {
  async function* nested(): AsyncGenerator<void> {}
  const arrow = async (): Promise<void> => {};
  void [nested, arrow];
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  if len(findings) != 2 {
    t.Fatalf("want two findings, got %+v", findings)
  }

  functionStart := strings.Index(source, "async function* nested")
  functionEnd := functionStart + len("async function* nested")
  if findings[0].Pos != functionStart || findings[0].End != functionEnd ||
    findings[0].Message != "Move async generator function 'nested' to the outer scope." {
    t.Fatalf("function head mismatch: %+v", findings[0])
  }
  arrowStart := strings.LastIndex(source, "=>")
  if findings[1].Pos != arrowStart || findings[1].End != arrowStart+2 ||
    findings[1].Message != "Move async arrow function 'arrow' to the outer scope." {
    t.Fatalf("arrow head mismatch: %+v", findings[1])
  }
}

func TestUnicornConsistentFunctionScopingValidatesThePublicOptionShape(t *testing.T) {
  valid := []json.RawMessage{nil, json.RawMessage(`{}`), json.RawMessage(`{"checkArrowFunctions":true}`), json.RawMessage(`{"checkArrowFunctions":false}`)}
  for _, options := range valid {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornConsistentFunctionScopingRuleName: SeverityError},
      Options: RuleOptionsMap{unicornConsistentFunctionScopingRuleName: options},
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("valid options %s were rejected: %v", options, err)
    }
    if !engine.NeedsTypeChecker() {
      t.Fatalf("valid options %s lost the checker requirement", options)
    }
  }

  invalid := []struct {
    options json.RawMessage
    want    string
  }{
    {options: json.RawMessage(`null`), want: "options must be an object"},
    {options: json.RawMessage(`[]`), want: "options must be an object"},
    {options: json.RawMessage(`{"checkArrowFunctions":null}`), want: `option "checkArrowFunctions" must be a boolean`},
    {options: json.RawMessage(`{"checkArrowFunctions":"yes"}`), want: `option "checkArrowFunctions" must be a boolean`},
    {options: json.RawMessage(`{"unknown":true}`), want: `unknown option "unknown"`},
  }
  for _, test := range invalid {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornConsistentFunctionScopingRuleName: SeverityError},
      Options: RuleOptionsMap{unicornConsistentFunctionScopingRuleName: test.options},
    })
    err := engine.ConfigError()
    if err == nil || !strings.Contains(err.Error(), test.want) {
      t.Fatalf("invalid options %s mismatch: want %q, got %v", test.options, test.want, err)
    }
    if _, active := engine.EnabledRules()[unicornConsistentFunctionScopingRuleName]; active {
      t.Fatalf("invalid options entered the dispatch table: %v", engine.EnabledRules())
    }
  }
}
