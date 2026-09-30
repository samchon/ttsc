package evidence

// internalBlock is the withdrawal the negative twin removes, kept beside the
// constant it is cut from so the pair stays one edit apart.
const internalBlock = `  /**
   * @internal
   */
`

// mergedWithdrawnVariable is one identity withdrawn in one declaration and
// spelled again, untagged, in another.
//
// This is the shape the host set and the unit set genuinely disagree about. The
// second declarator carries no tag of its own, so it registers a host, while
// the identity it names came out withdrawn from the first declaration. Only the
// reconciliation over finished identities can take that position away, and only
// if the declarator is among the nodes the unit recorded.
const mergedWithdrawnVariable = `
export namespace N {
  /**
   * @internal
   */
  export var price: number;
}
export namespace N {
  export var other: number,
    /** %s docs/spec.md#pricing A withdrawn identity must not answer here. */
    price: number;
}
`
