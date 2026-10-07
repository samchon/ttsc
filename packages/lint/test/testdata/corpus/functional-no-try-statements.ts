declare function run(): void;
declare function recover(error: unknown): void;

// expect: functional/no-try-statements error
try {
  run();
} catch (error) {
  recover(error);
}
