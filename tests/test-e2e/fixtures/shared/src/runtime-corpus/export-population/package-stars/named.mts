import { foo, mapped, sourceOnly, a, b, own, loadCount, sourceLoadCount } from "./barrel.cjs";
// @ts-ignore -- the shared corpus deliberately supplies no Node declarations.
import { createRequire } from "node:module";

/** Exercise static linking, then the same native CommonJS cache and namespace. */
export async function observePackageStars(): Promise<unknown> {
  const namespace: any = await import("./barrel.cjs");
  const repeated: any = await import("./barrel.cjs");
  const required = createRequire(import.meta.url)("./barrel.cjs");
  return {
    named: [foo, mapped, sourceOnly, a, b, own],
    defaults: [required.foo, required.mapped, required.sourceOnly, required.a, required.b, required.own],
    identity: namespace.default === required && namespace === repeated,
    loads: [loadCount(), sourceLoadCount()],
    typeOnlyAbsent: !("TypeOnly" in namespace) && !("TypeOnly" in required),
    importConditionAbsent: !("importOnly" in namespace) && !("importOnly" in required),
  };
}
