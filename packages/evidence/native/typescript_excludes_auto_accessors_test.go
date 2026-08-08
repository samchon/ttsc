package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies accessor classification: neither a callable nor a data accessor
 * becomes an evidence unit.
 *
 * Auto-accessors share PropertyDeclaration shape with ordinary fields but
 * retain accessor semantics, and a get/set pair is not a member variable
 * either. The ordinary field and method in the same class are the positive
 * controls: without them a collector that had stopped materializing class
 * members entirely would pass this case.
 *
 * An interface accessor is here because the rule has to hold wherever a member
 * is classified, and the interface collector reaches its member kinds through a
 * different switch. Adding a get/set case to that switch is a one-line edit and
 * it left the whole suite green, so the exclusion was stated for a class and
 * merely assumed for an interface.
 *
 *  1. Declare ordinary members beside callable and data accessors, on a class
 *     and on an interface.
 *  2. Collect the inventory.
 *  3. Assert only the ordinary members materialize.
 */
func TestTypeScriptAccessorsAreNotEvidenceUnits(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export class Service {
  handler = (): void => {};
  static factory: () => void;
  retries: number = 3;
  accessor callback = (): void => {};
  static accessor provider: () => void;
  accessor count = 0;
  static accessor limit: number;
  get computed(): number {
    return 1;
  }
  set computed(value: number) {}
}
export interface IService {
  handler: () => void;
  send(): void;
  retries: number;
  get computed(): number;
  set computed(value: number);
}
`)
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(targets)
  want := []string{
    "function:IService.handler",
    "function:IService.send",
    "function:Service.factory",
    "function:Service.prototype.handler",
    "property:IService.retries",
    "property:Service.prototype.retries",
    "type:IService",
    "type:Service",
  }
  if strings.Join(targets, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "accessor units:\n%s\nwant:\n%s",
      strings.Join(targets, "\n"),
      strings.Join(want, "\n"),
    )
  }
}

/**
 * Verifies auto-accessor claim hosts: JSDoc on an accessor stays outside a
 * function-only claim even when its initializer is callable.
 *
 * Excluding only the source unit is insufficient because supported-host
 * collection can still accept the same declaration as an outgoing function
 * claim.
 *
 *  1. Attach evidence to a callable auto-accessor beside a real function unit.
 *  2. Select function hosts and one Markdown heading.
 *  3. Assert the declaration is reported as unsupported.
 */
func TestTypeScriptAutoAccessorsAreNotFunctionClaimHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/contracts.ts": `
export class Service {
  /** @evidence docs/spec.md#contract This accessor cannot claim function evidence. */
  accessor callback = (): void => {};
  handler = (): void => {};
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/contracts.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "unsupported or non-exported declaration")
}

/**
 * Verifies a data auto-accessor is not a property claim host either.
 *
 * The property population is where an accessor most looks like it belongs, so
 * the exclusion has to hold on that side too. Without this twin, an accessor
 * refused as a callable could still slip in as a field and quietly discharge an
 * obligation the class never took.
 *
 *  1. Attach evidence to a data auto-accessor beside a real field.
 *  2. Select property hosts and one Markdown heading.
 *  3. Assert the declaration is reported as unsupported.
 */
func TestTypeScriptAutoAccessorsAreNotPropertyClaimHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/contracts.ts": `
export class Service {
  /** @evidence docs/spec.md#contract This accessor cannot claim property evidence. */
  accessor count = 0;
  retries: number = 3;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/contracts.ts"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "unsupported or non-exported declaration")
}
