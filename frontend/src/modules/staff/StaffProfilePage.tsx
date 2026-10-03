/**
 * StaffProfilePage.tsx
 * Full-page rich staff profile — route: /staff/:id
 * Shows all profile details, CV data, experience timeline, education, skills.
 */
import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Camera, Phone, Mail, Building2, Briefcase, Clock,
  DollarSign, ShieldCheck, User, Calendar, AlertCircle, Upload,
  Download, FileText, GraduationCap, Pencil, Check, X,
} from 'lucide-react';
import { usersApi, staffProfileApi, staffApi } from '../../services/api';

/* ─────────── types ─────────── */
interface StaffProfile {
  id?: string;
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
  pastExperience?: Array<{
    employer?: string; title?: string;
    startDate?: string; endDate?: string; description?: string;
  }> | null;
  cvFileUrl?: string | null;
  cvOriginalFilename?: string | null;
  cvUploadedAt?: string | null;
  cvParsed?: boolean;
}

/* ─────────── helpers ─────────── */
function initials(first = '', last = '') {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function fmt(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

/* ─────────── sub-components ─────────── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-5 border-t border-slate-100 first:border-0">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      {icon && <div className="mt-0.5 text-slate-400 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        <div className="text-sm font-medium text-slate-800 break-words">{value}</div>
      </div>
    </div>
  );
}

function SkillBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-medium">
      {label}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
      active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
    }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

/* ─────────── main page ─────────── */
export function StaffProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [cvErr, setCvErr] = useState<string | null>(null);
  const [cvOk, setCvOk] = useState(false);

  /* queries */
  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ['staff-member', id],
    queryFn: () => staffApi.getOne(id!),
    select: (res: any) => res.data,
    enabled: !!id,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['staff-profile', id],
    queryFn: () => staffProfileApi.get(id!),
    select: (res: any) => res.data as StaffProfile,
    enabled: !!id,
  });

  /* mutations */
  const photoMutation = useMutation({
    mutationFn: (file: File) => usersApi.uploadPhoto(id!, file),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff-member', id] }); setPhotoErr(null); },
    onError: () => setPhotoErr('Photo upload failed'),
  });

  const cvMutation = useMutation({
    mutationFn: (file: File) => staffProfileApi.uploadCv(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-profile', id] });
      setCvOk(true); setCvErr(null);
      setTimeout(() => setCvOk(false), 3000);
    },
    onError: (err: any) => setCvErr(err?.response?.data?.message ?? 'Upload failed'),
  });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setPhotoErr('Max 5 MB'); return; }
    setPhotoPreview(URL.createObjectURL(file));
    photoMutation.mutate(file);
    e.target.value = '';
  };

  const handleCv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setCvErr('Max 10 MB'); return; }
    cvMutation.mutate(file);
    e.target.value = '';
  };

  if (memberLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!member) return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <p className="text-sm">Staff member not found.</p>
      <button onClick={() => navigate(-1)} className="mt-3 text-xs underline">Go back</button>
    </div>
  );

  const photoSrc = photoPreview ?? (member.profilePhoto ? `/api${member.profilePhoto}` : null);
  const isActive = member.status === 'active';
  const skills: string[] = Array.isArray(profile?.skills) ? profile!.skills!.filter(Boolean) : [];
  const experience = Array.isArray(profile?.pastExperience) ? profile!.pastExperience! : [];
  const education = Array.isArray(profile?.education) ? profile!.education! : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <span className="text-slate-300">·</span>
        <span className="text-sm font-medium text-slate-800">{member.firstName} {member.lastName}</span>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge active={isActive} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column: photo + quick info ── */}
          <div className="flex flex-col gap-5">

            {/* Photo card */}
            <Card>
              <div className="px-6 py-8 flex flex-col items-center">
                <div className="relative group mb-5">
                  {photoSrc ? (
                    <img src={photoSrc} alt={`${member.firstName} ${member.lastName}`}
                      className="h-28 w-28 rounded-full object-cover border-4 border-white shadow-lg" />
                  ) : (
                    <div className="h-28 w-28 rounded-full bg-[#0F2A5C] flex items-center justify-center text-3xl font-bold text-white border-4 border-white shadow-lg">
                      {initials(member.firstName, member.lastName)}
                    </div>
                  )}
                  <button
                    onClick={() => photoRef.current?.click()}
                    disabled={photoMutation.isPending}
                    className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Upload photo"
                  >
                    {photoMutation.isPending
                      ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Camera size={22} className="text-white" />}
                  </button>
                  <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto} />
                </div>

                <h1 className="text-xl font-bold text-slate-900 text-center">
                  {member.firstName} {member.lastName}
                </h1>
                <p className="text-sm text-slate-500 mt-1 text-center">{member.position ?? 'No position set'}</p>

                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <StatusBadge active={isActive} />
                  {member.department && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-3 py-1 text-xs font-medium">
                      {member.department.name}
                    </span>
                  )}
                </div>
                {member.roles?.map((r: any) => (
                  <span key={r.id ?? r} className="mt-2 inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium capitalize">
                    {r.name ?? r}
                  </span>
                ))}

                {photoErr && <p className="mt-2 text-xs text-red-500 text-center">{photoErr}</p>}
                <p className="mt-3 text-xs text-slate-400">Hover photo · click to change</p>
              </div>
            </Card>

            {/* CV card */}
            <Card>
              <div className="px-5 py-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">CV / Resume</p>

                {profileLoading ? (
                  <p className="text-xs text-slate-400">Loading…</p>
                ) : profile?.cvFileUrl ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 mb-3">
                    <FileText size={22} className="text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {profile.cvOriginalFilename ?? 'CV.pdf'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {profile.cvUploadedAt ? `Uploaded ${fmt(profile.cvUploadedAt)}` : 'Uploaded'}
                        {profile.cvParsed ? ' · auto-filled' : ''}
                      </p>
                    </div>
                    <a href={`/api${profile.cvFileUrl}`} target="_blank" rel="noreferrer"
                      className="text-slate-400 hover:text-slate-700 flex-shrink-0" title="Download">
                      <Download size={18} />
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mb-3">No CV uploaded yet.</p>
                )}

                <button
                  onClick={() => cvRef.current?.click()}
                  disabled={cvMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  {cvMutation.isPending
                    ? <><div className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Uploading…</>
                    : <><Upload size={15} /> {profile?.cvFileUrl ? 'Replace CV' : 'Upload CV'}</>}
                </button>
                <input ref={cvRef} type="file" accept="application/pdf,.doc,.docx" className="hidden" onChange={handleCv} />

                {cvErr && <p className="mt-2 text-xs text-red-500">{cvErr}</p>}
                {cvOk && <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1"><Check size={13} /> CV uploaded and parsed!</p>}
                <p className="mt-2 text-xs text-slate-400">PDF or DOCX · max 10 MB · fields auto-filled</p>
              </div>
            </Card>

            {/* Skills card */}
            {skills.length > 0 && (
              <Card>
                <div className="px-5 py-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s, i) => <SkillBadge key={i} label={s} />)}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* ── Right columns: detailed info ── */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Personal details */}
            <Card>
              <CardSection title="Personal Details">
                <Field icon={<User size={15} />} label="Full Name" value={`${member.firstName} ${member.lastName}`} />
                {member.email && <Field icon={<Mail size={15} />} label="Email" value={member.email} />}
                <Field icon={<Phone size={15} />} label="Phone" value={profile?.phone ?? member.phone ?? '—'} />
                {profile?.dateOfBirth && (
                  <Field icon={<Calendar size={15} />} label="Date of Birth" value={fmt(profile.dateOfBirth)} />
                )}
                {profile?.address && (
                  <Field icon={<Building2 size={15} />} label="Address" value={profile.address} />
                )}
                {(profile?.emergencyContactName || profile?.emergencyContactPhone) && (
                  <Field icon={<AlertCircle size={15} />} label="Emergency Contact"
                    value={[profile?.emergencyContactName, profile?.emergencyContactPhone].filter(Boolean).join(' · ')} />
                )}
              </CardSection>
            </Card>

            {/* Employment */}
            <Card>
              <CardSection title="Employment">
                <Field icon={<Briefcase size={15} />} label="Position" value={member.position ?? '—'} />
                <Field icon={<Building2 size={15} />} label="Department" value={member.department?.name ?? '—'} />
                <Field icon={<Clock size={15} />} label="Shift" value={member.shift ?? '—'} />
                <Field icon={<DollarSign size={15} />} label="Salary"
                  value={member.salary != null ? `$${Number(member.salary).toLocaleString()}` : '—'} />
                {profile?.yearsOfExperience != null && (
                  <Field icon={<Briefcase size={15} />} label="Years of Experience"
                    value={`${profile.yearsOfExperience} years`} />
                )}
                {profile?.specialization && (
                  <Field icon={<ShieldCheck size={15} />} label="Specialization" value={profile.specialization} />
                )}
                <Field icon={<ShieldCheck size={15} />} label="Roles"
                  value={member.roles?.length ? member.roles.map((r: any) => r.name ?? r).join(', ') : '—'} />
              </CardSection>
            </Card>

            {/* Experience timeline */}
            {experience.length > 0 && (
              <Card>
                <CardSection title={`Experience${profile?.yearsOfExperience ? ` — ${profile.yearsOfExperience} years` : ''}`}>
                  <div className="flex flex-col">
                    {experience.map((exp, i) => (
                      <div key={i} className="flex gap-4 pb-5 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-300 mt-1 flex-shrink-0" />
                          {i < experience.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1.5" />}
                        </div>
                        <div className="min-w-0 pb-1">
                          <p className="text-sm font-semibold text-slate-800">
                            {exp.title ?? 'Role'}
                            {exp.employer && <span className="font-normal text-slate-600"> — {exp.employer}</span>}
                          </p>
                          {(exp.startDate || exp.endDate) && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {exp.startDate} – {exp.endDate ?? 'Present'}
                            </p>
                          )}
                          {exp.description && (
                            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{exp.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardSection>
              </Card>
            )}

            {/* Education */}
            {education.length > 0 && (
              <Card>
                <CardSection title="Education">
                  <div className="flex flex-col gap-4">
                    {education.map((edu, i) => (
                      <div key={i} className="flex gap-3">
                        <GraduationCap size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{edu.qualification ?? '—'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {edu.institution}{edu.year ? ` · ${edu.year}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardSection>
              </Card>
            )}

            {/* Empty state when profile not loaded yet */}
            {!profileLoading && !profile && (
              <Card>
                <div className="px-6 py-8 text-center">
                  <Upload size={28} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-600">No extended profile yet</p>
                  <p className="text-xs text-slate-400 mt-1">Upload a CV to auto-fill skills, experience and education.</p>
                </div>
              </Card>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
