# TEST-0001: Status change from the task row offers only the allowed next states *(sample)*

> **Sample test case.** Ships with the starter kit to illustrate the format, tied to the sample
> feature `feat-0002` (AC 1, marked manual-only). Not a real test case - `/init` deletes the
> samples.

- **Suites:** SUITE-001
- **Run class:** Smoke
- **Status:** Active
- **Reference:** feat-0002 AC 1
- **Coverage:**
  - [features/feat-0002-task-status-workflow.md](../../../features/feat-0002-task-status-workflow.md) - stands in until `/frontend` adds the files of the task list

**Goal:** Show that a task's status changes with a single action on its row, and that the row
offers only the allowed next states.

**Precondition:** Suite baseline: signed in as a regular user whose task list is empty; desktop
browser window at least 1280 px wide.

**Steps:**

> Not covered here, deliberately: narrow screens and tasks of another user - each would be a test
> case of its own.

| # | Step | Expected result |
|---|------|-----------------|
| 1 | **Setup:** Create a task titled `Status check` via **Add task**. | The task appears at the top of the list with the status **Open**. |
| 2 | Click the status badge of `Status check`. | A menu opens at the row. It offers **In progress** only - **not** Done. |
| 3 | Choose **In progress**. | The badge reads **In progress** immediately, without reloading the page. **No** confirmation dialog appears. |
| 4 | Click the status badge again. | The menu offers **Open** and **Done**. |
| 5 | Choose **Done**. | The badge reads **Done** immediately. |
| 6 | Click the status badge again. | The menu offers **Open** only - **not** In progress. |
| 7 | Choose **Open**. | The badge reads **Open** immediately. |
| 8 | Reload the page. | `Status check` still shows **Open**. |

**Expected throughout:**
- Every change takes exactly one choice in the menu - no save button, no dialog, no page change.
- The row keeps its place in the list at every step.

**Cleanup:** Delete the task `Status check` (row menu → **Delete**, confirm).
