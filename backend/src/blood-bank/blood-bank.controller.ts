import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { BloodBankService } from './blood-bank.service';
import { AddUnitsDto } from './dto/add-units.dto';
import { IssueUnitsDto } from './dto/issue-units.dto';
import { CreateDonationDto } from './dto/create-donation.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('blood-bank')
export class BloodBankController {
  constructor(private readonly bloodBankService: BloodBankService) {}

  @Permissions('bloodbank:read')
  @Get('inventory')
  getInventory() {
    return this.bloodBankService.getInventory();
  }

  @Permissions('bloodbank:update')
  @Post('inventory/add')
  addUnits(@Body() dto: AddUnitsDto, @Req() req: AuthenticatedRequest) {
    return this.bloodBankService.addUnits(dto, req.user.id);
  }

  @Permissions('bloodbank:update')
  @Post('inventory/issue')
  issueUnits(@Body() dto: IssueUnitsDto, @Req() req: AuthenticatedRequest) {
    return this.bloodBankService.issueUnits(dto, req.user.id);
  }

  @Permissions('bloodbank:read')
  @Get('donors')
  getDonors() {
    return this.bloodBankService.getDonors();
  }

  @Permissions('bloodbank:create')
  @Post('donations')
  recordDonation(@Body() dto: CreateDonationDto, @Req() req: AuthenticatedRequest) {
    return this.bloodBankService.recordDonation(dto, req.user.id);
  }
}
