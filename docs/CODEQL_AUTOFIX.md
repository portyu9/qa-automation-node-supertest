# CodeQL Autofix automation

This repository consumes the review-only CodeQL Autofix controller from `portyu9/qa-automation-mobile-appium` at immutable commit `9280e1cf79bea79c027eabc8abe355ad89e6c010`. Local policy is defined in `.github/codeql-autofix.json` and protected by dependency governance.

The controller runs only from trusted default-branch code after a successful `security` workflow, on a bounded schedule, or by explicit default-branch dispatch. Pull requests execute only unprivileged integration self-tests.

Only explicitly targeted open CodeQL alerts on the exact current `main` SHA may be processed. Generated changes are committed to a new isolated security branch, then rejected unless they remain within source-extension, changed-file, changed-line, alert-location, base-SHA, and denied-path limits. Accepted suggestions become draft PRs and CI, Extended, Security, and Docs are dispatched normally.

The controller never merges, dismisses an alert, force-updates a branch, checks out generated code in its privileged job, or changes denied workflow/dependency policy files. GitHub's explicit `422 Alert is not supported by autofix` result is recorded as an auditable nonfatal outcome; unexpected API, authentication, validation, and unsafe-diff failures remain hard failures.

Historical targets are alerts `#3` and `#4`. Their ReDoS findings were already remediated in PR #62, so a closed-alert no-op is the expected first production result.
