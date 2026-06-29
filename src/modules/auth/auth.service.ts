import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PasswordService } from '../../common/security';
import {
  DuplicateUserEmailError,
  USER_REPOSITORY,
  type UserRepository,
  type UserWithPassword,
} from '../../persistence';
import {
  toUserResponse,
  UserRecord,
} from '../users/utils/user-response.mapper';
import { ACCESS_TOKEN_EXPIRES_IN_SECONDS } from './constants/auth.constants';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import type { AuthenticatedUser } from './types/authenticated-user.type';
import type { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponseDto> {
    const passwordHash = await this.passwordService.hash(dto.password);

    try {
      const user = await this.userRepository.createSignupUser({
        email: dto.email,
        name: dto.name,
        passwordHash,
      });

      return this.createAuthResponse(user);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createAuthResponse(user);
  }

  async getMe(currentUser: AuthenticatedUser): Promise<UserRecord> {
    const user = await this.userRepository.findById(currentUser.id);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    return toUserResponse(user);
  }

  private async createAuthResponse(
    user: UserWithPassword,
  ): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      user: toUserResponse(user),
    };
  }

  private handleRepositoryError(error: unknown): never {
    if (error instanceof DuplicateUserEmailError) {
      throw new ConflictException('A user with this email already exists');
    }

    throw error;
  }
}
