# NestJS And Spring Boot Comparison

이 문서는 Java/Spring Boot에 익숙한 개발자가 이 NestJS 샘플의 구조를 이해할 때 참고하기 위한 비교 자료다.

## Request Flow

이 프로젝트의 기본 흐름은 다음과 같다.

```text
Controller -> Service -> Prisma -> PostgreSQL
```

상세 request lifecycle과 Mermaid diagram은 `docs/nestjs-request-lifecycle.md`에 따로 정리한다.

Spring Boot와 비교하면 대략 다음처럼 볼 수 있다.

| NestJS | Spring Boot | 역할 |
| --- | --- | --- |
| `Controller` | `@RestController` | HTTP 요청과 응답 경계 |
| `Service` | `@Service` | 비즈니스 로직과 데이터 접근 조율 |
| `Module` | `@Configuration`, component scan boundary | provider/controller 조립과 DI 범위 구성 |
| `DTO` | request/response DTO | 입력 validation과 API 데이터 구조 |
| `PrismaService` | repository 또는 data access bean | Prisma Client를 Nest DI에 연결 |
| `ValidationPipe` | validation layer, `@Valid` 흐름 | request DTO validation |
| `Exception` | `ResponseStatusException`, custom exception | HTTP 에러 응답 변환 |

NestJS decorator와 Spring annotation의 자세한 비교는 `docs/nestjs-decorators.md`에 정리한다.

## Module Structure

NestJS는 feature 단위로 module을 명시적으로 구성한다.

