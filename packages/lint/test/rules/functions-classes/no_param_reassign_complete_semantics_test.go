package linthost

import (
  "encoding/json"
  "sort"
  "strings"
  "testing"

  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type noParamReassignFinding struct {
  line    int
  message string
}

func runNoParamReassign(
  t *testing.T,
  source string,
  options json.RawMessage,
) []noParamReassignFinding {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, "no-param-reassign", source, options)
  normalized := make([]noParamReassignFinding, 0, len(findings))
  for _, finding := range findings {
    if finding.Rule != "no-param-reassign" {
      t.Fatalf("unexpected rule in no-param-reassign findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("no-param-reassign must not offer edits: %+v", finding)
    }
    normalized = append(normalized, noParamReassignFinding{
      line:    shimscanner.GetECMALineOfPosition(finding.File, finding.Pos) + 1,
      message: finding.Message,
    })
  }
  sort.Slice(normalized, func(i, j int) bool {
    if normalized[i].line != normalized[j].line {
      return normalized[i].line < normalized[j].line
    }
    return normalized[i].message < normalized[j].message
  })
  return normalized
}

func assertNoParamReassignFindings(
  t *testing.T,
  got []noParamReassignFinding,
  want ...noParamReassignFinding,
) {
  t.Helper()
  if len(got) != len(want) {
    t.Fatalf("no-param-reassign finding count mismatch: want=%+v got=%+v", want, got)
  }
  for index := range want {
    if got[index] != want[index] {
      t.Fatalf("no-param-reassign finding[%d] mismatch: want=%+v got=%+v all=%+v", index, want[index], got[index], got)
    }
  }
}

func TestNoParamReassignResolvesEveryParameterBindingAndWriteForm(t *testing.T) {
  source := `function writes(
  simple: any,
  { object = 0, nested: { deep = 0 } = {} }: any = {},
  [arrayValue = 0]: any[] = [],
  ...rest: any[]
): void {
  simple = 1;
  simple += 1;
  simple &&= 1;
  simple ||= 1;
  simple ??= 1;
  ++simple;
  simple--;
  ({ value: simple } = { value: 1 });
  [arrayValue = 1] = [];
  ({ object } = { object: 1 });
  ({ nested: { deep } } = { nested: { deep: 1 } });
  [...rest] = [];
  for (simple in {});
  for (arrayValue of []);
  (() => { object = 2; })();
}
`
  got := runNoParamReassign(t, source, nil)
  direct := func(line int, name string) noParamReassignFinding {
    return noParamReassignFinding{line: line, message: "Assignment to function parameter '" + name + "'."}
  }
  assertNoParamReassignFindings(
    t,
    got,
    direct(7, "simple"),
    direct(8, "simple"),
    direct(9, "simple"),
    direct(10, "simple"),
    direct(11, "simple"),
    direct(12, "simple"),
    direct(13, "simple"),
    direct(14, "simple"),
    direct(15, "arrayValue"),
    direct(16, "object"),
    direct(17, "deep"),
    direct(18, "rest"),
    direct(19, "simple"),
    direct(20, "arrayValue"),
    direct(21, "object"),
  )
}

func TestNoParamReassignUsesCheckerIdentityAcrossNestedScopes(t *testing.T) {
  source := `function scopes(value: any): void {
  { let value = 0; value = 1; }
  try { throw 0; } catch (value) { value = 1; }
  class Shadows {
    value = 1;
    field = (() => { let value = 0; value = 1; return value; })();
    static { let value = 0; value = 1; }
  }
  function local(): void { let value = 0; value = 1; }
  function captured(): void { value = 2; }
  class Captures {
    field = (value = 3);
    static { value = 4; }
  }
  const alias = value;
  const holder = { alias };
  JSON.stringify([Shadows, Captures, captured, holder]);
}
function nestedParameter(value: any): void {
  function inner(value: any): void { value = 5; }
  inner(value);
}
function mergedVar(value: any): void {
  var value;
  value = 6;
}
`
  got := runNoParamReassign(t, source, nil)
  assertNoParamReassignFindings(
    t,
    got,
    noParamReassignFinding{line: 10, message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 12, message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 13, message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 21, message: "Assignment to function parameter 'value'."},
    noParamReassignFinding{line: 26, message: "Assignment to function parameter 'value'."},
  )
}

func TestNoParamReassignPropsFollowsOfficialMutationBoundariesAndIgnores(t *testing.T) {
  source := `const data: any = {};
const sink = (value: any): any => value;
function mutate(target: any, ignored: any, regexName: any, condition: boolean): void {
  target.value = 1;
  target.deep.value++;
  delete target.deleted;
  [target.array] = [];
  ({ value: target.object } = { value: 1 });
  ([...target.arrayRest] = []);
  ({ ...target.objectRest } = {});
  for (target.loop in {});
  for (target.item of []);
  for ({ value: target.pattern } in {});
  for ([target.element] of []);
  target.get().value = 1;
  (condition ? target : {}).chosen = 1;
  data[target.value] = 1;
  sink(target.value).result = 1;
  (target ? {} : {}).untouched = 1;
  ({ [target.value]: ignored } = {});
  ignored.value = 1;
  regexName.value = 1;
  ignored = {};
  regexName = {};
}
`
  got := runNoParamReassign(
    t,
    source,
    json.RawMessage(`{"props":true,"ignorePropertyModificationsFor":["ignored"],"ignorePropertyModificationsForRegex":["^regex(?:Name)?$"]}`),
  )
  property := func(line int) noParamReassignFinding {
    return noParamReassignFinding{line: line, message: "Assignment to property of function parameter 'target'."}
  }
  assertNoParamReassignFindings(
    t,
    got,
    property(4),
    property(5),
    property(6),
    property(7),
    property(8),
    property(9),
    property(10),
    property(11),
    property(12),
    property(13),
    property(14),
    property(15),
    property(16),
    noParamReassignFinding{line: 23, message: "Assignment to function parameter 'ignored'."},
    noParamReassignFinding{line: 24, message: "Assignment to function parameter 'regexName'."},
  )
}

func TestNoParamReassignDefaultPropsLeavesPropertyWritesAlone(t *testing.T) {
  source := `function mutate(target: any): void {
  target.value = 1;
  ++target.other;
  delete target.deleted;
  [target.array] = [];
  for (target.item of []);
  target = {};
}
`
  got := runNoParamReassign(t, source, nil)
  assertNoParamReassignFindings(
    t,
    got,
    noParamReassignFinding{line: 7, message: "Assignment to function parameter 'target'."},
  )
}

// The command-path case protects option transport through a discovered JSON
// config, Program/checker construction, diagnostic rendering, and process code.
func TestCommandCheckNoParamReassignHonorsPropsConfig(t *testing.T) {
  root := seedLintProject(t, `function mutate(value: any, ignored: any): void {
  value.field = 1;
  ignored.field = 1;
  { let value = 0; value = 1; }
}
JSON.stringify(mutate);
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-param-reassign": []any{
        "error",
        map[string]any{
          "props":                          true,
          "ignorePropertyModificationsFor": []string{"ignored"},
        },
      },
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  const message = "[no-param-reassign] Assignment to property of function parameter 'value'."
  if code != 2 || stdout != "" || strings.Count(stderr, message) != 1 || strings.Contains(stderr, "parameter 'ignored'") {
    t.Fatalf("no-param-reassign command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
