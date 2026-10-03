import { ChangePasswordHost } from './ChangePasswordModal';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, Maximize2, Globe, ChevronDown, User, Lock, LogOut, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { searchApi } from '../../services/api';
import { MyProfileModal } from './MyProfileModal';
import { NotificationBell } from '../NotificationBell';

type SearchResult = { id: string; type: string; title: string; subtitle: string; route: string };
type SearchGroups = { patients: SearchResult[]; visits: SearchResult[]; appointments: SearchResult[]; invoices: SearchResult[] };

const GROUP_LABELS: Record<keyof SearchGroups, string> = {
  patients: 'Patients',
  visits: 'Visits',
  appointments: 'Appointments',
  invoices: 'Invoices',
};

const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'so', label: 'Soomaali', flag: '🇸🇴' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

export function TopHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [serverOnline, setServerOnline] = useState(true);
  const [langOpen, setLangOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Global search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchGroups | null>(null);
  const [searching, setSearching] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Ctrl+K / Cmd+K focuses the search box from anywhere
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setResultsOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Click outside closes the results dropdown
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setResultsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Debounced fetch as the user types
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      searchApi
        .global(q)
        .then((res) => {
          setResults(res.data);
          setResultsOpen(true);
        })
        .catch(() => setResults(null))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const totalResults = results
    ? results.patients.length + results.visits.length + results.appointments.length + results.invoices.length
    : 0;

  const goToResult = (r: SearchResult) => {
    navigate(r.route);
    setResultsOpen(false);
    setQuery('');
    setResults(null);
  };

  // Server health check every 30s
  useEffect(() => {
    const check = async () => {
      try {
        await fetch('/api/health', { method: 'GET' });
        setServerOnline(true);
      } catch {
        setServerOnline(false);
      }
    };
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  return (
    <header className="bg-white border-b border-clinical-200 px-4 py-3 flex items-center gap-4 z-10">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="p-2 hover:bg-clinical-100 rounded-lg transition-colors"
      >
        <Menu size={20} className="text-clinical-600" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md" ref={searchBoxRef}>
        <div className="relative">
          {searching ? (
            <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400 animate-spin" />
          ) : (
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
          )}
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results) setResultsOpen(true); }}
            placeholder="Search patients, visits, appointments, invoices... (Ctrl+K)"
            className="w-full pl-9 pr-4 py-2 text-sm bg-clinical-50 border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />

          {resultsOpen && results && (
            <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-clinical-200 py-1 z-50 max-h-96 overflow-y-auto">
              {totalResults === 0 ? (
                <p className="px-4 py-6 text-sm text-clinical-400 text-center">
                  No results for "{query}"
                </p>
              ) : (
                (Object.keys(GROUP_LABELS) as (keyof SearchGroups)[]).map((groupKey) => {
                  const items = results[groupKey];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={groupKey} className="py-1">
                      <p className="px-4 pt-1 pb-1 text-xs font-semibold text-clinical-400 uppercase tracking-wide">
                        {GROUP_LABELS[groupKey]}
                      </p>
                      {items.map((r) => (
                        <button
                          key={`${groupKey}-${r.id}`}
                          onClick={() => goToResult(r)}
                          className="w-full text-left px-4 py-2 hover:bg-clinical-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-clinical-800">{r.title}</p>
                          <p className="text-xs text-clinical-500">{r.subtitle}</p>
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Server status */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border mr-2"
          style={{ borderColor: serverOnline ? '#22c55e' : '#ef4444' }}>
          <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={serverOnline ? 'text-green-700' : 'text-red-700'}>
            {t(serverOnline ? 'serverStatus.connected' : 'serverStatus.offline')}
          </span>
        </div>

        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 px-3 py-2 hover:bg-clinical-100 rounded-lg text-sm transition-colors"
          >
            <Globe size={16} className="text-clinical-600" />
            <span>{currentLang.flag} {currentLang.code.toUpperCase()}</span>
            <ChevronDown size={14} className="text-clinical-400" />
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-clinical-200 py-1 z-50 min-w-[140px]">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => { i18n.changeLanguage(lang.code); setLangOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-clinical-50 transition-colors"
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <NotificationBell currentUserId={user?.id} onNavigate={navigate} />

        {/* Fullscreen */}
        <button
          onClick={() => !document.fullscreenElement ? document.documentElement.requestFullscreen() : document.exitFullscreen()}
          className="p-2 hover:bg-clinical-100 rounded-lg transition-colors"
        >
          <Maximize2 size={18} className="text-clinical-600" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserOpen(!userOpen)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-clinical-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-primary-600 text-white text-sm font-semibold flex-shrink-0">
              {user?.profilePhoto
                ? <img
                    key={user.profilePhoto}
                    src={user.profilePhoto.startsWith('http') ? user.profilePhoto : `/api${user.profilePhoto}`}
                    alt={user?.fullName ?? ''}
                    className="w-full h-full object-cover"
                  />
                : <>{user?.firstName?.[0]}{user?.lastName?.[0]}</>}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-clinical-900 leading-tight">{user?.fullName}</p>
              <p className="text-xs text-clinical-500 capitalize">{user?.roles?.[0]}</p>
            </div>
            <ChevronDown size={14} className="text-clinical-400" />
          </button>
          {userOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-clinical-200 py-1 z-50 min-w-[180px]">
              <button onClick={() => { setProfileOpen(true); setUserOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-clinical-50 transition-colors">
                <User size={16} className="text-clinical-500" /> My Profile
              </button>
              <button onClick={() => { window.dispatchEvent(new Event('open-change-password')); setUserOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-clinical-50 transition-colors">
                <Lock size={16} className="text-clinical-500" /> Change Password
              </button>
              <div className="border-t border-clinical-200 my-1" />
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} /> {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
      {profileOpen && <MyProfileModal onClose={() => setProfileOpen(false)} />}
      <ChangePasswordHost />
    </header>
  );
}
