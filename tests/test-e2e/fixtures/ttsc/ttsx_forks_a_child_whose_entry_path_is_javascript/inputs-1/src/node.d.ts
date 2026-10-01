declare const __dirname: string;
declare const process: {
  stdout: { write(text: string): void };
  exit(code: number): never;
};
interface ForkedChild {
  on(event: "exit", listener: (code: number | null) => void): void;
}
declare function require(name: "node:child_process"): {
  fork(modulePath: string, options: { stdio: string }): ForkedChild;
};
