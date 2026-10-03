import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { ExpenseCategoryGroup } from '../../expenses/entities/expense-category-group.entity';
import { ExpenseCategory } from '../../expenses/entities/expense-category.entity';

// code: stable identifier stored on Expense.category — never rename/reuse
// once expenses have been submitted under it. label: display text, editable
// any time from Settings without touching historical data.
const GROUPS: { code: string; label: string; sortOrder: number }[] = [
  { code: 'staff',        label: 'Staff & Human Resources',          sortOrder: 1 },
  { code: 'utilities',    label: 'Utilities & Facility',              sortOrder: 2 },
  { code: 'transport',    label: 'Transportation & Vehicles',         sortOrder: 3 },
  { code: 'maintenance',  label: 'Maintenance & Repairs',             sortOrder: 4 },
  { code: 'cleaning_sec', label: 'Cleaning, Security & Sanitation',   sortOrder: 5 },
  { code: 'office_admin', label: 'Office & Administrative Supplies',  sortOrder: 6 },
  { code: 'it',           label: 'IT & Technology',                  sortOrder: 7 },
  { code: 'financial',    label: 'Financial, Legal & Compliance',     sortOrder: 8 },
  { code: 'training_mkt', label: 'Training, Marketing & Events',      sortOrder: 9 },
  { code: 'patient_qual', label: 'Patient Services & Quality',        sortOrder: 10 },
];

