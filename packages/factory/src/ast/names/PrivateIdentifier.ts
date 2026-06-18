/**
 * A private class member name, e.g. `#secret`.
 *
 * Built by {@link factory.createPrivateIdentifier}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PrivateIdentifier {
  /** Discriminant tag; always `"PrivateIdentifier"`. */
  kind: "PrivateIdentifier";

  /** The private name, including the leading `#`. */
  text: string;
}
