# 07. 코딩 컨벤션 & AI 협업 가이드

> Palette AI 플랫폼 개발 시 모든 코드가 따라야 하는 규칙과 AI(Claude)와 협업하는 원칙을 정의한다.
> `docs/CLAUDE.md`의 코딩 규칙을 기반으로 확장 및 구체화한 문서이다.

---

## 1. MVP 캡슐 요약

| 항목 | 내용 |
|------|------|
| **목표** | AI가 HR 반복 업무를 자동 처리하는 회사 메신저 구축 |
| **페르소나** | 대표, 경영지원팀장, 휴가 담당자, 직원 A(정인수), 상사(김민준) |
| **핵심 기능** | FEAT-1: 메신저 + AI 자동응답 / FEAT-2: 휴가 신청/결재 시스템 |
| **성공 지표** | 시나리오 A/B/C 전체 E2E 동작 |
| **입력 지표** | AI 자동 처리율, 평균 처리 시간 |
| **비기능 요구** | 실시간 메시지 전달 < 500ms, 웹 + 모바일 반응형 |
| **Out-of-scope** | 네이티브 앱, B2B SaaS 멀티테넌시, Google Calendar 연동 |
| **Top 리스크** | LLM 할루시네이션으로 잘못된 업무 처리 |
| **완화/실험** | Tool 호출 강제 + 응답 검증 + Human Takeover |
| **다음 단계** | Phase 2 프로젝트 셋업 |

---

## 2. TypeScript 규칙

> 출처: `docs/CLAUDE.md` > 코딩 규칙 > TypeScript

### 2.1 필수 설정

```jsonc
// tsconfig.json (공통)
{
  "compilerOptions": {
    "strict": true,           // strict mode 필수
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 2.2 타입 선언 원칙

| 규칙 | 설명 | 예시 |
|------|------|------|
| **interface 우선** | 객체 타입은 항상 `interface`로 선언 | `interface User { id: string; name: string; }` |
| **type은 union일 때만** | 유니온, 인터섹션, 유틸리티 타입에만 `type` 사용 | `type ChannelKind = 'dm' \| 'task' \| 'team';` |
| **return type 명시** | 모든 함수에 반환 타입을 명시적으로 작성 | `function getUser(id: string): Promise<User>` |
| **any 사용 금지** | `any` 대신 `unknown`을 사용하고, 타입 가드로 좁히기 | `function parse(input: unknown): User` |

### 2.3 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| 함수 / 변수 | camelCase | `getUserById`, `isApproved` |
| 타입 / 인터페이스 | PascalCase (I 접두사 사용 안 함) | `ChatStore`, `LeaveRequest` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE` |
| Enum | PascalCase | `ChannelType`, `LeaveStatus` |
| Enum 멤버 | PascalCase | `ChannelType.DirectMessage` |

---

## 3. 프로젝트 구조 (모노레포)

```
palette-platform/
  apps/
    messenger/              # Next.js 메신저 UI (포트 3010)
    admin/                  # Next.js Admin UI (포트 3020)
  services/
    messaging-server/       # Hono + Socket.IO (포트 3000)
    ai-runtime/             # Hono (포트 3100)
    leave-service/          # Hono (포트 3001)
    approval-service/       # Hono (포트 3002)
    notification-service/   # Hono (포트 3003)
    scheduler/              # Hono (포트 3004)
  packages/
    shared/                 # 공통 타입, 유틸, 에러 코드
    db/                     # Drizzle 스키마, 마이그레이션, seed
  docs/                     # 설계 문서
  docker-compose.yml
  pnpm-workspace.yaml
```

### 3.1 패키지 간 의존 방향

```
apps/* ──→ packages/shared
apps/* ──→ services/* (HTTP/WebSocket)
services/* ──→ packages/shared
services/* ──→ packages/db
packages/shared ──→ (외부 의존 없음)
packages/db ──→ packages/shared (타입만)
```

> **규칙**: `packages/shared`는 어떤 패키지에도 의존하지 않는다. 순환 의존 절대 금지.

---

