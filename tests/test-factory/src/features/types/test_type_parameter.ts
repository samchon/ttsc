import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { print, ref } from "../../internal/helpers";

/**
 * Print a generic {@link factory.createTypeParameterDeclaration|type parameter}.
 *
 * A parameter carrying both a constraint and a default renders as `<T extends
 * Base = Fallback>` inside a type alias.
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
