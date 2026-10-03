import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  AlertCircle,
  CalendarDays,
  ListOrdered,
  Stethoscope,
  Activity,
  Pill,
  FlaskConical,
  Scan,
  DollarSign,
  Package,
  BedDouble,
  Building2,
  UsersRound,
  BarChart3,
  Settings,
  LogOut,
  FileText,
  Banknote,
  Receipt,
  RotateCcw,
  Clock,
  ChevronDown,
  History,
  ShoppingCart,
  Network,
  Wallet, Tags, CalendarRange, ClipboardCheck, HelpCircle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import logoImg from '../../assets/somacare-logo.png';
import { useState } from 'react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
  badge?: number;
  children?: NavItem[];
}

interface NavSection {
  section: string;
  items: NavItem[];
  hideForRoles?: string[];
}

const NAV: NavSection[] = [
  {
    section: 'Dashboard',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Patient Flow',
    items: [
      { label: 'All Patients',       path: '/patients',           icon: Users,         permission: 'patients:read' },
      { label: 'Register Patient',   path: '/patients/register',  icon: UserPlus,      permission: 'patients:create' },
      { label: 'Patient Visits',     path: '/patients/visits',    icon: ClipboardList, permission: 'visits:read' },
      { label: 'Emergency Patients', path: '/patients/emergency', icon: AlertCircle,   permission: 'patients:read' },
      { label: 'Appointments',       path: '/appointments',       icon: CalendarDays,  permission: 'appointments:read' },
      { label: 'Queue Management',   path: '/queue',              icon: ListOrdered,   permission: 'queue:read' },
    ],
    hideForRoles: ['pharmacist', 'accountant', 'laboratory'],
  },
  {
    section: 'Clinical',
    items: [
      { label: 'Triage',       path: '/clinical/triage',       icon: Activity,    permission: 'triage:read' },
      { label: 'Consultation', path: '/clinical/consultation', icon: Stethoscope, permission: 'consultations:read' },
      {
        label: 'Pharmacy',
        path: '/pharmacy',
        icon: Pill,
        permission: 'pharmacy:read',
        children: [
          { label: 'Dashboard',     path: '/pharmacy',               icon: LayoutDashboard, permission: 'pharmacy:read' },
          { label: 'Prescriptions', path: '/pharmacy/prescriptions', icon: ClipboardList,   permission: 'pharmacy:read' },
          { label: 'Dispensing',    path: '/pharmacy/dispensing',    icon: Package,         permission: 'pharmacy:read' },
          { label: 'Low Stock',     path: '/pharmacy/low-stock',     icon: AlertCircle,     permission: 'pharmacy:read' },
          { label: 'POS',           path: '/pharmacy/pos',           icon: ShoppingCart,    permission: 'pharmacy:read' },
        ],
      },
      { label: 'Laboratory',    path: '/laboratory', icon: FlaskConical, permission: 'laboratory:read' },
      { label: 'Radiology',     path: '/radiology',  icon: Scan,         permission: 'radiology:read' },
      { label: 'Bed Management',path: '/beds',        icon: BedDouble,    permission: 'beds:read' },
    ],
    hideForRoles: ['accountant'],
  },
  {
    section: 'Finance',
    items: [
      {
        label: 'Accounts',
        path: '/billing',
        icon: DollarSign,
        children: [
          { label: 'Invoices',          path: '/billing/invoices',        icon: FileText,  permission: 'billing:read' },
          { label: 'Payments',          path: '/billing/payments',        icon: Banknote,  permission: 'billing:read' },
          { label: 'Expenses',          path: '/billing/expenses',        icon: Receipt },
          { label: 'Credits & refunds', path: '/billing/credits-refunds', icon: RotateCcw, permission: 'billing:read' },
          { label: 'Bed rent',          path: '/billing/bed-rent',        icon: BedDouble, permission: 'billing:read' },
          { label: 'Outstanding',       path: '/billing/outstanding',     icon: Clock,     permission: 'billing:read' },
          {
            label: 'Reports', path: '/billing/reports', icon: BarChart3, permission: 'billing:read',
            children: [
              { label: 'Profit & loss',        path: '/billing/reports/profit-loss',          icon: BarChart3, permission: 'billing:read' },
              { label: 'Daily reconciliation', path: '/billing/reports/daily-reconciliation', icon: BarChart3, permission: 'billing:read' },
              { label: 'Discount & void log',  path: '/billing/reports/discount-void-log',    icon: BarChart3, permission: 'billing:read' },
            ],
          },
        ],
      },
      {
        label: 'Inventory',
        path: '/inventory',
        icon: Package,
        children: [
          {
            label: 'Lab',
            path: '/inventory/lab',
            icon: FlaskConical,
            permission: 'inventory:read',
            children: [
              { label: 'Supplies',          path: '/inventory/lab-supplies',           icon: FlaskConical, permission: 'inventory:read' },
              { label: 'Purchase Supplies', path: '/inventory/lab-supplies/purchases', icon: Banknote,     permission: 'inventory:update' },
            ],
          },
          {
            label: 'Pharmacy',
            path: '/inventory/pharmacy',
            icon: Pill,
            children: [
              { label: 'Medicines', path: '/pharmacy/medicines', icon: Pill,     permission: 'pharmacy:read' },
              { label: 'Purchase',  path: '/pharmacy/purchases', icon: Banknote, permission: 'pharmacy:read' },
            ],
          },
        ],
      },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Departments', path: '/departments', icon: Building2,  permission: 'departments:read' },
      { label: 'Staff',       path: '/staff',       icon: UsersRound, permission: 'staff:read' },
      { label: 'Reports',     path: '/reports',     icon: BarChart3,  permission: 'reports:read' },
      { label: 'Settings',    path: '/settings',    icon: Settings,   permission: 'settings:read' },
    ],
    hideForRoles: ['doctor', 'nurse', 'pharmacist', 'laboratory'],
  },
  {
    section: 'Leave',
    items: [
      { label: 'Leave Requests', path: '/leave/requests', icon: CalendarDays },
      { label: 'Leave Balance',  path: '/leave/balance',  icon: Wallet },
      { label: 'Leave Calendar', path: '/leave/calendar', icon: CalendarRange },
      { label: 'Approvals',      path: '/leave/approvals', icon: ClipboardCheck },
      { label: 'Leave Types',    path: '/leave/types',    icon: Tags },
    ],
  },
  {
    // Kept as its own section (no hideForRoles) so every role that holds
    // orgchart:read can see it, regardless of the Operations section's
    // role-based hiding above. Edit/delete access is still governed
    // separately by orgchart:create/update/delete permissions.
    section: 'Org Chart',
    items: [
      { label: 'Org chart', path: '/org-chart', icon: Network, permission: 'orgchart:read' },
    ],
  },
  {
    // No permission gate and no hideForRoles \u2014 everyone should be able to find help.
    section: 'Help',
    items: [
      { label: 'Help & FAQ', path: '/help', icon: HelpCircle },
    ],
  },
];

