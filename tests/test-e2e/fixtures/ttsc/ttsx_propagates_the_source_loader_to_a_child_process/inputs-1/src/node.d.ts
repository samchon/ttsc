declare const __dirname: string;
declare const process: { execPath: string; exit(code: number): never };
declare function require(name: "node:child_process"): {
  spawnSync(
    command: string,
    args: string[],
    options: { stdio: string },
  ): { status: number | null };
};
