# Aegis Arena — ETHGlobal Final Pitch and End-to-End Demo Runbook

## 1. Core story I should tell

My project, **Aegis Arena**, is a **CLI-first multi-agent security simulation framework built on 0G**. It is designed for a future where DeFi teams do not just read threat reports after an exploit happens, but continuously run autonomous adversarial simulations against their own protocol assumptions.

The key idea is simple:

1. a user onboards with a wallet through the CLI,
2. the user defines a simulation or training loop,
3. autonomous agents run red-team / blue-team / judge style interactions using the **0G inference framework and 0G SDK**,
4. the system publishes operational visibility to the main web application,
5. the operator can inspect threat-intel, agent behavior, inference readiness, runtime configuration, and what should happen next.

This is not just a dashboard and not just a CLI. The differentiation is the bridge between:

- wallet-native onboarding,
- command-driven simulation control,
- 0G-powered inference and future fine-tuning surfaces,
- persistent threat-intel ETL,
- explainable multi-agent behavior shown in a web control plane.

The strongest framing for ETHGlobal is:

> “We turn protocol defense into an interactive, wallet-native, agentic control loop. A builder can log in from the CLI, launch a red-team simulation, and immediately see the runtime state, threat context, and operator posture inside the web app.”

---

## 2. The one-sentence pitch

**Aegis Arena lets a protocol team onboard through a wallet-native CLI, run 0G-backed multi-agent red-team simulations, and monitor training, inference readiness, threat intelligence, and operator actions from a live web control plane.**

---

## 3. What the judges should understand in the first 30 seconds

At the beginning of the demo, I should establish five things immediately:

1. **This is wallet-native** — the user starts from the CLI and authenticates with browser wallet, Ledger, or Privy.
2. **This is simulation-native** — the user does not just “view analytics”; they define and run security scenarios.
3. **This is 0G-native** — the simulation and agent stack is framed around the 0G SDK, inference readiness, storage, and future fine-tuning flows.
4. **This is multi-agent** — adversary, defender, operator/CTO/CISO, and judge roles can be shown as coordinated actors in one control loop.
5. **This is operational** — after login and simulation start, the main web app becomes the control plane for status, updates, ETL intelligence, and actionability.

If I anchor the demo in those five claims, every screen and command afterward will feel coherent.

---

## 4. Recommended final demo structure

The strongest live demo order is:

1. **Open with the problem** — DeFi security is reactive, fragmented, and difficult to operationalize.
2. **Introduce Aegis Arena** — CLI-first, wallet-native, multi-agent, 0G-backed.
3. **Show wallet onboarding in the CLI** — browser wallet / Ledger / Privy.
4. **Show simulation definition** — choose protocol, choose inference mode, choose episode/step budget, optionally define the adversarial prompt.
5. **Run the workflow** — login, web sync, ETL refresh, simulation execution.
6. **Switch to the web application** — explain that the web app is the live control plane after the operator authenticates.
7. **Show what is visible after login** — agent runs, training rounds, inference posture, ETL threat feed, operator readiness, runtime settings.
8. **Show the strategic value** — this is how a protocol team can continuously red-team itself.
9. **Close with the future** — on-chain settlement, stronger 0G storage, retained memory, fine-tuning, and autonomous policy adaptation.

That order keeps the overall framework almost the same as what already exists. It only changes the **narrative**, not the architecture.

---

## 5. Pre-demo checklist I should complete before recording or presenting

Before the final demo, I should make sure these are ready:

### CLI readiness

- The CLI is globally installed or linked.
- `aegis --help` works.
- `aegis workflow run --help` works.
- If I plan to use Privy, I already have a valid access token.
- If I plan to use browser wallet, the local signing flow opens correctly.
- If I plan to use Ledger, the Ledger is connected and unlocked.

### Web readiness

- The deployed web app loads correctly.
- Login/session sync from CLI to web is working.
- The dashboard page loads without stale or empty state.
- The ETL page has data or bounded live preview data.
- The modules page shows 0G readiness and environment posture.
- The settings page shows enough environment readiness to support the story.

