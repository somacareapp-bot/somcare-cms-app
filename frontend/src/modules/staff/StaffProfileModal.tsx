import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Camera, Phone, Briefcase, Building2, Clock, DollarSign,
  ShieldCheck, Mail, User, Upload, Download, FileText, Calendar,
  AlertCircle, GraduationCap, BookOpen,
} from 'lucide-react';
import { usersApi, staffProfileApi } from '../../services/api';

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone: string | null;
  position: string | null;
  shift: string | null;
  salary: number | null;
  status: string;
  profilePhoto?: string | null;
  department: { id: string; name: string } | null;
  roles: { id: string; name: string }[];
}

interface StaffProfile {
  id: string;
  userId: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  specialization?: string | null;
  yearsOfExperience?: number | null;
  skills?: string[] | null;
  education?: Array<{ institution?: string; qualification?: string; year?: string }> | null;
  pastExperience?: Array<{ employer?: string; title?: string; startDate?: string; endDate?: string; description?: string }> | null;
  cvFileUrl?: string | null;
  cvOriginalFilename?: string | null;
  cvUploadedAt?: string | null;
  cvParsed?: boolean;
}

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-5 mb-2 px-5">
      {children}
    </p>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0 px-5">
      <div className="mt-0.5 text-slate-400 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-800 break-words">{value}</p>
      </div>
    </div>
  );
}

function SkillBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-3 py-1 text-xs font-medium">
      {label}
    </span>
  );
}