## 4. 파일 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 파일 | PascalCase + `.tsx` | `ChatPanel.tsx`, `MessageList.tsx` |
| 유틸/훅 파일 | camelCase + `.ts` | `useSocket.ts`, `formatDate.ts` |
| 서비스 파일 | camelCase + `.ts` | `leaveService.ts`, `approvalService.ts` |
| 라우트 핸들러 | camelCase + `.ts` | `leaveRoutes.ts` |
| 테스트 파일 | 원본명 + `.test.ts` | `leaveService.test.ts`, `ChatPanel.test.tsx` |
| 타입 정의 파일 | camelCase + `.ts` | `leaveTypes.ts` |
| 상수 파일 | camelCase + `.ts` | `errorCodes.ts` |
| 스키마 파일 | camelCase + `.ts` | `userSchema.ts` |
| CSS | Tailwind utility classes 사용 (별도 CSS 파일 최소화) | - |

---

## 5. API 응답 형식

> 출처: `docs/CLAUDE.md` > API 응답 형식

### 5.1 성공 응답

```typescript
interface ApiSuccessResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    [key: string]: unknown;
  };
}
```

```json
{
  "data": {
    "id": "leave-001",
    "userId": "user-004",
    "status": "pending"
  },
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### 5.2 에러 응답

```typescript
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

```json
{
  "error": {
    "code": "LV_001",
    "message": "연차가 부족합니다",
    "details": {
      "remaining": 0,
      "requested": 3
    }
  }
}
```

### 5.3 HTTP 상태 코드 매핑

| 상태 코드 | 용도 |
|-----------|------|
| `200` | 조회, 수정 성공 |
| `201` | 생성 성공 |
| `400` | 잘못된 요청 (입력 검증 실패) |
| `401` | 인증 실패 (토큰 없음/만료) |
| `403` | 권한 없음 |
| `404` | 리소스 없음 |
| `409` | 충돌 (중복 신청 등) |
| `500` | 서버 내부 오류 |

---

## 6. 에러 처리

### 6.1 에러 코드 체계

| 접두사 | 도메인 | 코드 범위 | 예시 |
|--------|--------|-----------|------|
| `LV` | 휴가 | LV_001 ~ LV_005 | LV_001: 연차 부족, LV_002: 주말/공휴일 신청 |
| `AP` | 결재 | AP_001 ~ AP_002 | AP_001: 결재자 없음, AP_002: 이미 처리됨 |
| `SYS` | 시스템 | SYS_001 ~ SYS_002 | SYS_001: 내부 서버 오류, SYS_002: 외부 서비스 장애 |
| `AUTH` | 인증 | AUTH_001 ~ AUTH_002 | AUTH_001: 토큰 만료, AUTH_002: 권한 부족 |

### 6.2 AppError 클래스

```typescript
// packages/shared/src/errors/AppError.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

### 6.3 에러 처리 원칙

1. **비즈니스 에러**: `AppError`를 throw하고, 글로벌 에러 핸들러에서 통일된 형식으로 응답
2. **예상치 못한 에러**: `try-catch`로 감싸고 `SYS_001`로 응답, 원본 에러는 로그에만 기록
3. **입력 검증 에러**: Zod 스키마로 검증하고 실패 시 `400` + 상세 메시지 응답
4. **에러 전파 금지**: 서비스 간 호출 시 에러를 적절히 변환하여 전파 (내부 에러 코드 노출 금지)

---

## 7. 아키텍처 원칙

### 7.1 뼈대 먼저 (Skeleton First)

개발 순서를 반드시 지킨다:

1. **전체 구조 잡기**: 디렉터리, 파일 생성, import/export 연결
2. **빈 함수 작성**: 시그니처와 return type만 정의, 본문은 `throw new Error('Not implemented')`
3. **하나씩 구현**: 빈 함수를 하나씩 실제 로직으로 채우기
4. **테스트 작성**: 구현과 동시에 테스트 코드 작성

### 7.2 코드 크기 제한

| 대상 | 최대 줄 수 |
|------|-----------|
| 한 파일 | 200줄 이하 |
| 한 함수 | 50줄 이하 |
| 한 컴포넌트 | 100줄 이하 |

> 초과 시 반드시 분리한다. 파일이 커지면 기능 단위로 나누고, 함수가 길면 헬퍼 함수를 추출한다.

### 7.3 관심사 분리

```
UI (React 컴포넌트)
  └── 렌더링과 이벤트 핸들링만 담당
  └── 비즈니스 로직 포함 금지

State (Zustand Store)
  └── 클라이언트 상태 관리
  └── 서버 상태는 React Query 또는 직접 fetch

Service (API 호출 레이어)
  └── HTTP/WebSocket 통신 캡슐화
  └── 에러 변환 및 재시도 로직

Util (순수 함수)
  └── 날짜 계산, 포맷팅, 검증
  └── 부수 효과(side effect) 없음
