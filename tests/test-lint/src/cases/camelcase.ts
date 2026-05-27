// expect: camelcase error
const snake_value: number = 1;
const camelValue: number = 2;
const PascalValue: number = 3;
const _private: number = 4;
const MAX_VALUE: number = 5;
function goodName(): void {}
// expect: camelcase error
function bad_name(): void {}
class GoodClass {}
// expect: camelcase error
class bad_class {}
function take(good: number, _ignored: number): void {
  void good;
  void _ignored;
}
// expect: camelcase error
function takeBad(bad_param: number): void {
  void bad_param;
}
JSON.stringify({ snake_value, camelValue, PascalValue, _private, MAX_VALUE, goodName, bad_name, GoodClass, bad_class, take, takeBad });
