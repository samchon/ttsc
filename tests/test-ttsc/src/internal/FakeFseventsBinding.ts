/**
 * An injectable FSEvents binding that records streams and controls delivery.
 *
 * A stopped stream drops events queued in the binding, as the native binding
 * does. `emit` can also simulate a callback already handed to JavaScript after
 * stop, so the registry must reject it itself.
 */
export class FakeFseventsBinding {
  public readonly streams: FakeStream[] = [];
  public beforeOpen?: (root: string) => void;
  public onOpen?: (root: string) => void;

  public watch(
    root: string,
    handler: (file: string, flags: number) => void,
  ): () => void {
    this.beforeOpen?.(root);
    const stream: FakeStream = {
      handler,
      pending: [],
      root,
      stops: 0,
    };
    this.streams.push(stream);
    this.onOpen?.(root);
    return () => {
      stream.pending = [];
      stream.stops += 1;
    };
  }

  public emit(index: number, file: string, flags: number): void {
    this.streams[index]!.handler(file, flags);
  }

  public queue(index: number, file: string, flags: number): void {
    this.streams[index]!.pending.push({ file, flags });
  }

  public flush(index: number): void {
    const stream = this.streams[index]!;
    for (const { file, flags } of stream.pending.splice(0)) {
      stream.handler(file, flags);
    }
  }
}

type FakeStream = {
  handler: (file: string, flags: number) => void;
  pending: Array<{ file: string; flags: number }>;
  root: string;
  stops: number;
};
