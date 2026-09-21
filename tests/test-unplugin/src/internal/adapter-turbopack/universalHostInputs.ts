import path from "node:path";

import { hostToolDirectory } from "../../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.js";
import { membershipDigestFile } from "../../../../../packages/unplugin/lib/core/bridge/membershipDigestFile.js";

/**
 * Exact compiler/descriptor inputs that affect every transformed module, and
 * the project's membership record, which every module depends on so a
 * persistent cache hears a root file appear (samchon/ttsc#1468).
 */
export function universalHostInputs(root: string): string[] {
  return [
    ...["package.json", "plugin.cjs", "tsconfig.json"].map((file) =>
      path.join(root, file),
    ),
    membershipDigestFile(
      hostToolDirectory(root),
      path.join(root, "tsconfig.json"),
    ),
  ];
}
