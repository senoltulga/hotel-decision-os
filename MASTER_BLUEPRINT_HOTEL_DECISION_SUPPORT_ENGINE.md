# Hotel Decision Support Engine — Master Blueprint v1.0

**Status:** BASELINE DRAFT  
**Purpose:** Claude Code implementation master document  
**Date:** 2026-10-07

---

## 1. Product Definition

**Hotel Decision Support Engine (HDSE)** is a deterministic decision-support system for hotel operations, finance, investment analysis, and valuation.

It is not only an optimization engine.

The system must support four primary analysis families:

1. **Simulation**
2. **Maximization**
3. **Minimization**
4. **Multi-Objective Optimization**

The engine must guide a non-expert user through the correct analysis flow, verify case readiness, request missing inputs, execute deterministic calculation skills, enforce constraints, and explain the result.

---

# 2. Core Development Protocol

Every model, flow, and module follows this lifecycle:

**DESIGN → SIMULATE → VALIDATE → LOCK → BLUEPRINT**

### DRAFT
The feature or flow is being designed.

### VALIDATED
The financial, mathematical, UX, and logical behavior has been tested and accepted.

### LOCKED
The behavior becomes a baseline contract.

### BLUEPRINT
The locked behavior is incorporated into the permanent system specification.

## Rule

No conceptual idea becomes a permanent system rule before simulation and validation.

---

# 3. Core Architecture Principle — Case First

Every analysis starts from a **Case**.

No solver, optimizer, simulator, or valuation flow may run before the system understands the case.

Main execution chain:

```text
Case
↓
Derived Metrics
↓
Case Readiness Check
↓
Guided Decision Wizard
↓
Problem Definition
↓
Calculation Skill Graph
↓
Constraint Engine
↓
Simulator / Solver
↓
Result & Explanation Layer
```

---

# 4. Case Model

A Case represents the hotel asset, operating assumptions, financial assumptions, market assumptions, and analysis state.

## 4.1 Asset / Capacity

Minimum structural fields may include:

```text
room_count
bed_count
open_days
available_room_nights
available_bed_nights
unavailable_capacity
unavailable_capacity_reason
```

Examples of unavailable capacity:

- owner-use
- maintenance
- renovation
- seasonal closure
- staff use
- house-use
- long-term blocking
- legal/technical restriction

---

## 4.2 Pricing

```text
current_adr
target_adr
min_adr
max_adr
seasonal_adr
channel_adr
```

---

## 4.3 Demand

```text
current_occupancy
target_occupancy
min_occupancy
seasonal_occupancy
demand_rule
demand_curve
segment_mix
channel_mix
```

---

## 4.4 Revenue

```text
room_revenue
fb_revenue
spa_revenue
rental_revenue
commercial_revenue
other_revenue
total_operating_revenue
```

---

## 4.5 Cost

```text
fixed_opex
variable_opex
variable_opex_rate
payroll
energy
maintenance
marketing
management_fee
insurance
capex
```

---

## 4.6 Finance / Market

```text
inflation
interest_rate
discount_rate
cap_rate
exit_cap_rate
tax_rate
debt
dscr
terminal_growth
forecast_horizon
```

---

# 5. Variable Taxonomy

Every variable must belong to a defined class.

## 5.1 Decision Variable

A value the engine is allowed to change.

Examples:

```text
ADR
Marketing Budget
Channel Mix
Open Days
CapEx Timing
```

---

## 5.2 Exogenous Variable

An external variable the engine does not control.

Examples:

```text
Inflation
Interest Rate
Discount Rate
Cap Rate
Market Growth
```

---

## 5.3 Constraint / State Variable

A required operating or financial boundary.

Examples:

```text
Occupancy >= 45%
ADR <= Market Maximum
DSCR >= 1.30
Marketing Budget <= Budget Limit
Service Quality >= Minimum Standard
```

---

## 5.4 Derived Variable

A value calculated by deterministic formulas.

Examples:

```text
RevPAR
Revenue
GOP
EBITDA
NOI
NPV
IRR
Property Value
Payback Period
```

---

## 5.5 Objective Variable

The result the selected analysis wants to improve.

Examples:

```text
MAX RevPAR
MAX NOI
MAX NPV
MIN OPEX
MIN CapEx
```

---

# 6. Deterministic Calculation Engine

The financial calculation engine must be separated from the solver.

The solver must never recreate, override, or invent financial formulas.

