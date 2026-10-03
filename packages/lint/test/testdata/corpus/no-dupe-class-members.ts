// Positive: duplicate method declarations.
class Methods {
  run(): number {
    return 1;
  }

  // expect: no-dupe-class-members error
  run(): number {
    return 2;
  }
}

// Positive: duplicate property declarations.
class Properties {
  value: number = 1;
  // expect: no-dupe-class-members error
  value: number = 2;
}

// Positive: duplicate static methods.
class Statics {
  static factory(): number {
    return 1;
  }

  // expect: no-dupe-class-members error
  static factory(): number {
    return 2;
  }
}

// Negative: getter and setter on the same name — they form a property pair.
class GetSet {
  #stored = 0;
  get value(): number {
    return this.#stored;
  }
  set value(next: number) {
    this.#stored = next;
  }
}

// Negative: instance and static members with the same name.
class InstanceVsStatic {
  static factory(): number {
    return 1;
  }
  factory(): number {
    return 2;
  }
}

JSON.stringify({ Methods, Properties, Statics, GetSet, InstanceVsStatic });
