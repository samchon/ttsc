package linthost

import "testing"

// TestNoUselessCatchReportsARethrowingCatchWithAndWithoutFinally verifies that
// a catch clause that only rethrows its binding is reported whether or not a
// finally block follows.
//
// Without a finally block the whole try statement is a wrapper. With one, the
// try statement still runs cleanup, so only the catch clause is redundant and
// the message names it.
//
//  1. Run the rule over a try with a rethrowing catch and no finally.
//  2. Run it over the same catch followed by a finally block.
//  3. Assert the first reports the wrapper message and the second the catch
//     clause message, each once, and that a catch that does other work stays clean.
//
// @evidence contracts/testing.md#behavioral-verification no-useless-catch must report a catch that only rethrows its binding with and without a finally block, with the message that names what is redundant, and must leave a catch that does other work alone.
// @evidence contracts/testing.md#independent-expectations ESLint documents both shapes as incorrect: a bare rethrowing catch, and a rethrowing catch before a finally, whose cleanup runs on the rethrow either way; the two literal messages are the upstream wrapper and catch-clause texts.
// @evidence contracts/testing.md#distinguishing-cases The finally and no-finally twins differ only in the finally block and in the reported message, and a catch that logs before rethrowing is the negative control.
// @evidence contracts/testing.md#execution-ownership TestNoUselessCatchReportsARethrowingCatchWithAndWithoutFinally parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoUselessCatchReportsARethrowingCatchWithAndWithoutFinally(t *testing.T) {
  messageOf := func(source string) string {
    t.Helper()
    _, _, findings := runRuleFindingsSnapshot(t, "no-useless-catch", source, nil)
    if len(findings) != 1 {
      t.Fatalf("no-useless-catch on %q: want exactly one finding, got %d", source, len(findings))
    }
    return findings[0].Message
  }
  if got := messageOf("function f(): void {\n  try {\n    work();\n  } catch (e) {\n    throw e;\n  }\n}\nfunction work(): void {}\nJSON.stringify(f);\n"); got != "Unnecessary try/catch wrapper." {
    t.Fatalf("without finally: got %q", got)
  }
  if got := messageOf("function f(): void {\n  try {\n    work();\n  } catch (e) {\n    throw e;\n  } finally {\n    work();\n  }\n}\nfunction work(): void {}\nJSON.stringify(f);\n"); got != "Unnecessary catch clause." {
    t.Fatalf("with finally: got %q", got)
  }
  assertRuleSkipsSource(
    t,
    "no-useless-catch",
    "function f(): void {\n  try {\n    work();\n  } catch (e) {\n    JSON.stringify(e);\n    throw e;\n  } finally {\n    work();\n  }\n}\nfunction work(): void {}\nJSON.stringify(f);\n",
  )
}