```ts
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

Spring Boot에서는 component scan과 annotation 조합으로 bean을 찾는 경우가 많다. NestJS도 DI container를 사용하지만, 어떤 controller/provider가 어느 module에 속하는지 더 명시적으로 적는 편이다.

## Async Model

NestJS의 Prisma 호출은 `Promise`를 반환한다.

```ts
const user = await this.prisma.user.findUnique({ where: { id } });
```

Spring MVC의 blocking repository와 비교하면 비동기 I/O 모델에 가깝다. Spring WebFlux와 비교하면 다음 정도로 이해할 수 있다.

```text
Promise<User>    ~= Mono<User>
Promise<User[]>  ~= Mono<List<User>>
Observable<User> ~= Flux<User>
```

일반적인 NestJS + Prisma CRUD에서는 `Observable`보다 `Promise`와 `async/await`를 주로 사용한다.

## Pagination

Spring Data JPA에는 `Pageable`, `Page<T>`, `Slice<T>` 같은 pagination abstraction이 기본으로 제공된다.

```java
Page<User> users = userRepository.findAll(pageable);
```

이 경우 page number, page size, sort, total count, total pages 같은 개념이 Spring Data 쪽에 이미 잡혀 있다.

NestJS 자체에는 이와 같은 표준 pagination 객체가 없다. NestJS는 HTTP framework이고, pagination은 사용하는 ORM/query layer나 프로젝트 convention으로 정하는 경우가 많다.

Prisma도 Spring Data JPA의 `Page<T>` 같은 결과 객체를 직접 반환하지 않는다. 대신 query option으로 `skip`, `take`, `orderBy`를 넘긴다.

```ts
const [items, total] = await prisma.$transaction([
  prisma.user.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
  }),
  prisma.user.count(),
]);
```

그래서 이 샘플은 공통 pagination helper를 직접 둔다.

```text
src/common/pagination/dto/pagination-query.dto.ts
src/common/pagination/dto/pagination-meta.dto.ts
src/common/pagination/types/paginated-result.type.ts
src/common/pagination/utils/pagination.util.ts
```

Spring Data JPA와 비교하면 다음처럼 대응된다.

| Spring Data JPA | NestJS + Prisma sample |
| --- | --- |
| `Pageable` | `PaginationQueryDto` |
| `Page<T>.getContent()` | `PaginatedResult<T>.items` |
| `Page<T>.getTotalElements()` | `meta.total` |
| `Page<T>.getTotalPages()` | `meta.totalPages` |
| `Sort` | resource-specific `orderBy`, `orderDirection` DTO fields |
| repository가 page 결과 조립 | service가 Prisma `findMany` + `count` 결과를 조립 |

즉 Spring Data JPA는 pagination abstraction이 framework/data layer에 더 강하게 들어가 있고, NestJS + Prisma에서는 API 계약에 맞는 pagination shape을 애플리케이션에서 명시적으로 만드는 편이다.

## Transaction Boundary

Spring Boot에서는 보통 service method에 `@Transactional`을 붙여 transaction boundary를 선언한다.

```java
@Transactional
public User signup(SignupRequest request) {
  // repository calls
}
```

NestJS + Prisma에서는 transaction boundary를 service code에서 명시적으로 호출한다.

```ts
await this.prisma.runInTransaction(async (tx) => {
  // tx.user.count()
  // tx.user.create()
});
```

이 샘플은 `PrismaService.runInTransaction()` helper를 두고, `AuthService.signup()`에서 `ADMIN` 사용자 수 조회와 user 생성을 하나의 interactive transaction으로 묶는다. 자세한 비교와 Mermaid diagram은 `docs/nestjs-prisma-transactions.md`에 정리한다.

## Environment Profiles

이 프로젝트는 `APP_ENV`로 실행 환경을 나눈다.

```text
APP_ENV=local
APP_ENV=dev
APP_ENV=prod
APP_ENV=test
```

Spring Boot와 비교하면 다음과 비슷하다.

```text
spring.profiles.active=local  -> APP_ENV=local
application-local.yml         -> .env.local
application-dev.yml           -> .env.dev
application-prod.yml          -> .env.prod
```

NestJS에서는 `ConfigModule`이 env 파일을 읽고, 이 샘플의 `src/config/environment.ts`가 profile 선택과 required variable validation을 담당한다.

## Error Handling

Spring Boot에서 domain exception 또는 `ResponseStatusException`을 던져 HTTP status로 변환하듯이, NestJS에서는 framework exception을 던진다.

```ts
throw new NotFoundException(`User ${id} was not found`);
throw new ConflictException('A user with this email already exists');
```

이 샘플은 Prisma known error를 다음처럼 HTTP exception으로 매핑한다.

```text
Prisma P2002 -> 409 Conflict
Prisma P2025 -> 404 Not Found
```

응답 형식을 전역으로 맞추는 방법은 Spring Boot의 `@ControllerAdvice` + `@ExceptionHandler`와 NestJS의 `ExceptionFilter`가 비슷한 역할을 한다.

Spring Boot에서는 보통 다음처럼 controller 밖에 공통 예외 처리 클래스를 둔다.

```java
@RestControllerAdvice
class GlobalExceptionHandler {
  @ExceptionHandler(NotFoundException.class)
  ResponseEntity<ErrorResponse> handleNotFound(NotFoundException exception) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(ErrorResponse.from(exception));
  }
}
```

NestJS에서는 `ExceptionFilter`를 만들고 `APP_FILTER` provider로 전역 등록한다.

```ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter<HttpException> {
  catch(exception: HttpException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    response.status(exception.getStatus()).json({
      statusCode: exception.getStatus(),
      code: 'NOT_FOUND',
      message: exception.message,
    });
  }
}
```

이 샘플은 `src/common/errors/filters/http-exception.filter.ts`에서 HTTP exception 응답을 다음 형태로 표준화한다.

```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "User was not found",
  "path": "/api/users/...",
  "timestamp": "2026-06-12T05:00:00.000Z"
}
```

Validation 실패는 `details` 배열을 추가한다.

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "path": "/api/users",
  "timestamp": "2026-06-12T05:00:00.000Z",
  "details": ["email must be an email"]
}
```

비교하면 다음과 같다.

