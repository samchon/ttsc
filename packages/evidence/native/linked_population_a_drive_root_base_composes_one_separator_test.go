package evidence

import (
	"testing"
)

/**
 * Verifies a base whose display already ends in a separator composes one.
 *
 * A drive root is the one directory whose separator is part of it, and a base on
 * another Windows volume has no relative spelling, so its display is that
 * absolute path. Concatenating blindly printed `D://requirements`, in every file
 * location as well as in the message a failed walk produces.
 *
 * The composition is asserted here from values rather than from a resolution,
 * because it is the branch that has to hold on every platform;
 * `TestALocationIsSpelledTheWayAReaderOpensIt` is where a configuration is shown
 * to produce such a display at all.
 *
 *  1. Compose a path under a base whose display ends in a separator.
 *  2. Compose one under an ordinary ascending base.
 *  3. Assert each carries exactly one separator at the join.
 *
 * @evidence contracts/testing.md#behavioral-verification populationBase.display composes a drive root and a parent-relative root without doubled separators.
 * @evidence contracts/testing.md#independent-expectations Literal D:/requirements/pricing.md and ../docs/requirements/pricing.md define the display contract.
 * @evidence contracts/testing.md#distinguishing-cases A drive prefix ending in a separator contrasts with an ascending display prefix.
 * @evidence contracts/testing.md#execution-ownership TestADriveRootBaseComposesOneSeparator calls populationBase.display twice with authored scalar values in one Go test process. It creates no filesystem fixture or symbolic link and starts no product host, compiler or installed consumer.
 */
func TestADriveRootBaseComposesOneSeparator(t *testing.T) {
	drive := populationBase{Absolute: `D:\`, Display: "D:/"}
	if got := drive.display("requirements/pricing.md"); got != "D:/requirements/pricing.md" {
		t.Fatalf("drive root display = %q", got)
	}
	ascending := populationBase{Absolute: `C:\docs`, Display: "../docs"}
	if got := ascending.display("requirements/pricing.md"); got != "../docs/requirements/pricing.md" {
		t.Fatalf("ascending display = %q", got)
	}
}
