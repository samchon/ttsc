/**
 * One pre-canned source script the playground dropdown can load. Sites provide
 * their own list — typia's site lists `random/is/json/protobuf`, the ttsc site
 * lists `typia/lint/mixed`.
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
