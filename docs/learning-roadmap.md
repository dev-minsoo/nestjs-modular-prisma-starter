# NestJS Learning Roadmap

이 문서는 `nestjs-modular-prisma-sample` 레포지토리를 NestJS 학습용 샘플에서 점진적으로 발전시키기 위한 방향을 정리한다.

## Purpose

이 레포지토리의 1차 목적은 NestJS의 기본 구조를 작은 REST API로 빠르게 이해하는 것이다.

현재 샘플은 다음 흐름을 중심으로 구성되어 있다.

```text
Controller -> Service -> Prisma -> PostgreSQL
```

각 구성 요소의 역할은 다음과 같다.

- `Controller`: HTTP 요청/응답 경계
- `Service`: 비즈니스 로직과 데이터 접근 조율
- `Module`: 기능 단위 조립과 dependency injection 설정
- `DTO`: request/response 데이터 구조와 validation
- `PrismaService`: Prisma Client를 NestJS provider로 연결하는 DB 접근 계층
- `ConfigModule`: 실행 환경별 설정을 로딩하는 계층

Spring Boot와의 비교는 `docs/nestjs-spring-boot-comparison.md`에, NestJS decorator 문법은 `docs/nestjs-decorators.md`에 별도로 정리한다.

초기 학습 단계에서는 인증, Redis, queue, 복잡한 architecture pattern을 한꺼번에 넣기보다, 작은 CRUD API를 통해 NestJS의 module, provider, controller, pipe, test 구조를 먼저 익히는 것이 목표다.

## Current Scope

현재 레포지토리는 다음 기능을 포함한다.

- NestJS 11 기반 REST API
- module-based 구조
- PostgreSQL + Prisma ORM
- `User` CRUD API
- users list pagination, search, ordering
- common pagination DTO/type/helper
- common HTTP error response format
- DTO validation
- Prisma known error mapping
- Swagger/OpenAPI 문서
- `APP_ENV` 기반 environment profile
- required environment variable validation
- Docker Compose 기반 local PostgreSQL
- Jest unit/e2e test 기본 설정
- Prisma generated client를 `src/generated/prisma`에 생성

현재 구조는 입문 샘플로는 충분하지만, production starter로 보기에는 아직 보강할 부분이 있다.

## Development Phases

### Phase 1. Make The Existing CRUD Solid

가장 먼저 현재 기능을 안정화한다.

Status: initial implementation complete.

- `start:prod` 스크립트와 build output 경로 정리
- `UsersController`, `UsersService` 테스트 추가
- Prisma known error를 HTTP 예외로 명확히 매핑
- duplicate email은 `409 Conflict`로 처리
- missing record는 `404 Not Found`로 처리
- validation 실패 케이스 테스트
- users list에 pagination, search, ordering 추가
- users pagination을 `src/common/pagination`으로 분리

현재 users list 응답은 단순 배열이 아니라 다음 형태를 사용한다.

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

이 단계의 목적은 NestJS에서 controller, service, DTO, validation, Prisma, test가 어떻게 연결되는지 선명하게 이해하는 것이다.

### Phase 2. Configuration And Environment

환경 설정을 명시적으로 다룬다.

Status: initial profile support added.

- `APP_ENV=local|dev|prod|test` profile 지원
- `.env.local`, `.env.dev`, `.env.prod`, `.env.test` 파일 로딩 순서 정리
- required environment variable 누락 시 boot fail 처리
- `PORT`, `DATABASE_URL`, `CORS_ORIGIN` validation
- `ConfigModule` 사용 패턴 정리

이 단계의 목적은 NestJS 애플리케이션이 실행 환경에 의존하는 값을 어떻게 안전하게 다루는지 익히는 것이다.

### Phase 3. Common NestJS Building Blocks

NestJS의 공통 확장 지점을 하나씩 학습한다.

