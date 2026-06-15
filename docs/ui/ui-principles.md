# Draftlet UI Principles

Draftlet is a writing tool. Its UI should feel calm, professional, readable, and focused. It should help users understand context, compare drafts, refine wording, and insert only what they approve.

Avoid flashy novelty. Draftlet should feel like a dependable browser-native assistant with a local runtime, not a decorative overlay.

## Product Feel

Draftlet should be:
- calm
- modern
- minimal without feeling empty
- readable during long writing sessions
- explicit about state and actions
- trustworthy around insertion and edits

The UI should support serious writing workflows: reviewing context, drafting replies, refining tone and length, answering all source questions, and preserving user control.

## Token Ownership

Draftlet-owned tokens define visual decisions for:
- color
- typography
- spacing
- radius
- shadow
- focus states

Use semantic tokens where possible. Add or change tokens only when the choice should be reused across surfaces. Do not let Tailwind one-offs, shadcn defaults, or local component styles become competing visual systems.

## Typography

Use a clear hierarchy:
- screen or panel titles identify the workspace or major view
- section headings help scan context, drafts, variants, and controls
- body text prioritizes reading comfort
- metadata and status text are smaller but still legible
- action labels are direct and specific

Writing surfaces need comfortable line length and spacing. Do not use dense, tiny typography for draft review, source summaries, or refinement history.

## Spacing, Radius, and Shadow

Use one spacing scale, one radius scale, and one shadow scale.

- Prefer consistent gaps over hand-tuned spacing per component.
- Use radius to support the design system, not to make every element decorative.
- Use shadows sparingly for layering and focus, not as a default card style.
- Avoid nested card-heavy layouts for primary workflows.

Repeated UI patterns should use shared primitives or wrappers once repetition becomes meaningful.

## Surface Density

### Inline UI
Inline UI on webpages should be tiny, unobtrusive, and context-aware. It may signal Draftlet availability or trigger a workflow, but it must not become the main app.

### Popup
The popup should be compact. It is for status, quick actions, shortcuts, runtime availability, and opening the side panel. It should not carry multi-step drafting workflows.

### Side Panel
The side panel is the primary workflow surface. It should support source summary, thread continuity, streaming drafts, follow-up instructions, variants, review, insertion, and retry states.

Use medium density: enough structure for repeated use, enough space for writing and review.

### Desktop
Desktop UI is operational. It should support onboarding, runtime setup, model/runtime controls, logs, diagnostics, settings, and tray-related behavior.

Desktop can be denser than the side panel for diagnostics and settings, but setup and failure recovery should remain clear.

## shadcn/ui and Tailwind

Use shadcn/ui as a source of primitives, not as an unchecked component catalog.

- Import one primitive at a time when it directly serves the feature.
- Adapt primitives to Draftlet tokens and interaction patterns.
- Do not add many components just because they exist.
- Do not leave raw generated styles inconsistent across surfaces.

Use Tailwind with token-driven classes and readable composition. Extract repeated patterns when class strings become noisy or when a pattern should be shared.

## Writing-Oriented UX

Draftlet UI should help the user:
- see what context is being used
- understand when a draft is streaming or complete
- compare draft variants
- refine tone, length, formality, warmth, and coverage
- ask follow-up instructions without losing thread context
- preserve and recover user edits
- review before insertion
- choose copy, insert, replace, or retry intentionally

Generated replies must scale with source complexity. Long or multi-point source content should not be represented as if a shallow acknowledgment is enough.

## Required States

Every meaningful user flow must define these states:
- empty
- loading
- streaming
- success
- error
- retry

Streaming states should make partial output, cancellation, completion, and retry behavior clear. Error states should say what failed and what the user can do next. Retry should never silently discard user edits.

## Accessibility

- Interactive elements must be keyboard reachable where practical.
- Focus states must be visible.
- Text contrast must be strong.
- Icons should not carry the entire meaning of important actions.
- Controls should have accessible names.
- Destructive or irreversible actions must be obvious.
- Status changes that affect workflow should be perceivable, not hidden behind subtle color changes alone.

## Anti-Patterns

Avoid:
- multiple competing visual systems
- popup overload
- toy-like chat UI for the side panel
- cramped writing UI
- hidden or overly subtle critical status
- large floating webpage overlays as the primary UX
- one-off colors, spacing, radii, or shadows for a single feature
- decorative containers that make core writing workflows harder to scan
