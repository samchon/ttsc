package evidence

// mergedAccessorFiles is the generated SDK shape this correction exists for:
// one exported function merged with a namespace of the same name, reached
// through the nested barrels a Nestia SDK publishes.
func mergedAccessorFiles() map[string]string {
  return map[string]string{
    "src/api/health.ts": `
export async function get(connection: string): Promise<get.Output> {
  return get.simulate(connection);
}
export namespace get {
  export type Output = string;

  export const METADATA = {
    method: "GET",
    path: "/health",
  } as const;

  export const path = () => "/health";
  export const random = (): string => "true";
  export const simulate = (_connection: string): Output => random();
}
`,
    "src/api/index.ts": "export * as health from \"./health\";\n",
    "src/index.ts":     "export * as functional from \"./api/index\";\n",
  }
}