export function StaffProfileModal({
  member,
  onClose,
}: {
  member: StaffMember;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [cvErr, setCvErr] = useState<string | null>(null);
  const [cvOk, setCvOk] = useState(false);

  // Fetch staff profile (CV data, skills, etc.)
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['staff-profile', member.id],
    queryFn: () => staffProfileApi.get(member.id),
    select: (res: any) => res.data as StaffProfile,
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => usersApi.uploadPhoto(member.id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setPhotoErr(null);
    },
    onError: () => setPhotoErr('Photo upload failed. Try again.'),
  });

  const cvMutation = useMutation({
    mutationFn: (file: File) => staffProfileApi.uploadCv(member.id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-profile', member.id] });
      setCvErr(null);
      setCvOk(true);
      setTimeout(() => setCvOk(false), 3000);
    },
    onError: (err: any) => {
      setCvErr(err?.response?.data?.message ?? 'CV upload failed');
    },
  });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setPhotoErr('Max 5 MB'); return; }
    setPreview(URL.createObjectURL(file));
    photoMutation.mutate(file);
    e.target.value = '';
  };

  const handleCv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setCvErr('Max 10 MB'); return; }
    setCvErr(null);
    cvMutation.mutate(file);
    e.target.value = '';
  };

  const photoSrc = preview ?? (member.profilePhoto ? `/api${member.profilePhoto}` : null);
  const isActive = member.status === 'active';
  const profile = profileData;

  const skills: string[] = Array.isArray(profile?.skills) ? profile.skills.filter(Boolean) : [];
  const experience = Array.isArray(profile?.pastExperience) ? profile.pastExperience : [];
  const education = Array.isArray(profile?.education) ? profile.education : [];

  const formatDate = (iso?: string | null) => {
    if (!iso) return null;
    try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return iso; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-800">Staff Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center pt-8 pb-5 px-5 bg-gradient-to-b from-slate-50 to-white flex-shrink-0">
          <div className="relative group mb-4">
            {photoSrc ? (
              <img src={photoSrc} alt={`${member.firstName} ${member.lastName}`}
                className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md" />
            ) : (
              <div className="h-24 w-24 rounded-full bg-[#0F2A5C] flex items-center justify-center text-2xl font-bold text-white border-4 border-white shadow-md">
                {initials(member.firstName, member.lastName)}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photoMutation.isPending}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Upload photo"
            >
              {photoMutation.isPending
                ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={20} className="text-white" />}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto} />
          </div>

          <h3 className="text-lg font-bold text-slate-900">{member.firstName} {member.lastName}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{member.position ?? 'No position set'}</p>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
            {member.department && (
              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-3 py-1 text-xs font-medium">
                {member.department.name}
              </span>
            )}
            {member.roles.map((r) => (
              <span key={r.id} className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium capitalize">
                {r.name}
              </span>
            ))}
          </div>
          {photoErr && <p className="mt-2 text-xs text-red-500">{photoErr}</p>}
          <p className="mt-1 text-xs text-slate-400">Hover photo · click to upload</p>
        </div>

        {/* ── Personal ── */}
        <SectionLabel>Personal</SectionLabel>
        <InfoRow icon={<User size={15} />} label="Full Name" value={`${member.firstName} ${member.lastName}`} />
        {member.email && <InfoRow icon={<Mail size={15} />} label="Email" value={member.email} />}
        <InfoRow icon={<Phone size={15} />} label="Phone" value={profile?.phone ?? member.phone ?? '—'} />
        {profile?.dateOfBirth && (
          <InfoRow icon={<Calendar size={15} />} label="Date of Birth" value={formatDate(profile.dateOfBirth) ?? '—'} />
        )}
        {profile?.address && (
          <InfoRow icon={<Building2 size={15} />} label="Address" value={profile.address} />
        )}
        {(profile?.emergencyContactName || profile?.emergencyContactPhone) && (
          <InfoRow
            icon={<AlertCircle size={15} />}
            label="Emergency Contact"
            value={[profile.emergencyContactName, profile.emergencyContactPhone].filter(Boolean).join(' · ')}
          />
        )}

        {/* ── Employment ── */}
        <SectionLabel>Employment</SectionLabel>
        <InfoRow icon={<Briefcase size={15} />} label="Position" value={member.position ?? '—'} />
        <InfoRow icon={<Building2 size={15} />} label="Department" value={member.department?.name ?? '—'} />
        <InfoRow icon={<Clock size={15} />} label="Shift" value={member.shift ?? '—'} />
        <InfoRow icon={<DollarSign size={15} />} label="Salary"
          value={member.salary != null ? `$${Number(member.salary).toLocaleString()}` : '—'} />
        {profile?.yearsOfExperience != null && (
          <InfoRow icon={<Briefcase size={15} />} label="Years of Experience" value={`${profile.yearsOfExperience} years`} />
        )}
        {profile?.specialization && (
          <InfoRow icon={<ShieldCheck size={15} />} label="Specialization" value={profile.specialization} />
        )}
        <InfoRow icon={<ShieldCheck size={15} />} label="Roles"
          value={member.roles.length ? member.roles.map((r) => r.name).join(', ') : '—'} />

        {/* ── Experience ── */}
        {experience.length > 0 && (
          <>
            <SectionLabel>
              Experience{profile?.yearsOfExperience ? ` — ${profile.yearsOfExperience} years` : ''}
            </SectionLabel>
            <div className="px-5 pb-1">
              <div className="flex flex-col gap-3">
                {experience.map((exp, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1.5">
                      <div className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                      {i < experience.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                    </div>
                    <div className="pb-3 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-tight">
                        {[exp.title, exp.employer].filter(Boolean).join(' — ')}
                      </p>
                      {(exp.startDate || exp.endDate) && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {exp.startDate} – {exp.endDate ?? 'Present'}
                        </p>
                      )}
                      {exp.description && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{exp.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Education ── */}
        {education.length > 0 && (
          <>
            <SectionLabel>Education</SectionLabel>
            <div className="px-5 pb-1">
              <div className="flex flex-col gap-3">
                {education.map((edu, i) => (
                  <div key={i} className="flex gap-3">
                    <GraduationCap size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{edu.qualification ?? '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {edu.institution}{edu.year ? ` · ${edu.year}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Skills ── */}
        {skills.length > 0 && (
          <>
            <SectionLabel>Skills</SectionLabel>
            <div className="px-5 pb-1 flex flex-wrap gap-2">
              {skills.map((s, i) => <SkillBadge key={i} label={s} />)}
            </div>
          </>
        )}

        {/* ── CV ── */}
        <SectionLabel>CV / Resume</SectionLabel>
        <div className="px-5 pb-2">
          {profileLoading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : profile?.cvFileUrl ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText size={20} className="text-red-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {profile.cvOriginalFilename ?? 'CV.pdf'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {profile.cvUploadedAt ? `Uploaded ${formatDate(profile.cvUploadedAt)}` : 'Uploaded'}
                    {profile.cvParsed ? ' · auto-filled' : ''}
                  </p>
                </div>
              </div>
              <a
                href={`/api${profile.cvFileUrl}`}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2"
                title="Download CV"
              >
                <Download size={18} />
              </a>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No CV uploaded yet.</p>
          )}

          {/* CV upload button */}
          <button
            onClick={() => cvRef.current?.click()}
            disabled={cvMutation.isPending}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cvMutation.isPending
              ? <><div className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Uploading…</>
              : <><Upload size={15} /> {profile?.cvFileUrl ? 'Replace CV' : 'Upload CV'}</>
            }
          </button>
          <input ref={cvRef} type="file" accept="application/pdf,.doc,.docx" className="hidden" onChange={handleCv} />
          {cvErr && <p className="mt-1.5 text-xs text-red-500">{cvErr}</p>}
          {cvOk && <p className="mt-1.5 text-xs text-emerald-600">✓ CV uploaded and parsed!</p>}
          <p className="mt-1 text-xs text-slate-400">PDF or DOCX · max 10 MB · fields auto-filled from CV</p>
        </div>

        {/* Bottom padding */}
        <div className="h-6 flex-shrink-0" />
      </div>
    </div>
  );
}