const CATEGORIES: { code: string; label: string; group: string; sortOrder: number }[] = [
  // 1. Staff & Human Resources
  { code: 'salaries_wages',      label: 'Salaries & Wages',            group: 'staff', sortOrder: 1 },
  { code: 'overtime_allowances', label: 'Overtime & Allowances',       group: 'staff', sortOrder: 2 },
  { code: 'staff_benefits',      label: 'Staff Benefits',              group: 'staff', sortOrder: 3 },
  { code: 'staff_meals',         label: 'Staff Meals',                 group: 'staff', sortOrder: 4 },
  { code: 'staff_transport',     label: 'Staff Transportation',        group: 'staff', sortOrder: 5 },
  { code: 'staff_accommodation', label: 'Staff Accommodation',         group: 'staff', sortOrder: 6 },
  { code: 'staff_recruitment',   label: 'Staff Recruitment',           group: 'staff', sortOrder: 7 },
  { code: 'staff_uniforms',      label: 'Staff Uniforms',               group: 'staff', sortOrder: 8 },
  { code: 'staff_medical',       label: 'Staff Medical Benefits',      group: 'staff', sortOrder: 9 },
  { code: 'employee_welfare',    label: 'Employee Welfare',            group: 'staff', sortOrder: 10 },

  // 2. Utilities & Facility
  { code: 'rent_lease',          label: 'Rent & Lease',                 group: 'utilities', sortOrder: 1 },
  { code: 'electricity',         label: 'Electricity',                  group: 'utilities', sortOrder: 2 },
  { code: 'water',               label: 'Water',                        group: 'utilities', sortOrder: 3 },
  { code: 'internet_comm',       label: 'Internet & Communication',    group: 'utilities', sortOrder: 4 },
  { code: 'telephone',           label: 'Telephone',                    group: 'utilities', sortOrder: 5 },
  { code: 'mobile_comm',         label: 'Mobile Communication',        group: 'utilities', sortOrder: 6 },
  { code: 'generator_fuel',      label: 'Generator Fuel',               group: 'utilities', sortOrder: 7 },
  { code: 'generator_maint',     label: 'Generator Maintenance',       group: 'utilities', sortOrder: 8 },
  { code: 'solar_maint',         label: 'Solar System Maintenance',    group: 'utilities', sortOrder: 9 },
  { code: 'utility_charges',     label: 'Utility Charges',              group: 'utilities', sortOrder: 10 },

  // 3. Transportation & Vehicles
  { code: 'fuel_transport',      label: 'Fuel & Transportation',       group: 'transport', sortOrder: 1 },
  { code: 'vehicle_maint',       label: 'Vehicle Maintenance',         group: 'transport', sortOrder: 2 },
  { code: 'vehicle_repairs',     label: 'Vehicle Repairs',              group: 'transport', sortOrder: 3 },
  { code: 'vehicle_insurance',   label: 'Vehicle Insurance',            group: 'transport', sortOrder: 4 },
  { code: 'vehicle_registration',label: 'Vehicle Registration',        group: 'transport', sortOrder: 5 },
  { code: 'vehicle_parts',       label: 'Vehicle Spare Parts',         group: 'transport', sortOrder: 6 },
  { code: 'ambulance_maint',     label: 'Ambulance Maintenance',       group: 'transport', sortOrder: 7 },
  { code: 'ambulance_fuel',      label: 'Ambulance Fuel',                group: 'transport', sortOrder: 8 },
  { code: 'taxi_local',          label: 'Taxi & Local Transport',      group: 'transport', sortOrder: 9 },
  { code: 'transport_services',  label: 'Transport Services',          group: 'transport', sortOrder: 10 },

  // 4. Maintenance & Repairs
  { code: 'building_maint',      label: 'Building Maintenance',        group: 'maintenance', sortOrder: 1 },
  { code: 'equipment_maint',     label: 'Equipment Maintenance',       group: 'maintenance', sortOrder: 2 },
  { code: 'medical_equip_repairs',label: 'Medical Equipment Repairs',  group: 'maintenance', sortOrder: 3 },
  { code: 'electrical_repairs',  label: 'Electrical Repairs',           group: 'maintenance', sortOrder: 4 },
  { code: 'plumbing_repairs',    label: 'Plumbing Repairs',              group: 'maintenance', sortOrder: 5 },
  { code: 'ac_maint',            label: 'Air Conditioning Maintenance',group: 'maintenance', sortOrder: 6 },
  { code: 'generator_repairs',   label: 'Generator Repairs',            group: 'maintenance', sortOrder: 7 },
  { code: 'furniture_repairs',   label: 'Furniture Repairs',            group: 'maintenance', sortOrder: 8 },
  { code: 'general_repairs',     label: 'General Repairs',              group: 'maintenance', sortOrder: 9 },
  { code: 'facility_improvement',label: 'Facility Improvement',        group: 'maintenance', sortOrder: 10 },

  // 5. Cleaning, Security & Sanitation
  { code: 'cleaning_services',   label: 'Cleaning Services',            group: 'cleaning_sec', sortOrder: 1 },
  { code: 'cleaning_materials',  label: 'Cleaning Materials',           group: 'cleaning_sec', sortOrder: 2 },
  { code: 'laundry_services',    label: 'Laundry Services',             group: 'cleaning_sec', sortOrder: 3 },
  { code: 'laundry_materials',   label: 'Laundry Materials',            group: 'cleaning_sec', sortOrder: 4 },
  { code: 'security_services',   label: 'Security Services',            group: 'cleaning_sec', sortOrder: 5 },
  { code: 'security_equip_maint',label: 'Security Equipment Maintenance', group: 'cleaning_sec', sortOrder: 6 },
  { code: 'waste_disposal',      label: 'Waste Disposal',                group: 'cleaning_sec', sortOrder: 7 },
  { code: 'medical_waste',       label: 'Medical Waste Disposal',       group: 'cleaning_sec', sortOrder: 8 },
  { code: 'pest_control',        label: 'Pest Control',                  group: 'cleaning_sec', sortOrder: 9 },
  { code: 'environmental_services', label: 'Environmental Services',   group: 'cleaning_sec', sortOrder: 10 },

  // 6. Office & Administrative Supplies
  { code: 'office_supplies',     label: 'Office Supplies',              group: 'office_admin', sortOrder: 1 },
  { code: 'printing_stationery', label: 'Printing & Stationery',       group: 'office_admin', sortOrder: 2 },
  { code: 'printer_maint',       label: 'Printer Maintenance',          group: 'office_admin', sortOrder: 3 },
  { code: 'photocopying',        label: 'Photocopying',                  group: 'office_admin', sortOrder: 4 },
  { code: 'office_furniture',    label: 'Office Furniture',              group: 'office_admin', sortOrder: 5 },
  { code: 'office_equipment',    label: 'Office Equipment',              group: 'office_admin', sortOrder: 6 },
  { code: 'paper_forms',         label: 'Paper & Forms',                 group: 'office_admin', sortOrder: 7 },
  { code: 'staff_id_cards',      label: 'Staff ID Cards',                group: 'office_admin', sortOrder: 8 },
  { code: 'postage_courier',     label: 'Postage & Courier',            group: 'office_admin', sortOrder: 9 },
  { code: 'admin_supplies',      label: 'General Administrative Supplies', group: 'office_admin', sortOrder: 10 },

  // 7. IT & Technology
  { code: 'software_subscriptions', label: 'Software & Subscriptions', group: 'it', sortOrder: 1 },
  { code: 'it_computer_maint',   label: 'IT & Computer Maintenance',    group: 'it', sortOrder: 2 },
  { code: 'computer_repairs',    label: 'Computer Equipment Repairs',   group: 'it', sortOrder: 3 },
  { code: 'network_maint',       label: 'Network Maintenance',          group: 'it', sortOrder: 4 },
  { code: 'website_domain',      label: 'Website & Domain',              group: 'it', sortOrder: 5 },
  { code: 'cloud_services',      label: 'Cloud Services',                group: 'it', sortOrder: 6 },
  { code: 'data_backup',         label: 'Data Backup Services',         group: 'it', sortOrder: 7 },
  { code: 'it_support',          label: 'IT Support Services',          group: 'it', sortOrder: 8 },
  { code: 'cybersecurity',       label: 'Cybersecurity Services',       group: 'it', sortOrder: 9 },
  { code: 'software_licenses',   label: 'Software Licenses',            group: 'it', sortOrder: 10 },

  // 8. Financial, Legal & Compliance
  { code: 'insurance',           label: 'Insurance',                     group: 'financial', sortOrder: 1 },
  { code: 'bank_charges',        label: 'Bank Charges',                  group: 'financial', sortOrder: 2 },
  { code: 'licenses_permits',    label: 'Licenses & Permits',           group: 'financial', sortOrder: 3 },
  { code: 'taxes_gov_fees',      label: 'Taxes & Government Fees',      group: 'financial', sortOrder: 4 },
  { code: 'professional_services', label: 'Professional Services',      group: 'financial', sortOrder: 5 },
  { code: 'legal_services',      label: 'Legal Services',                group: 'financial', sortOrder: 6 },
  { code: 'accounting_audit',    label: 'Accounting & Audit',           group: 'financial', sortOrder: 7 },
  { code: 'consultancy',         label: 'Consultancy Services',         group: 'financial', sortOrder: 8 },
  { code: 'registration_cert',   label: 'Registration & Certification Fees', group: 'financial', sortOrder: 9 },
  { code: 'regulatory_compliance', label: 'Regulatory Compliance Fees', group: 'financial', sortOrder: 10 },

  // 9. Training, Marketing & Events
  { code: 'training_dev',        label: 'Training & Staff Development', group: 'training_mkt', sortOrder: 1 },
  { code: 'conferences_workshops', label: 'Conferences & Workshops',    group: 'training_mkt', sortOrder: 2 },
  { code: 'advertising_marketing', label: 'Advertising & Marketing',    group: 'training_mkt', sortOrder: 3 },
  { code: 'public_relations',    label: 'Public Relations',             group: 'training_mkt', sortOrder: 4 },
  { code: 'promotional_materials', label: 'Promotional Materials',      group: 'training_mkt', sortOrder: 5 },
  { code: 'travel_accommodation', label: 'Travel & Accommodation',     group: 'training_mkt', sortOrder: 6 },
  { code: 'meals_refreshments',  label: 'Meals & Refreshments',        group: 'training_mkt', sortOrder: 7 },
  { code: 'meetings_events',     label: 'Meetings & Events',            group: 'training_mkt', sortOrder: 8 },
  { code: 'community_outreach',  label: 'Community Outreach',           group: 'training_mkt', sortOrder: 9 },
  { code: 'recruitment_advertising', label: 'Recruitment Advertising', group: 'training_mkt', sortOrder: 10 },

  // 10. Patient Services & Quality
  { code: 'patient_transport',   label: 'Patient Transport',            group: 'patient_qual', sortOrder: 1 },
  { code: 'medical_records_admin', label: 'Medical Records Administration', group: 'patient_qual', sortOrder: 2 },
  { code: 'patient_communication', label: 'Patient Communication',     group: 'patient_qual', sortOrder: 3 },
  { code: 'hospital_accreditation', label: 'Hospital Accreditation',   group: 'patient_qual', sortOrder: 4 },
  { code: 'quality_assurance',   label: 'Quality Assurance Activities', group: 'patient_qual', sortOrder: 5 },
  { code: 'occupational_health', label: 'Occupational Health & Safety', group: 'patient_qual', sortOrder: 6 },
  { code: 'emergency_preparedness', label: 'Security & Emergency Preparedness', group: 'patient_qual', sortOrder: 7 },
  { code: 'depreciation_assets', label: 'Depreciation & Asset Expenses', group: 'patient_qual', sortOrder: 8 },
  { code: 'misc_operating',      label: 'Miscellaneous Operating Expenses', group: 'patient_qual', sortOrder: 9 },
  { code: 'other_operating',     label: 'Other Operating Expenses',     group: 'patient_qual', sortOrder: 10 },
];

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [ExpenseCategoryGroup, ExpenseCategory],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  const groupsRepo = dataSource.getRepository(ExpenseCategoryGroup);
  const categoriesRepo = dataSource.getRepository(ExpenseCategory);

  const groupIdByCode: Record<string, string> = {};
  for (const g of GROUPS) {
    let row = await groupsRepo.findOne({ where: { code: g.code } });
    if (!row) {
      row = await groupsRepo.save(groupsRepo.create(g));
      console.log('Created group:', g.code);
    } else {
      console.log('Group already exists, skipping:', g.code);
    }
    groupIdByCode[g.code] = row.id;
  }

  let created = 0;
  let skipped = 0;
  for (const c of CATEGORIES) {
    const existing = await categoriesRepo.findOne({ where: { code: c.code } });
    if (existing) {
      skipped++;
      continue;
    }
    await categoriesRepo.save(
      categoriesRepo.create({
        code: c.code,
        label: c.label,
        groupId: groupIdByCode[c.group],
        sortOrder: c.sortOrder,
        active: true,
      }),
    );
    created++;
  }
  console.log(`Categories: ${created} created, ${skipped} already existed`);

  await dataSource.destroy();
  console.log('Done!');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
