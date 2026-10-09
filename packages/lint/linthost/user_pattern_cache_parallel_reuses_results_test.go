package linthost

import (
  "regexp"
  "sync"
  "testing"
)

// TestUserPatternCacheParallelReusesResults verifies concurrent file contexts
// share successful and failed compilations without changing matching behavior.
//
// Each worker owns its Context, as Engine.runFile does, and borrows the same
// configuration cache. Both patterns start cold and all workers start together.
//
//  1. Release parallel valid and invalid requests against one owner.
//  2. Assert identical regex/error results, matching and nonmatching text.
//  3. Repeat through another context to verify completed results remain reusable.
//
// @evidence contracts/testing.md#behavioral-verification Concurrent Context.compileUserPattern calls return one successful regexp identity and one failed error identity; the regexp matches only the authored marker and later calls reuse both results.
// @evidence contracts/testing.md#independent-expectations RE2 anchors independently require exactly marker; pointer/error identity distinguishes shared published results from separately returned compilations without a timing oracle.
// @evidence contracts/testing.md#distinguishing-cases Cold simultaneous valid/invalid requests, adjacent unmatched text and later warm requests cover publication and failure sharing; the resident case owns retirement.
// @evidence contracts/testing.md#execution-ownership Go goroutines call the owning helper in one test process using literal patterns, without a consumer installation, native build or process protocol.
func TestUserPatternCacheParallelReusesResults(t *testing.T) {
  const workers = 32
  cache := &userPatternCache{}
  start := make(chan struct{})
  regexes := make([]*regexp.Regexp, workers)
  failures := make([]error, workers)
  var wg sync.WaitGroup
  for i := range workers {
    wg.Add(1)
    go func(index int) {
      defer wg.Done()
      ctx := &Context{patterns: cache}
      <-start
      var err error
      regexes[index], err = ctx.compileUserPattern(`^marker$`)
      if err != nil {
        t.Errorf("valid request: %v", err)
      }
      re, err := ctx.compileUserPattern(`([`)
      if re != nil || err == nil {
        t.Errorf("invalid request: re=%v err=%v", re, err)
      }
      failures[index] = err
    }(i)
  }
  close(start)
  wg.Wait()
  for i := range workers {
    if regexes[i] == nil || regexes[i] != regexes[0] || failures[i] != failures[0] {
      t.Fatalf("worker %d did not share compilation results", i)
    }
    if !regexes[i].MatchString("marker") || regexes[i].MatchString("other-marker") {
      t.Fatalf("worker %d changed matching behavior", i)
    }
  }
  ctx := &Context{patterns: cache}
  re, err := ctx.compileUserPattern(`^marker$`)
  if re != regexes[0] || err != nil {
    t.Fatal("completed successful result was not reused")
  }
  re, err = ctx.compileUserPattern(`([`)
  if re != nil || err != failures[0] {
    t.Fatal("completed failed result was not reused")
  }
}
