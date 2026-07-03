# Confirm Dialog (no native confirm/alert/prompt)

> Pruned at `/init` time if the project has no UI.

## Rule
For any action that needs user confirmation (destructive ops, discarding unsaved changes, irreversible
state changes, bulk operations over N rows), use a single shared **`ConfirmDialog`** component
(a thin wrapper over the component library's AlertDialog) — never the browser's `window.confirm()` /
`window.alert()` / `window.prompt()`.

In `src/` it is **forbidden** to call `window.confirm` / `window.alert` / `window.prompt`. (A
`no-restricted-globals` ESLint rule can enforce this.) Use the `ConfirmDialog` for confirmations and a
toast (`sonner`-style) for post-action success/error feedback.

## Pattern (caller controls open state)
```tsx
const [pending, setPending] = useState<Row | null>(null)
const [busy, setBusy] = useState(false)

async function confirm() {
  setBusy(true)
  try {
    const res = await doAction({ id: pending!.id })
    if (!res.ok) { toast.error(res.error); return }   // dialog stays open for retry
    toast.success("Done.")
    setPending(null)                                   // owner closes the dialog
    await refresh()
  } finally { setBusy(false) }
}

<ConfirmDialog
  open={pending !== null}
  onOpenChange={(o) => { if (!o) setPending(null) }}
  title="Delete X?"
  description={<>… highlight identifiers in mono …</>}
  confirmLabel="Delete"          // imperative verb, not "Confirm"
  destructive={true}             // red only for real data loss; reversible actions = false (primary)
  busy={busy}                    // disables buttons + shows loading label while awaiting
  onConfirm={confirm}
>
  {/* optional children slot: a scrollable list of affected rows for bulk ops */}
</ConfirmDialog>
```

## Conventions
- **State pair** (`pending` object + `busy` flag), not just an `open` boolean — the body needs the
  row's data so the description doesn't flicker during close.
- **Owner closes its own dialog** after the toast, never before (avoids animation/result races).
- **Tone:** `destructive` (red) only when the action causes data loss / needs a backup to undo;
  reversible actions stay primary (`destructive={false}`).
- **Async:** set `busy` before `await`, clear it in `finally`; the confirm button must disable while
  busy (no double-submit).
- **Confirm label is an imperative verb** ("Delete", "Discard", "Revoke") — "Confirm" is a fallback.
- A new variant (confirm-with-text-input, multi-choice, diff-preview) gets its own component — discuss
  here first, then build, so the pattern doesn't fragment.

## Don'ts
- ❌ `window.confirm/alert/prompt` anywhere in `src/`.
- ❌ `alert()` for success/error — use a toast.
- ❌ Double confirmation (confirm + "it worked, OK?").
- ❌ Using the raw AlertDialog primitive directly instead of the shared wrapper.
