package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoVarSkipsUsingDeclarations verifies `using` and `await using`
// declaration lists never trip the noVar rule.
//
// noVar decides by GetCombinedNodeFlags: a list is `var` only when every
// block-scoped flag bit (Let | Const | Using) is clear. Registering
// KindVariableDeclarationList made the rule see EVERY list — statements and
// `for...of` headers alike — so this negative twin pins that the new
// dispatch surface still excludes the resource-management forms instead of
// reporting everything it now visits.
//
//  1. Parse a source with `using` and `await using` statements plus a
//     `for (using … of …)` header.
//  2. Run noVar over the file.
//  3. Assert no finding is emitted.
//
// @evidence contracts/testing.md#behavioral-verification Engine emits no no-var finding for using, await using or a for-of using declaration list.
// @evidence contracts/testing.md#independent-expectations Resource-management declaration flags identify lexical resource bindings, not var declarations; the complete zero-finding oracle follows that language distinction.
// @evidence contracts/testing.md#distinguishing-cases Synchronous, asynchronous and loop resource lists stay clean; TestRuleCorpusNoVarLoopHeaders owns reportable var loop lists.
// @evidence contracts/testing.md#execution-ownership TestNoVarSkipsUsingDeclarations parseTS parses the using, await-using and for-using source in memory and NewEngine(no-var).Run executes the rule directly over it; the test requires zero findings. No temp project, consumer install or product host is involved.
func TestNoVarSkipsUsingDeclarations(t *testing.T) {
  file := parseTS(
    t,
    "async function run(): Promise<void> {\n"+
      "  using handle = { [Symbol.dispose]() {} };\n"+
      "  await using stream = { async [Symbol.asyncDispose]() {} };\n"+
      "  for (using item of [{ [Symbol.dispose]() {} }]) {\n"+
      "    JSON.stringify(item);\n"+
      "  }\n"+
      "  JSON.stringify([handle, stream]);\n"+
      "}\n",
  )
  findings := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("noVar reported using declarations: %d findings", len(findings))
  }
}
