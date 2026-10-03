import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../services/api';

interface Payment {
  id: string;
  invoiceNumber: string;
  patientName: string;
  amount: number;
  paymentMethod: string;
  createdAt: string;
}

function usePayments() {
  return useQuery<Payment[]>({
    queryKey: ['billing', 'payments'],
    queryFn: async () => {
      const res = await billingApi.getAllPayments();
      return res.data ?? [];
    },
    placeholderData: [],
    retry: 1,
  });
}

function money(n: number) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

export function PaymentsPage() {
  const { data: payments = [] } = usePayments();
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500">
          {payments.length} payments • {money(totalCollected)} collected
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {payments.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No payments recorded yet</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Invoice #</th>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Method</th>
                <th className="px-4 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-blue-600">{p.invoiceNumber}</td>
                  <td className="px-4 py-2 text-gray-800">{p.patientName}</td>
                  <td className="px-4 py-2 font-medium text-green-600">{money(p.amount)}</td>
                  <td className="px-4 py-2 capitalize text-gray-600">{p.paymentMethod}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PaymentsPage;
