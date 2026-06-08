---
name: UI System
description: Rules for Draftlet UI consistency across React surfaces, including Tailwind, shadcn/ui, tokens, layout, state design, and accessibility.
---

# UI System

Use this skill for:
- React UI work
- Tailwind usage
- shadcn/ui usage
- design tokens and component decisions
- layout, typography, spacing, and component consistency
- inline UI, popup, side panel, and desktop UI refinement

## UI goals

Draftlet should feel:
- calm
- professional
- modern
- readable
- focused
- minimal without feeling empty

The UI should support serious writing workflows, not flashy novelty.

## Surface model

Draftlet has multiple UI surfaces with different density needs:

### Inline UI on webpages
- smallest surface
- must be subtle
- only for lightweight actions, context signaling, and insertion affordances
- must not become the main workflow

### Popup
- compact surface
- status and quick actions
- not the main app

### Side panel
- primary workflow surface
- should feel like the core Draftlet product
- owns drafting, refinement, variants, review, and insertion controls

### Desktop app
- operational/admin surface
- runtime setup
- settings
- diagnostics
- advanced controls

These surfaces should feel related but not identical.

## Stack

Use:
- React
- Tailwind CSS
- shadcn/ui primitives where useful
- Draftlet-owned wrappers and design tokens

## Token ownership

Draftlet-owned tokens define color, spacing, radius, typography, and shadow decisions.

- Prefer semantic tokens over raw values.
- Add or change tokens only when the choice should be reused across surfaces.
- Keep token changes deliberate and documented in the UI/system location already used by the repo.
- Do not let shadcn defaults or local Tailwind classes become a second design system.

## Design rules

### Consistency
- use one spacing scale
- use one radius scale
- use one shadow scale
- use semantic color tokens
- use consistent text hierarchy

### Readability
- prioritize readable typography
- avoid cramped layouts
- give actions enough separation
- use whitespace intentionally

### Density
- inline UI = very low density
- popup = compact
- side panel = medium density
- desktop settings/diagnostics = medium to high density only where needed
- writing and review areas need more breathing room than operational controls

### Visual hierarchy
Every screen should make these clear:
- what the current state is
- what the main action is
- what secondary actions are available
- what the user should do next

## Component rules

Prefer:
- small composable components
- reusable primitives
- clear props and predictable state
- semantic wrappers for repeated UI patterns

Avoid:
- giant one-off components
- copy-pasted styling variants
- ad hoc visual systems per feature
- overuse of decorative containers

## shadcn/ui rules

Use shadcn/ui as a source of primitives, not as an unchecked component library.

Prefer:
- importing one primitive at a time when it directly serves the feature
- adapting primitives to Draftlet tokens and interaction patterns
- wrapping repeated patterns only when the app needs consistency

Avoid:
- importing many components just because they exist
- creating multiple button/card/input styles without a system
- leaving raw generated styles inconsistent across surfaces
- adding shadcn components for simple UI that existing primitives already cover

## Tailwind rules

Prefer:
- design-token-driven classes
- readable class composition
- extraction when repeated patterns become noisy
- semantic utilities and wrappers for recurring layouts

Avoid:
- random spacing values
- random radius values
- arbitrary visual choices per component
- giant unreadable class strings when abstraction would help

## Layout guidance

### Side panel
Should support:
- thread header
- source/context summary
- streaming draft area
- refinement input
- variant list or tabs
- insertion / copy / replace actions
- clear failure and retry states

### Popup
Should support:
- runtime status
- connection summary
- open side panel
- recent quick actions
- possibly one or two lightweight settings

### Desktop
Should support:
- runtime status
- start/stop/setup
- model/runtime controls
- logs
- advanced preferences

## State design rules

Every meaningful user flow should define:
- empty state
- loading state
- streaming state
- success state
- error state
- retry state

Do not leave these implicit.

Streaming draft UI should make partial content, cancellation, completion, and retry behavior clear without surprising the user.

## Writing-oriented UX rules

Draftlet is a writing tool, so UI should support:
- comparing variants
- iterating on wording
- preserving user edits
- reviewing before insertion
- understanding why a draft may be long/short
- confidence in what will be inserted
- keeping user edits visible and recoverable

## Accessibility rules

- interactive elements must be clearly focusable
- keyboard navigation should be supported where practical
- text contrast must be strong
- icons should not carry the entire meaning of actions
- destructive or irreversible actions must be obvious

## Do not

- do not create multiple competing visual systems
- do not overload the popup with the main workflow
- do not make the side panel look like a toy chat app
- do not use dense, tiny typography for writing-heavy tasks
- do not hide critical state behind subtle visuals
- do not introduce one-off colors, spacing, radii, or shadows for a single feature
