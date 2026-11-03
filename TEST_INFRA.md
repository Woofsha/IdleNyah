# TEST_INFRA.md — IdleNyah E2E Testing Infrastructure

## 1. Test Philosophy

IdleNyah's End-to-End (E2E) testing infrastructure follows three foundational testing doctrines:

### 1.1 Opaque-Box Testing
Tests interact exclusively through public API contracts, public state accessors, serializable data transfers, and external assets. Tests treat the internal simulation logic, calculations, and scene graph as an opaque system:
- Assertions evaluate observable outputs (resource deltas, unlock status, caught creature rosters, save JSON integrity, asset existence, and dialogue texts).
- No mocking of internal math helpers or monkey-patching private engine members.
- If an API or feature changes its internal implementation while honoring the public contract, the tests continue to pass without modification.

### 1.2 Requirement-Driven Verification
Every single test case directly traces to a requirement defined in `ORIGINAL_REQUEST.md` (R1 through R6) and the 26 features cataloged in `PROJECT.md`. No orphan tests exist. Every test specifies its requirement ID, feature ID, and expected observable behavior.

### 1.3 Progressive Testability
Because IdleNyah separates the headless Pure TypeScript Simulation Engine (`src/core/`) from the PixiJS v8 View Layer (`src/render/`) and Web Audio Layer (`src/audio/`), the E2E test suite can run progressively:
- **Headless Execution**: Economy, progression, creature state machine, and persistence run in standard Node.js without requiring a browser, GPU, or WebGL context.
- **Contract & Asset Validation**: View layer configs (scaleMode, canvas options, spritesheet manifests) and Audio layer parameters (frequencies, volume clamps) are verified via contract inspection.
- **Speed & Determinism**: The entire test suite of over 120 test cases executes within 2-4 seconds, enabling continuous feedback during development and milestone audits.

---

## 2. Feature Inventory Mapping

All 26 features from `PROJECT.md` are mapped to requirements R1–R6, their implementation milestones, and their corresponding test tiers and test suites:

| Feature # | Feature Name | Requirement | Milestone | Target Tier | Test Suite File |
|:---:|:---|:---:|:---:|:---:|:---|
| **F01** | Tooling & Packaging Setup | R1 | M1 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F02** | Pure Simulation State Engine | R1, R3 | M1 | Tier 1, 2, 4 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F03** | Currency & Click Mechanics | R3 | M1 | Tier 1, 2, 3 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F04** | Fifi Chore Facilities (8 facilities) | R2, R3 | M1 | Tier 1, 2, 3 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F05** | Nyah Management Multipliers (4 multipliers) | R2, R3 | M1 | Tier 1, 2, 3 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F06** | Territory & Mansion Data Model (5 tiers) | R3 | M1 | Tier 1, 2, 3 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F07** | Creature Simulation & Spawning (10 species) | R4 | M1 | Tier 1, 2, 3 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F08** | Save/Load & Persistence | R3 | M1 | Tier 1, 2, 3 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F09** | PixiJS v8 App Initialization | R1, R5 | M2 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F10** | Asset Pipeline & PokeNyah Import | R5 | M2 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F11** | World Scene Graph & Y-Sorting | R1, R5 | M2 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F12** | Maid Character Animations | R2, R5 | M2 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F13** | Mansion Multi-Phase Visuals | R3, R5 | M3 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F14** | Outdoor Territory Grounds View | R3, R5 | M3 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F15** | Territory Expansion Unlocks | R3 | M3 | Tier 1, 2, 3 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F16** | Interactive Estate Clicks | R3 | M3 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F17** | Original Creature Pixel Art | R4, R5 | M4 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F18** | Wild Creature Spawning & Movement | R4 | M4 | Tier 1, 2, 3 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F19** | Interactive Creature Catching | R4 | M4 | Tier 1, 2, 3 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F20** | Creature Habitats & Assignments | R4 | M4 | Tier 1, 2, 3 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F21** | Pixel-Art HUD & UI Panels | R1, R5 | M5 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F22** | Dual-Tier Dialogue System | R2 | M5 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F23** | Cozy Audio Engine | R5 | M5 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F24** | Documentation & Cute Notes | R6 | M5 | Tier 1, 2 | `tests/e2e/tiers/tier1_feature_coverage.test.ts` |
| **F25** | Full E2E Test Suite | R1–R6 | M-Final | Tiers 1–4 | `tests/e2e/runner.ts` |
| **F26** | Adversarial Hardening | R1–R6 | M-Final | Tiers 2–4 | `tests/e2e/tiers/tier2_boundary_corner.test.ts` |

---

## 3. Test Architecture & Runner Invocation

