/** Coerce a `spawnSync` output value to a plain string, defaulting to `""`. */
export function outputText(value: string | Buffer | null | undefined): string {
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}