```

### 7.4 디렉터리 구조 패턴

**프론트엔드 (apps/messenger, apps/admin)**:
```
src/
  app/                    # Next.js App Router 페이지
  components/
    ui/                   # shadcn/ui 기반 공통 UI
    chat/                 # 채팅 관련 컴포넌트
    leave/                # 휴가 관련 컴포넌트
  stores/                 # Zustand 스토어
  services/               # API 호출 함수
  hooks/                  # 커스텀 훅
  lib/                    # 유틸리티, 상수
  types/                  # 프론트 전용 타입
```

**백엔드 (services/*)**:
```
src/
  routes/                 # Hono 라우트 정의
  handlers/               # 요청 핸들러 (컨트롤러)
  services/               # 비즈니스 로직
  middleware/              # 인증, 에러 핸들링 미들웨어
  types/                  # 서비스 전용 타입
  index.ts                # 서버 진입점
```

---

## 8. 보안 체크리스트

### 8.1 절대 금지 사항

- [ ] 비밀정보 하드코딩 금지 (API 키, 비밀번호, JWT 시크릿)
- [ ] `.env` 파일 커밋 금지 (`.gitignore`에 반드시 포함)
- [ ] SQL 직접 문자열 조합 금지 (Drizzle ORM 사용)
- [ ] `eval()`, `Function()` 사용 금지
- [ ] 에러 응답에 스택 트레이스 노출 금지 (프로덕션)

### 8.2 필수 적용 사항

- [ ] 사용자 입력 검증: Zod 스키마로 서버 측 필수 검증
- [ ] 비밀번호 해싱: bcrypt (salt rounds >= 12)
- [ ] 인증: JWT + Bearer Token (`Authorization: Bearer <token>`)
- [ ] CORS 설정: 허용 도메인 명시적 지정 (와일드카드 금지)
- [ ] Rate Limiting: 주요 API에 요청 제한 적용
- [ ] XSS 방지: 사용자 입력을 HTML에 직접 삽입하지 않음

### 8.3 환경 변수 관리

```bash
# .env (로컬 개발용 - 절대 커밋 금지)
ANTHROPIC_API_KEY=         # Claude API
DATABASE_URL=              # PostgreSQL 연결 문자열
REDIS_URL=redis://localhost:6379
JWT_SECRET=                # 랜덤 긴 문자열 (최소 32자)
TELEGRAM_BOT_TOKEN=        # 나중에 설정
```

```bash
# .env.example (커밋 가능 - 값은 비어 있어야 함)
ANTHROPIC_API_KEY=
DATABASE_URL=
REDIS_URL=redis://localhost:6379
JWT_SECRET=
TELEGRAM_BOT_TOKEN=
```

---

## 9. 테스트 전략

### 9.1 테스트 종류 및 도구

| 종류 | 도구 | 커버리지 목표 | 대상 |
|------|------|-------------|------|
| Unit | Vitest | >= 80% | 순수 함수, 서비스 로직, 유틸리티 |
| Integration | Vitest + Supertest | 주요 API 경로 | REST API 엔드포인트 |
| E2E | Playwright | 시나리오 A/B/C 전체 | 사용자 시나리오 흐름 |

### 9.2 TDD 사이클

```
RED    → 실패하는 테스트를 먼저 작성
GREEN  → 테스트를 통과하는 최소한의 코드 작성
REFACTOR → 코드 정리 (테스트는 계속 통과해야 함)
```

### 9.3 테스트 파일 위치

```
# 코로케이션 방식: 소스 파일과 같은 디렉터리에 배치
src/
  services/
    leaveService.ts
    leaveService.test.ts      # 유닛 테스트
  routes/
    leaveRoutes.ts
    leaveRoutes.test.ts        # 통합 테스트

# E2E: 프로젝트 루트의 별도 디렉터리
e2e/
  scenario-a-leave-request.spec.ts
  scenario-b-dm-conversation.spec.ts
  scenario-c-human-takeover.spec.ts
