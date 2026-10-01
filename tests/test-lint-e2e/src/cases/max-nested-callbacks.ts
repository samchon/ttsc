// Positive: eleven levels of nested arrow-function callbacks exceeds the
// default depth of ten. The rule fires on the eleventh callback because
// that is the first one whose stack-depth crossed the threshold.
declare function schedule(fn: () => void): void;

schedule(() =>
  schedule(() =>
    schedule(() =>
      schedule(() =>
        schedule(() =>
          schedule(() =>
            schedule(() =>
              schedule(() =>
                schedule(() =>
                  schedule(() =>
                    // expect: max-nested-callbacks error
                    schedule(() => {
                      void 0;
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
);

// Negative: ten levels deep sits exactly at the limit and stays silent —
// the rule fires only when the count strictly exceeds the threshold.
schedule(() =>
  schedule(() =>
    schedule(() =>
      schedule(() =>
        schedule(() =>
          schedule(() =>
            schedule(() =>
              schedule(() =>
                schedule(() =>
                  schedule(() => {
                    void 0;
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
);
