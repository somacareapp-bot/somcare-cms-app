import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoginSessionService } from './login-session.service';
import { UpdateLoginSessionSettingsDto } from './dto/update-login-session-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('settings/login-session')
export class LoginSessionController {
  constructor(private readonly service: LoginSessionService) {}

  @Get()
  get() {
    return this.service.getOrCreate();
  }

  @Patch()
  update(@Body() dto: UpdateLoginSessionSettingsDto) {
    return this.service.update(dto);
  }
}
