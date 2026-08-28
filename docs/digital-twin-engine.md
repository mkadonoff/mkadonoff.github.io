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

**Phase 0 — Static twin console (this repository).** No Azure, no cost, no auth. A React + Vite +
TypeScript app on GitHub Pages, matching the toolchain already here. Hex axial coordinate math, the
132-pod campus rendered in Babylon.js, a fixture graph in JSON, and a simulated customer pod
traversal with a scrub bar. The goal is to prove the geometry is legible and the metaphor is useful
*before* provisioning anything. If the tower does not make the business more understandable to
RPG's leadership team on a laptop, no amount of Azure will save it. This is a genuine kill gate.

**Phase 1 — One tower, real data, read-only.** DTDL models, an ADT instance, the Dataverse schema,
and the Finance/Ops tower populated from live Dynamics data. No writeback. The measure of success is
that operations recognises their own week in it.

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

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| **The tower becomes a demo toy.** 3D org visualisations are notorious for impressing once and never being opened again. | Every pod must be clickable into a real action, and every view must have a flat list equivalent. The geometry may never be the *only* way to do a job. Phase 0 exists to test this before spend. |
| Dual source of truth between ADT and Dynamics | Dataverse is authoritative; ADT is rebuildable. Stated in §5.1 and enforced by making all writes go to Dataverse first. |
| AI seats launder accountability | `accountableOwner` non-null on every agent pod, enforced in schema. |
| Stage hygiene in Dynamics is poor, making all cycle-time output fictional | Audit before Phase 1. If hygiene is bad, fixing it *is* Phase 1. |
| Marketplace licensing cannot meter the console | Resolved by the PCF-in-model-driven-app decision in §6 — but only if taken now. |
| Six levels of authority may exceed RPG's actual org depth | Levels may be sparsely occupied; an empty L4 is legal and renders as an open seat, which is itself useful information for the Accountability Chart. |

## 9. What to decide before Phase 1

1. Does the Phase 0 prototype actually help leadership see the business? (Kill gate.)
2. Is Dynamics stage data clean enough to compute dwell time honestly?
3. Confirm ADT + ADX running cost at RPG's volume against the value of the spatial layer.
4. Which three seats become the first AI pods, and who owns each of them by name.
5. Marketplace: single Dataverse offer with bundled Azure deployment, or two listings?
