import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientDto } from './dto/query-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepo: Repository<Patient>,
  ) {}

  private async generatePatientNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.patientsRepo.count({
      where: { patientNumber: ILike(`PT-${year}-%`) },
      withDeleted: true,
    });
    const next = (count + 1).toString().padStart(6, '0');
    return `PT-${year}-${next}`;
  }

  async create(dto: CreatePatientDto, userId?: string): Promise<Patient> {
    const patientNumber = await this.generatePatientNumber();
    const patient = this.patientsRepo.create({
      ...dto,
      patientNumber,
      registrationDate: new Date(),
      createdBy: userId,
    } as any);
    return this.patientsRepo.save(patient) as unknown as Patient;
  }

  async findAll(query: QueryPatientDto) {
    const { search, page = 1, limit = 20, patientType, patientStatus } = query;
    const qb = this.patientsRepo.createQueryBuilder('patient');

    if (search) {
      qb.andWhere(
        '(patient.firstName ILIKE :search OR patient.lastName ILIKE :search OR patient.patientNumber ILIKE :search OR patient.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (patientType) qb.andWhere('patient.patientType = :patientType', { patientType });
    if (patientStatus) qb.andWhere('patient.patientStatus = :patientStatus', { patientStatus });

    qb.orderBy('patient.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async search(q: string) {
    if (!q) return [];
    return this.patientsRepo
      .createQueryBuilder('patient')
      .where(
        '(patient.firstName ILIKE :q OR patient.lastName ILIKE :q OR patient.patientNumber ILIKE :q OR patient.phone ILIKE :q)',
        { q: `%${q}%` },
      )
      .take(10)
      .getMany();
  }

  async findOne(id: string): Promise<Patient> {
    const patient = await this.patientsRepo.findOne({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, userId: string): Promise<Patient> {
    const patient = await this.findOne(id);
    Object.assign(patient, dto, { updatedBy: userId });
    return this.patientsRepo.save(patient);
  }

  async remove(id: string, userId: string): Promise<void> {
    const patient = await this.findOne(id);
    patient.updatedBy = userId;
    await this.patientsRepo.save(patient);
    await this.patientsRepo.softDelete(id);
  }
}
