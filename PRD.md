# SpendSense – Product Requirements (MVP)

## Objective
Transform Plaid-style transaction data into explainable behavioral profiles, assign one primary persona, and deliver 3–5 educational items plus 1–3 partner offers (with eligibility checks), all behind explicit consent and operator oversight.

## Users & Roles
- **End user**: opts in, sees their profile, receives educational content
- **Operator**: reviews signals, persona, and recommendations; can approve/override

## Core Flows
1. **Consent**: user opts in → consent recorded → processing enabled
2. **Ingestion**: synthetic generator creates users, accounts, liabilities, transactions (or import AML CSV)
3. **Signals**: subscription cadence, savings inflow/growth, emergency coverage, credit utilization & flags, income stability
4. **Persona**: assign primary persona via rules; tie-break via priority order
5. **Recommendations**: compile education + partner offers w/ rationales and disclosures
6. **Guardrails**: eligibility, no-shaming tone, consent enforcement
7. **Operator Oversight**: review queue, approval, overrides, decision traces stored
8. **Evaluation**: metrics for coverage, explainability, latency, auditability

## Personas (max 5)
1. **High Utilization** – any card util ≥50% OR interest > 0 OR min‑pay only OR overdue
2. **Variable Income Budgeter** – median pay gap > 45 days AND cash‑flow buffer < 1 month
3. **Subscription‑Heavy** – ≥3 recurring merchants AND ($ ≥50 in 30d OR sub share ≥10%)
4. **Savings Builder** – savings growth ≥2% over window OR net inflow ≥$200/mo AND all utils < 30%
5. **Low Cushion Optimizer (custom)** – emergency fund coverage < 0.5 months AND no overdue cards.

Priority if multiple match: 1) High Utilization, 2) Low Cushion Optimizer, 3) Variable Income, 4) Subscription‑Heavy, 5) Savings Builder.

## Non‑Goals
- Real Plaid integration; production identity/PII storage; regulated advice

## Success Criteria
- Coverage: 100% personas with ≥3 behaviors
- Explainability: 100% recommendations have rationales
- Latency: <5s/user on laptop
- Auditability: 100% have decision traces
- ≥10 tests pass; clear docs & schema

