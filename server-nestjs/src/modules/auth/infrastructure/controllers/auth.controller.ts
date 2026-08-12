import { Controller, Post, Body, Get, UseGuards, Res, Req } from '@nestjs/common';
import { Response } from 'express';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RegisterDto, RegisterDtoSchema } from '../../application/dto/register.dto';
import { LoginDto, LoginDtoSchema } from '../../application/dto/login.dto';
import { ZodValidationPipe } from '../../../../shared/application/validators/validation.pipe';
import { AuthGuard, AuthenticatedRequest } from '../../../../shared/infrastructure/guards/auth.guard';
import { UserMapper } from '../mappers/user.mapper';
import { UserRepository } from '../../application/interfaces/user.repository.interface';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly userRepository: UserRepository,
  ) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(RegisterDtoSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const user = await this.registerUseCase.execute(dto);
      const userResponse = UserMapper.toResponse(user);

      // Set auth cookie
      const token = await this.generateToken(user);
      this.setAuthCookie(res, token);

      res.status(201).json(userResponse);
    } catch (error) {
      if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginDtoSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const authResponse = await this.loginUseCase.execute(dto);
      
      // Set auth cookie
      this.setAuthCookie(res, authResponse.token);

      res.json(authResponse.user);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookie(res);
    res.status(204).send();
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@Req() req: AuthenticatedRequest) {
    const user = await this.userRepository.findById(req.user.userId);
    
    if (!user) {
      return { error: 'User not found' };
    }

    return UserMapper.toResponse(user);
  }

  private async generateToken(user: any): Promise<string> {
    // This should use JwtService, but for simplicity here
    // In a real implementation, we'd inject JwtService
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: '7d' },
    );
  }

  private setAuthCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }

  private clearAuthCookie(res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
    });
  }
}