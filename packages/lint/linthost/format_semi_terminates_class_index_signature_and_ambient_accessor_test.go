package linthost

import "testing"

// TestFormatSemiTerminatesClassIndexSignatureAndAmbientAccessor verifies the
// class-body spellings of the member kinds take the same terminator.
//
// An index signature and a bodiless `declare` accessor are class members
// written as type members, and format/indent breaks them onto their own
// lines exactly as it breaks an interface member, so leaving them out of
// the insert would keep the same unterminated shape samchon/ttsc#1166
// reports for interfaces. Prettier terminates both.
//
//  1. Parse a class with an index signature and an ambient class with a
//     bodiless getter, each unterminated on its own line.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert both members gain a `;`.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must append terminators to a class index signature and a bodiless ambient getter while preserving their string annotations and declarations.
// @evidence contracts/testing.md#independent-expectations The independently authored full output gives each broken type-shaped class member its required terminator; neither fixture has a braced accessor body.
// @evidence contracts/testing.md#distinguishing-cases The index signature and ambient getter positives complement interface signature insertion and class/object braced-getter negatives, distinguishing member shape from shared kind.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiTerminatesClassIndexSignatureAndAmbientAccessor is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning semicolon rule and applies edits for exact output in the same Go process, without consumer installation, a native product build or host execution.
func TestFormatSemiTerminatesClassIndexSignatureAndAmbientAccessor(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "class Value {\n  [key: string]: string\n}\ndeclare class Ambient {\n  get first(): string\n}\n",
    "class Value {\n  [key: string]: string;\n}\ndeclare class Ambient {\n  get first(): string;\n}\n",
  )
}
