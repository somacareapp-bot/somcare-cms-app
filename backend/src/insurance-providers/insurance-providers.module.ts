import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceProvider } from './entities/insurance-provider.entity';
import { InsuranceProvidersService } from './insurance-providers.service';
import { InsuranceProvidersController } from './insurance-providers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InsuranceProvider])],
  controllers: [InsuranceProvidersController],
  providers: [InsuranceProvidersService],
  exports: [InsuranceProvidersService],
})
export class InsuranceProvidersModule {}
