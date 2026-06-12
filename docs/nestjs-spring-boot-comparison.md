# NestJS And Spring Boot Comparison

이 문서는 Java/Spring Boot에 익숙한 개발자가 이 NestJS 샘플의 구조를 이해할 때 참고하기 위한 비교 자료다.

## Request Flow

이 프로젝트의 기본 흐름은 다음과 같다.

```text
Controller -> Service -> Prisma -> PostgreSQL
```

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

## Testing

`*.spec.ts` 파일은 Jest 테스트 파일이다.

| NestJS test | Spring Boot test와 비교 |
| --- | --- |
| service unit spec | service 단위 테스트 |
| controller unit spec | controller slice에 가까운 테스트 |
| e2e spec with Supertest | `@SpringBootTest` + MockMvc/WebTestClient 흐름과 유사 |

현재 e2e test는 Prisma를 mock으로 대체한다. 다음 단계에서는 test database를 사용해 실제 migration과 CRUD 흐름을 검증하는 방향으로 확장할 수 있다.
