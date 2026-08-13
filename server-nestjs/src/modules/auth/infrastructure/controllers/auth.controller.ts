import { Controller, Post, Get, Body, Res, Req, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../../application/auth.service';
import { ZodValidationPipe } from '../../../../shared/application/validators/validation.pipe';
import { AuthGuard } from '../../../../shared/infrastructure/guards/auth.guard';
import { RequireAuth } from '../../../../shared/application/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../../../shared/infrastructure/middleware/auth.middleware';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  wantsModerator: z.boolean().optional(),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  path: '/',
};

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(credentialsSchema)) body: z.infer<typeof credentialsSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register(body.email, body.password, body.wantsModerator);
    res.cookie('token', this.authService.signToken(user), COOKIE_OPTIONS);
    res.status(201);
    return user;
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(credentialsSchema.omit({ wantsModerator: true })))
    body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.login(body.email, body.password);
    res.cookie('token', this.authService.signToken(user), COOKIE_OPTIONS);
    return user;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', COOKIE_OPTIONS);
    res.status(204);
    return;
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @RequireAuth()
  async me(@Req() req: AuthenticatedRequest) {
    return this.authService.me(req.user!.userId);
  }
}
