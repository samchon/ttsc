//go:build windows

package evidence

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// linkWindowsPopulationDirectory is the explicit kernel fixture operation.
// Its fixed command treats temporary paths as environment data; the portable
// unit helper only calls os.Symlink. This batch owns actual junction creation.
func linkWindowsPopulationDirectory(target, link string) error {
	command := exec.Command("cmd.exe", "/d", "/q", "/v:on")
	command.Stdin = strings.NewReader("mklink /J \"!TTSC_EVIDENCE_JUNCTION_LINK!\" \"!TTSC_EVIDENCE_JUNCTION_TARGET!\"\r\nexit /b !errorlevel!\r\n")
	command.Env = append(os.Environ(), "TTSC_EVIDENCE_JUNCTION_LINK="+link, "TTSC_EVIDENCE_JUNCTION_TARGET="+target)
	if output, err := command.CombinedOutput(); err != nil {
		return fmt.Errorf("junction fixture failed: %v: %s", err, string(output))
	}
	return nil
}
