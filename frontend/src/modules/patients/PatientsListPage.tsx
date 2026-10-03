import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { patientsApi } from '../../services/api';

export function PatientsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patients', search, page],
    queryFn: () =>
      patientsApi
        .getAll({ search: search || undefined, page, limit })
        .then((res) => res.data),
  });

  const patients = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">All Patients</h1>
          <p className="text-clinical-500 text-sm mt-1">
            {data?.total ?? 0} patients registered
          </p>
        </div>
        <button
          onClick={() => navigate('/patients/register')}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> Register Patient
        </button>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200">
        <div className="p-4 border-b border-clinical-100">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, patient number, phone..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-clinical-500 border-b border-clinical-100">
                <th className="px-4 py-3 font-medium">Patient #</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Gender</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-clinical-400">Loading...</td></tr>
              )}
              {isError && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-red-500">Failed to load patients.</td></tr>
              )}
              {!isLoading && !isError && patients.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-clinical-400">No patients found.</td></tr>
              )}
              {patients.map((p: any) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className="border-b border-clinical-50 hover:bg-clinical-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-clinical-800">{p.patientNumber}</td>
                  <td className="px-4 py-3 text-clinical-700">
                    {[p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')}
                  </td>
                  <td className="px-4 py-3 capitalize text-clinical-600">{p.gender}</td>
                  <td className="px-4 py-3 text-clinical-600">{p.phone || '—'}</td>
                  <td className="px-4 py-3 capitalize text-clinical-600">{p.patientType}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 capitalize">
                      {p.patientStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-clinical-100 text-sm text-clinical-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-clinical-200 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-clinical-200 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
