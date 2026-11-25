---
name: architect
description: "Sketch two shapes for a change (types, signatures, module boundaries) before code, and pick the one with the cleanest ownership. Use for /architect, 'architect this', 'design this', or non-trivial work where jumping to code would lock in the wrong shape."
---

# Architect

Trace every touched system with the **how** skill before sketching shapes. Then, before writing code, sketch two different shapes for the change (types, signatures, module boundaries), screen both against [`references/design-red-flags.md`](references/design-red-flags.md), and pick the one where each piece of state has one owner, each task has one way to do it, and callers need to know least. Redesign instead of patching if workarounds repeat.

For genuinely open one-way-door architecture, run the **arena** skill instead of sketching alone, so blind competing shapes break anchoring. For a concrete design or plan big enough to settle before it goes to the operator, converge it per [`../poteto-mode/references/converge-a-design.md`](../poteto-mode/references/converge-a-design.md).
