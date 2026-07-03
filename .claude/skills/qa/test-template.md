# QA Test Results Template

Add this section to the END of the feature spec `features/<prefix>-XXXX-*.md`:

```markdown
---

## QA Test Results

**Tested:** YYYY-MM-DD
**How:** [web UI at <url> | CLI | API client | …]
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: [Criterion Name]
- [x] Sub-criterion passed
- [ ] BUG: Sub-criterion failed (describe what went wrong)

#### AC-2: [Criterion Name]
- [x] All sub-criteria passed

### Edge Cases Status

#### EC-1: [Edge Case Name]
- [x] Handled correctly

#### EC-2: [Edge Case Name]
- [ ] BUG: Not handled (expected vs. actual)

### Feature-Scoped Security (this feature's new surface only)
- [x] Authentication: new endpoints reject unauthenticated access
- [x] Authorization: users cannot reach other users' data
- [x] Input validation: malformed/oversized/injection input rejected; output escaped
- [ ] BUG: [security issue description]

### Candidates for next `/security` run
- [systemic smell noticed but NOT investigated here]

### Bugs Found

#### BUG-1: [Bug Title]
- **Severity:** Critical | High | Medium | Low
- **Steps to Reproduce:**
  1. ...
  2. Expected: ... / Actual: ...
- **Priority:** Fix before deployment | Next sprint | Nice to have

### Summary
- **Acceptance Criteria:** X/Y passed
- **Bugs Found:** N total (C critical, H high, M medium, L low)
- **Security (feature scope):** [Pass / Issues found]
- **Production Ready:** YES / NO
- **Recommendation:** [Deploy / Fix bugs first]
```
