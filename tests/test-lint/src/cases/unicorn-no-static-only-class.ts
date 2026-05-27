// expect: unicorn/no-static-only-class error
class Utility {
  static helper() { return 42; }
}
void Utility;
