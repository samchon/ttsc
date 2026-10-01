import { readFileSync } from "node:fs";
import { join } from "node:path";

class Loader {
  public readonly root: string = "/tmp";
  public count: number = 0;
  constructor(public readonly base: string) {}
}

function makeConfig(): Record<string, unknown> {
  const config = {
    name: "alpha",
    retries: 3,
    timeout: 1000,
    verbose: true,
    mode: "fast",
  };
  const hosts = [
    "alpha.example.com",
    "bravo.example.com",
    "charlie.example.com",
  ];
  return { config, hosts };
}

function main(): void {
  const loader = new Loader("/tmp");
  const cfg = makeConfig();
  const total = loader.count;
  const full = join(loader.root, "x.txt");
  const raw = readFileSync(full, "utf8");
  console.log(cfg, total, raw);
}
