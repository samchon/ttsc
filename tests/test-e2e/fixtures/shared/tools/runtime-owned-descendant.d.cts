/** Awaits the authored CommonJS fixture's actual process ownership observations. */
declare function observeOwnedDescendant(): Promise<void>;
declare namespace observeOwnedDescendant {
  /** Requests the outer authenticated controller without inferring PID liveness. */
  function request(role: string, operation: string): any;
  /** The yielding equivalent for fixture owners that must join direct children. */
  function requestAsync(role: string, operation: string): Promise<any>;
  /** Connects one held worker; callbacks own authored readiness and lazy work. */
  function connect(role: string, details: Record<string, unknown>, ready: (receipt: any) => void, release: () => string): void;
}
export = observeOwnedDescendant;
