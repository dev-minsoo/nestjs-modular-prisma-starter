# NestJS Decorators

NestJS 코드를 보면 `@Controller`, `@Get`, `@Injectable`, `@Body`처럼 `@`로 시작하는 문법이 자주 나온다. TypeScript에서는 이것을 decorator라고 부른다.

Decorator는 class, method, parameter, property에 metadata를 붙이는 문법이다. NestJS는 이 metadata를 읽어서 routing, dependency injection, validation, Swagger 문서 생성을 구성한다.

## Why NestJS Uses Decorators

NestJS는 선언적인 스타일을 선호한다.

```ts
@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
```

위 코드는 다음 의미를 갖는다.

- `@Controller('users')`: 이 class는 `/users` 경로를 담당하는 controller다.
- `@Get()`: 이 method는 `GET /users` 요청을 처리한다.

즉 route table을 별도 파일에 직접 등록하기보다, controller 코드 가까이에 metadata를 선언한다.

## Common Decorator Types

### Module Decorators

```ts
@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

`@Module()`은 NestJS가 feature 단위를 조립하는 방법을 알려준다.

- `imports`: 이 module이 가져올 다른 module
- `controllers`: HTTP endpoint를 가진 controller
- `providers`: DI container에 등록할 service/provider

### Provider Decorators

```ts
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
}
```

`@Injectable()`은 이 class를 Nest DI container가 관리할 수 있는 provider로 표시한다. 생성자에 선언한 dependency는 Nest가 주입한다.

### Controller And Route Decorators

```ts
@Controller('users')
export class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }
}
```

자주 쓰는 route decorator는 다음과 같다.

| Decorator | 역할 |
| --- | --- |
| `@Controller('users')` | controller의 base path 설정 |
| `@Get()` | HTTP GET endpoint |
| `@Post()` | HTTP POST endpoint |
| `@Patch()` | HTTP PATCH endpoint |
| `@Delete()` | HTTP DELETE endpoint |
| `@HttpCode(204)` | 응답 status code 지정 |

### Parameter Decorators

Parameter decorator는 HTTP request에서 특정 값을 꺼내 method argument로 전달한다.

```ts
create(@Body() dto: CreateUserDto)
findOne(@Param('id') id: string)
findAll(@Query() query: ListUsersQueryDto)
```

| Decorator | 가져오는 값 | 예시 |
| --- | --- | --- |
| `@Body()` | request body | `{ "email": "minsoo@example.com" }` |
| `@Param('id')` | path parameter | `/users/:id` |
| `@Query()` | query string | `?page=1&pageSize=20` |

예를 들어 다음 요청이 들어오면:

```http
PATCH /api/users/2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524?notify=true
Content-Type: application/json

{
  "name": "Minsoo Kim"
}
```

NestJS에서는 다음처럼 받을 수 있다.

```ts
update(
  @Param('id') id: string,
  @Query('notify') notify: string,
  @Body() dto: UpdateUserDto,
) {
  return this.usersService.update(id, dto);
}
```

### Validation Decorators

DTO에는 `class-validator` decorator를 붙인다.

```ts
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
```

이 decorator들은 `ValidationPipe`와 함께 동작한다.

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

이 설정이 있으면 NestJS는 request body/query를 DTO class로 변환하고 validation decorator를 기준으로 검증한다.

### Swagger Decorators

Swagger 문서 생성을 위해 `@nestjs/swagger` decorator를 사용한다.

```ts
@ApiTags('users')
@Controller('users')
export class UsersController {
  @Post()
  @ApiCreatedResponse({ type: UserResponseDto })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
```

DTO에도 문서용 decorator를 붙일 수 있다.

```ts
export class UserResponseDto {
  @ApiProperty({ example: 'minsoo@example.com' })
  email!: string;
}
```

Swagger decorator는 runtime 동작보다 OpenAPI 문서 생성을 위한 metadata에 가깝다.

## Comparison With Spring Annotations

Spring Boot의 annotation과 NestJS decorator는 겉모습과 목적이 비슷하다.

| NestJS | Spring Boot | 역할 |
| --- | --- | --- |
| `@Controller()` | `@RestController` | HTTP controller 선언 |
| `@Get()` | `@GetMapping` | GET route 선언 |
| `@Post()` | `@PostMapping` | POST route 선언 |
| `@Body()` | `@RequestBody` | request body binding |
| `@Param()` | `@PathVariable` | path variable binding |
| `@Query()` | `@RequestParam` | query string binding |
| `@Injectable()` | `@Service`, `@Component` | DI 대상 provider 선언 |
| `@Module()` | `@Configuration` + component scan 설정 | module/provider 조립 |

하지만 구현 방식은 다르다.

- Spring annotation은 Java annotation이고, Spring container가 reflection/proxy 등을 통해 해석한다.
- NestJS decorator는 TypeScript decorator이고, Nest container가 metadata를 읽어 routing과 DI를 구성한다.
- Spring은 component scan에 의존하는 경우가 많고, NestJS는 module의 `controllers`, `providers`, `imports`에 더 명시적으로 등록한다.

## Things To Watch

Decorator는 framework metadata를 선언하는 도구다. 비즈니스 로직을 decorator 안에 숨기기보다, controller/service method 안에서 읽히도록 유지하는 편이 좋다.

또한 TypeScript decorator는 runtime metadata에 의존한다. 이 프로젝트의 `tsconfig.json`에도 다음 설정이 들어 있다.

```json
{
  "emitDecoratorMetadata": true,
  "experimentalDecorators": true
}
```

NestJS 프로젝트에서는 이 두 설정이 decorator 기반 DI와 validation 흐름에 중요하다.
