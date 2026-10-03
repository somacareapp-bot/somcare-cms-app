// backend/src/staff-profile/staff-profile.controller.ts
import {
  Controller, Get, Put, Post, Param, Body, UseGuards, UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { StaffProfileService } from './staff-profile.service';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];
const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

@UseGuards(JwtAuthGuard)
@Controller('staff-profiles')
export class StaffProfileController {
  constructor(private readonly staffProfileService: StaffProfileService) {}

  @UseGuards(PermissionsGuard)
  @Permissions('staff:read')
  @Get(':userId')
  get(@Param('userId') userId: string) {
    return this.staffProfileService.getOrCreate(userId);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('staff:update')
  @Put(':userId')
  update(@Param('userId') userId: string, @Body() body: any) {
    return this.staffProfileService.update(userId, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('staff:update')
  @Post(':userId/cv')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCv(@Param('userId') userId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF and DOCX files are supported');
    }
    if (file.size > MAX_CV_SIZE_BYTES) {
      throw new BadRequestException('CV file must be under 5MB');
    }
    return this.staffProfileService.uploadAndParseCv(userId, file);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('staff:update')
  @Put(':userId/apply-parsed')
  applyParsed(@Param('userId') userId: string, @Body() body: any) {
    return this.staffProfileService.applyParsedFields(userId, body);
  }
}