- custom exception filter
- interceptor 기반 request/response logging
- interceptor 기반 response timing
- custom pipe
- custom decorator
- guard 기본 개념

Status: initial `HttpExceptionFilter` complete.

현재 HTTP exception 응답은 다음 형태로 표준화한다.

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "path": "/api/users",
  "timestamp": "2026-06-12T05:00:00.000Z",
  "details": []
}
```

이 단계에서는 기능을 크게 늘리기보다 NestJS가 제공하는 request lifecycle 확장 포인트를 실습한다.

### Phase 4. Relational Domain Modeling

`User` 하나만 있는 모델에서 벗어나 관계형 모델을 추가한다.

- `Post` 또는 `Todo` 모델 추가
- `User 1:N Post` 관계 구성
- relation query 실습
- nested write와 transaction 예제 추가
- cascade delete 정책 검토
- seed 데이터 추가

이 단계의 목적은 Prisma를 통해 관계형 데이터를 다루는 방법과 service layer에서 transaction boundary를 잡는 방법을 익히는 것이다.

### Phase 5. Authentication

기본 구조가 익숙해진 뒤 인증을 추가한다.

- `AuthModule` 추가
- signup/login API
- password hashing
- JWT access token
- `JwtAuthGuard`
- `@CurrentUser()` custom decorator
- 인증이 필요한 users/profile API

인증은 여러 개념이 한꺼번에 섞이므로 초반부터 넣기보다 CRUD, validation, error handling, test가 어느 정도 정리된 뒤 추가한다.

### Phase 6. Real E2E Testing

현재 e2e test는 health check 중심이며 DB는 mock으로 대체한다. 이후에는 실제 test database를 사용하는 e2e 흐름으로 확장한다.

- test 전용 database 구성
- e2e test 실행 전 migration 적용
- test seed 또는 fixture 구성
- HTTP request로 실제 CRUD 검증
- validation, conflict, not found 케이스 검증
- test 종료 후 데이터 정리

이 단계의 목적은 NestJS API를 실제 실행 흐름에 가깝게 검증하는 방법을 익히는 것이다.

### Phase 7. Operational Basics

운영에 가까운 기본기를 추가한다.

- Dockerfile
- production build/run 검증
- health check에서 DB connectivity 확인
- graceful shutdown
- structured logging
- request/response logging middleware 또는 interceptor
- local/dev/prod별 log format 분리
- request id 또는 correlation id 추가
- 민감한 header/body field masking 정책 정리
- GitHub Actions 기반 lint/test/build
- migration deploy workflow

Spring Boot에서 Logback pattern, JSON encoder, `OncePerRequestFilter`, MDC로 request log와 trace id를 다루는 것처럼, NestJS에서는 logger provider, middleware/interceptor, request-scoped context를 조합해 같은 주제를 실습한다.

예상 작업 단위는 다음과 같다.

1. `LoggerModule` 또는 common logger provider 추가
2. local은 사람이 읽기 쉬운 pretty log, dev/prod는 JSON log 사용
3. HTTP request 시작/종료 로그 기록
4. method, path, statusCode, durationMs, requestId 기록
5. error response와 server error 로그 연결
6. authorization, cookie 같은 민감한 값 masking
7. README에 log field 예시와 profile별 log format 설명 추가

이 단계는 학습용 샘플을 작은 production-like API로 발전시키는 과정이다.

## Suggested Next Step

Phase 1, Phase 2, 공통 pagination, 공통 error response의 첫 구현이 들어간 뒤에는 운영 기본기를 하나씩 추가하는 것이 좋다.

우선순위는 다음과 같다.

1. DB connectivity health check 추가
2. GitHub Actions로 lint/test/e2e/build 자동화
3. structured logging과 request/response logging 추가
4. graceful shutdown 확인
5. 이후 실제 DB 기반 e2e test 검토

이 순서로 진행하면 API contract를 유지하면서 운영에 필요한 기본기를 점진적으로 추가할 수 있다.
