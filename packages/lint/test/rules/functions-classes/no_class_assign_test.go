package linthost

import (
  "fmt"
  "testing"
)

// TestRuleCorpusNoClassAssign verifies class binding identity and every write surface.
//
// A file-wide name set conflates unrelated shadows and only sees bare binary
// assignments. The checker must connect each modifying reference to the class
// declaration or named-expression binding it actually resolves to, including
// class-body references and TypeScript declaration merges.
//
//  1. Write class bindings through assignment, update, destructuring, loop, and TypeScript wrapper forms.
//  2. Place official clean twins and same-spelled parameter, local, block, catch, loop, and sibling shadows beside them.
//  3. Assert exactly the marked identifier ranges are reported once with the canonical message.
func TestRuleCorpusNoClassAssign(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-class-assign": SeverityError})
  if !engine.NeedsTypeChecker() {
    t.Fatal("no-class-assign did not request a type checker")
  }

  source := `declare const replacement: any;
declare const sequence: any[];
declare const record: Record<string, any>;

class direct {}
/* report */direct = replacement;

class compound {}
/* report */compound += replacement;

class logical {}
/* report */logical ||= replacement;

class prefixUpdate {}
++/* report */prefixUpdate;

class postfixUpdate {}
/* report */postfixUpdate--;

class arrayTarget {}
[/* report */arrayTarget] = sequence;

class objectTarget {}
({ value: /* report */objectTarget } = record);

class shorthandTarget {}
({ /* report */shorthandTarget } = record);

class defaultTarget {}
({ value: /* report */defaultTarget = replacement } = record);

class restTarget {}
[.../* report */restTarget] = sequence;

class nestedTarget {}
[[/* report */nestedTarget]] = [sequence];

class inTarget {}
for (/* report */inTarget in record) {}

class ofTarget {}
for (/* report */ofTarget of sequence) {}
for (let ofTarget of sequence) {
  void ofTarget;
}

class asTarget {}
(/* report */asTarget as any) = replacement;

class angleTarget {}
(<any>/* report */angleTarget) = replacement;

class nonNullTarget {}
(/* report */nonNullTarget!) = replacement;

class satisfiesTarget {}
(/* report */satisfiesTarget satisfies any) = replacement;

/* report */hoisted = replacement;
class hoisted {}

class selfWrite {
  replace(): void {
    /* report */selfWrite = replacement;
  }
}

class staticBlockWrite {
  static {
    /* report */staticBlockWrite = replacement;
  }
}

class captured {}
const writeCaptured = (): void => {
  /* report */captured = replacement;
};

let expression = class namedExpression {
  static replace(): void {
    /* report */namedExpression = replacement;
  }
};
expression = replacement;

let anonymous = class {};
anonymous = replacement;

let anonymousOuterWrite = class {
  static replace(): void {
    anonymousOuterWrite = replacement;
  }
};

declare class ambient {}
/* report */ambient = replacement;

class merged {}
namespace merged {
  export const member = 1;
}
/* report */merged = replacement;

class interfaceMerged {}
interface interfaceMerged {
  member: number;
}
/* report */interfaceMerged = replacement;

export class exported {}
/* report */exported = replacement;

function leftScope() {
  class same {}
  /* report */same = replacement;
}

function rightScope() {
  class same {}
  /* report */same = replacement;
}

class parameterShadow {
  replace(parameterShadow: any): void {
    parameterShadow = replacement;
  }
}

class methodLocalShadow {
  replace(): void {
    let methodLocalShadow: any;
    methodLocalShadow = replacement;
  }
}

class blockShadow {}
{
  let blockShadow: any;
  blockShadow = replacement;
}

class catchShadow {}
try {
  throw replacement;
} catch (catchShadow) {
  catchShadow = replacement;
}

class siblingShadow {}
function localSiblingShadow() {
  let siblingShadow: any;
  siblingShadow = replacement;
}

namespace namespaceOnly {
  export const member = 1;
}
namespaceOnly = replacement;

interface interfaceOnly {}
interfaceOnly = replacement;

const holder = { Class: class {} };
holder.Class = replacement;
`

  _, _, findings := runRuleFindingsSnapshot(t, "no-class-assign", source, nil)
  expected := markedIdentifierRanges(t, source, "/* report */")
  if len(findings) != len(expected) {
    t.Fatalf("expected %d no-class-assign findings, got %d: %#v", len(expected), len(findings), findings)
  }
  for index, finding := range findings {
    want := expected[index]
    if finding.Rule != "no-class-assign" || finding.Severity != SeverityError ||
      finding.Pos != want[0] || finding.End != want[1] {
      t.Fatalf("finding %d range mismatch: got=%+v want=%v", index, finding, want)
    }
    name := source[want[0]:want[1]]
    if expectedMessage := fmt.Sprintf("'%s' is a class.", name); finding.Message != expectedMessage {
      t.Fatalf("finding %d message mismatch: got=%q want=%q", index, finding.Message, expectedMessage)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("finding %d unexpectedly offered edits: %+v", index, finding)
    }
  }
}
