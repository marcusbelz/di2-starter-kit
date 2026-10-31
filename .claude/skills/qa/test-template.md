# QA Test Results Template

Add this section to the END of the feature spec `features/<prefix>-XXXX-*.md`.

Finding IDs: `QA-1`, `QA-2`, … — numbered per QA run of this feature, cited by bug files and fix
commits ("QA-2 fixed"). They are **not** bug IDs: a finding that becomes a bug gets its own
`BUG-NNNN` via `/bug`, and the finding line names it. AC status: `[x]` passed, `[ ]` failed,
`[~]` skipped — a skip always carries the reason.

```markdown
---

## QA Test Results

**Tested:** YYYY-MM-DD
**How:** [web UI at <url> | CLI | API client | …]
**Code state:** <commit SHA>
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

- [x] **AC 1:** <criterion> — passed
- [ ] **AC 2:** <criterion> — FAILED → QA-1
- [~] **AC 3:** <criterion> *(manual-AC)* — SKIP: <reason, e.g. needs a second account> (backlog, see run protocol)

### Automated tests
- `<test command from stack.md>`: <N passed / N total>, complete: yes/no

### Manual test cases (projects with a test-case catalog)
- Run protocol: [runs/YYYY-MM-DD-<env>.md](../docs/test-cases/runs/YYYY-MM-DD-<env>.md)
- TEST-NNNN (AC 3): PASS | FAIL → QA-n | SKIP (<reason>)
- Due Regression/Smoke cases (coverage touched by this diff): TEST-NNNN PASS, …

### Edge Cases Status
- [x] **EC 1:** <edge case> — handled correctly
- [ ] **EC 2:** <edge case> — not handled → QA-2

### Feature-Scoped Security (this feature's new surface only)
- [x] Authentication: new endpoints reject unauthenticated access
- [x] Authorization: users cannot reach other users' data
- [x] Input validation: malformed/oversized/injection input rejected; output escaped
- [ ] <security issue> → QA-n

### Findings

#### QA-1: <title>
- **Severity:** Critical | High | Medium | Low
- **Steps to reproduce:**
  1. ...
  2. Expected: ... / Actual: ...
- **Pre-existing?** yes (same result on the pre-fix state → own bug, not part of this feature) | no
- **Bug:** BUG-NNNN (filed via `/bug`) | not filed (reason)

#### QA-2: <title>
- ...

### Process findings
- <e.g. AC 4 is marked manual-AC but no Active test case references it — the case must come from
  the AC (`/ux`), not be written now from the code>

### Candidates for next `/security` run
- <systemic smell noticed but NOT investigated here>

### Summary
- **Acceptance Criteria:** X passed / Y failed / Z skipped (of N)
- **Findings:** N total (C critical, H high, M medium, L low); bugs filed: BUG-…
- **Security (feature scope):** Pass / Issues found
- **Production Ready:** YES / NO
- **Recommendation:** Deploy / Fix Critical+High first (lower severities filed and prioritized)
```