All formulas live in deterministic skills.

Core hotel financial chain:

```text
ADR
↓
Occupancy
↓
RevPAR
↓
Room Revenue
↓
Other Revenue
↓
Total Revenue
↓
OPEX
↓
GOP
↓
EBITDA
↓
NOI
↓
Cash Flow
↓
NPV / Property Value
↓
IRR / Payback
```

Same inputs must always produce the same outputs.

---

# 7. Core Financial Skills

## 7.1 RevPAR Skill

```text
RevPAR = ADR × Occupancy
```

RevPAR is not a price.

- ADR = price decision / pricing metric
- Occupancy = demand response
- RevPAR = resulting room-revenue efficiency KPI

---

## 7.2 Room Revenue Skill

```text
Room Revenue
= Available Room Nights × Occupancy × ADR
```

Equivalent:

```text
Room Revenue
= Available Room Nights × RevPAR
```

---

## 7.3 GOP Skill

```text
GOP
= Total Operating Revenue − Operating Expenses
```

---

## 7.4 NOI Skill

NOI must represent property-level net operating income.

The exact GOP → EBITDA → NOI bridge must be standardized before the NOI module is locked.

---

## 7.5 Direct Capitalization Skill

```text
Property Value = NOI / Cap Rate
```

Cap Rate is normally an exogenous market parameter, not a free solver decision variable.

---

## 7.6 DCF Skill

```text
PV = CF_t / (1 + r)^t
```

Total value:

```text
Forecast Period Present Value
+
Terminal Value Present Value
=
Property / Investment Value
```

---

# 8. Decision Support Engine — Primary Analysis Areas

## 8.1 Simulation Engine

Primary question:

> What happens if these assumptions change?

Sub-tools:

- What-if Analysis
- A/B Comparison
- Scenario Analysis
- Sensitivity Analysis
- Stress Test

---

## 8.2 Maximization Engine

Primary question:

> Under the allowed constraints, what combination produces the highest target value?

Canonical first targets:

1. MAX RevPAR
2. MAX NOI
3. MAX NPV / Property Value

---

## 8.3 Minimization Engine

Primary question:

> Under required constraints, what combination produces the lowest target value?

Canonical first targets:

1. MIN OPEX
2. MIN CapEx
3. MIN Risk / Payback Period

---

## 8.4 Multi-Objective Optimization Engine

Primary question:

> What is the best trade-off between multiple competing objectives?

Canonical first use cases:

1. RevPAR ↔ Occupancy
2. NOI ↔ OPEX
3. NPV ↔ Risk / CapEx

---

# 9. Simulation Sub-Tools

## 9.1 What-if

Example:

```text
ADR 145 → 155 USD
Occupancy 55% → 50%
```

Question:

> What happens to RevPAR, Revenue, NOI, and Value?

---

## 9.2 A/B Comparison

Two explicit alternatives are compared.

Example:

```text
A:
ADR = 145
Occupancy = 55%

B:
ADR = 155
Occupancy = 49%
```

Comparison KPIs:

```text
RevPAR
Revenue
GOP
NOI
Value
```

---

## 9.3 Scenario Analysis

Multiple assumption packages are compared.

Typical scenarios:

```text
Conservative
Base
Upside
```

Multiple parameters may change together:

```text
ADR
Occupancy
OPEX
CapEx
Discount Rate
```

---

## 9.4 Stress Test

The base case is subjected to adverse conditions.

Example:

```text
ADR -15%
Occupancy -10 pts
OPEX +20%
Discount Rate +4 pts
```

---

# 10. Guided Decision Wizard

The user is not assumed to understand hotel finance or optimization terminology.

The application must never present an unexplained technical form.

Every decision step follows this sequence:

```text
Explain
↓
Show Impact
↓
Explain When to Use
↓
Show Trade-Off / Risk
↓
Offer Valid Options
↓
Request User Approval
↓
Continue
```

Example:

If the user selects **RevPAR Maximization**, the system explains:

- RevPAR = ADR × Occupancy
- ADR is the decision variable
- Occupancy is demand response
- RevPAR is a performance KPI
- maximizing RevPAR does not necessarily maximize NOI
- the system requires ADR bounds and a demand relationship

Only after user approval may the wizard continue.

---

# 11. Main Entry Experience

When the user opens the Decision Support Engine, the primary question is:

# What do you want to do?

Available tools:

