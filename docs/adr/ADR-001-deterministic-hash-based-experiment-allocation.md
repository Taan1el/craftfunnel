# ADR-001: Deterministic Hash-Based Experiment Allocation

## Status
Accepted

## Context
High-traffic SaaS applications frequently run A/B experiments across millions of visitors. Traditional assignment methods either:
1. Require synchronous database writes for every anonymous visit, creating database bottlenecks.
2. Rely entirely on client-side cookies or localStorage, which fail across devices and in server-side rendered contexts.

## Decision
We implemented a deterministic hash-based variant allocation algorithm:
$$\text{Bucket} = \text{SHA256}(\text{userId} + \text{":"} + \text{experimentKey}).\text{readUInt32BE}(0) \pmod{100}$$

1. **Stateless & Deterministic**: The same user ID and experiment key always map to the exact same bucket without requiring prior database lookups.
2. **Configurable Weighting**: Buckets ($0..99$) are mapped against variant weights (e.g. $0..49 \to \text{Control}$, $50..99 \to \text{Variant A}$).
3. **Audit Persistence**: When evaluated, the allocation is persisted in `experiment_allocations` to enable conversion attribution and customer timeline inspection.
4. **Statistical Significance**: A 2-proportion Z-score with normal cumulative distribution approximation is calculated live to report confidence levels and identify winners ($\ge 95\%$).

## Consequences
- Zero cross-device variant hopping.
- Minimal database overhead during variant evaluation.
- Statistically sound experimentation framework conforming to modern growth engineering standards.