### 3.1 Four-Tier Testing Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        IdleNyah E2E Test Suite                         │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 1: Feature Coverage (Isolation)                                  │
│  - >= 5 test cases per core feature (R1 - R6)                          │
│  - Verifies basic mechanics: click, buy, unlock, spawn, catch, save    │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 2: Boundary & Corner Cases (Robustness & Extreme Inputs)         │
│  - >= 5 test cases per feature covering edge conditions                │
│  - Zero/negative inputs, large numbers, boundary caps, invalid IDs     │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 3: Cross-Feature Combinations (Pairwise & System Interactions)   │
│  - Clicking + Facilities + Multipliers + Territory + Habitat Buffs     │
│  - Save / Load roundtrips with active states, frenzy, and offline math │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 4: Real-World Gameplay Scenarios (End-to-End Simulations)        │
│  - Multi-minute simulated playthroughs from fresh start to endgame     │
│  - Verifies pacing, progression milestones, and economic balance       │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Invocation Commands

All tests are executable via Vitest runner or via custom E2E runner in Windows PowerShell:

```powershell
# Run the entire E2E test suite (all tiers)
npx.cmd vitest run tests/e2e

# Run a specific tier
npx.cmd vitest run tests/e2e/tiers/tier1_feature_coverage.test.ts
npx.cmd vitest run tests/e2e/tiers/tier2_boundary_corner.test.ts
npx.cmd vitest run tests/e2e/tiers/tier3_cross_feature.test.ts
npx.cmd vitest run tests/e2e/tiers/tier4_real_world_scenarios.test.ts

# Run the standalone E2E runner script
npx.cmd tsx tests/e2e/runner.ts
```

---

## 4. Real-World Application Scenarios (Tier 4)

The Tier 4 suite simulates realistic player interactions over extended timelines to verify gameplay pacing, balance, and stability:

### Scenario A: "From Dusty Porch to Country Kitchen" (Starter Phase)
- **Duration**: Simulated 0 to 15 minutes of play.
- **Player Actions**: Active clicking on porch, triggering Tsundere Frenzy, purchasing first Fifi Broom and Feather Duster, accumulating 500 gold and 25 chores, unlocking Country Kitchen & Herb Garden (`zone_02_kitchen_garden`).
- **Invariants**: Gold strictly increases, unlock requirements validated, wild `dust_bunny` spawns and caught with free petting, habitat assignment boosts passive gold.

### Scenario B: "Watering the Whispering Pond" (Mid-Game Expansion)
- **Duration**: Simulated 15 to 45 minutes of play.
- **Player Actions**: Automating treats from kitchen oven, harvesting herbs for nature essence, purchasing multi-buy 10x/25x Fifi facilities, unlocking Whispering Pond (`zone_03_pond_courtyard`), baiting wild `puddle_duck` and `lilypuff` with Maid Treats.
- **Invariants**: Bulk purchase costs match closed-form geometric series, pond unlocks passive essence generation, creature boosts accelerate chore completion.

### Scenario C: "Nyah's Royal Library & Supervision" (Late-Game Escalation)
- **Duration**: Simulated 45 to 120 minutes of play.
- **Player Actions**: Accumulating 85,000 gold and 200 essence, unlocking Royal Library (`zone_04_library_balcony`), purchasing Nyah's management multipliers (Stern Inspection, Tea Lounge, Strict Budgeting), catching `breeze_finch` in Aviary Perch.
- **Invariants**: Multipliers compound exponentially, budget discount lowers territory unlock costs, critical hit chance cap and overflow conversion operate accurately.

### Scenario D: "The Starlight Empire & Full Estate Grand Slam" (End-Game Mastery & Persistence)
- **Duration**: Simulated several hours compressed into discrete tick blocks (including a 12-hour offline simulated hiatus).
- **Player Actions**: Unlocking Enchanted Orchard (`zone_05_orchard_sanctuary`) and Starlight Observatory (`zone_06_starlight_observatory`), assigning creatures across all habitats, capturing mythic `star_cat`, saving game state to JSON, closing session, simulating 43,200 seconds of offline time, reloading from save string.
- **Invariants**: Offline catch-up applies passive gains with Nyah's Royal Catnap efficiency bonus, save/load state retains 100% data fidelity, zero NaN or infinite resource corruptions.

---

## 5. Coverage Thresholds

| Metric | Minimum Required | Target |
|:---|:---:|:---:|
| **Requirements Covered (R1–R6)** | 100% (6/6) | 100% |
| **Features Covered (F01–F26)** | 100% (26/26) | 100% |
| **Tier 1 Tests per Core Feature** | $\ge 5$ tests | $\ge 6$ tests |
| **Tier 2 Tests per Core Feature** | $\ge 5$ tests | $\ge 6$ tests |
| **Tier 3 Cross-Feature Matrices** | $\ge 10$ matrices | $\ge 12$ matrices |
| **Tier 4 Real-World Scenarios** | $\ge 4$ scenarios | 4 scenarios |
| **Total Test Count** | $\ge 100$ tests | $\ge 120$ tests |
| **Execution Time** | $< 10$ seconds | $< 5$ seconds |
