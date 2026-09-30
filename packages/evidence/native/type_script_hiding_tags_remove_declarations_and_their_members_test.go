package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies each hiding tag removes its declaration and everything nested
 * inside it, while an untagged sibling in the same file is untouched.
 *
 * The three tags are equivalent statements that a declaration is not API, so
 * treating them separately would leave two of them silently inert. The
 * untagged sibling is the negative twin: without it, a collector that dropped
 * every declaration in a file carrying any tag would pass just as well.
 *
 *  1. Tag an interface, a namespace, a function, and a class in one file, each
 *     owning nested members.
 *  2. Collect the inventory once per tag.
 *  3. Assert only the untagged sibling and its members survive.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert only the untagged sibling and its members survive.
 * @evidence contracts/testing.md#independent-expectations The three tags are equivalent statements that a declaration is not API, so treating them separately would leave two of them silently inert. The untagged sibling is the negative twin: without it, a collector that dropped every declaration in a file carrying any tag would pass just as well. The authored scenario requires this outcome: Assert only the untagged sibling and its members survive.
 * @evidence contracts/testing.md#distinguishing-cases Tag an interface, a namespace, a function, and a class in one file, each owning nested members. Collect the inventory once per tag. Assert only the untagged sibling and its members survive.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptHidingTagsRemoveDeclarationsAndTheirMembers runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptHidingTagsRemoveDeclarationsAndTheirMembers(t *testing.T) {
  for _, tag := range hiddenTagCases {
    t.Run(tag, func(t *testing.T) {
      inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
/** `+tag+` Not part of the published surface. */
export interface IPrivate {
  id: string;
}

/** `+tag+` */
export namespace secret {
  export const run = (): void => {};
  export interface IInner {
    id: string;
  }
  export namespace deeper {
    export const nested = (): void => {};
  }
}

/** `+tag+` */
export function build(): void {}

/** `+tag+` */
export class Service {
  static create(): void {}
}

export interface IPublic {
  id: string;
}
`)
      units := []string{}
      for _, unit := range inventory.Units {
        if unit.Hidden != "" {
          continue
        }
        units = append(units, unit.Symbol+":"+unit.Target)
      }
      sort.Strings(units)
      want := []string{
        "property:IPublic.id",
        "type:IPublic",
      }
      if strings.Join(units, "\n") != strings.Join(want, "\n") {
        t.Fatalf(
          "surviving units:\n%s\nwant:\n%s",
          strings.Join(units, "\n"),
          strings.Join(want, "\n"),
        )
      }
    })
  }
}
