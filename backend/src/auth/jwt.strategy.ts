import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'buckduck_super_secure_jwt_secret_key_2026',
    });
  }

  async validate(payload: { sub: number; email: string; role: string }) {
    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      include: {
        stores: true,
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User not authorized or inactive');
    }

    return user;
  }
}
