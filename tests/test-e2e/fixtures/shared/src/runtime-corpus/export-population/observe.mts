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
  const before = [inert.nested, inert.default.nested];
  inert.change();
  return {
    inert: { actual: [inert.actual, inert.default.actual], before, after: inert.default.nested, inlineText: inert.inlineText, memberText: inert.memberText, hidden: "hidden" in inert || "hidden" in inert.default, ghost: "ghost" in inert || "ghost" in inert.default, arithmetic: inert.inertArithmetic, decorators: inert.observed },
    dynamic: { actual: [dynamic.actual, dynamic.default.actual], computed: dynamic.default.dynamic, decorators: dynamic.observed },
    collision: projectOnly + ":" + packageValue,
    lowering: [lowering.default.answer, lowering.default.shout("ok"), lowering.default.namespaceBox.value].join(":"),
  };
}
