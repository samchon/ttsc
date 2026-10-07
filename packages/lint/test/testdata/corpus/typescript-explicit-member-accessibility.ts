class Implicit {
  // expect: typescript/explicit-member-accessibility error
  value: number = 0;

  // expect: typescript/explicit-member-accessibility error
  bump(): void {
    this.value += 1;
  }

  // expect: typescript/explicit-member-accessibility error
  get current(): number {
    return this.value;
  }
}

class Explicit {
  public value: number = 0;
  private internalCount = 0;

  public bump(): void {
    this.value += 1;
    this.internalCount += 1;
  }
}

// Negative: private-hash members are exempt — the `#` already encodes
// the accessibility contract.
class Hashed {
  #counter = 0;
  public bump(): void {
    this.#counter += 1;
  }
}

JSON.stringify({ Implicit, Explicit, Hashed });
