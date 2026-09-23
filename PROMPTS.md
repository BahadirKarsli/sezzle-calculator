# Prompts used

The assignment allows any AI tooling. I used **Claude** (Anthropic) as a pair programmer.

## Initial prompt

I wrote the Objective and asked Claude to implement it.

## Follow-up prompt

While testing the UI, I noticed very long numbers weren't being displayed and asked
whether this was intentional and whether scientific notation could be used instead.

Claude explained that input is intentionally capped at 15 digits (float64 precision)
and that large results already switch to exponent notation. It also pointed out a real
bug: chained operations used the *rounded display string* as the next operand, so
`1 ÷ 3 × 3` gave `0.999999999999` instead of `1`, and large results lost digits.
I then implemented the fix myself, following its guidance.

## How I reviewed and changed the output

- Read through the backend and frontend code
- Ran both test suites locally (`go test -cover ./...`, `npm test`)
- Ran the backend and frontend locally and tested the calculator in the browser
- Fixed the precision bug described above:
  - Wrote failing tests first (chaining off a rounded result, large results in
    exponent form, digit-limit feedback) and confirmed they failed
  - Added a full-precision `value` field to the calculator state; rounding is now
    display-only, and chained operations use the exact value
  - Added a visible message when the 15-digit input limit is reached, instead of
    silently ignoring key presses
  - Confirmed all 77 frontend tests pass
