# Prompt Optimizer

A Firefox browser extension that helps you write better prompts for Claude AI.

What it does:

Prompt Optimizer analyzes your prompts to identify ambiguities that could lead to hallucinations or unintended behavior, then guides you through a structured refinement process. It asks categorized clarifying questions (scope, context, safety), incorporates your answers iteratively, and generates optimized prompts following Anthropic's best practices.

Key features:

Ambiguity detection — Identifies vague language, missing context, and potential misinterpretation points
Guided refinement — Categorized clarifying questions with clickable suggestion chips for quick answers
Iterative building — Accumulates your answers across multiple question rounds to build comprehensive prompts
Model recommendations — Suggests whether Sonnet 4.5 or Opus 4.5 is better suited for each task, with confidence indicators
Prompt library — Save, categorize, and reuse your optimized prompts
Privacy-first — Uses your own Anthropic API key; no data sent to third parties

Built for developers who want prompts that are natural, reusable, and ready to copy-paste into tools like Antigravity, Cursor, or VS Code.