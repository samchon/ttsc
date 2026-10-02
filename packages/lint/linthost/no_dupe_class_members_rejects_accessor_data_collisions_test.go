package linthost

import "testing"

// TestNoDupeClassMembersRejectsAccessorDataCollisions verifies a getter or setter
// collides with a same-named method or field, while a getter/setter pair and a
// static member of the same name do not.
//
// Accessor halves coexist, but methods and fields replace either accessor.
//
// 1. Parse five classes pairing an accessor with a method, field or second getter.
// 2. Assert exactly the later colliding members are reported, in source order.
// 3. Assert a getter, setter and static method of one name report nothing.
//
// @evidence contracts/testing.md#behavioral-verification The actual rule reports exactly the later members in both collision orders and repeated getters.
// @evidence contracts/testing.md#independent-expectations ECMAScript member keys share one instance/static property identity; only getter/setter pairs are compatible.
// @evidence contracts/testing.md#distinguishing-cases Getter/method, setter/field, reversed order and repeated getter collide; getter/setter pairs and distinct static identities do not.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes the parser and public rule Engine through exact-range and zero-finding helpers without any product artifact or subprocess.
func TestNoDupeClassMembersRejectsAccessorDataCollisions(t *testing.T) {
  assertRuleFindingRanges(t, "no-dupe-class-members", `
class A { get x(){return 1} x(){return 2} }
class B { x(){return 1} get x(){return 3} }
class C { set x(v){} x = 2; }
class D { x = 1; set x(value){} }
class E { get x(){return 1} get x(){return 4} }
`, "x(){return 2}", "get x(){return 3}", "x = 2;", "set x(value){}", "get x(){return 4}")
  assertRuleSkipsSource(t, "no-dupe-class-members", `class A { get x(){return 1} set x(v){} static x(){} }`)
}
