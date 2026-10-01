export namespace Ambient {
  interface Input { id: string; }
  function run(input: Input): void;
  const state: string;
  namespace Nested {
    function work(): void;
  }
}
