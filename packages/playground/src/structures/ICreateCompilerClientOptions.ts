/** Options for {@link createCompilerClient}. */
export interface ICreateCompilerClientOptions {
  /**
   * URL of the bundled worker script (the site's rspack output of its
   * `compiler/index.ts` worker entry, which calls `createWorkerCompiler`).
   */
  workerUrl: string;
  /**
   * Optional Worker constructor override — pass when the site needs custom
   * worker options (type, credentials, name). Defaults to `new Worker(...)`.
   */
  createWorker?: () => Worker;
}
