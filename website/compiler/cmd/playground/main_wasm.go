//go:build js && wasm

// Browser entry for the ttsc.dev playground wasm. Binds globalThis.ttscPlayground
// with the base ttsc build/check/transform endpoints plus the first-party
// utility plugins (banner / paths / strip) and a lint placeholder.
//
// The playground UI (`website/src/components/playground/PlaygroundShell.tsx`)
// boots this wasm in a Web Worker and routes the user's source through
// `api.build`. Plugin dispatch is reserved for future "Format with @ttsc/lint"
// buttons; today the playground does not surface it.
package main

import (
	"github.com/samchon/ttsc/packages/wasm/host"
)

func main() {
	host.Expose("ttscPlayground", host.Config{
		Plugins: []host.Plugin{
			newBannerPlugin(),
			newPathsPlugin(),
			newStripPlugin(),
			newLintPlugin(),
			newTypiaPlugin(),
		},
	})
}
