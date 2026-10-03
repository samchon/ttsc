import type { ChildProcess } from "node:child_process";

/**
 * Subscribe to this fixture client's actual child before requests can retire it.
 *
 * The test-only structural read names the child already created by the owning
 * constructor. It is used solely for resource ownership, not reply/queue
 * expectations; no production API or foreign method is replaced. dispose is a
 * termination attempt, so only the actual close event completes this receipt.
 * A timeout remains a cleanup failure, never successful retirement.
 */
export function observeResidentTransformClose(
  client: { dispose(): void },
): () => Promise<void> {
  const child = (client as unknown as { readonly child: ChildProcess }).child;
  let closedListener!: () => void;
  const closed = new Promise<void>((resolve) => {
    closedListener = () => resolve();
    child.once("close", closedListener);
  });
  return async () => {
    const failures: unknown[] = [];
    try {
      client.dispose();
    } catch (error) {
      failures.push(error);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        closed,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error("Resident transform fixture child did not close")),
            60_000,
          );
        }),
      ]);
    } catch (error) {
      failures.push(error);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      child.removeListener("close", closedListener);
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, "Resident transform disposal and close failed");
  };
}
