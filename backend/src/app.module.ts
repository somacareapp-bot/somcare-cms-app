import { StaffProfileModule } from './staff-profile/staff-profile.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { VisitsModule } from './visits/visits.module';
import { LaboratoryModule } from './laboratory/laboratory.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import { DepartmentsModule } from './departments/departments.module';
import { BranchesModule } from './branches/branches.module';
import { BloodBankModule } from './blood-bank/blood-bank.module';
import { BillingModule } from './billing/billing.module';
import { RolesModule } from './roles/roles.module';
import { LabTestCatalogModule } from './settings/laboratory/lab-test-catalog.module';
import { ServicesCatalogModule } from './billing/services-catalog.module';
import { FacilitySettingsModule } from './settings/facility/facility-settings.module';
import { ClinicalSettingsModule } from './clinical-settings/clinical-settings.module';
import { SearchModule } from './search/search.module';
import { ExpensesModule } from './expenses/expenses.module';
import { LeaveModule } from './leave/leave.module';
import { InventoryModule } from './inventory/inventory.module';
import { RadiologyModule } from './radiology/radiology.module';
import { RadiologyTestCatalogModule } from './settings/radiology/radiology-test-catalog.module';
import { BedsModule } from './beds/beds.module';
import { InsuranceProvidersModule } from './insurance-providers/insurance-providers.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrgChartModule } from './org-chart/org-chart.module';
import { FaqModule } from './faq/faq.module';
import { BackupModule } from './backup/backup.module';
import { LoginSessionModule } from './login-session/login-session.module';
import { ActivityLoggingModule } from './common/interceptors/activity-logging.module';

@Module({
  imports: [
    StaffProfileModule,
    BedsModule,
    InsuranceProvidersModule,
    ActivityLoggingModule,
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],

    }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Feature modules (add more here as each phase is built)
    AuthModule,
    PatientsModule,
    AppointmentsModule,
    VisitsModule,
    LaboratoryModule,
    UsersModule,
    PharmacyModule,
    ReportsModule,
    DepartmentsModule,
    BranchesModule,
    BloodBankModule,
    BillingModule,
    RolesModule,
    LabTestCatalogModule,
    ServicesCatalogModule,
    FacilitySettingsModule,
    ClinicalSettingsModule,
    SearchModule,
    ExpensesModule,
    LeaveModule,
    InventoryModule,
    RadiologyModule,
    RadiologyTestCatalogModule,
    NotificationsModule,
    OrgChartModule,
    FaqModule,
    BackupModule,
    LoginSessionModule,
  ],
})
export class AppModule {}
