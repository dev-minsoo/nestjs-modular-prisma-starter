# VSCode Debugging

이 문서는 IntelliJ + Spring Boot에서 breakpoint를 잡아 디버깅하던 흐름을 VSCode + NestJS에서 재현하는 방법을 정리한다.

## Before Debugging

처음 한 번은 local DB와 env를 준비한다.

```bash
npm install
cp .env.local.example .env.local
npm run docker:up
npm run db:migrate
```

VSCode의 Run and Debug 패널에서 이 프로젝트가 제공하는 launch configuration을 선택한다.

```text
.vscode/launch.json
```

## Debug Local App

가장 IntelliJ의 "Debug Application"과 비슷한 방식이다.

1. VSCode 왼쪽 Run and Debug 패널을 연다.
2. `NestJS: debug local app`을 선택한다.
3. Start Debugging을 누른다.
4. controller, service, guard, interceptor에 breakpoint를 건다.
5. Swagger 또는 curl로 API를 호출한다.

Swagger UI:

```text
http://localhost:3000/docs
```

예시 curl:

```bash
curl http://localhost:3000/api/health
```

이 configuration은 `src/main.ts`를 `ts-node`로 직접 실행한다. watch mode는 아니지만 breakpoint 확인에는 가장 단순하다.

## Attach To Watch Mode

파일 변경 watch가 필요하면 터미널에서 Nest debug mode를 먼저 실행한다.

```bash
npm run start:debug
```

그 다음 VSCode Run and Debug 패널에서 다음을 선택한다.

```text
NestJS: attach to npm run start:debug
```

이 방식은 Spring Boot에서 이미 떠 있는 JVM debug port에 attach하는 것과 비슷하다.

```text
Spring Boot remote debug port
-> Node inspector port 9229
```

## Debug Jest

현재 열고 있는 spec 파일만 디버깅할 때는 다음 configuration을 사용한다.

```text
Jest: debug current file
```

사용법:

1. 디버깅할 `*.spec.ts` 파일을 연다.
2. 테스트하고 싶은 service/controller line에 breakpoint를 건다.
3. `Jest: debug current file`을 실행한다.

이 configuration은 내부적으로 다음과 비슷한 일을 한다.

```bash
APP_ENV=test jest --runTestsByPath <current-file> --runInBand
```

`--runInBand`를 쓰는 이유는 Jest worker를 여러 개 띄우면 breakpoint 흐름이 분산되어 디버깅하기 불편하기 때문이다.

## Good Breakpoint Spots

요청 흐름을 따라 보고 싶다면 이 순서로 breakpoint를 걸면 된다.

```text
RequestIdMiddleware
RequestContextMiddleware
JwtStrategy.validate
RolesGuard.canActivate
HttpLoggingInterceptor.intercept
Controller method
Service method
PrismaService.runInTransaction
HttpExceptionFilter.catch
```

Spring Boot와 비교하면 다음과 비슷하다.

| Spring Boot | NestJS sample |
| --- | --- |
| Servlet Filter | Middleware |
| Spring Security Filter | Guard + Passport Strategy |
| HandlerInterceptor | Nest Interceptor |
| `@RestController` | Controller |
| `@Service` | Service |
| `@Transactional` boundary | `PrismaService.runInTransaction()` |
| `@ControllerAdvice` | ExceptionFilter |

## Practical Tips

- breakpoint가 안 잡히면 VSCode Debug Console이 아니라 Integrated Terminal에서 앱이 실제로 켜졌는지 확인한다.
- Swagger로 테스트할 때 인증 API는 먼저 `/api/auth/signup` 또는 `/api/auth/login`으로 token을 받은 뒤 Authorize에 Bearer token을 넣는다.
- Prisma generated client 내부보다는 `PrismaService`, 각 service method, transaction callback에 breakpoint를 거는 편이 낫다.
- request context를 보고 싶으면 `this.requestContext.getStore()`를 watch expression에 넣는다.
- JWT 인증 이후 값을 보고 싶으면 `request.user` 또는 `this.requestContext.getCurrentUser()`를 확인한다.
