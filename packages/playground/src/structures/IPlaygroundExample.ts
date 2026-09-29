/**
 * One pre-canned source script the playground dropdown can load. Sites provide
 * their own list — typia's site lists `random/is/json/protobuf`, the ttsc site
 * lists `typia/lint/mixed`.
 *
 * @evidence contracts/common.md#principled-implementation Stable id selects source independently of visible title and optional grouping metadata.
 * @evidence contracts/common.md#clear-and-simple-design Example content and presentation stay in a site-owned record without compiler configuration mixed in.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Sites supply examples; ids do not choose hidden compiler behavior.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies site ownership and the group default, following documentation-skill paragraph and tag separation.
 */
export interface IPlaygroundExample {
  id: string;
  title: string;
  description: string;
  source: string;

  /**
   * Optional grouping bucket. Examples are rendered grouped by this label.
   * Defaults to "Examples" when omitted.
   */
  group?: string;
}
