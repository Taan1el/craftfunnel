# ADR-003: Funnel Step Conversion Aggregations and Drop-Off Analytics

## Status
Accepted

## Context
Understanding the customer journey from anonymous landing visit to paying subscriber requires tracking multi-stage conversion funnels. Calculating drop-off percentages and identifying the greatest drop-off bottleneck is crucial for growth engineering teams prioritizing roadmap initiatives.

## Decision
1. **Append-Only Event Log**:
   Funnel events are stored in `funnel_events` recording `customer_id`, `stage`, optional metadata JSON, and timestamps.
2. **Indexed Cohort Aggregations**:
   A composite index on `(customer_id, stage)` and `(stage)` enables efficient `COUNT(DISTINCT customer_id)` queries grouped by stage.
3. **Sequential Metric Pipeline**:
   The funnel service transforms raw counts into:
   - Total unique customers reaching stage $i$.
   - Cumulative conversion rate relative to the initial `visited` stage: $\frac{\text{count}_i}{\text{count}_{\text{visited}}}$.
   - Sequential drop-off rate from previous stage $i-1$: $\frac{\text{count}_{i-1} - \text{count}_i}{\text{count}_{i-1}}$.
4. **Automated Bottleneck Detection**:
   The client-side visualizer detects the stage with the highest drop-off rate and dynamically flags it as a priority growth optimization target.

## Consequences
- Historical event integrity preserved through append-only logging.
- Real-time conversion and drop-off analytics without heavy external BI tooling.
