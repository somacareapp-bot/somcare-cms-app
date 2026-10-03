import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { patientsApi } from '../../services/api';

export function EmergencyPatientsPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patients', 'emergency'],
    queryFn: () => patientsApi.getAll({ patientType: 'emergency', limit: 100 }).then((res) => res.data),
  });

  const patients = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AlertTriangle size={20} className="text-red-600" />
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">Emergency Patients</h1>
          <p className="text-clinical-500 text-sm mt-1">{patients.length} patients flagged as emergency</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-clinical-500 bg-red-50 border-b border-red-200">
                <th className="px-4 py-3 font-medium">Patient #</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Gender</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Allergies</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-clinical-400">Loading...</td></tr>
              )}
              {isError && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-red-500">Failed to load patients.</td></tr>
              )}
              {!isLoading && !isError && patients.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-clinical-400">No emergency patients right now.</td></tr>
              )}
              {patients.map((p: any) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className="border-b border-red-50 hover:bg-red-50/50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-clinical-800">{p.patientNumber}</td>
                  <td className="px-4 py-3 text-clinical-700">{p.firstName} {p.lastName}</td>
                  <td className="px-4 py-3 capitalize text-clinical-600">{p.gender}</td>
                  <td className="px-4 py-3 text-clinical-600">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-red-600 font-medium">{p.allergies || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
