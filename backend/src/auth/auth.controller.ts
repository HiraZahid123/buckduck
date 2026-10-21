import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; pass: string; password?: string }) {
    const password = body.pass || body.password || '';
    const user = await this.authService.validateUser(body.email, password);
    return this.authService.login(user);
  }

  @Post('demo-login')
  async demoLogin(@Body() body: { role: string }) {
    return this.authService.demoLoginByRole(body.role || 'customer');
  }

  @Post('register')
  async register(@Body() body: { email: string; password: string; name: string; role?: string; phone?: string; vehicle?: string }) {
    return this.authService.register(body);
  }

  @Get('demo-users')
  async getDemoUsers() {
    return this.authService.getDemoUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }
}
