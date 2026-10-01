import path from "node:path";

/** Transformable outputs intentionally excluded from the project directory walk. */
export function externalSourceModules(root: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    path.join(root, "node_modules", "external-source", `mod${index}.ts`),
  );
}
