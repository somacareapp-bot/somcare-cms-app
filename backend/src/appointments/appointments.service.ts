import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Appointment } from './appointment.entity';
import { Visit } from '../visits/entities/visit.entity';

interface FindAllParams {
  page?: number;
  limit?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  doctorId?: string;
  patientId?: string;
  search?: string;
}

export interface DuplicateWarning {
  type: 'appointment' | 'visit';
  id: string;
  status: string;
  doctorName?: string;
  department?: string;
  when: string;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private repo: Repository<Appointment>,
    @InjectRepository(Visit)
    private visitsRepo: Repository<Visit>,
  ) {}

  async create(data: Partial<Appointment>): Promise<Appointment> {
    const appt = this.repo.create(data);
    return this.repo.save(appt);
  }

  // Looks for either (a) an existing appointment for this patient that
  // hasn't been checked in yet, or (b) an active visit (checked in but
  // not yet completed/cancelled) — for the same patient, and optionally
  // narrowed to the same doctor and/or department. Non-blocking: the
  // frontend shows this as a warning and lets the user book anyway.
  // Completed/cancelled/discharged visits never match — a patient who
  // was already seen and discharged can always be booked again.
  async checkDuplicate(
    patientId: string,
    doctorId?: string,
    department?: string,
  ): Promise<DuplicateWarning | null> {
    if (!patientId) return null;

    const apptQb = this.repo
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .where('appointment.patientId = :patientId', { patientId })
      .andWhere('appointment.status IN (:...statuses)', { statuses: ['scheduled', 'confirmed'] })
      .orderBy('appointment.appointmentDate', 'DESC')
      .addOrderBy('appointment.appointmentTime', 'DESC');
    if (department) apptQb.andWhere('appointment.department = :department', { department });
    if (doctorId) apptQb.andWhere('appointment.doctorId = :doctorId', { doctorId });

    const existingAppt = await apptQb.getOne();
    if (existingAppt) {
      return {
        type: 'appointment',
        id: existingAppt.id,
        status: existingAppt.status,
        doctorName: existingAppt.doctor
          ? `${existingAppt.doctor.firstName} ${existingAppt.doctor.lastName}`
          : undefined,
        department: existingAppt.department,
        when: `${existingAppt.appointmentDate} ${existingAppt.appointmentTime}`,
      };
    }

    const visitQb = this.visitsRepo
      .createQueryBuilder('visit')
      .leftJoinAndSelect('visit.doctor', 'doctor')
      .where('visit.patientId = :patientId', { patientId })
      .andWhere('visit.status NOT IN (:...statuses)', { statuses: ['completed', 'cancelled'] })
      .orderBy('visit.createdAt', 'DESC');
    if (department) visitQb.andWhere('visit.department = :department', { department });
    if (doctorId) visitQb.andWhere('visit.doctorId = :doctorId', { doctorId });

    const existingVisit = await visitQb.getOne();
    if (existingVisit) {
      return {
        type: 'visit',
        id: existingVisit.id,
        status: existingVisit.status,
        doctorName: existingVisit.doctor
          ? `${existingVisit.doctor.firstName} ${existingVisit.doctor.lastName}`
          : undefined,
        department: existingVisit.department,
        when: existingVisit.createdAt.toISOString(),
      };
    }

    return null;
  }

  // For any appointment stuck on 'waiting' (its terminal status by design —
  // see appointment-transitions.util.ts), pull in the current status of the
  // Visit that check-in created, so lists don't show "Waiting" forever for a
  // patient who has actually moved through triage, consultation, or been
  // discharged. Appointment.status itself is left untouched.
  private async attachVisitStatus<T extends Appointment>(appointments: T[]): Promise<any[]> {
    const waitingIds = appointments.filter((a) => a.status === 'waiting').map((a) => a.id);
    if (!waitingIds.length) return appointments;

    const visits = await this.visitsRepo.find({
      where: { appointmentId: In(waitingIds) },
      order: { createdAt: 'DESC' },
    });
    const latestByAppointment = new Map<string, string>();
    for (const v of visits) {
      if (!latestByAppointment.has(v.appointmentId)) {
        latestByAppointment.set(v.appointmentId, v.status);
      }
    }

    return appointments.map((a) => ({
      ...a,
      visitStatus: latestByAppointment.get(a.id) ?? null,
    }));
  }

  // scopeDoctorId: when set, results are forced to this doctor regardless
  // of the doctorId query param (a doctor can't ask to see someone else's).
  async findAll(params: FindAllParams, scopeDoctorId?: string) {
    const { page = 1, limit = 20, date, dateFrom, dateTo, status, doctorId, patientId, search } = params;

    const qb = this.repo
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .orderBy('appointment.appointmentDate', 'ASC')
      .addOrderBy('appointment.appointmentTime', 'ASC');

    if (date) {
      qb.andWhere('appointment.appointmentDate = :date', { date });
    } else if (dateFrom && dateTo) {
      qb.andWhere('appointment.appointmentDate BETWEEN :dateFrom AND :dateTo', { dateFrom, dateTo });
    } else if (dateFrom) {
      qb.andWhere('appointment.appointmentDate >= :dateFrom', { dateFrom });
    }

    if (status) {
      qb.andWhere('appointment.status = :status', { status });
    }

    if (scopeDoctorId) {
      qb.andWhere('appointment.doctorId = :scopeDoctorId', { scopeDoctorId });
    } else if (doctorId) {
      qb.andWhere('appointment.doctorId = :doctorId', { doctorId });
    }

    // Patient Detail page's Appointments tab: pull only this patient's rows.
    if (patientId) {
      qb.andWhere('appointment.patientId = :patientId', { patientId });
    }

    if (search) {
      qb.andWhere(
        '(patient.firstName ILIKE :s OR patient.lastName ILIKE :s OR patient.patientNumber ILIKE :s OR patient.phone ILIKE :s OR doctor.firstName ILIKE :s OR doctor.lastName ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    qb.skip((page - 1) * limit).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    const data = await this.attachVisitStatus(rows);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  // scopeDoctorId: if set and the appointment belongs to someone else,
  // this throws 404 — not 403 — so a doctor can't confirm a record exists.
  async findOne(id: string, scopeDoctorId?: string): Promise<any> {
    const appt = await this.repo.findOne({ where: { id }, relations: ['patient', 'doctor'] });
    if (!appt || (scopeDoctorId && appt.doctorId !== scopeDoctorId)) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }
    const [enriched] = await this.attachVisitStatus([appt]);
    return enriched;
  }

  async update(id: string, data: Partial<Appointment>, scopeDoctorId?: string): Promise<Appointment> {
    await this.findOne(id, scopeDoctorId);
    await this.repo.update(id, data);
    return this.findOne(id, scopeDoctorId);
  }

  async remove(id: string, scopeDoctorId?: string): Promise<void> {
    await this.findOne(id, scopeDoctorId);
    await this.repo.delete(id);
  }
}