```text
What-if Simulation
Scenario Analysis
A/B Comparison
Stress Test
Maximization
Minimization
Multi-Objective Optimization
```

When the user selects a tool, the application must first display:

1. What is this tool?
2. When should it be used?
3. What result does it produce?
4. What case data does it require?
5. What trade-offs should the user understand?

Then:

```text
Continue with this tool
```

---

# 12. Case Readiness Engine

Before any selected analysis runs, the engine asks:

> Does this Case contain enough information for this analysis?

Possible states:

## READY

All mandatory inputs exist.

## INCOMPLETE

Some required fields are missing but can be completed by the user.

## BLOCKED

A critical relationship or data source is missing and the analysis cannot run.

---

# 13. Missing Data Workflow

If required data is missing:

```text
DO NOT RUN SOLVER
```

Instead:

1. identify missing fields
2. explain why each field is required
3. expose only the missing input fields
4. collect user input
5. validate input
6. rerun readiness
7. continue only if READY

Example:

```text
Selected analysis: MAX RevPAR

Missing:
- minimum ADR
- maximum ADR
- ADR → Occupancy relationship
```

The system must request these fields before allowing optimization.

---

# 14. Dynamic Required Inputs

Required fields depend on selected analysis.

## 14.1 RevPAR

Required:

```text
reference_adr
reference_occupancy
min_adr
max_adr
demand_rule
```

Recommended:

```text
min_occupancy
```

---

## 14.2 NOI

In addition to revenue drivers:

```text
fixed_opex
variable_opex
property_level_expenses
```

---

## 14.3 NPV

In addition to NOI:

```text
forecast_horizon
annual_cash_flows
capex
discount_rate
terminal_value_assumptions
```

---

# 15. Demand Relationship

RevPAR optimization cannot run with a single ADR and a single occupancy value.

The engine must understand how occupancy reacts when ADR changes.

Supported methods:

## 15.1 Scenario Points

Example:

```text
130 USD → 65%
145 USD → 55%
150 USD → 50%
```

---

## 15.2 Sensitivity Rule

Example:

```text
Every +5 USD ADR
→ Occupancy -2 percentage points
```

---

## 15.3 Historical Data

Use historical:

```text
ADR
Occupancy
Season
Channel
Segment
```

to derive a demand curve.

A predictive layer may be added later, but deterministic control and validation must remain.

---

# 16. Scenario / Problem Template Architecture

Do not build a separate application for every analysis.

Each analysis is represented as a reusable problem template.

General contract:

```text
Scenario Template
↓
Required Inputs
↓
Skill Graph
↓
Constraints
↓
Objective
↓
Solver / Simulator
```

---

# 17. Canonical MAX RevPAR Flow

**Status:** MVP FLOW — DRAFT / LOCK CANDIDATE

## Objective

```text
MAX RevPAR
```

## Formula

```text
RevPAR = ADR × Occupancy
```

## Decision Variable

```text
ADR
```

## Derived Variable

```text
Occupancy
```

Occupancy must be calculated from the selected demand rule.

## Required Inputs

```text
reference_adr
reference_occupancy
min_adr
max_adr
demand_rule
```

Optional constraint:

```text
min_occupancy
```

## Example Reference Case

```text
Reference ADR = 145 USD
Reference Occupancy = 55%
Reference RevPAR = 79.75 USD

ADR Minimum = 130 USD
ADR Maximum = 150 USD
```

Current missing field in the simulated case:

```text
Demand Rule
```

## Solver Flow

```text
1. Generate candidate ADR
2. Calculate Occupancy = DemandFunction(ADR)
3. Run Constraint Check
4. Calculate RevPAR
5. Compare with best valid result
6. Save better result
7. Repeat across search space
8. Return optimal solution
```

## Result Contract

```text
optimal_adr
expected_occupancy
maximum_revpar
binding_constraints
used_assumptions
explanation
```

---

# 18. Problem Definition Contract

Every solver receives a standardized problem object.

Conceptual structure:

```text
Case
Objective
Direction
Decision Variables
Bounds
Constraints
Fixed Inputs
Exogenous Inputs
Calculation Skills
Scenario Parameters
Solver Configuration
```

Example:

```text
Objective:
  metric = RevPAR
  direction = MAX

Decision Variable:
  ADR

Bounds:
  ADR = 130–150 USD

Reference:
  ADR = 145 USD
  Occupancy = 55%

Derived:
  Occupancy = DemandFunction(ADR)

Calculation:
  RevPAR = ADR × Occupancy
```