function collectAllPaths(items: NavItem[]): string[] {
  const paths: string[] = [];
  for (const item of items) {
    paths.push(item.path);
    if (item.children) paths.push(...collectAllPaths(item.children));
  }
  return paths;
}

const ALL_NAV_PATHS = NAV.flatMap((section) => collectAllPaths(section.items));

// Picks the single most specific (longest) matching path in the whole menu,
// so sibling routes that share a text prefix (e.g. /inventory/lab-supplies
// and /inventory/lab-supplies/purchases) never both light up at once.
function findBestMatch(pathname: string): string | null {
  let best: string | null = null;
  for (const p of ALL_NAV_PATHS) {
    if (pathname === p || pathname.startsWith(p + '/')) {
      if (!best || p.length > best.length) best = p;
    }
  }
  return best;
}

function isActivePath(pathname: string, path: string): boolean {
  return path === findBestMatch(pathname);
}

function containsActive(item: NavItem, pathname: string): boolean {
  if (isActivePath(pathname, item.path)) return true;
  return !!item.children?.some((c) => containsActive(c, pathname));
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();
  const { user, hasPermission, hasRole, logout } = useAuthStore();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  if (!user) return null;

  const isVisible = (section: NavSection) => {
    if (!section.hideForRoles) return true;
    if (hasRole('administrator') || hasRole('manager')) return true;
    return !section.hideForRoles.some((r) => hasRole(r));
  };

  const canSee = (item: NavItem): boolean => {
    if (item.permission && !hasPermission(item.permission)) return false;
    if (!item.children) return true;
    return item.children.some(canSee);
  };

  const toggleGroup = (path: string) => {
    setOpenGroups((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const renderItem = (item: NavItem, depth: number) => {
    const Icon = item.icon;
    const hasChildren = !!item.children && item.children.length > 0;
    const active = isActivePath(location.pathname, item.path);
    const childActive = containsActive(item, location.pathname);
    const isOpen = openGroups[item.path] ?? childActive;
    const visibleChildren = item.children?.filter(canSee) ?? [];

    if (hasChildren) {
      return (
        <div key={item.path}>
          <button
            type="button"
            onClick={() => toggleGroup(item.path)}
            title={collapsed ? item.label : undefined}
            className={`
              flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-sm font-normal transition-colors
              ${collapsed ? 'justify-center px-0' : ''}
              ${childActive ? 'text-white font-medium' : 'text-white/50 hover:bg-white/8 hover:text-white'}
            `}
            style={depth > 0 && !collapsed ? { paddingLeft: 12 + depth * 14 } : undefined}
          >
            <Icon size={depth > 0 ? 14 : 16} className="flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left">{item.label}</span>
                <ChevronDown
                  size={13}
                  className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </>
            )}
          </button>
          {!collapsed && isOpen && (
            <div className="space-y-0.5 mt-0.5">
              {visibleChildren.map((child) => renderItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === '/pharmacy'}
        title={collapsed ? item.label : undefined}
        className={`
          flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-normal transition-colors
          ${collapsed ? 'justify-center px-0' : ''}
          ${active ? 'bg-primary-600 text-white font-normal' : 'text-white/50 hover:bg-white/8 hover:text-white'}
        `}
        style={depth > 0 && !collapsed ? { paddingLeft: 12 + depth * 14 } : undefined}
      >
        <Icon size={depth > 0 ? 14 : 16} className="flex-shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && item.badge != null && item.badge > 0 && (
          <span className="bg-white/20 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none">
            {item.badge}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={`flex flex-col h-screen bg-gray-900 text-white transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-[60px]' : 'w-[220px]'
      }`}
    >
      <div
        className={`flex flex-col items-center justify-center flex-shrink-0 border-b border-white/10 ${
          collapsed ? 'py-3' : 'py-7 px-4'
        }`}
      >
        <img
          src={logoImg}
          alt="Somcare"
          className={`object-contain flex-shrink-0 ${collapsed ? 'w-9 h-9' : 'w-20 h-20 mb-2'}`}
        />
        {!collapsed && (
          <>
            <span className="font-extrabold text-2xl leading-tight tracking-wide">
              <span className="text-white">SOM</span><span className="text-red-500">CARE</span>
            </span>
            <span className="text-[11px] text-white/60 mt-1 tracking-wide text-center">
              Better Health &bull; Brighter Future
            </span>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {NAV.map((section) => {
          if (!isVisible(section)) return null;
          const visibleItems = section.items.filter(canSee);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.section} className="mb-3">
              {!collapsed && (
                <p className="text-[11px] font-extrabold text-orange-400 uppercase tracking-widest px-2 mb-1 mt-1">
                  {section.section}
                </p>
              )}
              {collapsed && (
                <div className="border-t border-white/10 mx-1 mb-2 mt-1" />
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => renderItem(item, 0))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-2 py-3 flex-shrink-0 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] font-semibold text-white/60 capitalize truncate">
                {user.roles?.[0] ?? 'User'}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={`flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-white/50 hover:text-red-400 hover:bg-white/8 text-xs transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Log out' : undefined}
        >
          <LogOut size={14} />
          {!collapsed && <span className="font-semibold">Log out</span>}
        </button>
      </div>
    </aside>
  );
}
