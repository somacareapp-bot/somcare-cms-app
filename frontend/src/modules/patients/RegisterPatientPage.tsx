import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { patientSchema, PatientFormValues, genderOptions, bloodGroupOptions, patientTypeOptions } from './patients.schema';
import { patientsApi } from '../../services/api';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-clinical-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const inputClass = "w-full px-3 py-2 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500";

export function RegisterPatientPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: PatientFormValues) => patientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      navigate('/patients');
    },
  });

  const onSubmit = (data: PatientFormValues) => mutation.mutate(data);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-clinical-900">Register Patient</h1>
        <p className="text-clinical-500 text-sm mt-1">Enter the patient's details below.</p>
      </div>

      {mutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          Failed to register patient. Please check the form and try again.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-clinical-200 p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-clinical-800 mb-3">Basic Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="First Name *" error={errors.firstName?.message}>
              <input {...register('firstName')} className={inputClass} />
            </Field>
            <Field label="Middle Name" error={errors.middleName?.message}>
              <input {...register('middleName')} className={inputClass} />
            </Field>
            <Field label="Last Name *" error={errors.lastName?.message}>
              <input {...register('lastName')} className={inputClass} />
            </Field>
            <Field label="Gender *" error={errors.gender?.message}>
              <select {...register('gender')} className={inputClass}>
                <option value="">Select...</option>
                {genderOptions.map((g) => (
                  <option key={g} value={g} className="capitalize">{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Date of Birth" error={errors.dateOfBirth?.message}>
              <input type="date" {...register('dateOfBirth')} className={inputClass} />
            </Field>
            <Field label="Blood Group" error={errors.bloodGroup?.message}>
              <select {...register('bloodGroup')} className={inputClass}>
                <option value="">Select...</option>
                {bloodGroupOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-clinical-800 mb-3">Contact Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Phone" error={errors.phone?.message}>
              <input {...register('phone')} className={inputClass} />
            </Field>
            <Field label="Alternative Phone" error={errors.alternativePhone?.message}>
              <input {...register('alternativePhone')} className={inputClass} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input type="email" {...register('email')} className={inputClass} />
            </Field>
            <Field label="Address" error={errors.address?.message}>
              <input {...register('address')} className={inputClass} />
            </Field>
            <Field label="City" error={errors.city?.message}>
              <input {...register('city')} className={inputClass} />
            </Field>
            <Field label="District" error={errors.district?.message}>
              <input {...register('district')} className={inputClass} />
            </Field>
            <Field label="Country" error={errors.country?.message}>
              <input {...register('country')} className={inputClass} />
            </Field>
            <Field label="Nationality" error={errors.nationality?.message}>
              <input {...register('nationality')} className={inputClass} />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-clinical-800 mb-3">Emergency Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact Name" error={errors.emergencyContactName?.message}>
              <input {...register('emergencyContactName')} className={inputClass} />
            </Field>
            <Field label="Contact Phone" error={errors.emergencyContactPhone?.message}>
              <input {...register('emergencyContactPhone')} className={inputClass} />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-clinical-800 mb-3">Clinical & Insurance</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Patient Type" error={errors.patientType?.message}>
              <select {...register('patientType')} className={inputClass}>
                {patientTypeOptions.map((t) => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Allergies" error={errors.allergies?.message}>
              <input {...register('allergies')} className={inputClass} />
            </Field>
            <Field label="Insurance Company" error={errors.insuranceCompany?.message}>
              <input {...register('insuranceCompany')} className={inputClass} />
            </Field>
            <Field label="Insurance Number" error={errors.insuranceNumber?.message}>
              <input {...register('insuranceNumber')} className={inputClass} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Notes" error={errors.notes?.message}>
              <textarea {...register('notes')} rows={3} className={inputClass} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-clinical-100">
          <button
            type="button"
            onClick={() => navigate('/patients')}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Register Patient'}
          </button>
        </div>
      </form>
    </div>
  );
}
