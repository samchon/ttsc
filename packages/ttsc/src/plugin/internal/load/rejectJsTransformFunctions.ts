
/**
 * Reject unsupported JavaScript transforms on a descriptor object.
 *
 * @evidence contracts/common.md#principled-implementation Membership checks preserve the original rejection even for inherited or undefined transform properties; no JavaScript implementation enters the Go pipeline.
 * @evidence contracts/common.md#clear-and-simple-design One validation call owns exactly the two prohibited descriptor keys and its named-specifier diagnostic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is the actual loader guard, not a test-side reconstruction or native compilation substitute.
 * @evidence contracts/common.md#meaningful-documentation The headline and key-presence explanation state the rejection responsibility without describing internal machinery.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources rejectJsTransformFunctions declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms rejectJsTransformFunctions declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work rejectJsTransformFunctions declares a signature only; the implementation owns any shared work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation rejectJsTransformFunctions is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
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