### Data readiness

- I have at least one good protocol slug prepared for the demo, such as `rhea-finance`.
- I know whether I want to run `og-mock` or a more realistic inference mode.
- I decide whether to show a single simulation run or a training-oriented loop.
- I know the exact prompt I want to use for the adversary strategy.

### Presentation readiness

- I keep the terminal font large.
- I keep browser tabs ready: dashboard, ETL, modules, settings.
- I know the short explanation for each page.
- I avoid live improvisation around env variables or broken setup.

---

## 6. Exact showcase narrative I should use

### Opening narrative

I should say something close to this:

> “Most security workflows in crypto are still passive. Teams read reports, collect postmortems, and maybe run one-off audits. Aegis Arena turns that into an agentic loop. A user authenticates from a wallet-native CLI, defines a security scenario, runs a multi-agent simulation over 0G-backed inference, and then monitors the entire operation from a web control plane.”

Then immediately continue with:

> “The important part is not just that agents run. The important part is that the operator can track what those agents are doing, what threat intelligence is coming in, what the runtime posture is, and what actions should be taken next.”

That transitions perfectly into the CLI.

---

## 7. Step-by-step CLI onboarding flow I should show

This is the first major product proof. I need to show that onboarding is not a fake front end. It is a real operator workflow.

### Step 1 — Explain why onboarding starts in the CLI

I should say:

> “We start in the CLI because this is meant for protocol operators, security researchers, and engineering teams. The CLI is the control surface where they authenticate, choose their simulation mode, and launch real security experiments.”

This establishes that the CLI is intentional, not just developer-only tooling.

### Step 2 — Show wallet-native login

Use:

```bash
aegis login wallet
```

Then explain:

- browser wallet is the easiest wallet-native onboarding path,
- Ledger is for high-trust operator workflows,
- Privy is for smoother app-linked authentication.

Say explicitly:

> “The user does not need to start by manually creating some custom Safe-specific setup. They can begin with the wallet they already control and bind that identity into the Aegis workflow.”

This is a very important point because it reduces friction and makes the product feel real.

### Step 3 — Show that the CLI session syncs into the web control plane

Use:

```bash
aegis login sync-web --base-url https://aegis-0g-openagents-hackathon.vercel.app
```

Then explain:

> “This step bridges the operator identity from the CLI into the web app. After that, the web application becomes the live control plane for the simulation and the operator state.”

This is where I should emphasize that I have **one coherent product**, not two disconnected demos.

---

## 8. Step-by-step simulation definition flow I should show

This is the second major proof: the user is not just authenticating; they are defining security behavior.

### Step 1 — Introduce the workflow command

Use:

```bash
aegis workflow run --base-url https://aegis-0g-openagents-hackathon.vercel.app
```

Before executing, explain what it does:

1. authenticates the operator,
2. syncs the session to the web app,
3. optionally refreshes threat-intel ETL,
4. launches the simulation run.

This command is excellent for a demo because it compresses the end-to-end product into one memorable action.

### Step 2 — Show the simulation parameters

The best demo version is something like:

```bash
aegis workflow run \
	--base-url https://aegis-0g-openagents-hackathon.vercel.app \
	--auth browser \
	--inference og-mock \
	--episodes 1 \
	--steps 8 \
	--slug rhea-finance
```

When I show this command, I should explain each parameter in product language:

- `--auth browser` means the operator can onboard with the wallet flow most users already understand.
- `--inference og-mock` means I can demo the inference loop deterministically and reliably.
- `--episodes 1` means a single bounded scenario for presentation.
- `--steps 8` means a multi-turn attack/defense exchange rather than one shallow output.
- `--slug rhea-finance` means I am grounding the simulation in a specific protocol context.

### Step 3 — Explain the adversarial scenario definition

This is where I should frame the product more ambitiously, even if today it is partly encoded through scenario choice and prompt structure.

I should say:

