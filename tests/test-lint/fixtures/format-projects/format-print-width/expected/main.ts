class Singleton {
  constructor(public readonly factory: () => unknown) {}
}

function registerHandler(event: string, handler: () => void): void {
  void event;
  void handler;
}

function configure(options: Record<string, unknown>): void {
  void options;
}

function run(task: () => void): void {
  void task;
}

function defer(task: () => void): void {
  void task;
}

function setup(): void {}
function flush(): void {}
function start(): void {}

const enabled = true;

const widget = new Singleton(() => {
  setup();
  return widget;
});

registerHandler("ready", () => {
  flush();
});

configure({
  name: "alpha",
  retries: 3,
  timeout: 1000,
  nested: { mode: "fast", verbose: true },
});

run(() => {
  defer(() => {
    start();
  });
});

run(() => {
  if (enabled) {
    start();
  }
});
