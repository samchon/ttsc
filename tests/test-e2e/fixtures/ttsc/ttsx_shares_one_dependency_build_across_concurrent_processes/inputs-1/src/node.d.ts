declare const __dirname: string;
declare const process: { execPath: string; exit(code: number): never };
interface SpawnedChild {
  on(event: "exit", listener: (code: number | null) => void): void;
}
declare function require(name: "node:child_process"): {
  spawn(
    command: string,
    args: string[],
    options: { stdio: string },
  ): SpawnedChild;
};