> “The user can define the red-team objective — for example, simulate a governance capture attempt, price manipulation setup, bridge failure path, oracle desynchronization, or coordination failure between operators. The point is to let the operator shape the adversarial prompt and observe how the attacker, defender, and judge agents react.”

Even if the current implementation is not yet a fully polished prompt-builder UI, this is still consistent with the architecture. The prompt and scenario are already the natural control surface.

### Step 4 — If I want to show training rather than just a single run

Use:

```bash
aegis workflow train \
	--base-url https://aegis-0g-openagents-hackathon.vercel.app \
	--inference og-mock \
	--rounds 2 \
	--variants 3 \
	--episodes 1 \
	--steps 8 \
	--slug rhea-finance
```

Then explain:

> “A single run gives me one red-team episode. Training mode lets me iterate across variants and rounds so the policy can be stress-tested against multiple strategies.”

This is the cleanest way to introduce **training rounds** in the demo.

---

## 9. How I should explain the 0G story during the CLI run

When the workflow is executing, I should clearly connect my product to 0G.

### What to say

> “The simulation layer is designed around the 0G stack. We use the 0G SDK posture for inference readiness, authenticated compute, storage, memory persistence, and future fine-tuning. That means this is not a generic chatbot demo — it is a security workflow that can progressively bind into decentralized AI infrastructure.”

Then simplify it for the judges:

- 0G inference powers agent decision loops,
- 0G runtime readiness is surfaced in the product,
- 0G storage and memory become the persistence layer for retained simulation context,
- 0G fine-tuning is the path toward improving the agents over time.

That explanation is both technically grounded and easy to follow.

---

## 10. Exactly what I should show in the web app after login

This is the most important part of the whole showcase. The CLI proves entry and control. The web app proves visibility and orchestration.

After I finish login and launch the workflow, I should switch to the web app and explain that the operator has moved from **command mode** into **control plane mode**.

### Primary claim to make

> “Once the simulation is launched from the CLI, the main web application becomes the place where I monitor the current state of the agent system — training rounds, inference posture, ETL-driven threat context, environment readiness, and future on-chain execution signals.”

This is the exact bridge the judges need to understand.

---

## 11. How to present the dashboard page

The dashboard is the best page to present as **mission control**.

### What I should say

> “This dashboard is the operator overview. It summarizes the current protocol posture, recent runs, runtime state, and quick access into the live intelligence and 0G operational surfaces.”

### What the dashboard already supports conceptually

Based on the current app structure, I should frame it this way:

- the hero and metric cards represent **current system state**,
- the charts panel represents **simulation and protocol trend visibility**,
- the pipeline panel represents **what data is flowing through the system**,
- the auth/vector section represents **identity binding and memory**,
- the protocol and run tables represent **which simulations ran and what happened**.

### How to connect this to the user request

When I am on the dashboard, I should explicitly say:

> “This is where the operator can see whether a simulation has been launched, which protocol it targets, how recent runs are behaving, and what should be investigated next. In the product vision, this is also where training round status, agent-level inference state, and on-chain cost/payment traces roll up into one operational view.”

That phrasing is honest and aligned with the current framework.

---

## 12. How to present training rounds in the current product without major rewrites

The user specifically wants training rounds clearly shown after login. To do this without breaking the app, I should use a **minimal refactor / relabeling strategy**, not a full redesign.

### Recommended framing

I should present the **run table** as the visible surface for training lifecycle updates.

I should say:

> “Each run corresponds to a bounded simulation or training execution. The next small product step is to expose each round and variant directly inside this table or in an adjacent activity feed. That does not require a major architecture change — it is mainly a matter of making the run metadata more explicit in the UI.”

### What to implement with minimal change

If I want to tighten the scenario quickly, I should add or relabel fields such as:

- round number,
- variant id,
- active role set,
- inference mode,
- last update timestamp,
- status: queued / running / judged / completed.

This keeps the framework the same and only strengthens the story.

---

## 13. How to present inference status in the current product

The user also wants inference status clearly shown. The current app already has a strong place for this: the **Modules** and **Settings** pages.

### What I should say on the Modules page

