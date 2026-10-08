import { projectOnly } from "./inner.js";
import { packageValue } from "batch-collision-exports";

/** Observe actual bare-package links in the one shared runtime host. */
export async function observeExportPopulation(): Promise<Record<string, unknown>> {
  const inertName = "batch-inert-exports";
  const dynamicName = "batch-dynamic-exports";

  const loweringName = "batch-commonjs-lowering";
  const inert = await import(inertName);
  const dynamic = await import(dynamicName);

  const lowering = await import(loweringName);
  const enumDirectName: string = "../enum-values.cjs";
  const enumBarrelName: string = "../enum-barrel.cjs";
  const enumDirect = await import(enumDirectName);
  const enumBarrel = await import(enumBarrelName);
  const enumRepeated = await import(enumBarrelName);
  // Keep native linking failures independent from the other observed families.
  const packageStars: Record<string, unknown> = {};
  for (const name of ["named", "blocked", "missing"]) {
    try {
      const target = "./package-stars/" + name + (name === "named" ? ".mjs" : ".cjs");
      const loaded = await import(target);
      packageStars[name] = name === "named" ? await loaded.observePackageStars() : "unexpected success";
    } catch (error) {
      packageStars[name] = { code: (error as any).code ?? null, message: String((error as any).message) };
    }
  }
  const enumBefore = [enumDirect.live, enumBarrel.live, enumBarrel.default.live];
  enumDirect.change();
  const before = [inert.nested, inert.default.nested];
  inert.change();
  return {
    packageStars,
    inert: { actual: [inert.actual, inert.default.actual], before, after: inert.default.nested, inlineText: inert.inlineText, memberText: inert.memberText,
      hidden: { namespaceOwn: Object.hasOwn(inert, "hidden"), namespaceValueType: typeof inert.hidden, defaultOwn: Object.hasOwn(inert.default, "hidden"), defaultValueType: typeof inert.default.hidden },
      ghost: { namespaceOwn: Object.hasOwn(inert, "ghost"), namespaceValueType: typeof inert.ghost, defaultOwn: Object.hasOwn(inert.default, "ghost"), defaultValueType: typeof inert.default.ghost },
      arithmetic: inert.inertArithmetic, decorators: inert.observed },
    dynamic: { actual: [dynamic.actual, dynamic.default.actual], computed: dynamic.default.dynamic, decorators: dynamic.observed },
    collision: projectOnly + ":" + packageValue,
    lowering: [lowering.default.answer, lowering.default.shout("ok"), lowering.default.namespaceBox.value].join(":"),
    enums: {
      value: [enumDirect.Value.Entry, enumBarrel.Value.Entry],
      identity: enumDirect.Value === enumDirect.default.Value && enumBarrel.Value === enumBarrel.default.Value && enumDirect.Value === enumBarrel.Value,
      typeAbsent: !("OnlyType" in enumDirect) && !("OnlyType" in enumBarrel) && !("OnlyType" in enumBarrel.default),
      actual: [enumDirect.actual, enumBarrel.actual], before: enumBefore, after: enumBarrel.default.live,
      repeated: enumRepeated === enumBarrel, loads: enumBarrel.loadCount(), decorators: enumBarrel.decorators,
    },
  };
}