```

### 9.4 Quality Gate

모든 PR 병합 전에 아래 항목이 통과해야 한다:

1. **빌드 성공**: `pnpm build` 에러 없음
2. **테스트 통과**: `pnpm test` 전체 통과
3. **린트 통과**: `pnpm lint` 경고/에러 없음
4. **타입 체크 통과**: `pnpm typecheck` 에러 없음
5. **커버리지 충족**: 80% 이상

---

## 10. 코드 품질 도구

| 도구 | 프론트엔드 | 백엔드 | 설정 |
|------|-----------|--------|------|
| Linter | ESLint | ESLint | 루트 `eslint.config.js` 공유 |
| Formatter | Prettier | Prettier | 루트 `.prettierrc` 공유 |
| Type Check | TypeScript strict | TypeScript strict | 패키지별 `tsconfig.json` |
| Test Runner | Vitest | Vitest | 패키지별 `vitest.config.ts` |

### 10.1 ESLint 핵심 규칙

```javascript
// 반드시 활성화할 규칙
{
  "@typescript-eslint/explicit-function-return-type": "error",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-unused-vars": "error",
  "no-console": "warn",  // 프로덕션 코드에서 console.log 경고
  "eqeqeq": "error"      // === 강제
}
```

### 10.2 Prettier 설정

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 100
}
```

---

## 11. Git 워크플로우

### 11.1 커밋 메시지 규칙

```
<type>: <설명>

# type 종류
feat:     새로운 기능 추가
fix:      버그 수정
refactor: 리팩터링 (기능 변경 없음)
test:     테스트 추가/수정
docs:     문서 수정
chore:    설정, 빌드, 의존성 등
style:    코드 스타일 변경 (포매팅 등)
```

**예시**:
```
feat: 휴가 신청 API 구현
fix: 날짜 검증 주말 처리 로직 수정
refactor: leave-service 에러 핸들링 통일
test: 결재 승인 플로우 통합 테스트 추가
chore: pnpm workspace 초기 설정
```

### 11.2 브랜치 전략

```
main                          # 안정 브랜치
  └── step-1/db-setup         # Phase 1 Step 1
  └── step-2/messaging-server # Phase 1 Step 2
  └── step-3/ai-runtime       # Phase 1 Step 3
  └── step-4/messenger-ui     # Phase 1 Step 4
  └── step-5/admin-integration# Phase 1 Step 5
```

- 각 Step 완료 후 `main`에 병합
- Git Worktree를 활용하여 Phase별 독립 작업 가능

---

## 12. import 정렬 규칙

각 파일의 import 문은 아래 순서를 따른다:

```typescript
// 1. 외부 라이브러리
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';

// 2. 모노레포 내부 패키지
import { AppError } from '@palette/shared';
import { db, users } from '@palette/db';

// 3. 같은 서비스 내부 모듈 (절대 경로)
import { validateDateRange } from '../utils/dateValidator';
import { LeaveService } from '../services/leaveService';

// 4. 타입 import (type-only)
import type { LeaveRequest, LeaveBalance } from '../types/leaveTypes';
```

> 그룹 사이에는 빈 줄을 하나 넣는다.

---

## 13. 주석 규칙

### 13.1 주석 작성 원칙

- **왜(why)**를 설명하는 주석은 환영한다.
- **무엇(what)**을 설명하는 주석은 코드를 더 명확하게 리팩터링하는 것이 우선이다.
- TODO 주석에는 반드시 담당자와 이슈 번호를 포함한다.

```typescript
// 좋은 주석: "왜"를 설명
// 주말과 공휴일을 제외해야 실제 근무일 기준 연차가 차감됨
function calculateWorkingDays(start: Date, end: Date): number {
  // ...
}

// TODO 주석 형식
// TODO(@username): LV_003 에러 시 재시도 로직 추가 (#42)
```

### 13.2 JSDoc

공개 API와 복잡한 함수에는 JSDoc을 작성한다:

```typescript
/**
 * 지정된 기간의 근무일 수를 계산한다.
 * 주말(토, 일)과 공휴일을 제외한다.
 *
 * @param startDate - 시작일 (포함)
 * @param endDate - 종료일 (포함)
 * @param holidays - 공휴일 날짜 배열
 * @returns 근무일 수
 */
function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: Date[]
): number {
  // ...
}
```

---

## 14. AI 협업 원칙

### 14.1 기본 규칙

| 원칙 | 설명 |
|------|------|
| **하나의 채팅 = 하나의 작업** | 한 세션에서 하나의 명확한 작업만 수행한다. 여러 작업을 섞지 않는다. |
| **컨텍스트 명시** | 작업 시작 시 관련 TASKS 문서, 설계 문서를 참조하도록 명시한다. |
| **코드 리뷰 필수** | AI가 생성한 코드는 반드시 개발자가 리뷰한 후 적용한다. |
| **이해하지 못하는 코드 사용 금지** | AI가 생성한 코드가 이해되지 않으면 설명을 요청하고, 이해한 뒤 사용한다. |