| Spring Boot | NestJS |
| --- | --- |
| `@RestControllerAdvice` | `ExceptionFilter` |
| `@ExceptionHandler` | `@Catch()` |
| `ResponseEntity<ErrorResponse>` | `response.status(...).json(...)` |
| bean으로 등록 | `APP_FILTER` provider 또는 `app.useGlobalFilters()` |
| validation error는 `MethodArgumentNotValidException` 등으로 처리 | validation error는 `ValidationPipe`가 `BadRequestException`을 만들고 filter가 변환 |

## Authentication And Authorization

Spring Security에서 filter chain을 통해 JWT를 읽고 `SecurityContext`를 채우는 흐름은 NestJS에서 guard와 Passport strategy 조합으로 표현한다.

이 샘플의 인증 흐름은 다음과 같다.

```text
POST /api/auth/login
-> AuthService가 email/password 확인
-> JwtService가 access token 발급
-> JwtStrategy가 bearer token 검증
-> JwtAuthGuard가 request.user 구성
-> RolesGuard가 role metadata 확인
```

Signup, login, protected API sequence diagram은 `docs/nestjs-request-lifecycle.md`에 정리한다.

Spring Security와 비교하면 다음처럼 대응된다.

| Spring Security | NestJS sample | 역할 |
| --- | --- | --- |
| `SecurityFilterChain` | `JwtAuthGuard`, `RolesGuard` | 요청별 인증/인가 흐름 적용 |
| `OncePerRequestFilter` | Passport `JwtStrategy` + guard | bearer token 추출과 검증 |
| `AuthenticationManager` | `AuthService.login()` | credential 검증 진입점 |
| `UserDetailsService` | Prisma `user.findUnique()` | email 기준 사용자 조회 |
| `PasswordEncoder` | `PasswordService` with bcryptjs | password hash/compare |
| `SecurityContextHolder` | `request.user` | 인증된 사용자 context |
| `@AuthenticationPrincipal` | `@CurrentUser()` | controller method에서 현재 사용자 주입 |
| `@PreAuthorize("hasRole('ADMIN')")` | `@Roles(Role.ADMIN)` + `RolesGuard` | role 기반 method authorization |

Spring Boot에서는 보통 다음처럼 method security를 건다.

```java
@PreAuthorize("hasRole('ADMIN')")
@GetMapping("/users")
List<UserResponse> findAll() {
  return userService.findAll();
}
```

이 샘플에서는 metadata decorator와 guard를 조합한다.

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Get()
findAll(@Query() query: ListUsersQueryDto) {
  return this.usersService.findAll(query);
}
```

NestJS guard는 controller 진입 전에 실행되므로 Spring Security filter나 method security처럼 요청을 조기에 거절할 수 있다. 인증 실패는 `401 Unauthorized`, role 부족은 `403 Forbidden`으로 응답한다.

## Request Context

Spring Boot에서는 요청 단위 공통 정보를 `HttpServletRequest`, `ThreadLocal`, MDC, `SecurityContextHolder`로 다루는 경우가 많다.

NestJS + Node에서는 thread가 아니라 async execution chain을 따라 요청 처리가 이어지므로 이 샘플은 `AsyncLocalStorage` 기반 `RequestContextService`를 사용한다.

```text
RequestIdMiddleware
-> RequestContextMiddleware
-> JwtAuthGuard
-> HttpLoggingInterceptor
-> AppLogger
```

`AppLogger`는 context에 저장된 `requestId`, `currentUserId`, `currentUserRole`을 log metadata에 자동으로 포함한다. 자세한 설명은 `docs/nestjs-request-context.md`에 정리한다.

## Testing

`*.spec.ts` 파일은 Jest 테스트 파일이다.

| NestJS test | Spring Boot test와 비교 |
| --- | --- |
| service unit spec | service 단위 테스트 |
| controller unit spec | controller slice에 가까운 테스트 |
| e2e spec with Supertest | `@SpringBootTest` + MockMvc/WebTestClient 흐름과 유사 |

현재 e2e test는 Prisma를 mock으로 대체한다. 다음 단계에서는 test database를 사용해 실제 migration과 CRUD 흐름을 검증하는 방향으로 확장할 수 있다.