> “This page surfaces the 0G operational posture: Galileo connectivity, authenticated compute, storage, memory persistence, and fine-tuning readiness. So when the simulation runs on the CLI, this page gives the operator confidence that the inference stack is ready and that the system can support more advanced agent workflows.”

### Why this works well already

The modules page already communicates:

- 0G network and runtime readiness,
- authenticated compute posture,
- memory/storage readiness,
- fine-tuning readiness,
- operator task list.

That means I do **not** need a dramatic rewrite. I only need to frame it more explicitly as the **inference and agent runtime status page**.

### Minimal-change enhancement recommendation

To make the story stronger, I should eventually rename or relabel one section to something like:

- “Inference Status”,
- “Agent Runtime Readiness”, or
- “0G Execution Posture”.

That is a copy and data-mapping refinement, not a deep architectural change.

---

## 14. How to present on-chain activity and agent payments

The user specifically wants to mention on-chain activity for agent payments. I should handle this carefully and present it in a roadmap-grounded way unless I already have all the traces visible live.

### Safe way to present it

I should say:

> “Aegis Arena is designed so that the economic layer of the agents can also be observed. As the agent framework matures, the operator can track payment-related activity, execution provenance, and cost visibility alongside the simulation lifecycle. In the current framework, the right place to surface that is in the same run/status layer that already tracks simulation activity and 0G readiness.”

### Minimal-change implementation path

Without changing the app dramatically, I can add a lightweight payment/status strip showing:

- payer or session wallet,
- transaction hash or payment reference,
- cost per inference batch or run,
- settlement status,
- last payment event timestamp.

The best place for that is:

- inside the run table,
- in the dashboard metric strip, or
- as a compact “On-chain activity” card.

This preserves the overall framework and strengthens the ETHGlobal demo significantly.

---

## 15. How to present attack vectors and live threat updates

This part is already one of the strongest existing pages: the **ETL page**.

### What I should say

> “Our simulation is not operating in a vacuum. The ETL workspace continuously normalizes external threat intelligence from sources like Rekt and Solodit, so the operator can keep current exploit patterns and findings in view while deciding what adversarial scenarios to test.”

### What the ETL page currently proves

The ETL page already gives me a very strong narrative because it shows:

- recent incidents,
- external findings,
- severity buckets,
- ETL job history,
- refreshability.

### How to connect ETL to simulation

I should say:

> “These latest attack vectors can directly inspire the next red-team prompt. So an operator sees a fresh exploit pattern in the ETL feed, then immediately launches a scenario in the CLI to test whether their own protocol posture would survive the same class of attack.”

That line connects the web intelligence layer back to the CLI action loop beautifully.

---

## 16. How to present the adversary nodes in the multi-agent framework

The user wants the ability to showcase adversary nodes in the multi-agent framework. I should present this as one of the central pieces of the product identity.

### What I should say

> “The platform is multi-agent by design. We can model adversarial nodes, defense-oriented nodes, operator/coordinator nodes, and evaluation or judge nodes. The point is not one LLM making one answer. The point is a structured conflict environment where each role has different incentives and responsibilities.”

### How to map this onto the existing product

Without changing the framework dramatically, I should describe the roles like this:

- **Attacker / Adversary node** — proposes exploit paths, coordination tactics, and pressure strategies.
- **Defender / CTO / CISO node** — evaluates impact, containment options, and remediation priorities.
- **Judge node** — scores outcomes, compares policies, and determines whether the defense succeeded.
- **Operator** — the human user steering the red-team prompt and deciding what to do next.

### Minimal UI refactor that fits the current app

I do not need a new architecture. I mainly need to expose role labels more explicitly in:

- run metadata,
- charts or activity feed,
- scenario summary cards.

Even a simple “active agents in this run” block would make this much clearer.

---

## 17. How to present the CTO / CISO / operator action layer

The user specifically wants to show how the CTO is stable and able to take action. I should translate that into a clean operator narrative.

### Best framing

