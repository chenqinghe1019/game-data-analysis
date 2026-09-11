# SQL Review Checklist

Use this checklist before returning any final SQL from `game-data-sql-analyst`.

## 1. Project and source

- [ ] Project name is resolved.
- [ ] Table suffix is the current project suffix.
- [ ] User table / event table match the project config.
- [ ] Event names and field names were read from current repository knowledge or the user-provided schema.
- [ ] No field or table was guessed when a source exists.

## 2. Cohort and dates

- [ ] Cohort anchor is correct: create-role date, server-open date, activity start, or another explicit anchor.
- [ ] ThinkingData dynamic date selector is used as a complete condition in a scope that contains `"$part_date"`.
- [ ] Event table scan covers the requested observation horizon.
- [ ] Registration-date filters do not accidentally truncate D2+ events.
- [ ] D1/D2 numbering matches the current topic definition.

## 3. Maturity

- [ ] The requested metric requires mature samples unless explicitly overridden.
- [ ] For D1-DN, cohort anchor + N - 1 <= yesterday.
- [ ] Immature dates/servers/cycles are excluded from the DN metric rather than partially accumulated.

## 4. Metric definition

- [ ] Daily vs cumulative is explicit and implemented correctly.
- [ ] Numerator is correct.
- [ ] Denominator is correct.
- [ ] User counts use `count(distinct ...)` when measuring players/accounts.
- [ ] First-day payment is not replaced by historical/cumulative payment unless requested.
- [ ] Payment tier boundaries match the current project/topic rule.
- [ ] Retention, participation, purchase rate, pass rate, ARPU, ARPPU, LTV, and share metrics use the intended population.

## 5. Payments and units

- [ ] Payment event is correct.
- [ ] Payment unit is correct for the project.
- [ ] `/100` is applied only where repository rules say payment is stored in cents.
- [ ] Product/package mapping uses the current dimension table or mapping rule.
- [ ] NULL / zero-payment / payment_method-empty cases follow current requirements.

## 6. Joins and identity

- [ ] `#account_id`, `#user_id`, `nb_open_id`, `#varchar_id`, `#long_id`, role_id, and other IDs are not mixed.
- [ ] Join types are compatible; casts are intentional.
- [ ] Current cluster tables and historical tag tables use the correct identifier rule.
- [ ] `LEFT JOIN` vs `INNER JOIN` does not unintentionally change the denominator.
- [ ] Join multiplicity will not duplicate payment or player counts.

## 7. Trino / ThinkingData correctness

- [ ] No `WITH` / CTE unless explicitly requested.
- [ ] No `USING`; use explicit `ON`.
- [ ] Event-table partition pruning is retained where required.
- [ ] Timestamp / double / varchar conversions match the actual project schema.
- [ ] `from_unixtime` is used only for Unix numeric timestamps.
- [ ] Array / JSON / row expressions are valid Trino syntax.

## 8. Output

- [ ] Final response contains the full runnable SQL by default.
- [ ] Chinese aliases are used where consistent with the user's style.
- [ ] Same-type D1-D7/D30 columns are grouped together unless otherwise requested.
- [ ] Money display is normally rounded to 2 decimals.
- [ ] Ratios are not automatically multiplied by 100.
- [ ] Auxiliary calculation fields are not exposed unless useful.
- [ ] Requested dimensions, summary rows, ordering, and output range are all present.

## 9. Modification consistency

For requests such as “这个也改”“跟上一个一样”“同样逻辑”:

- [ ] The latest sibling/canonical SQL was located first.
- [ ] Unrequested cohort, maturity, payment-tier, and join logic stayed the same.
- [ ] Only the requested business object or metric definition changed.
- [ ] Equivalent metrics across related SQLs now use the same implementation.

## 10. Knowledge sync

- [ ] Did the user establish a reusable new rule or correction?
- [ ] If yes, classify it as global / project / topic / reusable SQL.
- [ ] Update the corresponding GitHub source.
- [ ] Do not store one-off temporary filters as permanent rules.
