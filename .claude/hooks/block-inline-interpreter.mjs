#!/usr/bin/env node
// .claude/hooks/block-inline-interpreter.mjs
// PreToolUse hook for Claude Code's Bash tool (wired in .claude/settings.json).
//
// Problem: a double backslash in the command text of the Bash tool reaches the
// shell as a SINGLE backslash - in quoted heredocs (<<'EOF') and single-quoted
// arguments too (observed with Claude Code on Windows + Git Bash, 2026-10: the
// command `printf '%s' 'x\\y'` prints `x\y`). Where the command text is CODE for
// an interpreter - a heredoc, `python -c`, `node -e` - that silently changes the
// program: `\\0` turns into `\0` and Python writes a real NUL byte into the
// target file, `\\.` in a regex turns into `\.`, and so on. The damage shows up
// later, far from its cause. A prose rule against it existed in the project this
// hook comes from - and was broken anyway. Hence the hook.
//
// Rule: a Bash call is rejected when it hands code inline to an interpreter
// (heredoc `<<`, `python -c`, `node -e`/`--eval`/`-p`) AND contains a backslash
// anywhere. Inline code without a backslash stays allowed (a short
// `node -e "console.log(1)"`), and so do here-strings (`<<<`).
//
// Way out (printed in the message): write the script with the Write tool - Write
// stores the bytes exactly as given - and run it by path.
//
// Exit 2 + stderr = call blocked, the message goes back to Claude.
// Requires `node` on the PATH; without it the hook errors and does not block.

let raw = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (c) => (raw += c))
process.stdin.on("end", () => {
  let cmd = ""
  try {
    cmd = JSON.parse(raw)?.tool_input?.command ?? ""
  } catch {
    process.exit(0) // unreadable input - do not block
  }
  if (typeof cmd !== "string" || !cmd.includes("\\")) process.exit(0)

  // Heredoc `<<EOF`, `<<'EOF'`, `<<-EOF` - but not the here-string `<<<`.
  const heredoc = /(?<!<)<<(?!<)\s*-?\s*['"]?[A-Za-z_]/.test(cmd)
  const inlineInterpreter =
    /\b(python3?|py|node)(\.exe)?\s+(-[A-Za-z]*\s+)*(-c|-e|--eval|-p|--print)\s/.test(cmd)

  if (!heredoc && !inlineInterpreter) process.exit(0)

  const kind = heredoc ? "heredoc (<<)" : "inline code (python -c / node -e)"
  process.stderr.write(
    [
      `Blocked: ${kind} containing a backslash. The Bash tool turns a double backslash into a single one`,
      "before the shell sees it - inside code that silently changes the program (\\\\0 becomes a NUL byte,",
      "\\\\. a different regex), and the damage shows up later.",
      "Instead: write the script with the Write tool into the scratchpad and run it by path",
      "(python <scratchpad>/x.py <args> or node <scratchpad>/x.mjs). For plain text replacements in files",
      "use the Edit tool. A commit message with a backslash (e.g. a Windows path): write it with the",
      "Write tool to <scratchpad>/msg.txt and use `git commit -F <scratchpad>/msg.txt` instead of a heredoc.",
      "Inline code WITHOUT a backslash is still allowed.",
    ].join("\n") + "\n",
  )
  process.exit(2)
})
