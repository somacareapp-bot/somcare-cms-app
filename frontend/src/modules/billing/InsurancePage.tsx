import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../services/api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientName: string;
  createdAt: string;
  total: number;
  paid: number;
  status: 'paid' | 'partial' | 'unpaid';
  paymentMethod: string;
}

function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['billing', 'invoices'],
    queryFn: async () => {
      const res = await billingApi.getAll();
      return res.data ?? [];
    },
    placeholderData: [],
    retry: 1,
  });
}

function money(n: number) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

export function InsurancePage() {
  const { data: invoices = [] } = useInvoices();

  const insuranceInvoices = useMemo(
    () => invoices.filter((inv) => inv.paymentMethod === 'insurance'),
    [invoices],
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Insurance</h1>
        <p className="text-sm text-gray-500">{insuranceInvoices.length} insurance-billed invoices</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {insuranceInvoices.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No insurance invoices yet
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Invoice #</th>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Paid</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {insuranceInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 font-medium text-blue-600">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2 text-gray-800">{inv.patientName}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-gray-800">{money(inv.total)}</td>
                  <td className="px-4 py-2 text-green-600">{money(inv.paid)}</td>
                  <td className="px-4 py-2 text-red-600">
                    {money(Number(inv.total) - Number(inv.paid))}
                  </td>
                  <td className="px-4 py-2 capitalize text-gray-600">{inv.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default InsurancePage;
