import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, In, Not, MoreThanOrEqual } from 'typeorm';
import { Visit, VisitStatus } from './entities/visit.entity';
import { Prescription } from './entities/prescription.entity';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitStatusDto } from './dto/update-visit-status.dto';
import { UpdateVitalsDto } from './dto/update-vitals.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { UsersService } from '../users/users.service';

import { LabOrder, LabOrderStatus } from '../laboratory/entities/lab-order.entity';
import { RadiologyOrder, RadiologyOrderStatus } from '../radiology/entities/radiology-order.entity';
import { PrescriptionStatus } from './entities/prescription.entity';
@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(Visit)
    private readonly visitsRepo: Repository<Visit>,
    @InjectRepository(Prescription)
    private readonly prescriptionsRepo: Repository<Prescription>,
    @InjectRepository(LabOrder)
    private readonly labOrdersRepo: Repository<LabOrder>,
    @InjectRepository(RadiologyOrder)
    private readonly radiologyOrdersRepo: Repository<RadiologyOrder>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  private async notifyRoles(roleNames: string[], opts: { actorName: string; message: string; link?: string; meta?: Record<string, any> }) {
    const targetRoles = Array.from(new Set([...roleNames, 'administrator']));
    const users = await this.usersService.findByRoleNames(targetRoles);
    await Promise.all(
      users.map((u) =>
        this.notificationsService.create({
          recipientId: u.id,
          actorName: opts.actorName,
          type: NotificationType.PRESCRIPTION,
          message: opts.message,
          link: opts.link,
          meta: opts.meta,
        }),
      ),
    );
  }

  private async generateVisitNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.visitsRepo.count({
      where: { visitNumber: ILike(`VIS-${year}-%`) },
    });
    const next = (count + 1).toString().padStart(6, '0');
    return `VIS-${year}-${next}`;
  }


  async checkIn(dto: CreateVisitDto): Promise<Visit> {
    const visitNumber = await this.generateVisitNumber();
    const visit = this.visitsRepo.create({
      ...dto,
      visitNumber,
      // Registration/WAITING stage removed — patients go straight to
      // Triage once checked in (from an appointment or walk-in).
      status: VisitStatus.IN_TRIAGE,
      checkedInAt: new Date(),
      triageStartedAt: new Date(),
    });
    return this.visitsRepo.save(visit);
  }

  // Public, unauthenticated - this is what the QR code on patient receipts
  // links to. patientNumber acts as a lightweight shared-secret check so a
  // guessed appointmentId alone can't pull up someone else's status.
  async findPublicStatus(appointmentId: string, patientNumber: string) {
    const visit = await this.visitsRepo.findOne({
      where: { appointmentId },
      relations: ['patient', 'doctor'],
      order: { createdAt: 'DESC' },
    });

    if (!visit || !visit.patient || visit.patient.patientNumber !== patientNumber) {
      throw new NotFoundException('Tracking info not found');
    }

    // Same Lab > Radiology > Pharmacy priority as the queue board's
    // findQueue() — the tracker must show ONE current stage, matching
    // whichever single queue column staff actually see this patient in.
    let subStage: string | null = null;
    let currentItem: { label: string; status: string } | null = null;

    if (visit.status === VisitStatus.WITH_DOCTOR) {
      const [openLab, openRad, openRx] = await Promise.all([
        this.labOrdersRepo.find({
          where: { visitId: visit.id, status: In([LabOrderStatus.ORDERED, LabOrderStatus.SAMPLE_COLLECTED, LabOrderStatus.IN_PROGRESS]) },
          order: { createdAt: 'ASC' },
        }),
        this.radiologyOrdersRepo.find({
          where: { visitId: visit.id, status: In([RadiologyOrderStatus.ORDERED, RadiologyOrderStatus.IN_PROGRESS]) },
          order: { createdAt: 'ASC' },
        }),
        this.prescriptionsRepo.find({
          where: { visitId: visit.id, status: PrescriptionStatus.PENDING },
          order: { createdAt: 'ASC' },
        }),
      ]);

      if (openLab.length > 0) {
        subStage = 'in_lab';
        currentItem = { label: openLab[0].testName, status: openLab[0].status };
      } else if (openRad.length > 0) {
        subStage = 'in_radiology';
        currentItem = { label: openRad[0].testName, status: openRad[0].status };
      } else if (openRx.length > 0) {
        subStage = 'in_pharmacy';
        currentItem = { label: openRx[0].drugName, status: openRx[0].status };
      }
    }

    return {
      stage: visit.status,
      subStage,
      currentItem,
      department: visit.department,
      doctorName: visit.doctor ? ('Dr. ' + visit.doctor.firstName + ' ' + visit.doctor.lastName) : null,
      checkedInAt: visit.checkedInAt,
      triageStartedAt: visit.triageStartedAt,
      consultationStartedAt: visit.consultationStartedAt,
      completedAt: visit.completedAt,
    };
  }

  // Queue board: group by status, only today's active visits by default.
  // WAITING/IN_TRIAGE have no doctor assigned yet, so every clinical role
  // sees those columns in full. WITH_DOCTOR/READY_DISCHARGE are scoped —
  // a doctor only sees the patients actually assigned to them there.
  async findQueue(scopeDoctorId?: string) {
    const visits = await this.visitsRepo.find({
      where: [
        { status: VisitStatus.IN_TRIAGE },
        { status: VisitStatus.WITH_DOCTOR },
        { status: VisitStatus.READY_DISCHARGE },
      ],
      relations: ['patient', 'doctor'],
      order: { checkedInAt: 'ASC' },
    });

    const columns: Record<string, Visit[]> = {
      [VisitStatus.WAITING]: [],
      [VisitStatus.IN_TRIAGE]: [],
      [VisitStatus.WITH_DOCTOR]: [],
      [VisitStatus.READY_DISCHARGE]: [],
      [VisitStatus.COMPLETED]: [],
      [VisitStatus.CANCELLED]: [],
      in_lab: [],
      in_radiology: [],
      in_pharmacy: [],
    };

    // Which of the doctor's patients currently have work open in a department?
    const doctorVisitIds = visits.filter((v) => v.status === VisitStatus.WITH_DOCTOR).map((v) => v.id);
    const inLab = new Set<string>();
    const inRadiology = new Set<string>();
    const inPharmacy = new Set<string>();

    if (doctorVisitIds.length) {
      const [labs, rads, rxs] = await Promise.all([
        this.labOrdersRepo.find({
          select: ['visitId'],
          where: {
            visitId: In(doctorVisitIds),
            status: In([LabOrderStatus.ORDERED, LabOrderStatus.SAMPLE_COLLECTED, LabOrderStatus.IN_PROGRESS]),
          },
        }),
        this.radiologyOrdersRepo.find({
          select: ['visitId'],
          where: {
            visitId: In(doctorVisitIds),
            status: In([RadiologyOrderStatus.ORDERED, RadiologyOrderStatus.IN_PROGRESS]),
          },
        }),
        this.prescriptionsRepo.find({
          select: ['visitId'],
          where: {
            visitId: In(doctorVisitIds),
            status: Not(In([PrescriptionStatus.DISPENSED, PrescriptionStatus.CANCELLED])),
          },
        }),
      ]);
      labs.forEach((o) => inLab.add(o.visitId));
      rads.forEach((o) => inRadiology.add(o.visitId));
      rxs.forEach((p) => inPharmacy.add(p.visitId));
    }

    // Completed today: findQueue() otherwise never looks at COMPLETED visits at all,
    // so the Completed column would stay empty forever. This shows same-day completions.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayCompletedVisits = await this.visitsRepo.find({
      where: { status: VisitStatus.COMPLETED, completedAt: MoreThanOrEqual(startOfToday) },
      relations: ['patient', 'doctor'],
      order: { completedAt: 'DESC' },
    });
    columns[VisitStatus.COMPLETED].push(...todayCompletedVisits);

    const scopedStatuses = new Set([VisitStatus.WITH_DOCTOR, VisitStatus.READY_DISCHARGE]);
    visits.forEach((v) => {
      if (scopeDoctorId && scopedStatuses.has(v.status) && v.doctorId !== scopeDoctorId) return;

      if (v.status !== VisitStatus.WITH_DOCTOR) {
        columns[v.status].push(v);
        return;
      }

      // Priority order when a patient has open work in more than one
      // department at once: Lab > Radiology > Pharmacy. Only shows in
      // ONE queue column at a time, not split across all matching ones.
      if (inLab.has(v.id)) {
        columns.in_lab.push(v);
      } else if (inRadiology.has(v.id)) {
        columns.in_radiology.push(v);
      } else if (inPharmacy.has(v.id)) {
        columns.in_pharmacy.push(v);
      } else {
        columns[VisitStatus.WITH_DOCTOR].push(v); // nothing outstanding → back with the doctor
      }
    });
    return columns;
  }

  // patientId: optional filter so PatientDetailPage's Appointments/Prescriptions
  // tabs (Prescription has no direct patient FK, only Visit does) can pull
  // just this patient's visits, with prescriptions eager-loaded.
  async findAll(status?: VisitStatus, scopeDoctorId?: string, patientId?: string) {
    const where: any = status ? { status } : {};
    if (scopeDoctorId) where.doctorId = scopeDoctorId;
    if (patientId) where.patientId = patientId;
    return this.visitsRepo.find({
      where,
      relations: ['patient', 'doctor', 'prescriptions'],
      order: { checkedInAt: 'DESC' },
    });
  }

  // scopeDoctorId: 404 (not 403) if the visit belongs to another doctor.
  async findOne(id: string, scopeDoctorId?: string): Promise<Visit> {
    const visit = await this.visitsRepo.findOne({
      where: { id },
      relations: ['patient', 'doctor', 'prescriptions'],
    });
    if (!visit || (scopeDoctorId && visit.doctorId !== scopeDoctorId)) {
      throw new NotFoundException('Visit not found');
    }
    return visit;

  }

  async updateStatus(id: string, dto: UpdateVisitStatusDto, scopeDoctorId?: string): Promise<Visit> {
    const visit = await this.findOne(id, scopeDoctorId);
    visit.status = dto.status;

    if (dto.status === VisitStatus.IN_TRIAGE && !visit.triageStartedAt) {
      visit.triageStartedAt = new Date();
    }
    if (dto.status === VisitStatus.WITH_DOCTOR) {
      if (!visit.consultationStartedAt) visit.consultationStartedAt = new Date();
      if (!visit.doctorId && scopeDoctorId) visit.doctorId = scopeDoctorId;
    }
    if (dto.status === VisitStatus.COMPLETED && !visit.completedAt) {
      visit.completedAt = new Date();
    }

    return this.visitsRepo.save(visit);
  }

  async updateVitals(id: string, dto: UpdateVitalsDto, scopeDoctorId?: string): Promise<Visit> {
    const visit = await this.findOne(id, scopeDoctorId);
    Object.assign(visit, dto);
    visit.vitalsRecordedAt = new Date();
    return this.visitsRepo.save(visit);
  }

  async updateConsultation(id: string, dto: UpdateConsultationDto, scopeDoctorId?: string): Promise<Visit> {
    const visit = await this.findOne(id, scopeDoctorId);
    Object.assign(visit, dto);
    if (!visit.consultationStartedAt) visit.consultationStartedAt = new Date();
    return this.visitsRepo.save(visit);
  }


  async addPrescription(id: string, dto: CreatePrescriptionDto, scopeDoctorId?: string): Promise<Prescription> {
    const visit = await this.findOne(id, scopeDoctorId); // 404 if missing or not this doctor's
    const prescription = this.prescriptionsRepo.create({ ...dto, visitId: id });
    const saved = await this.prescriptionsRepo.save(prescription);

    const doctorName = visit.doctor ? `${visit.doctor.firstName} ${visit.doctor.lastName}` : 'A doctor';
    const patientName = visit.patient ? `${visit.patient.firstName} ${visit.patient.lastName}` : 'a patient';
    await this.notifyRoles(['pharmacist'], {
      actorName: doctorName,
      message: `${doctorName} sent a prescription for ${patientName}: ${dto.drugName}`,
      link: '/pharmacy/prescriptions',
      meta: { prescriptionId: saved.id, visitId: id },
    });

    return saved;
  }

  async removePrescription(visitId: string, prescriptionId: string, scopeDoctorId?: string): Promise<void> {
    await this.findOne(visitId, scopeDoctorId);
    await this.prescriptionsRepo.delete({ id: prescriptionId, visitId });
  }

  async complete(id: string, scopeDoctorId?: string): Promise<Visit> {
    return this.updateStatus(id, { status: VisitStatus.COMPLETED }, scopeDoctorId);
  }
}
