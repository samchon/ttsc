// Positive: getter with no return.
class MissingReturn {
  // expect: getter-return error
  get value(): number {
    const x = 1 + 1;
    JSON.stringify(x);
  }
}

// Positive: getter that returns conditionally.
class ConditionalReturn {
  flag = true;
  // expect: getter-return error
  get value(): number {
    if (this.flag) {
      return 1;
    }
  }
}

// Negative: getter that always returns.
class AlwaysReturns {
  get value(): number {
    return 42;
  }
}

// Negative: getter that throws.
class AlwaysThrows {
  get value(): number {
    throw new Error("unimplemented");
  }
}

JSON.stringify({ MissingReturn, ConditionalReturn, AlwaysReturns, AlwaysThrows });
