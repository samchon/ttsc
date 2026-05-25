interface Service {
  // expect: method-signature-style error
  run(input: string): number;
  keep: (input: string) => number;
}

type Handler = {
  // expect: method-signature-style error
  handle(): void;
  keep: () => void;
};

class Impl {
  run(input: string): number {
    return input.length;
  }
}

JSON.stringify({} as Service);
JSON.stringify({} as Handler);
JSON.stringify(Impl);
