# Prompts used

The assignment allows any AI tooling. I used **Claude** (Anthropic) as a pair programmer.

## Prompt

I pasted the full assignment text from Sezzle (Objective, Requirements, Constraints,
Deliverables, Instructions), unchanged, and asked Claude to implement it.

No other prompts were used to generate the code.

## How I reviewed the output

- Read through every file in the backend and frontend
- Ran the test suites locally (`go test -cover ./...`, `npm test`)
- Ran the backend and frontend locally and tested the UI in the browser
