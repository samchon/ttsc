/** Plugin entry declaring the reported dependency list complete for `complete`. */
export function declareComplete(complete: string[]): unknown {
  return {
    transform: "./plugin.cjs",
    name: "completeness",
    operation: "declare-complete",
    complete,
  };
}
