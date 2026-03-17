# apps/ - Frontend Applications

## Application Overview

| App | Port | Framework | State |担当 Agent |
|-----|------|-----------|-------|-----------|
| messenger | 3010 | Next.js 14 (App Router) | Zustand | frontend-specialist |
| admin | 3020 | Next.js 14 (App Router) | Zustand + TanStack Query | frontend-specialist |

## Shared Rules

### Component Patterns

- Single Responsibility: one component = one concern
- No inline API calls in components (use custom hooks)
- No direct store access in leaf components (pass via props)
- All components must be typed with explicit return types

### State Management

```typescript
// Zustand store pattern
import { create } from 'zustand';

interface AuthState {
  user: Employee | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  // ...
}));
```

### API Communication

- HTTP: Axios or fetch with typed wrappers
- WebSocket: Socket.IO Client (messenger only)
- All API calls go through `src/lib/api.ts` or custom hooks

### Design System

- Reference: docs/planning/05-design-system.md
- Style: Kakao Work inspired (clean, minimal)
- Components: Tailwind CSS + shadcn/ui
- No custom CSS unless absolutely necessary

### Socket.IO Events (messenger only)

| Event | Direction | Payload |
|-------|-----------|---------|
| message:send | Client -> Server | `{ channelId, content, contentType }` |
| message:new | Server -> Client | `{ channelId, message: Message }` |
| typing:start | Client -> Server | `{ channelId }` |
| typing:stop | Client -> Server | `{ channelId }` |
| typing | Server -> Client | `{ channelId, employeeId, isTyping }` |
| channel:takeover | Server -> Client | `{ channelId, isAiActive, takenOverBy }` |

### Forbidden

- Direct DB access from frontend
- Storing secrets in client-side code
- Using `any` type (use `unknown` + type guard)
- console.log in production code

## Testing

- Component tests: `apps/{name}/tests/*.test.tsx`
- Testing Library + Vitest (jsdom)
- Mock API: vi.mock('axios') or MSW
- Coverage target: >= 80%