> “The operator side of Aegis Arena is not passive. The defensive agent layer represents executive or security ownership: recognizing the threat, measuring risk, coordinating remediation, and deciding when to escalate or intervene.”

### How to say it concretely

> “So the attacker agent is not the whole story. We also model the response side — what a CTO, CISO, or protocol operator should do under pressure. This lets us test not only whether an exploit path exists, but whether the organization can react coherently.”

This is a very strong demo claim because it moves the project from “AI attacks smart contracts” to “AI simulates organizational resilience.”

### Minimal feature shaping needed

To make this more obvious in the current framework, I should keep the overall system unchanged and just:

- label the defensive role more explicitly,
- surface “recommended action” or “next operator action” in the dashboard or run detail,
- let the prompt mention the defensive objective.

That is a small extension, not a rewrite.

---

## 18. How to present user-defined red teaming prompts

This is an important point to emphasize because it makes the system flexible.

### What I should say

> “The user can define the kind of red-team pressure they want to simulate. For example: an oracle manipulation strategy, governance coordination attack, bridge timing exploit, liquidity poisoning attempt, or social-engineering-assisted operator confusion. This gives the system a concrete adversarial objective and lets the other agents respond.”

### Example prompt framing I can use during the demo

I can say something like:

> “In this run, I want the adversary to test a coordinated oracle desynchronization strategy against a DeFi protocol while the defensive agent tries to preserve user funds and maintain operational continuity.”

That sounds sophisticated but still matches the existing architecture.

### Minimal implementation direction

To support this better without major changes, I only need:

- a clearer scenario prompt argument in the CLI, or
- a scenario template list that maps to a prompt behind the scenes.

This keeps the current framework almost fully intact.

---

## 19. The exact live demo sequence I should follow

Below is the cleanest end-to-end sequence for ETHGlobal.

### Part A — Start with the product identity

Say:

> “Aegis Arena is a wallet-native, CLI-first DeFi security simulator built on 0G. It lets an operator authenticate, run multi-agent adversarial scenarios, and inspect the resulting system state from a web control plane.”

### Part B — Show CLI onboarding

Run:

```bash
aegis login wallet
```

Then explain the wallet choice.

### Part C — Sync into the web app

Run:

```bash
aegis login sync-web --base-url https://aegis-0g-openagents-hackathon.vercel.app
```

Then say:

> “Now the operator identity is available inside the control plane.”

### Part D — Launch the end-to-end workflow

Run:

```bash
aegis workflow run \
	--base-url https://aegis-0g-openagents-hackathon.vercel.app \
	--auth browser \
	--inference og-mock \
	--episodes 1 \
	--steps 8 \
	--slug rhea-finance
```

If I want a stronger training story, use:

```bash
aegis workflow train \
	--base-url https://aegis-0g-openagents-hackathon.vercel.app \
	--inference og-mock \
	--rounds 2 \
	--variants 3 \
	--episodes 1 \
	--steps 8 \
	--slug rhea-finance
```

### Part E — Move to the dashboard

Say:

> “The CLI is where I initiate the operation. The dashboard is where I monitor it.”

Then explain the dashboard as the main overview for runs, telemetry, and operator posture.

### Part F — Move to ETL

Say:

> “This page gives me the live exploit and finding context that can inform what scenario I test next.”

### Part G — Move to Modules

Say:

> “This is the 0G execution and inference posture. It tells me whether the stack is ready for authenticated compute, storage, memory, and future fine-tuning.”

### Part H — Move to Settings

Say:

> “This page gives me deployment and runtime trust signals: identity binding, vector setup, artifact storage, and environment posture.”

### Part I — Close with the value proposition

Say:

> “So the outcome is not just that an AI generated some text. The outcome is that a protocol operator can log in, define a red-team objective, run an agentic simulation, and inspect the resulting system state in a way that is operationally useful.”

---

## 20. What I should claim as “already working” vs “next minimal step”

To stay credible, I should separate what already exists from what is the immediate near-term polish.

### Already working and safe to claim

