import { TestValidator } from "@nestia/e2e";

import factory from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";

/**
 * Verifies printing of the remaining convenience aliases.
 *
 * `createVoidZero` → `void 0`, `createExportDefault` → `export default ...`,
 * and `createExternalModuleExport` → `export { name }`.
 *
 * 1. Convenience constructors print void 0, default export and named export with
 *    their intended token shapes.
 * 2. Explicit void 0, export default value; and export { foo }; literals define
 *    each alias output independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Convenience constructors print void 0, default export and named export with their intended token shapes.
 * @evidence contracts/testing.md#independent-expectations Explicit void 0, export default value; and export { foo }; literals define each alias output independently.
 * @evidence contracts/testing.md#distinguishing-cases Expression alias versus default/named declaration aliases expose independent wrappers rather than one generic factory path.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_convenience_aliases. Calls createVoidZero/createExportDefault/createExternalModuleExport and print in process.
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
