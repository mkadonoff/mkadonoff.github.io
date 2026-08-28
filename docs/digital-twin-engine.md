# Pod Tower — a digital twin engine for RPG Squarefoot Solutions

Status: **plan, not started.** Nothing in this document is built yet. It defines a geometry, a data
model, a runtime, and a phased path from a static prototype in this repository to a transactable
Microsoft Marketplace offer.

---

## 1. The idea in one paragraph

RPG's operating model is rendered as a **campus**: three hexagonal towers — Finance/Ops, Sales,
Marketing — arranged around a shared **Central Axis**. Every hexagonal prism (**Pod**) in a tower is
one EOS accountability seat, held by exactly one human or one AI agent. Work is not a row in a
queue; it is a **Customer Pod** that physically traverses the campus — around a floor as it moves
through process stages, up a tower when it escalates, across a skybridge when it hands off to
another function. Where a customer pod is, how long it has sat there, and which seat owns it are the
same fact, expressed once. The tower is not a picture of the business. It is the control surface.

## 2. Geometry

### 2.1 The pod

A hexagonal prism has eight faces, and each one is a **port** with fixed meaning. Port semantics are
structural, not decorative — every state transition in the engine consumes exactly one port, and a
transition with no port is not expressible.

| Port | Count | Meaning |
| --- | --- | --- |
| Inward (hub-facing) | 1 | Handoff to the floor's hub pod — coordination, exceptions, arbitration |
| Lateral | 2 | Handoff to the two adjacent seats on the same floor ring — the normal next stage |
| Outward | 3 | External: skybridge to another tower, customer/vendor intake, Central Axis dock |
| Up | 1 | **Escalate** — to the seat directly above, at higher decision authority |
| Down | 1 | **Delegate** — return to the seat below |

This falls out of honeycomb geometry rather than being imposed on it. In a ring of six hexes around
a center, each perimeter hex touches the center on one face and two neighbours on two faces, leaving
exactly three faces free. Those three free faces are the external ports. The count is a property of
the tiling, which means the model cannot silently acquire an unaudited handoff path.

### 2.2 Floor, tower, campus

- **Floor** = 1 hub pod + 6 seat pods in a ring = **7 pods**. A floor that outgrows six seats grows a
  second ring (12 more, 19 total) rather than sprouting an eighth face.
- **Tower** = **6 floors** = 42 pods minimum.
- **Campus** = 3 towers + 1 Central Axis (6 levels of shared workgroup pods) = **132 pods**.

### 2.3 What the three axes mean

The single most important design decision here: the three spatial axes are not interchangeable
decoration. Each carries one distinct semantic, and nothing else.

| Axis | Symbol | Meaning | Movement means |
| --- | --- | --- | --- |
| Ring position | θ | Process stage | Normal progress through the workflow |
| Level | z | Decision authority | **Escalation** (up) or delegation (down) |
| Radius | r | Perimeter seat → hub → Central Axis | Pulling in shared or cross-functional capability |

The consequence is that a customer pod's path is a **helix**, and its shape is diagnostic on sight.
A flat spiral is a clean deal. A path that keeps climbing is a deal in trouble. A path that keeps
crossing to the Central Axis is a deal consuming disproportionate shared capacity. You can read
account health off the trajectory without a report.

**Elevation is exception.** In a healthy month most customer pods never leave level 1–2.

### 2.4 Levels as decision authority

| Level | Seat class | Typical occupant |
| --- | --- | --- |
| L6 | Vision | Visionary + Integrator |
| L5 | Leadership | Leadership Team — the LMA seats |
| L4 | Management | Department managers |
| L3 | Senior specialist | Designers, senior AEs, project managers |
| L2 | Coordinator | Order desk, scheduling, campaign ops |
| L1 | Autonomous | AI agents and deterministic automation |

L1 is where AI agents live by default and where most work should complete. An escalation from L1 to
L2 is the machine saying *I could not close this*, and the L1→L2 rate per seat is the single most
useful quality metric the engine produces.

## 3. The three towers

Each tower's six ring positions are its process stages. A customer pod enters at θ1 and exits at θ6.

**Marketing Tower — market to lead.** Audience/ICP → Campaign → Content → Engagement → Scoring →
Sales handoff.

**Sales Tower — lead to order.** Qualification → Discovery → Design & specification → Proposal →
Negotiation → Close.

**Finance/Ops Tower — order to cash and delivery.** Order acceptance → Procurement → Receiving →
Install scheduling → Punch & closeout → Invoice & cash.

