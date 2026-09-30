package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the citation trigger cannot match inside an exclusion line.
 *
 * The host matches a trigger with `strings.LastIndex` against the line prefix,
 * so the two tags stay apart only because `After` carries a trailing space: the
 * character following `@evidence` inside `@evidenceExclude` is `E`. That is a
 * property of the host's matcher rather than of this code, which is why it is
 * pinned rather than trusted — dropping the space would silently merge the two
 * corpora.
 *
 *  1. Take the triggers this package actually publishes.
 *  2. Apply the host's matching rule to each tag line.
 *  3. Assert each trigger matches its own line and neither matches the other's.
 * @evidence contracts/testing.md#behavioral-verification The test applies strings.LastIndex directly to evidenceHintTriggers and checks two distinct triggers, own-line matching and cross-line rejection.
 * @evidence contracts/testing.md#independent-expectations Mutual separation follows the matcher contract: a trigger must match its own tag prefix and reject the other prefix. Lines are generated from implementation triggers, so this oracle detects lost separation but cannot establish the canonical spellings independently.
 * @evidence contracts/testing.md#distinguishing-cases Both published triggers are crossed against both generated tag lines. Removing the distinguishing trailing space permits the shorter trigger to match the longer tag; changing both names consistently can remain undetected.
 * @evidence contracts/testing.md#execution-ownership TestHintsKeepTheTwoTriggersApart is the Go unit entry discovered beside the native package. It inspects evidenceHintTriggers and runs strings.LastIndex directly; the generated tag lines are local subcases, with no graph or host session.
 */
func TestHintsKeepTheTwoTriggersApart(t *testing.T) {
  // Read from the published triggers rather than from literals retyped here.
  // A copy of the strings would keep passing after the trailing space was
  // dropped from the corpus, which is the one change this case exists to
  // catch.
  lines := map[string]string{}
  for _, trigger := range evidenceHintTriggers {
    lines[trigger.After] = " * " + strings.TrimSuffix(trigger.After, " ") + " "
  }
  if len(lines) != 2 {
    t.Fatalf("expected two distinct triggers, got %d", len(lines))
  }
  for _, trigger := range evidenceHintTriggers {
    for after, line := range lines {
      matched := strings.LastIndex(line, trigger.After) >= 0
      if after == trigger.After && !matched {
        t.Fatalf("trigger %q must match its own line %q", trigger.After, line)
      }
      if after != trigger.After && matched {
        t.Fatalf("trigger %q must not match line %q", trigger.After, line)
      }
    }
  }
}
