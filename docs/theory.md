# Theory map

English | [日本語](theory.ja.md)

This document is informative. It maps theory families to implementation decisions in `responsible`; it is not a requirement to implement every theory in v0.

## Implementation roles

| Theory family                               | Role in `responsible`                                                                                                                                                                                                  | v0 or future                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Category theory                             | Supports Activity composition and projection as compositional structure. `seq` returns another Activity, and boundary projection is a structure-preserving view where possible.                                        | v0 concept; future formalization          |
| Design by Contract                          | Gives runtime meaning to `requires`, `ensures`, and reviewable invariants.                                                                                                                                             | v0 runtime checking                       |
| Hoare Logic                                 | Gives the target semantics for proving pre/post condition chains such as `ensures_A => requires_B`.                                                                                                                    | Future static verification                |
| Process algebra / LTS                       | Provides hiding, observable action, `tau`, weak bisimulation, and quotient vocabulary for RBNF.                                                                                                                        | v0 explanation; future graph verification |
| DDD / Bounded Context                       | Helps explain Responsibility Boundary as a model and language boundary, but Responsibility Boundary is not identical to Bounded Context. It can also represent organization, role, system, or composite boundary axes. | v0 explanation                            |
| BPMN / RACI / swimlane                      | Communication and visualization layers. They help readers understand views and responsibility assignment, but they are not the semantic core.                                                                          | Downstream view layer                     |
| Petri Net / Workflow Net                    | Candidate basis for reachability, soundness, branching, merging, and parallel workflow verification after v0 linear projection.                                                                                        | Future verification                       |
| Abstract Interpretation / Galois connection | Candidate basis for lossy projection, abstraction, concretization limits, and view consistency.                                                                                                                        | Future formalization                      |

## Decisions supported

Category theory supports two core decisions: an Activity can be composed into a larger Activity, and projection can be treated as a disciplined mapping from detailed structure to view structure. The current implementation keeps this practical: plain TypeScript functions and JSON-compatible values.

Design by Contract supports v0 runtime checks. `requires` and `ensures` are meaningful predicates even when they are opaque functions. Hoare Logic is intentionally separated as future work because static proof needs symbolic predicates, not only callbacks or prose.

Process algebra and LTS provide the vocabulary for RBNF. Same-boundary internal steps are hidden as `tau`; boundary-crossing effects are observable actions; weak bisimulation describes the future target for comparing projected graphs. Current v0 only performs linear same-boundary collapse.

DDD and Bounded Context are useful for explaining why boundaries matter. They do not define the whole model. A Responsibility Boundary can be a person, team, role, system, company, project/function pair, or other selected responsibility expression.

BPMN, RACI, and swimlane notation belong to communication and visualization. A lane view may look familiar to BPMN readers, and RACI may help discuss responsibility, but `responsible` is not a BPMN runtime or RACI chart tool.

Petri Net and Workflow Net theory become more important when the model grows past linear flows. They are candidates for future reachability, deadlock/livelock, and workflow soundness checks.

Abstract Interpretation and Galois connection terminology is relevant because projection is intentionally lossy. A projected view may be consistent and useful without containing enough information to reconstruct the original model.

## References

- C. A. R. Hoare, "An Axiomatic Basis for Computer Programming" (1969): supports the future static proof target for pre/post condition chains. https://dl.acm.org/doi/10.1145/363235.363259
- Bertrand Meyer, "Applying Design by Contract" (1992): supports v0 runtime contract vocabulary and invariant discipline. https://ieeexplore.ieee.org/document/161279/
- Brendan Fong and David I. Spivak, "Seven Sketches in Compositionality" (2019): supports compositional modeling and projection vocabulary. https://arxiv.org/abs/1803.05316
- Robin Milner, "Communication and Concurrency" (1989): supports process algebra vocabulary for hiding, observable behavior, and future equivalence checking.
- Martin Fowler, "Bounded Context" (2014): supports the boundary explanation while preserving the distinction from Responsibility Boundary. https://martinfowler.com/bliki/BoundedContext.html
- Object Management Group, "Business Process Model and Notation (BPMN) Version 2.0.2" (2014): supports treating BPMN as a communication and visualization reference, not the semantic core. https://www.omg.org/spec/BPMN/2.0.2/About-BPMN
- Wil M. P. van der Aalst, "The Application of Petri Nets to Workflow Management" (1998): supports future Workflow Net and Petri Net verification directions. https://research.tue.nl/en/publications/the-application-of-petri-nets-to-workflow-management/
- Patrick Cousot and Radhia Cousot, "Abstract Interpretation: A Unified Lattice Model for Static Analysis" (1977): supports future formalization of lossy projection and consistency through abstraction.
