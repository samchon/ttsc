import type { SyntaxKind } from "../../syntax";

/**
 * A bare keyword / operator / punctuation token (e.g. `true`, `readonly`, `+`).
 *
 * Built by {@link factory.createToken}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface Token<TKind extends SyntaxKind = SyntaxKind> {
  /** Discriminant tag; always `"Token"`. */
  kind: "Token";

  /** The token kind. */
  token: TKind;
}
