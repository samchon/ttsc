package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a withdrawal on a constructor overload signature still reaches the
 * fields the implementation declares.
 *
 * An overload run is one constructor written several times, and a signature is
 * where JSDoc for an overloaded declaration conventionally goes, while only the
 * implementation carries parameter properties. Reading the tag from the node
 * being visited would make the withdrawal depend on which half the author
 * documented.
 *
 * Three positions are asserted together because each kills a different way of
 * getting this wrong. A tag on the first signature dies under "read the visited
 * node". A tag on the implementation alone dies under "read the first
 * constructor and stop". Two competing tags pin first-in-source-order, matching how a
 * statement list resolves a merged declaration's withdrawal.
 *
 *  1. Withdraw a different constructor declaration in each of three classes.
 *  2. Collect each inventory.
 *  3. Assert the parameter property carries the expected tag every time.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the parameter property carries the expected tag every time.
 * @evidence contracts/testing.md#independent-expectations An overload run is one constructor written several times, and a signature is where JSDoc for an overloaded declaration conventionally goes, while only the implementation carries parameter properties. Reading the tag from the node being visited would make the withdrawal depend on which half the author documented. The authored scenario requires this outcome: Assert the parameter property carries the expected tag every time.
 * @evidence contracts/testing.md#distinguishing-cases Withdraw a different constructor declaration in each of three classes. Collect each inventory. Assert the parameter property carries the expected tag every time.
 * @evidence contracts/testing.md#execution-ownership TestWithdrawnConstructorSignatureWithdrawsItsParameterProperties runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawnConstructorSignatureWithdrawsItsParameterProperties(t *testing.T) {
  for _, testCase := range []struct {
    name   string
    source string
    want   string
  }{
    {
      name: "on the first signature",
      source: `
  /**
   * @internal
   */
  constructor(price: number);
  constructor(price: string);
  constructor(public readonly price: number | string) {}`,
      want: "@internal",
    },
    {
      name: "on the implementation alone",
      source: `
  constructor(price: number);
  constructor(price: string);
  /**
   * @internal
   */
  constructor(public readonly price: number | string) {}`,
      want: "@internal",
    },
    {
      name: "the first of two competing tags",
      source: `
  /**
   * @hidden
   */
  constructor(price: number);
  /**
   * @internal
   */
  constructor(price: string);
  constructor(public readonly price: number | string) {}`,
      want: "@hidden",
    },
  } {
    t.Run(testCase.name, func(t *testing.T) {
      inventory := parseTypeScriptInventory(t, "src/Order.ts", `
export class Order {
  readonly declared: number = 0;`+testCase.source+`
}
`)
      tagged := []string{}
      for _, unit := range inventory.Units {
        tagged = append(tagged, unit.Symbol+":"+unit.Target+"="+unit.Hidden)
      }
      sort.Strings(tagged)
      want := []string{
        "property:Order.prototype.declared=",
        "property:Order.prototype.price=" + testCase.want,
        "type:Order=",
      }
      if strings.Join(tagged, "\n") != strings.Join(want, "\n") {
        t.Fatalf(
          "withdrawn constructor units:\n%s\nwant:\n%s",
          strings.Join(tagged, "\n"),
          strings.Join(want, "\n"),
        )
      }
    })
  }
}
