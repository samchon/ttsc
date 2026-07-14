package linthost

import (
  "fmt"
  "strings"
  "testing"
)

// TestRuleCorpusNoFuncAssign verifies function binding identity and every write surface.
//
// A file-wide name set conflates unrelated shadows and only sees bare binary
// assignments. The real checker must instead connect each modifying reference
// to the function declaration or named-expression binding it actually resolves
// to, including hoisted, overloaded, and namespace-merged TypeScript forms.
//
//  1. Write function bindings through assignment, update, destructuring, loop, and TypeScript wrapper forms.
//  2. Place same-spelled parameter, function-local, block, catch, loop, and sibling shadows beside them.
//  3. Assert exactly the marked identifier ranges are reported once with the canonical message.
func TestRuleCorpusNoFuncAssign(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-func-assign": SeverityError})
  if !engine.NeedsTypeChecker() {
    t.Fatal("no-func-assign did not request a type checker")
  }

  source := `declare const replacement: any;
declare const sequence: any[];
declare const record: Record<string, any>;

function direct() {}
/* report */direct = replacement;

function compound() {}
/* report */compound += replacement;

function logical() {}
/* report */logical ||= replacement;

function prefixUpdate() {}
++/* report */prefixUpdate;

function postfixUpdate() {}
/* report */postfixUpdate--;

function arrayTarget() {}
[/* report */arrayTarget] = sequence;

function objectTarget() {}
({ value: /* report */objectTarget } = record);

function shorthandTarget() {}
({ /* report */shorthandTarget } = record);

function defaultTarget() {}
({ value: /* report */defaultTarget = replacement } = record);

function restTarget() {}
[.../* report */restTarget] = sequence;

function nestedTarget() {}
[[/* report */nestedTarget]] = [sequence];

function inTarget() {}
for (/* report */inTarget in record) {}

function ofTarget() {}
for (/* report */ofTarget of sequence) {}
for (let ofTarget of sequence) {
  void ofTarget;
}

function asTarget() {}
(/* report */asTarget as any) = replacement;

function angleTarget() {}
(<any>/* report */angleTarget) = replacement;

function nonNullTarget() {}
(/* report */nonNullTarget!) = replacement;

function satisfiesTarget() {}
(/* report */satisfiesTarget satisfies any) = replacement;

/* report */hoisted = replacement;
function hoisted() {}

function selfWrite() {
  /* report */selfWrite = replacement;
}

function captured() {}
const writeCaptured = (): void => {
  /* report */captured = replacement;
};

let expression = function namedExpression() {
  /* report */namedExpression = replacement;
};
expression = replacement;

function overloaded(value: string): string;
function overloaded(value: number): number;
function overloaded(value: string | number): string | number {
  return value;
}
/* report */overloaded = replacement;

declare function ambient(value: string): string;
/* report */ambient = replacement;

function merged() {}
namespace merged {
  export const member = 1;
}
/* report */merged = replacement;

function leftScope() {
  function same() {}
  /* report */same = replacement;
}

function rightScope() {
  function same() {}
  /* report */same = replacement;
}

let anonymous = function () {};
anonymous = replacement;

function parameterShadow(parameterShadow: any) {
  parameterShadow = replacement;
}

function functionScopeShadow() {
  var functionScopeShadow: any;
  functionScopeShadow = replacement;
}

function blockShadow() {}
{
  let blockShadow: any;
  blockShadow = replacement;
}

function catchShadow() {}
try {
  throw replacement;
} catch (catchShadow) {
  catchShadow = replacement;
}

function siblingShadow() {}
function localSiblingShadow() {
  let siblingShadow: any;
  siblingShadow = replacement;
}

namespace namespaceOnly {
  export const member = 1;
}
namespaceOnly = replacement;

const holder = { method() {} };
holder.method = replacement;
`

  _, _, findings := runRuleFindingsSnapshot(t, "no-func-assign", source, nil)
  expected := noFuncAssignMarkedRanges(t, source)
  if len(findings) != len(expected) {
    t.Fatalf("expected %d no-func-assign findings, got %d: %#v", len(expected), len(findings), findings)
  }
  for index, finding := range findings {
    want := expected[index]
    if finding.Rule != "no-func-assign" || finding.Severity != SeverityError ||
      finding.Pos != want[0] || finding.End != want[1] {
      t.Fatalf("finding %d range mismatch: got=%+v want=%v", index, finding, want)
    }
    name := source[want[0]:want[1]]
    if expectedMessage := fmt.Sprintf("'%s' is a function.", name); finding.Message != expectedMessage {
      t.Fatalf("finding %d message mismatch: got=%q want=%q", index, finding.Message, expectedMessage)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("finding %d unexpectedly offered edits: %+v", index, finding)
    }
  }
}

func noFuncAssignMarkedRanges(t *testing.T, source string) [][2]int {
  t.Helper()
  const marker = "/* report */"
  ranges := make([][2]int, 0)
  remaining := source
  consumed := 0
  for {
    markerOffset := strings.Index(remaining, marker)
    if markerOffset < 0 {
      return ranges
    }
    start := consumed + markerOffset + len(marker)
    end := start
    for end < len(source) && (source[end] == '_' || source[end] == '$' ||
      source[end] >= 'a' && source[end] <= 'z' || source[end] >= 'A' && source[end] <= 'Z' ||
      end > start && source[end] >= '0' && source[end] <= '9') {
      end++
    }
    if end == start {
      t.Fatalf("marker at byte %d is not followed by an identifier", start-len(marker))
    }
    ranges = append(ranges, [2]int{start, end})
    consumed = end
    remaining = source[end:]
  }
}
