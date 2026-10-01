package linthost

import "testing"

// Removing an identifier or this evaluation can remove an observable throw.
// @evidence contracts/testing.md#behavioral-verification Actual findings retain TDZ, unresolved, with-object and derived-constructor receiver evaluation without fix or suggestion, while literal receivers still fix.
// @evidence contracts/testing.md#independent-expectations ECMAScript GetValue throws on TDZ/unresolved names and pre-super this; with resolution can invoke a getter. Literal null evaluation cannot do these.
// @evidence contracts/testing.md#distinguishing-cases Four read-sensitive receiver environments contrast with a nonthrowing literal receiver.
// @evidence contracts/testing.md#execution-ownership This unit runs parser, Engine and actual edit application in Go without installing consumers or starting a native product host.
func TestNoExtraBindPreservesThrowingReceiverReads(t *testing.T) {
  for _, source := range []string{
    `export {}; const f=(()=>1).bind(receiver); const receiver=0;`,
    `const f=(()=>1).bind(missing);`,
    `with(o){const f=(()=>1).bind(receiver);}`,
    `class A extends B { constructor(){ const f=(()=>1).bind(this); super(); } }`,
  } {
    assertReportOnlySnapshot(t, "no-extra-bind", source)
  }
  assertFixSnapshot(t, "no-extra-bind", `const f=(()=>1).bind(null);`, `const f=(()=>1);`)
}
