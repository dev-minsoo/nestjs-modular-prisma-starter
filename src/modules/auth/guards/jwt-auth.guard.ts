import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JWT_STRATEGY_NAME } from '../constants/auth.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_STRATEGY_NAME) {}
