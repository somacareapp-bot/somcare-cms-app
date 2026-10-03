import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, Save } from 'lucide-react';
import { facilityApi } from '../../services/api'; // ← adjust import path/name to match your api.ts

type FacilitySettings = {
  id: string;
  name: string;
  tagline?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
};

// If your API base isn't same-origin, prefix this with your API_BASE_URL.
const assetUrl = (path?: string) => (path ? path : undefined);

export function FacilitySettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Partial<FacilitySettings>>({});
  const [initialized, setInitialized] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'facility'],
    queryFn: () => facilityApi.get().then((res) => res.data as FacilitySettings),
  });

  if (settings && !initialized) {
    setForm({
      name: settings.name ?? '',
      tagline: settings.tagline ?? '',
      address: settings.address ?? '',
      phone: settings.phone ?? '',
      email: settings.email ?? '',
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => facilityApi.update(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'facility'] }),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => facilityApi.uploadLogo(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'facility'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-clinical-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading facility settings…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <h1 className="text-lg font-bold text-clinical-900">Facility Information</h1>
      <p className="text-sm text-clinical-500">
        This name, logo, address, and contact info appear on every generated report.
      </p>

      {/* Logo */}
      <div className="border border-clinical-100 rounded-xl p-4 flex items-center gap-4">
        <div className="w-20 h-20 rounded-lg border border-clinical-100 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
          {settings?.logoUrl ? (
            <img src={assetUrl(settings.logoUrl)} alt="Facility logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-xs text-clinical-400">No logo</span>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) logoMutation.mutate(file);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={logoMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-clinical-200 hover:bg-gray-50 transition-colors"
          >
            {logoMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {logoMutation.isPending ? 'Uploading…' : 'Upload Logo'}
          </button>
          <p className="text-xs text-clinical-400 mt-1.5">PNG, JPG, SVG or WEBP — up to 5MB.</p>
        </div>
      </div>

      {/* Text fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-clinical-800 mb-1.5">Facility Name</label>
          <input
            className="w-full border border-clinical-200 rounded-lg px-3 py-2 text-sm"
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-clinical-800 mb-1.5">Tagline</label>
          <input
            className="w-full border border-clinical-200 rounded-lg px-3 py-2 text-sm"
            value={form.tagline ?? ''}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-clinical-800 mb-1.5">Address</label>
          <input
            className="w-full border border-clinical-200 rounded-lg px-3 py-2 text-sm"
            value={form.address ?? ''}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-clinical-800 mb-1.5">Phone</label>
            <input
              className="w-full border border-clinical-200 rounded-lg px-3 py-2 text-sm"
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-clinical-800 mb-1.5">Email</label>
            <input
              className="w-full border border-clinical-200 rounded-lg px-3 py-2 text-sm"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white text-sm font-semibold rounded-lg hover:bg-red-800 transition-colors"
      >
        {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
