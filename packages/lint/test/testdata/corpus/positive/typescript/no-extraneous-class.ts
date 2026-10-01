// expect: typescript/no-extraneous-class error
class StaticOnly {
  static factory(): number {
    return 1;
  }
}
JSON.stringify(StaticOnly);