### 14.2 AI 작업 요청 템플릿

```
## 작업 요청
- 현재 Step: Step X
- 참조 문서: docs/XXX.md
- 작업 내용: [구체적인 작업 설명]
- 제약 조건: [지켜야 할 규칙]
- 완료 기준: [어떤 상태가 되면 완료인지]
```

### 14.3 AI 코드 생성 시 체크리스트

AI가 코드를 생성한 후 개발자가 확인해야 할 항목:

- [ ] TypeScript strict 모드에서 에러 없는가?
- [ ] 모든 함수에 return type이 명시되어 있는가?
- [ ] `any` 타입이 사용되지 않았는가?
- [ ] 네이밍 컨벤션을 따르는가? (camelCase, PascalCase, UPPER_SNAKE_CASE)
- [ ] 파일 크기가 200줄을 넘지 않는가?
- [ ] 함수 크기가 50줄을 넘지 않는가?
- [ ] 에러 처리가 AppError를 사용하는가?
- [ ] API 응답이 표준 형식을 따르는가?
- [ ] 비밀정보가 하드코딩되어 있지 않은가?
- [ ] 테스트 코드가 함께 작성되었는가?

### 14.4 AI 활용 팁

1. **점진적 요청**: 한 번에 큰 기능을 요청하지 말고, 뼈대 -> 단위 기능 -> 통합 순으로 나눠 요청한다.
2. **실패 시 롤백**: AI가 생성한 코드가 문제를 일으키면 바로 되돌리고 다시 요청한다.
3. **디버깅 협업**: 에러 메시지와 관련 코드를 함께 제공하면 더 정확한 해결책을 얻는다.
4. **설계 문서 우선**: 코드 생성 전에 `docs/` 문서를 먼저 참조하게 하여 프로젝트 맥락을 전달한다.

---

## 15. 코드 리뷰 기준

PR(Pull Request) 리뷰 시 아래 기준으로 검토한다:

### 15.1 필수 통과 항목

1. **기능 정확성**: 요구사항대로 동작하는가?
2. **타입 안전성**: strict 모드에서 에러 없는가?
3. **에러 처리**: 예외 상황이 적절히 처리되는가?
4. **보안**: 비밀정보 노출, SQL injection, XSS 위험이 없는가?
5. **테스트**: 새 코드에 대한 테스트가 포함되어 있는가?

### 15.2 권장 검토 항목

1. **가독성**: 코드가 직관적으로 이해되는가?
2. **네이밍**: 변수, 함수, 타입 이름이 의도를 명확히 표현하는가?
3. **중복 제거**: 비슷한 코드가 반복되지 않는가?
4. **크기 제한**: 파일/함수/컴포넌트 크기 제한을 준수하는가?
5. **성능**: 불필요한 연산, N+1 쿼리, 과도한 리렌더링이 없는가?

---

## 부록: 빠른 참조 카드

```
========================================
  Palette AI 코딩 컨벤션 빠른 참조
========================================

[TypeScript]
  strict mode: ON
  interface > type (union 제외)
  return type: 항상 명시
  any: 사용 금지

[네이밍]
  함수/변수: camelCase
  타입/인터페이스: PascalCase (I 접두사 없음)
  상수: UPPER_SNAKE_CASE
  파일(컴포넌트): PascalCase.tsx
  파일(유틸/훅): camelCase.ts

[크기 제한]
  파일: 200줄 이하
  함수: 50줄 이하
  컴포넌트: 100줄 이하

[API 응답]
  성공: { data: T, meta?: {} }
  에러: { error: { code, message, details? } }

[에러 코드]
  LV_001~005: 휴가
  AP_001~002: 결재
  SYS_001~002: 시스템
  AUTH_001~002: 인증

[Git 커밋]
  feat: / fix: / refactor: / test: / docs: / chore:

[테스트]
  Unit: Vitest (>= 80%)
  Integration: Vitest + HTTP
  E2E: Playwright
  TDD: RED -> GREEN -> REFACTOR

[보안]
  .env 커밋 금지
  하드코딩 금지
  Drizzle ORM 사용
  Zod 입력 검증
  bcrypt 해싱
  JWT + Bearer Token

[AI 협업]
  1채팅 = 1작업
  컨텍스트 명시
  코드 리뷰 필수
  이해 못하면 사용 금지
========================================
```
