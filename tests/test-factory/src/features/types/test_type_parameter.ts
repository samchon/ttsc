import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { print, ref } from "../../internal/helpers";

/**
 * Verifies printing of a generic
 * {@link factory.createTypeParameterDeclaration|type parameter}.
 *
 * A parameter carrying both a constraint and a default renders as `<T extends
 * Base = Fallback>` inside a type alias.
 *
 * 1. A T parameter preserves both extends Base constraint and = Fallback default
 *    inside Wrap.
 * 2. Literal type Wrap<T extends Base = Fallback> = T; independently defines
 *    constraint/default order and identity.
 *
 * @evidence contracts/testing.md#behavioral-verification A T parameter preserves both extends Base constraint and = Fallback default inside Wrap.
 * @evidence contracts/testing.md#independent-expectations Literal type Wrap<T extends Base = Fallback> = T; independently defines constraint/default order and identity.
 * @evidence contracts/testing.md#distinguishing-cases Both optional fields are populated together, detecting one overwriting the other; unconstrained generic parameters appear in function/class cases.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_type_parameter. Calls createTypeParameterDeclaration/createTypeAliasDeclaration and print in process.
 */
export const test_type_parameter = (): void => {
  TestValidator.equals(
    "constraint + default",
    print(
      factory.createTypeAliasDeclaration(
        undefined,
        "Wrap",
        [
          factory.createTypeParameterDeclaration(
            undefined,
            "T",
            ref("Base"),
            ref("Fallback"),
          ),
        ],
        ref("T"),
      ),
    ),
    "type Wrap<T extends Base = Fallback> = T;",
  );
};
