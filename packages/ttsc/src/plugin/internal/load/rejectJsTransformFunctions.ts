
/**
 * Reject unsupported JavaScript transforms on a descriptor object.
 *
 * @evidence contracts/common.md#principled-implementation Membership checks preserve the original rejection even for inherited or undefined transform properties; no JavaScript implementation enters the Go pipeline.
 * @evidence contracts/common.md#clear-and-simple-design One validation call owns exactly the two prohibited descriptor keys and its named-specifier diagnostic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is the actual loader guard, not a test-side reconstruction or native compilation substitute.
 * @evidence contracts/common.md#meaningful-documentation The headline and key-presence explanation state the rejection responsibility without describing internal machinery.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This descriptor predicate retains no cache, handle or historical result; a thrown diagnostic transfers to the caller.
 * @evidence contracts/performance.md#efficient-algorithms At most two key-membership probes avoid enumerating unrelated descriptor fields. Native JavaScript membership follows prototype or proxy semantics, and failure formats the supplied specifier text; no bound on user-defined proxy work is established.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work No shared producer or cross-request descriptor-answer identity is owned by this immediate membership guard.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Descriptor membership and error text do not interpret native paths, discover capabilities or launch processes; the specifier is diagnostic data.
 */
export function rejectJsTransformFunctions(
  specifier: string,
  candidate: object,
): void {
  if ("transformSource" in candidate || "transformOutput" in candidate) {
    throw new Error(
      `ttsc: plugin "${specifier}" declares unsupported JS transform functions; ` +
        "declare a native backend instead",
    );
  }
}
