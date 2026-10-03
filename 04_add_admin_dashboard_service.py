from pathlib import Path

def patch(path: Path, old: str, new: str, label: str):
    src = path.read_text()
    count = src.count(old)
    if count != 1:
        print(f"SKIP — {label} (expected 1 match, found {count})")
        return
    path.write_text(src.replace(old, new))
    print(f"OK — {label}")

root = Path(".")
svc = root / "backend/src/reports/reports.service.ts"

# 1) Pull VisitUrgency into the existing Visit import
patch(
    svc,
    "import { Visit, VisitStatus } from '../visits/entities/visit.entity';",
    "import { Visit, VisitStatus, VisitUrgency } from '../visits/entities/visit.entity';",
    "reports.service.ts: VisitUrgency import added",
)

# 2) New entity imports for the admin dashboard's alerts
patch(
    svc,
    "import { Patient } from '../patients/entities/patient.entity';",
    """import { Patient } from '../patients/entities/patient.entity';
import { Medicine } from '../pharmacy/entities/medicine.entity';
import { Invoice, InvoiceStatus } from '../billing/entities/invoice.entity';""",
    "reports.service.ts: Medicine/Invoice imports added",
)

# 3) Inject the two new repositories
patch(
    svc,
    """    @InjectRepository(Patient) private patientsRepo: Repository<Patient>,
  ) {}""",
    """    @InjectRepository(Patient) private patientsRepo: Repository<Patient>,
    @InjectRepository(Medicine) private medicinesRepo: Repository<Medicine>,
    @InjectRepository(Invoice) private invoicesRepo: Repository<Invoice>,
  ) {}""",
    "reports.service.ts: medicinesRepo/invoicesRepo injected",
)

