/** Envelope returned by every `ITtscApi` method. */
export interface ITtscResult {
  /** Exit code. 0 = success, 2 = compiler/config/usage error, 3 = runtime error. */
  code: number;
  /** Anything the wasm wrote to its stdout stream. */
  stdout: string;
  /** Anything the wasm wrote to its stderr stream. */
  stderr: string;
  /**
   * For the base endpoints, the JSON-encoded compile/transform result. For the
   * plugin endpoint, this is empty — the plugin's own output sits in
   * stdout/stderr. Use `parseResult<T>` to deserialize.
   */
  result: string;
}
