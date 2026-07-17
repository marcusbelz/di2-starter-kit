// eslint-rules/no-raw-font-size.mjs — ESLint custom rule (flat config) that
// reports raw pixel font sizes (text-[Xpx]) and Tailwind size defaults
// (text-xs|sm|base) in the app scope as errors.
//
// This is the enforcement counterpart to the type-scale convention in
// ../brand.md ("Enforcement" section: wiring, carve-out semantics, activation
// order). It ships as inert template content — the kit's own CI has no Node
// stack; a project activates it when it adopts the UI stack.
//
// Three deliberate decisions:
//   1. ALL string literals and template quasis are checked — not just JSX
//      attributes. That also catches cn() arguments, .join(" ") helpers, and
//      exported class-string constants.
//   2. The error message names the snap target from the convention table —
//      whoever sees the error sees the fix (human or agent).
//   3. text-lg and larger is deliberately NOT flagged: a conspicuously large
//      text in an app file is a design-review case, not a mechanical snap.

const PX_RE = /text-\[(\d+(?:\.\d+)?)px\]/g

// Match as a whole utility token (lookbehind/-ahead allow variant prefixes
// like sm:text-xs or hover:text-sm but prevent hits inside word fragments).
const DEFAULT_RE = /(?<![\w-])text-(xs|sm|base)(?![\w-])/g

// Numeric snap: pixel value -> canonical token of YOUR project's type scale.
// The text-scale-* names below are EXAMPLE VALUES — replace them with the
// tokens you define in brand.md (same for the tie-breaks: exact matches are
// identity replacements, in-between values snap to the nearest token; the
// documented tie-break here is 14px -> body).
const PX_SNAP = {
  '9': 'text-scale-label',
  '9.5': 'text-scale-label',
  '10': 'text-scale-label',
  '10.5': 'text-scale-micro',
  '11': 'text-scale-meta',
  '11.5': 'text-scale-meta',
  '12': 'text-scale-meta',
  '12.5': 'text-scale-body',
  '13': 'text-scale-body',
  '14': 'text-scale-body',
  '15': 'text-scale-h2',
  '16': 'text-scale-h2',
  '18': 'text-scale-h1',
}

const DEFAULT_SNAP = {
  xs: 'text-scale-meta',
  sm: 'text-scale-body',
  base: 'text-scale-h2',
}

function checkString(context, node, raw) {
  if (typeof raw !== 'string') return

  for (const m of raw.matchAll(PX_RE)) {
    const target = PX_SNAP[m[1]]
    context.report({
      node,
      messageId: 'rawPx',
      data: {
        match: m[0],
        target: target ?? 'a token of the type scale (check the table in brand.md)',
      },
    })
  }

  for (const m of raw.matchAll(DEFAULT_RE)) {
    context.report({
      node,
      messageId: 'tailwindDefault',
      data: { match: m[0], target: DEFAULT_SNAP[m[1]] },
    })
  }
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforces the type scale in the app scope; forbids raw text-[Xpx] and text-xs|sm|base sizes.',
    },
    schema: [],
    messages: {
      rawPx: 'Raw pixel font size `{{match}}` in the app scope. Use {{target}}.',
      tailwindDefault:
        'Tailwind default font size `{{match}}` in the app scope. Use `{{target}}`.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          checkString(context, node, node.value)
        }
      },
      TemplateElement(node) {
        checkString(context, node, node.value && node.value.cooked)
      },
    }
  },
}

export default rule
