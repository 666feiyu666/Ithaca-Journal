# Project working agreements

## Token-efficient collaboration

- Before changing anything, give the user a plan of at most three points. An
  explicit request to make the change is permission.
- Keep replies concise by default: lead with the outcome, avoid restating the
  request, and report only the result, verification, and material risks.
- Expand explanations only when the user asks for detail or when a decision,
  failure, ambiguity, or safety concern requires it.
- Inspect and report only the files, output, and context needed for the current
  task. Summarize long output instead of reproducing it, and avoid rereading or
  repeating unchanged material.
- Batch related inspections and verification when practical. Prefer focused
  checks first, and run broader checks only when the task or risk warrants them.
- Stop when the requested outcome is implemented and sufficiently verified; do
  not add speculative features, documentation, or follow-up work.

## Language

- English is the canonical language for project documentation, notebook prose,
  prompts, and code comments unless the user requests otherwise.

## Preservation and safety

- Preserve unrelated user changes and research evidence.
- Never expose or commit API keys. Keep `.env` local and placeholders safe.
- Keep `README.md` concise and modify it only when explicitly asked.
- Modify `.gitignore` only with explicit authorization.
- Keep `AGENTS.md` local only; do not track, commit, or push it.
- Do not commit or push automatically. The user decides what to commit.
