# Activity, Requires, Ensures, Effect

English | [日本語](activity-effects.ja.md)

Responsible is a notation in which state transitions arise from the composition of responsible Activities, rather than being drawn as a state-transition diagram.

This document defines a minimal vocabulary for describing change in the world centered on Activity, without treating data mutation, side effects, or mutation itself as the central concept.

## Minimal vocabulary

```text
Activity = Activity
requires = precondition (requires)
ensures  = established fact (ensures)
effect   = Effect
```

## Activity

An Activity is an activity performed by a responsible party.

```text
Activity
  = an activity performed by a responsible party,
    inside a Responsibility Boundary
```

An Activity is not merely a data operation.

An Activity is performed against a world that satisfies its preconditions, and establishes new facts upon completion.

```text
Activity:
  a world that satisfies the preconditions
    -> a world in which new facts are established
```

## Requires

`requires` is a condition that must already be established for an Activity to start responsibly.

```text
requires = precondition
```

Example:

```text
activity "Submit application" by "Applicant" {
  requires {
    Application.status = draft
    RequiredFields = complete
  }
}
```

This means the following.

```text
Given that the application is a draft and the required fields
are complete, the Applicant can perform the Activity
"Submit application."
```

A precondition is not merely an input.

```text
input / uses
  values used for judgment or the activity itself

requires / precondition
  a condition that must hold in the world for the activity to
  be valid
```

## Ensures

`ensures` is a fact that is established in the world after an Activity completes.

```text
ensures = established fact
```

Example:

```text
activity "Submit application" by "Applicant" {
  ensures {
    Application.status = submitted
    SubmissionFact(Application, Applicant) = true
  }
}
```

This means the following.

```text
Completion of the Activity establishes the facts that the
application has been submitted, and that the Applicant
submitted it.
```

An established fact is not a DB update or an object mutation.

```text
Expressions to avoid:
  update Application.status submitted
  insert SubmissionHistory

Expression in Responsible:
  Application.status = submitted is established
  SubmissionFact(Application, Applicant) = true is established
```

The implementation may end up as an update / insert / event append.
But in Responsible's primary vocabulary, we write the facts established
in the world after the Activity, not the operation itself.

## Effect

An Effect is a result of an Activity becoming observable across a Responsibility Boundary.

```text
An Effect is a result of an Activity becoming observable
across a Responsibility Boundary.
```

The Japanese term for this concept is `作用`.

```text
effect = Effect
```

Example:

```text
activity "Submit application" by "Applicant" {
  requires {
    Application.status = draft
    RequiredFields = complete
  }

  ensures {
    Application.status = submitted
    SubmissionFact(Application, Applicant) = true
  }

  effects {
    ApprovalRequest to Manager
  }
}
```

This means the following.

```text
The fact "the application has been submitted," established within
the Applicant's Responsibility Boundary, becomes observable from
the Manager's Responsibility Boundary as an approval request.
```

An Effect changes the world.

However, what matters in Responsible is not writing the change to the
world as a low-level mutation. What matters is that a fact established
inside one Responsibility Boundary becomes observable from another
Responsibility Boundary.

## Composition of Activities

Activities are connected through ensures and requires.

```text
Activity A ensures X
Activity A effects X to Boundary B
Activity B requires X
```

In other words:

```text
What A ensures becomes what B requires.
```

This connection lines up Activities in sequence.

```text
Create application
  -> Submit application
  -> Approve application
  -> Start next process
```

The state transition is derived from this sequence of Activities.

```text
absent -> draft -> submitted -> approved
```

Responsible does not take the state transition as its direct subject.
The state transition arises from the composition of Activities.

## Correspondence with the functional paradigm

Read through the lens of the functional paradigm, an Activity looks like this:

```text
Activity : World -> (World, Effect[])
```

However, the Effect is not hidden inside the Activity and executed implicitly.
The Effect is made explicit as a value.

In Responsible, the correspondence is as follows.

```text
requires
  the condition of the world before entering the Activity

ensures
  the fact established in the world after the Activity

effects
  the Effect by which that established fact becomes observable
  across a Responsibility Boundary
```

## Data / State / Mutation

Responsible's primary vocabulary does not treat mutation as the central concept.

```text
Data
  = a value

State
  = the set of facts established in the world at a given point
    in time

Mutation
  = an implementation-level change operation
```

What Responsible writes is not the operation, but the fact established after the activity.

Example:

```text
activity "Approve application" by "Manager" {
  requires {
    Application.status = submitted
    ApprovalAuthority(Manager, Application) = true
  }

  ensures {
    Application.status = approved
    ApprovalFact(Application, Manager) = true
  }

  effects {
    ApprovalResult to Applicant
    NextProcessRequest to Accounting
  }
}
```

What matters here is not `update Application.status`.

What matters is the following.

```text
Through the Manager's Activity, the facts are established that the
application has been approved, and that the Manager approved it.

This established fact acts as an Effect on the Responsibility
Boundaries of the Applicant and Accounting.
```

## Summary

```text
An Activity is performed against a world that satisfies its
preconditions.
Completion of an Activity establishes new facts.
An Effect is that established fact becoming observable across a
Responsibility Boundary.
The state transition arises from the composition of responsible
Activities.
Mutation is an implementation view, not Responsible's primary
vocabulary.
```
