import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { FacilitySettingsService } from './facility-settings.service';
import { UpdateFacilitySettingsDto } from './dto/update-facility-settings.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings/facility')
export class FacilitySettingsController {
  constructor(private readonly service: FacilitySettingsService) {}

  @Permissions('settings:read')
  @Get()
  get() {
    return this.service.getOrCreate();
  }

  @Permissions('settings:update')
  @Patch()
  update(@Body() dto: UpdateFacilitySettingsDto) {
    return this.service.update(dto);
  }

  @Permissions('settings:update')
  @Post('logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: './uploads/facility',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}${extname(file.originalname)}`;
          cb(null, `logo-${unique}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!/\.(png|jpg|jpeg|svg|webp)$/i.test(file.originalname)) {
          return cb(new BadRequestException('Logo must be an image file (png, jpg, svg, webp)'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const logoUrl = `/uploads/facility/${file.filename}`;
    return this.service.setLogoUrl(logoUrl);
  }
}
