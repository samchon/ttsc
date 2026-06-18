import type { CallSignatureDeclaration } from "./CallSignatureDeclaration";
import type { ConstructSignatureDeclaration } from "./ConstructSignatureDeclaration";
import type { IndexSignatureDeclaration } from "./IndexSignatureDeclaration";
import type { MethodSignature } from "./MethodSignature";
import type { PropertySignature } from "./PropertySignature";

/**
 * Any member of an interface or {@link TypeLiteralNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type TypeElement =
  | CallSignatureDeclaration
  | ConstructSignatureDeclaration
  | IndexSignatureDeclaration
  | MethodSignature
  | PropertySignature;
