/**
 * A decorator as written on a declaration, carried on the decorated
 * {@link ITtscGraphNode}'s `decorators`. Reported faithfully, not interpreted
 * per framework: `name` is the decorator as written (`Controller`, `Get`,
 * `TypedRoute.Get`, ...), and statically resolvable literal arguments are
 * preserved so a consumer applies its own meaning without re-parsing source.
 *
 * @evidence contracts/common.md#principled-implementation The written name and literal arguments represent syntax without inventing framework semantics.
 * @evidence contracts/common.md#clear-and-simple-design Name and ordered arguments are the complete decorator envelope; argument details have their own record.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No framework-specific decorator names are encoded as special cases.
 * @evidence contracts/common.md#meaningful-documentation Native comments distinguish written names, source ordering and statically resolvable arguments in separate paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface ITtscGraphDecorator {
  /**
   * The decorator name as written, qualified through its access path:
   * `Controller`, `Get`, `TypedRoute.Get`, `MessagePattern`.
   */
  name: string;

  /** The literal call arguments, in source order. Empty for a bare decorator. */
  arguments: ITtscGraphDecorator.IArgument[];
}
export namespace ITtscGraphDecorator {
  /**
   * One argument of an {@link ITtscGraphDecorator}. `literal` is set only when
   * the argument is a string, number, or boolean literal the producer could
   * resolve statically, so a consumer can use it without evaluating code.
   *
   * @evidence contracts/common.md#principled-implementation The primitive union represents resolved literals; absence represents an argument that cannot be resolved statically.
   * @evidence contracts/common.md#clear-and-simple-design One optional value carries the argument fact without embedding expression bodies.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation does not evaluate an argument or substitute a guessed value.
   * @evidence contracts/common.md#meaningful-documentation The argument comment explains absence and the literal-only boundary, with a blank line before acknowledgment tags.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export interface IArgument {
    /** The statically-resolved literal value, when the argument is a literal. */
    literal?: string | number | boolean;
  }
}
