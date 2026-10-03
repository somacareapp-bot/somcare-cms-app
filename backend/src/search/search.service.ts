import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { Visit } from '../visits/entities/visit.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Invoice } from '../billing/entities/invoice.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Patient) private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Visit) private readonly visitsRepo: Repository<Visit>,
    @InjectRepository(Appointment) private readonly appointmentsRepo: Repository<Appointment>,
    @InjectRepository(Invoice) private readonly invoicesRepo: Repository<Invoice>,
  ) {}

  // Broad, cross-entity search used by the top navbar's global search box.
  // Matches patient name/code/phone across Patients, Visits (via their
  // patient), Appointments (via patient or doctor), and Invoices (via
  // invoice number/patient name, plus a manual join to Patient for
  // code/phone since Invoice has no FK relation to Patient).
  async search(q: string) {
    const empty = { patients: [], visits: [], appointments: [], invoices: [] };
    if (!q || !q.trim()) return empty;

    const term = `%${q.trim()}%`;

    const [patients, visits, appointments, invoices] = await Promise.all([
      this.patientsRepo
        .createQueryBuilder('patient')
        .where(
          '(patient.firstName ILIKE :q OR patient.lastName ILIKE :q OR patient.patientNumber ILIKE :q OR patient.phone ILIKE :q)',
          { q: term },
        )
        .take(5)
        .getMany(),

      this.visitsRepo
        .createQueryBuilder('visit')
        .leftJoinAndSelect('visit.patient', 'patient')
        .where(
          '(visit.visitNumber ILIKE :q OR patient.firstName ILIKE :q OR patient.lastName ILIKE :q OR patient.patientNumber ILIKE :q OR patient.phone ILIKE :q)',
          { q: term },
        )
        .take(5)
        .getMany(),

      this.appointmentsRepo
        .createQueryBuilder('appointment')
        .leftJoinAndSelect('appointment.patient', 'patient')
        .leftJoinAndSelect('appointment.doctor', 'doctor')
        .where(
          '(patient.firstName ILIKE :q OR patient.lastName ILIKE :q OR patient.patientNumber ILIKE :q OR patient.phone ILIKE :q OR doctor.firstName ILIKE :q OR doctor.lastName ILIKE :q)',
          { q: term },
        )
        .take(5)
        .getMany(),

      this.invoicesRepo
        .createQueryBuilder('invoice')
        .leftJoin(Patient, 'patient', 'patient.id::text = invoice.patientId')
        .where(
          '(invoice.invoiceNumber ILIKE :q OR invoice.patientName ILIKE :q OR patient.patientNumber ILIKE :q OR patient.phone ILIKE :q)',
          { q: term },
        )
        .take(5)
        .getMany(),
    ]);

    return {
      patients: patients.map((p) => ({
        id: p.id,
        type: 'patient' as const,
        title: [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' '),
        subtitle: [p.patientNumber, p.phone].filter(Boolean).join(' · '),
        route: `/patients/${p.id}`,
      })),
      visits: visits.map((v) => ({
        id: v.id,
        type: 'visit' as const,
        title:
          [v.patient?.firstName, v.patient?.lastName].filter(Boolean).join(' ') ||
          v.visitNumber,
        subtitle: v.visitNumber,
        route: `/clinical/consultation/${v.id}`,
      })),
      appointments: appointments.map((a) => ({
        id: a.id,
        type: 'appointment' as const,
        title:
          [a.patient?.firstName, a.patient?.lastName].filter(Boolean).join(' ') ||
          'Appointment',
        subtitle: [
          a.appointmentDate,
          a.appointmentTime,
          a.doctor ? `Dr. ${a.doctor.lastName}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        route: `/appointments`,
      })),
      invoices: invoices.map((inv) => ({
        id: inv.id,
        type: 'invoice' as const,
        title: inv.invoiceNumber,
        subtitle: inv.patientName,
        route: `/billing/invoices`,
      })),
    };
  }
}
