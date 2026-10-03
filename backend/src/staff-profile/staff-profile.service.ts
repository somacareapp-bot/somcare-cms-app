// backend/src/staff-profile/staff-profile.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffProfile } from './entities/staff-profile.entity';
import { CvParserService } from './cv-parser.service';
import * as fs from 'fs';
import * as path from 'path';

const CV_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'cvs');

@Injectable()
export class StaffProfileService {
  constructor(
    @InjectRepository(StaffProfile) private readonly repo: Repository<StaffProfile>,
    private readonly cvParser: CvParserService,
  ) {
    if (!fs.existsSync(CV_UPLOAD_DIR)) fs.mkdirSync(CV_UPLOAD_DIR, { recursive: true });
  }

  async getByUserId(userId: string): Promise<StaffProfile> {
    const profile = await this.repo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Staff profile not found');
    return profile;
  }

  async getOrCreate(userId: string): Promise<StaffProfile> {
    let profile = await this.repo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.repo.create({ userId });
      profile = await this.repo.save(profile);
    }
    return profile;
  }

  async update(userId: string, updates: Partial<StaffProfile>): Promise<StaffProfile> {
    const profile = await this.getOrCreate(userId);
    Object.assign(profile, updates);
    return this.repo.save(profile);
  }

  /**
   * Handles CV upload: saves the file, extracts text, parses it into
   * suggested fields, and returns both the saved file reference and the
   * parsed suggestions. Does NOT overwrite existing profile fields —
   * the frontend should show suggestions for the staff/admin to accept
   * or edit before calling update().
   */
  async uploadAndParseCv(userId: string, file: Express.Multer.File) {
    const profile = await this.getOrCreate(userId);

    const filename = `${userId}-${Date.now()}${path.extname(file.originalname)}`;
    const filePath = path.join(CV_UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, file.buffer);

    profile.cvFileUrl = `/uploads/cvs/${filename}`;
    profile.cvOriginalFilename = file.originalname;
    profile.cvUploadedAt = new Date();
    profile.cvParsed = false;
    await this.repo.save(profile);

    let parsed;
    try {
      const rawText = await this.cvParser.extractText(file.buffer, file.mimetype);
      parsed = this.cvParser.parse(rawText);
      profile.cvParsed = true;
      await this.repo.save(profile);
    } catch (err) {
      // Parsing failure shouldn't block the upload — CV is saved either way.
      return { profile, parsed: null, parseError: (err as Error).message };
    }

    return { profile, parsed, parseError: null };
  }

  /** Applies parsed CV suggestions the staff/admin has reviewed and accepted. */
  async applyParsedFields(userId: string, fields: {
    pastExperience?: StaffProfile['pastExperience'];
    education?: StaffProfile['education'];
    skills?: string[];
    phone?: string;
  }) {
    return this.update(userId, fields);
  }
}


