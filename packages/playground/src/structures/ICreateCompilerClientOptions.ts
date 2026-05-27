/** Options for {@link createCompilerClient}. */
export interface ICreateCompilerClientOptions {
  /**
   * URL of the bundled worker script (the site's rspack output of its
   * `compiler/index.ts` worker entry, which calls `createWorkerCompiler`).
   *
   * The Worker is constructed by tgrid's `WorkerConnector` with classic-
   * worker semantics. A custom Worker factory hook is intentionally not
   * exposed — the upstream tgrid v1 API only accepts a URL. File an issue
   * if you need module workers, named workers, or custom credentials.
   */
  workerUrl: string;
}
