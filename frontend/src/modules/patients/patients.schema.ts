import { z } from 'zod';

export const genderOptions = ['male', 'female', 'other'] as const;
export const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] as const;
export const patientTypeOptions = ['outpatient', 'inpatient', 'emergency'] as const;

export const patientSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().max(100).optional().or(z.literal('')),
  lastName: z.string().min(1, 'Last name is required').max(100),
  gender: z.enum(genderOptions, { required_error: 'Gender is required' }),
  dateOfBirth: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  alternativePhone: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  district: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  nationality: z.string().optional().or(z.literal('')),
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactPhone: z.string().optional().or(z.literal('')),
  bloodGroup: z.enum(bloodGroupOptions).optional(),
  allergies: z.string().optional().or(z.literal('')),
  insuranceCompany: z.string().optional().or(z.literal('')),
  insuranceNumber: z.string().optional().or(z.literal('')),
  patientType: z.enum(patientTypeOptions).optional(),

  notes: z.string().optional().or(z.literal('')),
});

export type PatientFormValues = z.infer<typeof patientSchema>;
