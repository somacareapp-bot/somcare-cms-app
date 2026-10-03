import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Camera, Building2, ShieldCheck, Mail, User } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { usersApi } from '../../services/api';

const API = '';

function toFullUrl(path?: string | null): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `/api${path}`;
}

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-800 break-words">{value}</p>
      </div>
    </div>
  );
}

export function MyProfileModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState(false);

  const photoMutation = useMutation({
    mutationFn: (file: File) => usersApi.uploadPhoto(user!.id, file),
    onSuccess: (res: any) => {
      const photoUrl: string = res.data?.photoUrl;
      if (photoUrl) {
        updateUser({ profilePhoto: photoUrl });
      }
      setUploadErr(null);
      setUploadOk(true);
      setTimeout(() => setUploadOk(false), 2500);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Upload failed';
      setUploadErr(msg);
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadErr('Max 5 MB'); return; }
    setUploadErr(null);
    photoMutation.mutate(file);
    e.target.value = '';
  };

  if (!user) return null;

  const photoSrc = toFullUrl(user.profilePhoto);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">My Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex flex-col items-center pt-8 pb-6 px-5 bg-gradient-to-b from-slate-50 to-white">
          <div className="relative group mb-4">
            {photoSrc ? (
              <img key={photoSrc} src={photoSrc} alt={user.fullName}
                className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md" />
            ) : (
              <div className="h-24 w-24 rounded-full bg-[#0F2A5C] flex items-center justify-center text-2xl font-bold text-white border-4 border-white shadow-md">
                {initials(user.firstName, user.lastName)}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photoMutation.isPending}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {photoMutation.isPending
                ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={20} className="text-white" />}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" onChange={handleFile} />
          </div>

          <h3 className="text-lg font-bold text-slate-900">{user.firstName} {user.lastName}</h3>
          <p className="text-sm text-slate-500 mt-0.5 capitalize">{user.roles.join(', ')}</p>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-medium">Active</span>
            {user.roles.map(r => (
              <span key={r} className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium capitalize">{r}</span>
            ))}
          </div>

          {uploadErr && <p className="mt-2 text-xs text-red-500">{uploadErr}</p>}
          {uploadOk  && <p className="mt-2 text-xs text-emerald-600">✓ Photo updated!</p>}
          {photoMutation.isPending && <p className="mt-2 text-xs text-blue-500">Uploading...</p>}
          <p className="mt-1 text-xs text-slate-400">Hover photo · click to upload</p>
        </div>

        <div className="flex-1 px-5 pb-8">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Details</p>
          <InfoRow icon={<User size={15}/>}       label="Full Name"  value={`${user.firstName} ${user.lastName}`} />
          <InfoRow icon={<Mail size={15}/>}        label="Username"   value={user.username} />
          {user.email && <InfoRow icon={<Mail size={15}/>} label="Email" value={user.email} />}
          <InfoRow icon={<Building2 size={15}/>}   label="Department" value={user.department ?? '—'} />
          <InfoRow icon={<ShieldCheck size={15}/>} label="Roles"      value={user.roles.length ? user.roles.join(', ') : '—'} />
        </div>
      </div>
    </div>
  );
}
