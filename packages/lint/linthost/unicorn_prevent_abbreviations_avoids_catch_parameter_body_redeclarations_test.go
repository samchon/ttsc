package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsAvoidsCatchParameterBodyRedeclarations verifies that the fixer compares catch parameter and body binding renames with authored output.
//
// Catch parameter/body lexical constraints independently require different generated index names.
//
// @evidence contracts/testing.md#behavioral-verification The fixer compares catch parameter and body binding renames with authored output.
// @evidence contracts/testing.md#independent-expectations Catch parameter/body lexical constraints independently require different generated index names.
// @evidence contracts/testing.md#distinguishing-cases The catch idx becomes index and body i becomes index_, with both uses preserved.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsAvoidsCatchParameterBodyRedeclarations owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsAvoidsCatchParameterBodyRedeclarations(t *testing.T) {
  source := "try {\n  throw 0;\n} catch (idx) {\n  const i = 1;\n  console.log(i);\n}\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "try {\n  throw 0;\n} catch (index) {\n  const index_ = 1;\n  console.log(index_);\n}\n",
  )
}