Given RPG's two lines of business, a customer pod carries a **line-of-business facet** that changes
which seats it docks with inside the same stage: office equipment routes procurement through
manufacturer acknowledgment and warehouse receiving; construction technology services routes it
through jobsite readiness and commissioning. Same geometry, different occupants — this is what keeps
one campus serving both businesses rather than forcing a fork.

**Skybridges.** Marketing→Sales and Sales→Finance/Ops bridges land at **L3**, the senior specialist
floor, and are gated. A handoff is a real approval by a real seat, not a status flip. Service and
warranty re-entry runs Finance/Ops→Finance/Ops via a dedicated return bridge, so a warranty call is
visibly a *re-entry* and not a new deal.

## 4. The Central Axis and EOS

RPG runs on EOS, so the Central Axis is the operating system itself, and its six levels are the Six
Key Components. Towers are the value streams; the axis is what holds them accountable.

| Level | Key Component | Shared workgroup pod | Holds |
| --- | --- | --- | --- |
| L1 | **Data** | Telemetry & Data | Every measurable the engine emits |
| L2 | **People** | People & Capacity | Seat roster, GWC ratings, installer/PM capacity |
| L3 | **Process** | Process & Pricing | Documented core processes, margin desk |
| L4 | **Issues** | Issues | The live issues list |
| L5 | **Traction** | Scorecard & Rocks | Weekly scorecard, 90-day Rocks, the L10 room |
| L6 | **Vision** | Vision & Traction | V/TO, 1-year plan, quarterly priorities |

### How EOS artifacts map

- **Accountability Chart → the campus itself.** One pod, one seat, one name. EOS's rule that a seat
  has exactly one accountable person becomes a structural invariant: a pod with zero or two holders
  fails validation and the engine refuses to publish the graph.
- **Scorecard → pod measurables.** Each pod exposes one to three weekly measurables; floors roll up
  to towers, towers to the L5 Scorecard pod. Off-track measurables tint the pod on sight.
- **Rocks → pod state.** A 90-day Rock is attached to the accountable seat's pod and visible on it.
- **L10 agenda → generated, not typed.** This is the highest-value output of the whole engine. Every
  customer pod that breached a dwell SLA, every off-track measurable, and every escalation that
  reached L4 automatically drops an Issue into the L4 Issues pod with its evidence attached. The
  Monday L10 opens with an agenda the business produced by operating, and IDS resolutions write back
  as process changes on the L3 Process pod.

### The accountability problem with AI seats

EOS accountability is a human commitment; an agent cannot hold it. So every AI-occupied pod carries
a **human accountable owner** — a named person in a different pod who answers for that seat's output
at L10. The agent occupies the seat; the human owns it. This is a hard rule, enforced in the schema
(`accountableOwner` is non-null on every pod whose occupant is an agent), not a guideline. Without
it the engine quietly launders responsibility, which is worse than having no engine.

## 5. Azure architecture

### 5.1 System of record — decide this first

**Dataverse is the system of record. Azure Digital Twins is a projection.**

Azure Digital Twins is a live graph and eventing surface, not a workflow engine, not a rules engine,
and not a durable business database. Treating it as a second source of truth alongside Dynamics
creates a dual-write reconciliation problem that will consume the project. ADT earns its place as
the spatial index, the simulation sandbox, and the thing the 3D console queries — and it can be
rebuilt from Dataverse at any time. If ADT is ever dropped, the business keeps running.

### 5.2 Components

| Layer | Service | Role |
| --- | --- | --- |
| Record | **Dataverse / Dynamics 365** | Sales (opportunity), Business Central or F&O (order, PO, invoice), Field Service (install, warranty) |
| Spatial graph | **Azure Digital Twins** | DTDL v3 models; live pod/customer-pod graph; adjacency as relationships |
| Orchestration | **Durable Functions** | One orchestration instance per customer pod; dwell timers; SLA breach; escalation |
| Eventing | **Event Grid** | Dataverse change → ADT patch; ADT event route → writeback and Teams cards |
| History | **ADT Data History → Azure Data Explorer** | Dwell time, cycle time, escalation rate; Power BI on top |
| Agents | **Azure AI Foundry Agent Service** | One agent per AI pod: instructions, tools, knowledge index, tracing, evaluations |
| Knowledge | **Azure AI Search** over SharePoint | Per-pod scoped index; a pod sees only its own corpus |
| Human surface | **Teams + SharePoint** | Team per tower, channel per pod; Adaptive Card approvals; SharePoint library per pod |
| Identity | **Entra ID** | Managed identity per agent; Dataverse row-level security follows seat, not user |

### 5.3 Flow of a single transition

1. A seat completes its stage — a human taps an Adaptive Card in Teams, or an L1 Foundry agent
   finishes its tool call.
