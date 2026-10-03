import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BackupService } from './backup.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('backup')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Permissions('backup:manage')
  @Get()
  list() {
    return this.service.list();
  }

  @Permissions('backup:manage')
  @Post()
  create() {
    return this.service.create();
  }

  @Permissions('backup:manage')
  @Get(':filename/download')
  download(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.service.getFilePath(filename);
    res.download(filePath);
  }

  @Permissions('backup:manage')
  @Post(':filename/restore')
  async restoreExisting(@Param('filename') filename: string) {
    await this.service.restoreFromExisting(filename);
    return { restored: true };
  }

  @Permissions('backup:manage')
  @Delete(':filename')
  remove(@Param('filename') filename: string) {
    this.service.delete(filename);
    return { deleted: true };
  }

  @Permissions('backup:manage')
  @Post('restore-upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = './uploads/backup-restore-tmp';
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `upload-${Date.now()}${extname(file.originalname) || '.dump'}`),
      }),
      fileFilter: (_req, file, cb) => {
        if (!/\.dump$/i.test(file.originalname)) {
          return cb(new BadRequestException('Restore file must be a .dump backup'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
    }),
  )
  async restoreUpload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    try {
      await this.service.restoreFromPath(file.path);
    } finally {
      fs.unlink(file.path, () => {});
    }
    return { restored: true };
  }
}
