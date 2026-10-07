package projectinput

import (
	"fmt"
	"github.com/samchon/ttsc/packages/lint/rule"
)

// residentInputRule publishes the configured helper's one exact input.
// The original topologyRule retains its fixed Markdown/JSON declarations.
//
// @evidence contracts/common.md#principled-implementation A distinct configured rule name separates real and linked option values during global entry folding; the public options marker permits only the supported decoding channel.
// @evidence contracts/common.md#clear-and-simple-design One name field permits two independently configured publishers without changing the existing topologyRule.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Real host registration and ProjectInputContext options carry the value; no private registry write or fabricated snapshot substitutes for publication.
// @evidence contracts/common.md#meaningful-documentation The fixture states the separate real/link option responsibility and the unchanged original publisher.
// @evidenceExclude contracts/performance.md#efficient-algorithms This value shape contains no algorithm; ProjectInputs owns decoding and publication.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Configuration and dependency caches remain with the host, not this rule value.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only one name string is retained for each of two initialization-time registrations; no handle is acquired.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This value type contains no filesystem or process operation.
type residentInputRule struct{ name string }

// Name preserves this configured publisher's distinct registry key.
//
// @evidence contracts/common.md#principled-implementation Returns the retained fixed fixture name; two registrations keep their resolved options separate.
// @evidence contracts/common.md#clear-and-simple-design A direct value return avoids any host configuration or alias lookup.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This fixture uses the native rule interface without private registry changes or simulated responses.
// @evidence contracts/common.md#meaningful-documentation The native headline states this method's exact contribution to the input-only fixture.
// @evidence contracts/performance.md#efficient-algorithms This fixed operation does not scale with project files or requests.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation adds no result cache; host configuration and resident evaluation own reuse.
// @evidence contracts/performance.md#bound-retention-and-release-resources No handle or task is acquired; initialization retains only the two fixed rule values.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation performs no native path, filesystem or process query.
func (r residentInputRule) Name() string { return r.name }

// AcceptsTtscLintOptions enables the existing public options contract.
//
// @evidence contracts/common.md#principled-implementation Returns true to admit the explicit file option through the existing host marker.
// @evidence contracts/common.md#clear-and-simple-design A literal marker declares support rather than replacing host option validation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This fixture uses the native rule interface without private registry changes or simulated responses.
// @evidence contracts/common.md#meaningful-documentation The native headline states this method's exact contribution to the input-only fixture.
// @evidence contracts/performance.md#efficient-algorithms This fixed operation does not scale with project files or requests.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation adds no result cache; host configuration and resident evaluation own reuse.
// @evidence contracts/performance.md#bound-retention-and-release-resources No handle or task is acquired; initialization retains only the two fixed rule values.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation performs no native path, filesystem or process query.
func (residentInputRule) AcceptsTtscLintOptions() bool { return true }

// Check emits no file diagnostic; this fixture owns input publication only.
//
// @evidence contracts/common.md#principled-implementation The fixture has no project diagnostics; its sole behavior is ProjectInputs publication.
// @evidence contracts/common.md#clear-and-simple-design An empty diagnostic hook prevents the input transport case from adding unrelated findings.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This fixture uses the native rule interface without private registry changes or simulated responses.
// @evidence contracts/common.md#meaningful-documentation The native headline states this method's exact contribution to the input-only fixture.
// @evidence contracts/performance.md#efficient-algorithms This fixed operation does not scale with project files or requests.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation adds no result cache; host configuration and resident evaluation own reuse.
// @evidence contracts/performance.md#bound-retention-and-release-resources No handle or task is acquired; initialization retains only the two fixed rule values.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation performs no native path, filesystem or process query.
func (residentInputRule) Check(*rule.ProjectContext) {}

// ProjectInputs returns the exact configured file without reading the file.
//
// @evidence contracts/common.md#principled-implementation DecodeOptions reads the actual configured helper result and returns one ProjectInputFile; host normalization owns physical path and missing-file semantics.
// @evidence contracts/common.md#clear-and-simple-design Decode, validate the required value and return one declaration; no Program or discovery query is involved.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed or empty options panic into the host's protected publisher error rather than becoming a successful empty topology.
// @evidence contracts/common.md#meaningful-documentation Native documentation explains exact-file declaration without filesystem consumption.
// @evidence contracts/performance.md#efficient-algorithms JSON decoding costs configured option bytes and produces one declaration, independent of project population.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The host supplies current options per query; this publisher stores no reusable computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The decoded option and single returned record transfer to the collector without a handle or task.
// @evidence contracts/portability.md#os-neutral-implementation The file string is passed to the native host's supported path normalizer; this rule does not rewrite separators or infer case policy.
func (residentInputRule) ProjectInputs(ctx *rule.ProjectInputContext) []rule.ProjectInput {
	var options struct {
		File string `json:"file"`
	}
	if err := ctx.DecodeOptions(&options); err != nil {
		panic(err)
	}
	if options.File == "" {
		panic(fmt.Errorf("resident input requires file"))
	}
	return []rule.ProjectInput{{Kind: rule.ProjectInputFile, Pattern: options.File}}
}

// init adds two separate public fixture registrations beside topologyRule.
//
// @evidence contracts/common.md#principled-implementation Two distinct names are registered by the supported initialization-time contributor API.
// @evidence contracts/common.md#clear-and-simple-design Only two fixed registration effects occur; the existing topologyRule remains untouched.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This fixture uses the native rule interface without private registry changes or simulated responses.
// @evidence contracts/common.md#meaningful-documentation The native headline states this method's exact contribution to the input-only fixture.
// @evidence contracts/performance.md#efficient-algorithms This fixed operation does not scale with project files or requests.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation adds no result cache; host configuration and resident evaluation own reuse.
// @evidence contracts/performance.md#bound-retention-and-release-resources No handle or task is acquired; initialization retains only the two fixed rule values.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This operation performs no native path, filesystem or process query.
func init() {
	rule.RegisterProject(residentInputRule{name: "topology/resident-real"})
	rule.RegisterProject(residentInputRule{name: "topology/resident-linked"})
}
