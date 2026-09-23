# Prompts used

The assignment allows any AI tooling. I used **Claude** (Anthropic) as a pair programmer. Below are the prompts I gave it, verbatim.

## 1. Initial prompt

> aga sezzle görev vermiş hemen yapalım şunu
>
> *(followed by the full assignment text from Sezzle, pasted unchanged)*

Translation of the first line (Turkish): "Sezzle sent me an assignment, let's build it right away."

From this, the assistant proposed and implemented the architecture described in the README (pure calculator core + HTTP layer in Go, reducer + hook + injected API client in React). It ran the test suites and coverage in a sandbox as it went.

## 2. Follow-up prompts

<!-- Add any further prompts here, verbatim, in the order you used them. -->

## How I reviewed the output

<!-- e.g. read every file, ran `make test` and `make coverage` locally, built and ran the Docker image,
     clicked through the UI on desktop and mobile, changed X / Y myself. -->
