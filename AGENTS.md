# AGENTS.md

## Project
Draftlet

Privacy-first browser extension for generating local AI draft replies on any webpage.

## Core stack
- WXT
- TypeScript
- React for the panel UI only
- Tailwind CSS for panel styling
- Lightweight local UI primitives
- Shadow DOM
- FastAPI
- Pydantic
- httpx
- Ollama
- SSE
- SQLite
- SQLAlchemy 2.0
- Alembic
- Electron Forge for the desktop companion

## Product goal
Draftlet should feel like a serious, local-first drafting tool:
- select text on a webpage
- open Draftlet
- generate draft replies
- copy or insert a reply
- revisit history and preferences
- use the desktop companion to guide local runtime setup and readiness

## Working philosophy
Do not overengineer.

Prefer:
- explicit functions
- small modules
- thin route files
- readable code
- isolated complexity only where necessary
- UI polish through structure, contrast, and hierarchy rather than heavy abstraction

Avoid:
- Redux
- WebSockets
- dependency injection frameworks
- repository pattern unless clearly necessary
- generic plugin systems
- giant utility files
- unrelated refactors
- dashboard-like UI bloat

## Important constraints
- React is allowed only for the Draftlet panel UI and its immediate child components
- low-level browser/page integration logic must stay outside React
- keep selection, focus capture, insertion, SSE, and content-script wiring outside React
- preserve current working behavior during UI refactors
- do not add side panel unless explicitly requested
- do not change server behavior unless clearly required for the requested phase

## Architecture boundaries

### React owns
- panel rendering
- panel-local UI state
- tabs/views
- reply cards
- tone controls
- status badge
- copy/insert feedback display
- history presentation

### Non-React extension code owns
- selection detection
- floating trigger
- focus capture
- insertion logic
- clipboard fallback helpers
- API request helpers
- SSE streaming client
- Shadow DOM host creation/mounting
- page event listeners
- viewport-aware host positioning

### Server owns
- request validation
- prompt building
- Ollama streaming client
- delimiter-based parsing
- SSE response emission
- persistence

### Desktop companion owns
- guided local runtime setup flow
- Ollama install/running checks
- OS-specific Ollama setup guidance
- recommended model checks and install action
- Draftlet server start/stop orchestration for local development
- setup and help guidance

Desktop companion does not own the in-browser drafting UX.

### Electron desktop companion owns
- main-process runtime checks and local process control
- preload-mediated IPC API exposure
- renderer setup/status UI

Electron renderer code must not receive raw Node APIs. Keep `contextIsolation: true`, `nodeIntegration: false`, and expose only explicit preload APIs.

## UI Design Direction
Draftlet panel UI should follow a **dark editorial utility** direction.

Design goals:
- compact, premium, serious writing tool
- dark graphite / charcoal surfaces
- warm restrained accent
- crisp but subtle borders
- layered sections with clearer separation
- strong typography hierarchy
- readable text on dark backgrounds
- compact but calm spacing
- refined, not flashy

Avoid:
- generic AI assistant styling
- purple gradient AI look
- dashboard-like layout
- too many outlined boxes
- overly playful styling
- low-contrast text on dark surfaces
- oversized controls
- noisy animation
- visual clutter

Preferred direction:
- dark editorial workspace
- fewer hard rectangles, more layered surfaces
- brighter primary text
- muted but readable secondary/meta text
- unified top workspace block
- reply cards as the visual focus
- compact navigation tabs that feel intentional
- subtle premium accent, not neon

## Layout guidance
Prefer this hierarchy inside the panel:
1. Header
   - Draftlet
   - subtle subtitle
   - connection badge
2. Workspace block
   - selected text preview / source context
   - tone selector
   - primary action
3. View navigation
   - Replies
   - History
4. Main results area
   - refined reply/history cards

Do not make the whole UI feel like one long stack of identical bordered boxes.

## Color and typography guidance
Aim for:
- brighter primary text on dark backgrounds
- clearer distinction between primary, secondary, and meta text
- restrained warm accent
- dark surfaces with enough separation to avoid visual flattening

Typical hierarchy:
- title: stronger and more prominent
- subtitle/meta: smaller, muted, still readable
- body/reply text: most readable text in the UI
- feedback text: subdued but legible
- tabs/buttons: compact and confident

## File guidance

### Extension
- `entrypoints/content.ts`: initialization, page wiring, orchestration only
- `core/selection.ts`: selection logic
- `core/focus.ts`: focus capture and restore helpers
- `core/insertion.ts`: insertion strategies and clipboard fallback
- `core/api.ts`: server request helpers
- `core/sse-client.ts`: SSE handling
- `ui/mount-panel.tsx`: React mount boundary into Shadow DOM
- `components/panel/*`: React UI components only

### Server
- keep routes thin
- keep orchestration in service files
- do not change server structure during UI-only phases unless clearly necessary

### Desktop
- `apps/desktop/src/main`: Electron main process and IPC handlers
- `apps/desktop/src/preload`: safe renderer API bridge only
- `apps/desktop/src/renderer`: React setup/status UI
- keep IPC handlers explicit and small
- do not expose raw Node APIs to renderer code

## Insertion rules
Implement insertion in this order:
1. input
2. textarea
3. contenteditable
4. framework-controlled inputs later if needed

If insertion fails:
- fall back to clipboard
- show clear user feedback

Do not claim universal support for all sites.

## Delivery rules
- implement only the requested phase or files
- do not silently add new frameworks
- do not introduce abstractions without a clear need
- make the smallest clean change that improves the requested outcome
- keep code easy to review file-by-file
- preserve working behavior while improving UI