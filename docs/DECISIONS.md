# Key Decisions
- **Local-first** (SQLite) for simplicity and auditability
- **Rules-first** personas & recommendations for explainability
- **Two windows** (30d, 180d) computed on demand
- **Consent enforced at recommend-time** (profiles viewable for transparency)
- **Eligibility** filters per-offer, extend via config later
- **Tone** guardrails via banned-phrase regex list
- **Prioritization** order documented in PRD
- Store third‑party AML labels in a separate table (`AmlLabel`) to keep SpendSense profiles decoupled
- UI surfaces labels & alerts with explicit disclaimers and operator review