# 4) Append getAdminDashboard() as a new method on the class
patch(
    svc,
    """      patientsByDepartment: deptRows.map((r) => ({ name: r.name, patients: Number(r.patients) })),
    };
  }
}""",
    """      patientsByDepartment: deptRows.map((r) => ({ name: r.name, patients: Number(r.patients) })),
    };
  }

  // ---- Admin-only dashboard: org-wide KPIs, staffing, alerts, activity feed. ----
  async getAdminDashboard() {
    const { start, end } = todayRange();

    const totalPatients = await this.patientsRepo.count();
    const newPatientsToday = await this.patientsRepo.count({
      where: { createdAt: Between(start, end) },
    });

    const appointmentsToday = await this.appointmentsRepo.count({
      where: { appointmentDate: toISODate(start) },
    });

    const doctorsTotal = await this.usersRepo
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.name = :role', { role: 'doctor' })
      .getCount();
    const doctorsActive = await this.usersRepo
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.name = :role', { role: 'doctor' })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .getCount();

    const staffTotal = await this.usersRepo.count();
    const staffActive = await this.usersRepo.count({ where: { status: UserStatus.ACTIVE } });

    const waiting = await this.visitsRepo.count({ where: { status: VisitStatus.WAITING } });
    const consulting = await this.visitsRepo.count({ where: { status: VisitStatus.WITH_DOCTOR } });
    const completedToday = await this.visitsRepo.count({
      where: { status: VisitStatus.COMPLETED, completedAt: Between(start, end) },
    });
    const emergency = await this.visitsRepo
      .createQueryBuilder('visit')
      .where('visit.urgency = :urgency', { urgency: VisitUrgency.EMERGENCY })
      .andWhere('visit.status NOT IN (:...done)', { done: [VisitStatus.COMPLETED, VisitStatus.CANCELLED] })
      .getCount();

    // Visits per day for the last 7 days — same shape as the facility dashboard's chart
    const weeklyVisits: { day: string; visits: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const count = await this.visitsRepo.count({ where: { checkedInAt: Between(dayStart, dayEnd) } });
      weeklyVisits.push({ day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }), visits: count });
    }

    // Today's appointments, doctor names attached, soonest first
    const todaysAppointmentsList = await this.appointmentsRepo.find({
      where: { appointmentDate: toISODate(start) },
      relations: ['doctor'],
      order: { appointmentTime: 'ASC' },
      take: 6,
    });

    // Department "performance" = share of today's visits in that department that
    // reached COMPLETED. Open to a different definition if this isn't what you meant.
    const deptRows = await this.visitsRepo
      .createQueryBuilder('visit')
      .select('visit.department', 'name')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE visit.status = :completedStatus)', 'completed')
      .where('visit.department IS NOT NULL')
      .andWhere('visit.checkedInAt BETWEEN :start AND :end', { start, end })
      .setParameter('completedStatus', VisitStatus.COMPLETED)
      .groupBy('visit.department')
      .getRawMany<{ name: string; total: string; completed: string }>();
    const departmentPerformance = deptRows.map((r) => ({
      name: r.name,
      percent: Number(r.total) > 0 ? Math.round((Number(r.completed) / Number(r.total)) * 100) : 0,
    }));

    // System alerts
    const alerts: { type: string; message: string }[] = [];

    const lowStockMeds = await this.medicinesRepo
      .createQueryBuilder('m')
      .where('m.isActive = true')
      .andWhere('m.stockQuantity <= m.reorderLevel')
      .getCount();
    if (lowStockMeds > 0) {
      alerts.push({ type: 'stock', message: `Low pharmacy stock (${lowStockMeds} item${lowStockMeds > 1 ? 's' : ''})` });
    }

    const pendingLabTests = await this.labOrdersRepo
      .createQueryBuilder('lab')
      .where('lab.status NOT IN (:...done)', { done: [LabOrderStatus.COMPLETED, LabOrderStatus.CANCELLED] })
      .getCount();
    if (pendingLabTests > 0) {
      alerts.push({ type: 'lab', message: `${pendingLabTests} pending lab test${pendingLabTests > 1 ? 's' : ''}` });
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringMeds = await this.medicinesRepo
      .createQueryBuilder('m')
      .where('m.isActive = true')
      .andWhere('m.expiryDate IS NOT NULL')
      .andWhere('m.expiryDate <= :soon', { soon: thirtyDaysFromNow })
      .getCount();
    if (expiringMeds > 0) {
      alerts.push({ type: 'expiry', message: `${expiringMeds} expiring/expired medicine${expiringMeds > 1 ? 's' : ''}` });
    }

    const pendingPayments = await this.invoicesRepo
      .createQueryBuilder('i')
      .where('i.status != :paid', { paid: InvoiceStatus.PAID })
      .getCount();
    if (pendingPayments > 0) {
      alerts.push({ type: 'payment', message: `${pendingPayments} pending payment${pendingPayments > 1 ? 's' : ''}` });
    }

    // Recent activity — merged from a few real timestamped events, most recent first.
    // NOTE: there's no dedicated activity-log table, so this is assembled on the fly
    // from existing timestamps rather than a true audit trail.
    const recentPatients = await this.patientsRepo.find({ order: { createdAt: 'DESC' }, take: 5 });
    const recentVisits = await this.visitsRepo.find({
      where: { status: VisitStatus.COMPLETED }, order: { completedAt: 'DESC' }, take: 5,
    });
    const recentLabs = await this.labOrdersRepo.find({
      where: { status: LabOrderStatus.COMPLETED }, order: { completedAt: 'DESC' }, take: 5,
    });
    const recentRx = await this.prescriptionsRepo.find({
      where: { status: PrescriptionStatus.DISPENSED }, order: { dispensedAt: 'DESC' }, take: 5,
    });

    const recentActivity = [
      ...recentPatients.map((p) => ({ message: 'New patient registered', at: p.createdAt })),
      ...recentVisits.map((v) => ({ message: 'Visit completed', at: v.completedAt })),
      ...recentLabs.map((l) => ({ message: 'Lab result approved', at: l.completedAt })),
      ...recentRx.map((r) => ({ message: 'Prescription dispensed', at: r.dispensedAt })),
    ]
      .filter((e): e is { message: string; at: Date } => !!e.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8)
      .map((e) => ({ message: e.message, at: e.at.toISOString() }));

    return {
      scope: 'admin' as const,
      patients: { total: totalPatients, newToday: newPatientsToday },
      appointmentsToday,
      doctors: { total: doctorsTotal, active: doctorsActive },
      staff: { total: staffTotal, active: staffActive },
      clinicalActivity: { waiting, consulting, completedToday, emergency },
      weeklyVisits,
      appointmentsTodayList: todaysAppointmentsList.map((a) => ({
        time: a.appointmentTime,
        doctorName: a.doctor ? `Dr. ${a.doctor.lastName}` : '\\u2014',
        status: a.status,
      })),
      departmentPerformance,
      alerts,
      recentActivity,
    };
  }
}""",
    "reports.service.ts: getAdminDashboard() added",
)

print("\nDone. Restart the backend.")
print("Note: department performance = % of today's visits per department that")
print("reached COMPLETED status. Tell me if you had a different metric in mind —")
print("easy to swap out.")
