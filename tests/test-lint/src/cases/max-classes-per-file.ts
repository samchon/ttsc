// Positive: declaring two classes in the same file exceeds the default
// ceiling of one. The finding anchors on the second class because it is
// the declaration that pushed the count past the limit.
class First {
  value(): number {
    return 1;
  }
}

// expect: max-classes-per-file error
class Second {
  value(): number {
    return 2;
  }
}

// Negative: nested class expressions still count toward the file total,
// but a fixture with a single class would be silent — exercising the
// rule requires the multi-class shape above.

JSON.stringify({
  first: new First().value(),
  second: new Second().value(),
});
