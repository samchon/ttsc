import { TestValidator } from "@nestia/e2e";
import factory from "@ttsc/factory";

import { id, print } from "../../internal/helpers";

/**
 * Print the remaining convenience aliases.
 *
 * `createVoidZero` → `void 0`, `createExportDefault` → `export default ...`,
 * and `createExternalModuleExport` → `export { name }`.
 */
export const test_convenience_aliases = (): void => {
  TestValidator.equals("void zero", print(factory.createVoidZero()), "void 0");
  TestValidator.equals(
    "export default",
    print(factory.createExportDefault(id("value"))),
    "export default value;",
  );
  TestValidator.equals(
    "external module export",
    print(factory.createExternalModuleExport("foo")),
    "export { foo };",
  );
};
