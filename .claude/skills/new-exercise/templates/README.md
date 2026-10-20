# {{ID}} {{TITLE}}

Lesson: {{LESSON_URL}}

{{SUMMARY}}

Setup, API key and logging: see the [root README](../../README.md).

## What it builds

{{BEHAVIOURS}}

## Run

```sh
npm install
npm start -- '{{PROMPT}}'
```

Test inputs: {{INPUTS}}

Cost of the example prompt: (from the RESULT.md run's log).

## What to watch for

## Troubleshooting

## Source files

| File | Role |
|---|---|
| `src/index.ts` | Entry point: reads arguments, prints the result. |
| `src/log.ts` | This lesson's trace events on top of `common/log.ts`. |