2. Dataverse writes the authoritative state change on the customer pod row.
3. A Dataverse plugin raises an Event Grid event.
4. A Function patches the ADT twin: the customer pod's `locatedAt` relationship moves to the next
   pod through a named port.
5. The Durable Functions orchestration for that customer pod cancels the old dwell timer and arms
   the next one.
6. ADT's event route pushes the change to the console over SignalR; the pod visibly moves.
7. Data History lands the dwell duration in ADX for the scorecard.

The port used in step 4 is validated against the pod's eight-port table. An attempted transition
with no legal port is rejected and logged as a process defect — which is exactly the kind of thing
that should reach the L4 Issues pod.

### 5.4 DTDL model sketch

```
dtmi:rpg:podtower:Campus;1        contains → Tower, CentralAxis
dtmi:rpg:podtower:Tower;1         contains → Floor          | function: Sales|Ops|Marketing
dtmi:rpg:podtower:Floor;1         contains → Pod            | level: 1..6
dtmi:rpg:podtower:Pod;1           axial q,r | portMap[8] | adjacentTo → Pod (with port name)
                                  occupiedBy → Agent | accountableOwner → Person
                                  measurables[] | rocks[] | dwellSlaMinutes
dtmi:rpg:podtower:Agent;1         kind: human|ai | foundryAgentId? | gwc{get,want,capacity}
dtmi:rpg:podtower:CustomerPod;1   locatedAt → Pod | dataverseRef | lineOfBusiness
                                  enteredAt | slaState | trajectory[]
dtmi:rpg:podtower:Bridge;1        connects → Pod, Pod | gatedBy → Pod
```

`adjacentTo` is generated from axial coordinates, never hand-authored. The generator is the only
thing that may create adjacency, which is how the port invariant stays true.

### 5.5 Known constraints, stated up front

- ADT has no native temporal query. Anything historical goes through Data History into ADX — plan
  the ADX cluster and its cost from day one, not as an afterthought.
- ADT query limits make "walk the whole campus" queries expensive. The console loads the static
  structure once and subscribes to deltas; it must never poll the graph.
- Foundry agent handoffs are not transactional. A handoff that must not be lost goes through
  Dataverse and the orchestrator, not agent-to-agent.
- Reverse-engineering dwell time depends on Dynamics stage hygiene. If stages are updated in batches
  on Friday, every cycle-time number the engine produces is fiction. Audit this before Phase 1.

## 6. Marketplace packaging

The intent is to sell this on the Microsoft Marketplace as a Dynamics 365 offer, which imposes a
constraint worth knowing before any code is written:

**Dataverse ISV license management only meters model-driven app components.** A standalone React 3D
console is not a licensable component and cannot be entitlement-gated by that mechanism. The fix is
architectural and must be decided now, not retrofitted: build the console as a **PCF control hosted
in a custom page inside a model-driven app**. The 3D canvas keeps working exactly as designed, and
it becomes a component the licensing metadata can actually see.

Because Phase 0 now connects directly to Dataverse, this decision is taken at Phase 0 rather than
here — the PCF shape is also the cheapest way to get a live connection at all (§7.1). By the time
this section applies, the packaging work is mostly already done.

The shape of the offer:

- **Dynamics 365 apps on Dataverse and Power Apps** offer in Partner Center, carrying the managed
  solution with license plan metadata and entitlement definitions.
- Azure-side components (ADT, Functions, ADX, Foundry) deployed into the **customer's** subscription
  via an ARM/Bicep template — they pay their own Azure consumption, RPG licenses the IP.
- Per-seat plans that map to pod occupancy, which is the natural meter here: customers pay for pods
  they staff.
- Microsoft's security, compliance and quality review applies. Budget real calendar time for it.

Open question to resolve before Phase 5: whether the Azure-side deployment is better as a separate
Azure Managed Application listing or folded into the solution's setup experience. This affects
support boundaries and should be answered with Partner Center, not guessed.

## 7. Phasing

**Phase 0 — Live twin console (kill gate).** No Azure. A PCF control in a model-driven app in a
Dataverse development environment, reading live through `context.webAPI`: hex axial coordinate
maths, the 132-pod campus in Babylon.js, and a scrubbable 90-day replay built from audit history.
Still TypeScript and npm, so it can live in this repository — but it is a `pac pcf init` project, not
a Vite site, and it does not deploy to GitHub Pages. See §7.1–§7.4.

**Phase 1 — The graph substrate, if §7.5 says you need it.** DTDL models, an ADT instance, the
Dataverse schema, and the Dataverse → Event Grid → ADT projection, with the console switched from
direct queries to the twin graph. Phase 0 already delivers real data read-only, so this phase is
about structure and scale — and it should be deferred or dropped outright if none of the four
conditions in §7.5 hold.