---

# 19. Solver Rules

The solver must:

1. receive a validated problem definition
2. generate candidate decisions
3. call deterministic calculation skills
4. validate constraints
5. calculate objective value
6. compare valid solutions
7. return best valid solution

The solver must not:

- invent formulas
- invent market data
- modify locked calculation rules
- optimize exogenous parameters unless explicitly modeled as decisions
- bypass readiness

---

# 20. Calculation Skill Library

Initial skill roadmap:

```text
ADR Skill
Occupancy / Demand Skill
RevPAR Skill
Room Revenue Skill
Other Revenue Skill
Total Revenue Skill
OPEX Skill
GOP Skill
EBITDA Skill
NOI Skill
Cap Rate Valuation Skill
Cash Flow Skill
DCF Skill
Terminal Value Skill
NPV Skill
IRR Skill
Payback Skill
DSCR Skill
Constraint Check Skill
```

---

# 21. AI / Agent Role

AI may help with:

- user intent interpretation
- analysis-tool recommendation
- explanation of financial concepts
- missing-data guidance
- objective suggestions
- constraint suggestions
- scenario generation
- result explanation

AI must not replace:

- financial calculation skills
- readiness rules
- constraint validation
- deterministic solver
- valuation formulas

Core principle:

> AI helps define and explain the problem.  
> The deterministic engine calculates and solves the problem.

---

# 22. MVP v0.1 Scope

The first working version is intentionally narrow.

## Included

```text
Case Schema
Variable Taxonomy
RevPAR Skill
Demand Rule Skill
Constraint Validator
Readiness Engine
Guided Wizard
MAX RevPAR Problem Builder
MAX RevPAR Solver
Result & Explanation Layer
End-to-End Tests
```

## Not Included in v0.1

```text
MAX NOI
MAX NPV
MIN OPEX
A/B Comparison
Scenario Analysis
Stress Test
Multi-Objective Optimization
AI recommendation layer
```

These are added after the first canonical flow is locked.

---

# 23. MVP Definition of Done

MVP v0.1 is complete when:

1. user can create a hotel case
2. incomplete case is detected correctly
3. missing fields are explained
4. only missing fields are requested
5. invalid input is rejected
6. readiness returns READY before solver activation
7. MAX RevPAR problem definition is generated
8. deterministic solver returns the correct optimum
9. result shows ADR, occupancy, RevPAR, assumptions, and constraints
10. same input always returns the same output
11. end-to-end tests pass
12. MAX RevPAR flow becomes eligible for LOCKED status

---

# 24. MVP Task Order

## Phase A — Core

### T01 — Case Schema
Define the canonical hotel Case contract.

### T02 — Variable Taxonomy
Define:

```text
Decision
Fixed
Exogenous
Constraint
Derived
Objective
```

### T03 — RevPAR Skill
Implement and test:

```text
RevPAR = ADR × Occupancy
```

### T04 — Demand Rule Skill
Initial support:

```text
Scenario Points
Linear Sensitivity Rule
```

### T05 — Constraint Validator
Validate:

```text
ADR bounds
Occupancy bounds
Minimum occupancy
Invalid numeric values
```

### T06 — Readiness Engine
Return:

```text
READY
INCOMPLETE
BLOCKED
```

---

## Phase B — Working User Flow

### T07 — Guided Wizard

Implement:

```text
Explain
Impact
Trade-Off
Options
Approval
```

### T08 — MAX RevPAR Problem Builder
Generate standardized problem definition.

### T09 — MAX RevPAR Solver
Search valid ADR range and return maximum RevPAR solution.

### T10 — Result & Explanation Layer
Show:

```text
Optimal ADR
Expected Occupancy
Maximum RevPAR
Assumptions
Constraints
Explanation
```

---

## Phase C — Validation & Lock

### T11 — End-to-End Tests

Required cases:

```text
complete case
incomplete case
blocked case
invalid ADR range
invalid occupancy
single-point ADR range
boundary optimum
normal optimum
```

### T12 — MAX RevPAR Flow v1.0 Lock

If all tests pass:

```text
MAX RevPAR Flow v1.0 = LOCKED
```

Then incorporate the locked flow into the permanent Master Blueprint.

---

# 25. Recommended Technical Structure

Suggested first implementation:

