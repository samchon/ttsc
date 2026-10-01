import path from "node:path";

/** A bundler alias entry; its only job is to force the generated tsconfig. */
export function aliasFor(root: string): Record<string, string> {
  return { "@lib": path.join(root, "src", "modules") };
}