- wallet-first CLI onboarding,
- CLI-to-web session sync,
- packaged workflow command,
- threat-intel ETL surface,
- web control plane pages,
- 0G runtime and readiness framing,
- multi-agent simulation orientation,
- training-oriented workflow direction.

### Best framed as immediate next-step polish

- richer training round activity feed,
- more explicit agent-role visibility,
- payment/on-chain event card,
- prompt templates exposed more clearly in the CLI or UI,
- more explicit run-by-run inference telemetry.

This is important because it keeps the demo ambitious without overselling implementation detail.

---

## 21. Minimal refactor plan that keeps the framework intact

The user asked for a comprehensive refactor direction that does not break the existing framework. This is the best path.

### Refactor goal

Do **not** rebuild the architecture. Instead, refine the current product so the ETHGlobal narrative becomes obvious.

### Refactor principle

**Keep the CLI flow, keep the pages, keep the 0G posture pages, keep ETL, keep the control plane. Only tighten naming, metadata visibility, and operator framing.**

### Minimal-change refactor backlog

#### A. Dashboard refinements

- Relabel the dashboard as the primary **Mission Control** or **Operator Overview** surface.
- Add or relabel a compact section for:
	- current run status,
	- current round,
	- active agent roles,
	- inference mode,
	- last action.
- Add a compact “On-chain activity / cost visibility” card if payment traces are available.

#### B. Run metadata refinements

- Extend run records with:
	- round,
	- variant,
	- role summary,
	- adversarial objective,
	- status,
	- last update.
- Keep the existing run table structure and just enrich the row payload.

#### C. Prompt / scenario refinements

- Add a clearer CLI argument or config for scenario objective.
- Provide 3–5 built-in scenario templates for demos:
	- oracle manipulation,
	- governance attack,
	- bridge compromise,
	- liquidity drain setup,
	- operator confusion / response stress test.

#### D. Modules page refinements

- Reframe one section as **Inference Status**.
- Reframe one section as **Agent Runtime Readiness**.
- Keep the exact same data sources and layout wherever possible.

#### E. ETL page refinements

- Add a short callout that says: “Use these findings to seed the next red-team prompt.”
- Keep the current ETL architecture and page almost unchanged.

#### F. Operator action refinements

- Add a small “recommended action” summary derived from the latest run.
- This can be static or heuristic at first; it does not require a major model rewrite.

This plan is strong because it gives the product a sharper identity while preserving almost everything already built.

---

## 22. Suggested final verbal script for the judges

If I want a concise but polished script, I should say something close to this:

> “This is Aegis Arena, a wallet-native multi-agent security simulator built on 0G. Instead of waiting for incidents and postmortems, a protocol operator can log in from the CLI, define a red-team scenario, and launch an adversarial simulation. The agents can represent attackers, defenders, and evaluators. Once the workflow starts, the main web app becomes the control plane where I inspect the latest runs, the threat-intel ETL feed, the 0G inference posture, and the operational state of the system. So the core value is not just AI generation — it is turning security testing into a continuous, explainable, agentic workflow.”

That script is strong, accurate, and memorable.

---

## 23. My recommended final positioning statement

To end the presentation, I should say:

> “Aegis Arena gives crypto teams a new security primitive: wallet-native autonomous red teaming with visible operator control. The CLI is the launch surface, 0G is the intelligence substrate, and the web app is the operational control plane.”

That is the cleanest closing line for ETHGlobal.

---

## 24. Final practical recommendation

If I want to ship this showcase quickly without major breakage, I should **not** redesign the product. I should:

1. keep the existing CLI workflow,
2. keep the dashboard / ETL / modules / settings page split,
3. enrich the wording and run metadata,
4. frame the dashboard as operator mission control,
5. frame ETL as the live attack-vector feed,
6. frame Modules as the 0G inference and runtime readiness layer,
7. frame Settings as trust and deployment posture,
8. optionally add a small payment/on-chain activity summary,
9. optionally add explicit adversarial prompt templates.

This gets me to a polished ETHGlobal-ready scenario with **minimal architectural change** and **maximum narrative clarity**.