```text
Next.js / React
TypeScript
Pure deterministic domain functions
```

Suggested folder structure:

```text
src/
  domain/
    case/
      case.types.ts
      case.schema.ts

    variables/
      variable.types.ts

    skills/
      revpar.skill.ts
      demand.skill.ts

    readiness/
      readiness.engine.ts

    constraints/
      constraint.validator.ts

    problems/
      problem.types.ts
      max-revpar.builder.ts

    solvers/
      max-revpar.solver.ts

    results/
      result.types.ts
      result.explainer.ts

  features/
    decision-support/
      entry/
      case-readiness/
      wizard/
      max-revpar/
      results/

tests/
  unit/
  integration/
  e2e/
```

---

# 26. Claude Code Implementation Rules

Claude Code must follow these rules:

1. Do not change locked formulas without explicit approval.
2. Keep calculation logic outside UI components.
3. Keep solver logic separate from calculation skills.
4. Prefer pure deterministic functions.
5. Validate every external input.
6. Never run solver before readiness.
7. Never fabricate missing financial or market data.
8. Do not use LLM logic inside deterministic financial calculations.
9. Add unit tests for every calculation skill.
10. Add end-to-end tests for every canonical flow.
11. Avoid magic numbers.
12. Keep currency and percentages explicit and type-safe.
13. Result explanation must be separate from numerical calculation.
14. New modules must not break locked behavior.
15. Preserve the lifecycle:

```text
DRAFT → VALIDATED → LOCKED → BLUEPRINT
```

---

# 27. Immediate Development Milestone

The first canonical milestone is:

# MAX RevPAR Flow v1.0

Required end-to-end behavior:

```text
Create Case
↓
Select Decision Support Engine
↓
Select Maximization
↓
Select MAX RevPAR
↓
Explain RevPAR and dependencies
↓
Run Readiness
↓
Detect missing data
↓
Collect ADR bounds
↓
Collect Demand Rule
↓
Validate Constraints
↓
Build Problem Definition
↓
Run Deterministic Solver
↓
Return Optimal ADR / Occupancy / RevPAR
↓
Explain Result
↓
Validate
↓
LOCK
```

This flow becomes the reference pattern for later modules such as MAX NOI, MIN OPEX, What-if, Scenario Analysis, and Multi-Objective Optimization.

---

# 28. Final System Principle

The product must behave as a guided decision-support system, not as a raw calculator.

The user should always understand:

```text
What am I trying to do?
What information is required?
What is missing?
What can the engine change?
What is fixed?
What constraints apply?
Which formulas are being used?
Why did the system produce this result?
```

The system architecture must guarantee:

```text
Correct Case
+
Validated Inputs
+
Deterministic Skills
+
Explicit Constraints
+
Transparent Solver
=
Explainable Decision Support
```

---

# Implementation Appendix — Codex, 2026-10-07

Original conceptual baseline above is preserved. The implementation now includes:

- MAX RevPAR continuous analytic solver, Case readiness, constraints, immutable problem builder, guided wizard, result explanation, rounded-price re-evaluation, and local Case storage/export.
- What-if, A/B, scenario, sensitivity and stress modules.
- Revenue/OPEX/GOP/EBITDA/NOI, cash flow, direct capitalization, DCF, terminal value, NPV, IRR, payback and DSCR skills.
- MAX NOI/NPV/value, MIN OPEX/CapEx/risk/payback and three Pareto templates over explicitly defined finite alternatives.
- Historical demand fitting, deterministic intent guidance, optional provider-neutral AI proposal adapter, and enforced model lifecycle transitions.

MAX RevPAR Flow v1.0 technical baseline is LOCKED, recorded in `release/flow-baseline.json`, after analytic checks and end-to-end behavioral validation under the user's delegated implementation instruction. This is a technical implementation baseline, not independent business or valuation certification. Locked source hashes are preserved and cannot be silently overwritten.

Financial bridge and forecast conventions are specified in `FINANCIAL_MODEL_CONTRACT.md`; they are technically tested but not permanently financially locked. All features, task-number mappings, evidence and runtime limitations are recorded in `IMPLEMENTATION_AUDIT.md` and `artifacts/validation/manifest.json`.

Application entry: `dist/index.html`; local command: `npm start`. There are 16 analysis templates. No market inputs are fabricated, no financial formula is delegated to an LLM, and optimization never changes exogenous valuation assumptions.
