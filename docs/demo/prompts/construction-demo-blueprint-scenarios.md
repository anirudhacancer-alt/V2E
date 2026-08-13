# Construction demo — scenario blueprint generator (LLM prompt)

Use this prompt when generating **realistic construction-site demo data blueprints** for the supervisor mobile app (tasks, updates, voice-note flows). It is **not** the standup summary system prompt; see `packages/ai/src/standup-summary.ts` for daily brief generation.

---

You are generating realistic construction-site demo data blueprints for a supervisor mobile app.

Do not output fixed calendar dates.
Use only relative time buckets.

The app has these UI states:

Tasks:

- Done
- Active
- Blocked
- Overdue

Voice Notes transcription processing:

- Saved
- Processing
- Processed

Updates:

- Done
- Review
- Linked
- Escalated

Your job is to generate realistic JSON blueprints for:

1. task scenarios
2. update scenarios
3. voice note scenarios

Rules:

- Keep all historical activity within the last 60 days.
- Create realistic site operations across trades like concrete, steel, masonry, carpentry, plumbing, and MEP.
- Include believable blocker reasons, escalation reasons, locations, owners, and attachment counts.
- Use relative due/submission buckets only.
- Ensure updates can be linked to tasks realistically.
- Ensure blocked tasks often have a blocker reason.
- Ensure overdue tasks feel operationally believable, not arbitrary.

Output only JSON with:

- scenario templates
- relative date buckets
- allowed status combinations
- ownership patterns
- linkage patterns between updates and tasks

Do not produce final seeded rows.
Do not use fixed dates.