**Phase 2 — Movement.** Durable Functions traversal engine, dwell SLAs, escalation, Teams Adaptive
Card approvals writing back to Dataverse. Sales and Marketing towers added. The campus becomes a
control surface rather than a display.

**Phase 3 — Agents in seats.** Three L1 Foundry agents only, chosen for low blast radius: quote QA,
install schedule assist, MQL triage. Each with a named human accountable owner, Foundry evaluations,
and full tracing. Expand only on measured L1→L2 escalation rates.

**Phase 4 — EOS layer.** Scorecard rollup, Rocks on pods, and the auto-generated L10 agenda. This is
where the engine stops being an ops tool and becomes how RPG runs.

**Phase 5 — Marketplace.** PCF/custom-page repackaging, license metadata, Bicep for the Azure side,
Partner Center certification.

### 7.1 Phase 0 connects directly to Dataverse

No export, no fixtures. Phase 0 reads live, which is better for the gate than a snapshot would have
been: a frozen extract is stale by the second week, and the two-week unprompted-use check in §7.4 is
precisely the half a stale page cannot pass.

It also leaks less, which is the opposite of most people's intuition. A CSV extract is one person's
copy of everything they can see, shared as a file that stops honouring row-level security the moment
it is saved. A live connection runs as the signed-in user, shows each viewer exactly what their own
security role permits, and puts nothing on disk.

**Take the PCF decision now, at Phase 0, not at Phase 5.** §6 establishes that the console must end
up as a PCF control in a custom page inside a model-driven app, because that is the only shape
Dataverse ISV license management can meter. Building it that way from the first commit also happens
to be the cheapest way to connect directly:

| | PCF in a model-driven app **(recommended)** | Static SPA on GitHub Pages |
| --- | --- | --- |
| Auth code | None — the user is already signed in | MSAL.js, Entra app registration, SPA redirect URI |
| Consent | None | `Dynamics CRM user_impersonation`, usually needs an admin |
| CORS | Not applicable — same origin | Supported by Dataverse for SPAs, but one more thing to debug |
| Data API | `context.webAPI` | Web API over `fetch` with a bearer token |
| Governance | Stays inside the tenant | A public `github.io` origin registered against production Dataverse |
| Rework at Phase 5 | None — already the shipping shape | Rebuild the shell |

The static-SPA route is genuinely viable; Dataverse does support CORS for MSAL-authenticated SPAs.
Keep it as the fallback if a Dataverse development environment cannot be had within a week. It buys
a faster inner loop and pays for it with an app registration, an admin-consent conversation, a
security review of a public origin pointed at production data, and a rebuild at Phase 5.

The cost of the recommended route is a slower inner loop: the PCF test harness mocks
`context.webAPI`, so seeing real data means pushing to the development environment. Budget for that
instead of Vite hot reload.

Phase 0 is **read-only by construction** — it issues GET and nothing else. Writeback is Phase 2.

### 7.2 Dwell time still depends on auditing, and that is now a day-one query

Connecting directly does not conjure stage history. Dataverse holds three things that resemble it,
and only one carries timestamps:

- **Audit** — the only general source of *when* a stage changed, via `RetrieveRecordChangeHistory` or
  a query against the `audit` table. Retention defaults to indefinite, though many tenants have since
  configured a shorter window.
- **`traversedpath`** on business-process-flow records — the ordered list of stage GUIDs a record
  passed through, with no times attached. Good for the path, useless for dwell.
- **Explicit date columns** — actual close date, work-order dates, invoice dates. Precise where they
  exist, and they cover only a handful of transitions.

So the first thing Phase 0 does, before any geometry, is one query: is auditing enabled on the stage
columns of Opportunity, Order and Work Order, and does retained history cover ninety days?

**Auditing cannot be backfilled.** If it was off, the honest answer is that dwell time is unavailable
until ninety days after someone turns it on — and turning it on this week then becomes the single
highest-value action in this document, worth doing whether or not Pod Tower is ever built. This is
the same finding as the stage-hygiene risk in §8; connecting directly does not remove it, it just
means you learn it on day one from a query instead of on week three from a spreadsheet.

### 7.3 What the tower shows that a report does not

- **Dwell encoded in the same object as stage.** The funnel says eleven orders are in Procurement.
  The tower shows that four arrived this week and one has sat for 41 days. The report requires you to
  already suspect the 41-day order in order to go and find it.
