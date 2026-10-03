import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginSessionSettings } from './entities/login-session-settings.entity';
import { LoginSessionService } from './login-session.service';
import { LoginSessionController } from './login-session.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LoginSessionSettings])],
  controllers: [LoginSessionController],
  providers: [LoginSessionService],
  exports: [TypeOrmModule],
})
export class LoginSessionModule {}
