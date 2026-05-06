import fs from "node:fs";
import path from "node:path";

let cachedVersion: string | undefined;

export function packageVersion(): string {
  if (cachedVersion !== undefined) {
    return cachedVersion;
  }
  try {
    const pkg = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "..", "..", "package.json"),
        "utf8",
      ),
    ) as { version?: string };
    cachedVersion = pkg.version ?? "0.0.0";
  } catch {
    cachedVersion = "0.0.0";
  }
  return cachedVersion;
}
