import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PasswordService } from '../../common/security';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
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

type UserWithPassword = UserRecord & {
  passwordHash: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponseDto> {
    const role = await this.resolveSignupRole();
    const passwordHash = await this.passwordService.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
          role,
        },
      });

      return this.createAuthResponse(user);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

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
    const user = await this.prisma.user.findUnique({
      where: {
        id: currentUser.id,
      },
    });

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

  private async resolveSignupRole(): Promise<Role> {
    const adminCount = await this.prisma.user.count({
      where: {
        role: Role.ADMIN,
      },
    });

    return adminCount === 0 ? Role.ADMIN : Role.USER;
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A user with this email already exists');
    }

    throw error;
  }
}