- **Seats and work in one picture.** In EOS the Accountability Chart is a separate slide from the
  Scorecard. Here they are the same object: a seat with fourteen customer pods docked and one person
  in it needs no utilisation calculation, and a vacant L4 with work piling up beneath it reads as a
  hole in the building.
- **Escalation that is systematic rather than incidental.** Scrub the ninety days and watch the lift.
  If every construction-technology order climbs to L4 at commissioning and no office-equipment order
  ever does, that is a process defect to point at rather than argue about.
- **Handoff leakage at the skybridges.** Count what enters the Marketing→Sales bridge against what
  lands. That number is a perennial issues-list argument currently settled by anecdote.

A report gives a number per period. The scrub gives the motion between periods, which is the one
thing reports cannot do.

### 7.4 How the gate is actually run

A demo is not a gate. Failure has to be possible, and defined before anyone sees the tower.

**The exercise.** Give each member of the leadership team the same five questions they would
normally answer from reports — *which deal is most at risk and why; where is the worst bottleneck;
who is over capacity; what belongs on Monday's L10; where did we lose the most between marketing and
sales* — and have them answer using only the tower, with nobody driving for them.

**Pass.** They answer faster than they do today, or the tower surfaces something they did not already
know. The strongest signal is that they stop looking at it and start operating it: "can I filter by
line of business?" is a pass, not a feature request.

**Fail.** They navigate by the flat list, so the geometry is adding nothing. Or they cannot find
anything without someone at the keyboard, so it is not legible. Or everything they point at is
something they already knew, so it is a prettier report.

**The second half is time, not the meeting.** Leave it up for two weeks, then ask each of them
directly whether they opened it unprompted, and what for. Model-driven app usage telemetry could
answer this, but a plain question put to five or six people is faster and less arguable. Nobody
opening it unprompted is the clearest fail available — and it is worth two to three weeks to learn
that, rather than learning it after Phase 2.

### 7.5 If the console reads Dataverse directly, what is ADT for?

A fair question, and Phase 0 sharpens it rather than dodging it. Direct queries are entirely adequate
for a read-only view of a few hundred live records. Azure Digital Twins earns its cost only if at
least one of these turns out to be true:

1. The adjacency and port graph needs to be **queryable structure**, rather than something the client
   recomputes from axial coordinates on every load.
2. Many viewers need **real-time push**, rather than each browser polling Dataverse.
3. Someone wants **what-if simulation** — moving pods on a copy of the graph without touching
   production.
4. Dwell and cycle-time analytics need **temporal history** at a volume Dataverse should not serve.

If Phase 0 passes its gate and none of the four hold, the correct decision is to drop ADT and keep
the console on Dataverse. That saves an ADT instance and an ADX cluster, and nothing else in this
plan breaks — which is exactly why §5.1 makes ADT a projection rather than a system of record.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| **The tower becomes a demo toy.** 3D org visualisations are notorious for impressing once and never being opened again. | Every pod must be clickable into a real action, and every view must have a flat list equivalent. The geometry may never be the *only* way to do a job. The §7.4 gate — live data, defined failure conditions, a two-week unprompted-use check — exists to catch this before any spend. |
| Dual source of truth between ADT and Dynamics | Dataverse is authoritative; ADT is rebuildable. Stated in §5.1 and enforced by making all writes go to Dataverse first. |
| AI seats launder accountability | `accountableOwner` non-null on every agent pod, enforced in schema. |
| Stage hygiene in Dynamics is poor, making all cycle-time output fictional | Now a day-one query in Phase 0 (§7.2) rather than an audit before Phase 1. Auditing cannot be backfilled, so if it is off, enabling it this week is the finding. |
| Marketplace licensing cannot meter the console | Resolved by the PCF-in-model-driven-app decision in §6 — but only if taken now. |
| Six levels of authority may exceed RPG's actual org depth | Levels may be sparsely occupied; an empty L4 is legal and renders as an open seat, which is itself useful information for the Accountability Chart. |

## 9. What to decide before Phase 1

1. Run the Phase 0 gate exactly as specified in §7.4, and treat a fail as a fail. It is the only
   point at which this project can be killed cheaply.
2. Is auditing on the stage columns of Opportunity, Order and Work Order, and does retained history
   reach back ninety days? One query, and it blocks everything downstream (§7.2).
3. Who provisions the Dataverse development environment, and how quickly? A week or less and Phase 0
   is a PCF control; longer and it falls back to the static SPA and a rebuild at Phase 5 (§7.1).
4. Confirm ADT + ADX running cost at RPG's volume against the value of the spatial layer.
5. Which three seats become the first AI pods, and who owns each of them by name.
6. Marketplace: single Dataverse offer with bundled Azure deployment, or two listings?
