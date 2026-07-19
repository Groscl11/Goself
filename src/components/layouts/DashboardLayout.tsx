import { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface MenuItem {
  label: string;
  path: string;
  icon: ReactNode;
  collapsibleContent?: ReactNode;
  section?: string;
  adminOnly?: boolean;
}

interface DashboardLayoutProps {
  children: ReactNode;
  menuItems: MenuItem[];
  title?: string;
}

const COLLAPSED_KEY = 'goself_sidebar_collapsed';

// ── Tooltip wrapper (shown only in collapsed mode) ────────────────────────────
function NavTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute left-full ml-2.5 z-[200] whitespace-nowrap">
          <div className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg">
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardLayout({ children, menuItems, title }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
  });
  const { theme, loadTheme } = useTheme();
  const { profile } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const location = useLocation();

  useEffect(() => {
    if (profile?.client_id) loadTheme(profile.client_id);
  }, [profile?.client_id, loadTheme]);

  function toggleCollapsed() {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  }

  const toggleItem = (path: string) => {
    setExpandedItems(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderedSections = new Set<string>();

  const sidebarW = collapsed ? 'w-14' : 'w-52';
  const mainML  = collapsed ? 'lg:ml-14' : 'lg:ml-52';

  function SidebarContent() {
    const sections = new Set<string>();
    return (
      <div className="h-full flex flex-col">
        {/* Brand header */}
        <div className={`border-b border-gray-200 flex items-center ${collapsed ? 'px-0 py-4 justify-center' : 'px-4 py-4'}`}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold leading-none">G</span>
            </div>
          ) : (
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-blue-600 leading-none">GoSelf</h2>
              {theme.brandName && (
                <p className="text-xs font-semibold text-gray-700 mt-0.5 truncate">{theme.brandName}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-0.5">Client Portal</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 overflow-x-hidden">
          <ul className="space-y-0.5">
            {menuItems
              .filter(item => !item.adminOnly || profile?.role === 'admin')
              .map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/client' && location.pathname.startsWith(item.path + '/'));
                const isExpanded = expandedItems[item.path];
                const showSection = item.section && !sections.has(item.section);
                if (item.section) sections.add(item.section);

                return (
                  <li key={item.path}>
                    {/* Section header */}
                    {showSection && (
                      collapsed ? (
                        <div className="mx-2 my-2 border-t border-gray-100" />
                      ) : (
                        <p className="px-2 pt-3 pb-0.5 text-[9px] font-bold tracking-widest text-gray-400 uppercase truncate">
                          {item.section}
                        </p>
                      )
                    )}

                    <div className="flex flex-col">
                      <div className="flex items-center">
                        {collapsed ? (
                          <NavTooltip label={item.label}>
                            <Link
                              to={item.path}
                              onClick={() => setSidebarOpen(false)}
                              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors mx-auto
                                ${isActive
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
                            >
                              {item.icon}
                            </Link>
                          </NavTooltip>
                        ) : (
                          <Link
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-xs min-w-0
                              ${isActive
                                ? 'bg-blue-50 text-blue-700 font-semibold'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'}`}
                          >
                            <span className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                              {item.icon}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </Link>
                        )}

                        {/* Collapsible toggle — only in expanded mode */}
                        {!collapsed && item.collapsibleContent && (
                          <button
                            onClick={() => toggleItem(item.path)}
                            className="px-1.5 py-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                          >
                            {isExpanded
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>

                      {/* Collapsible sub-content */}
                      {!collapsed && item.collapsibleContent && isExpanded && (
                        <div className="mt-1 ml-2 pl-3 border-l-2 border-blue-100">
                          {item.collapsibleContent}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        </nav>

        {/* Collapse toggle button */}
        <div className={`border-t border-gray-200 ${collapsed ? 'p-2 flex justify-center' : 'p-2'}`}>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex items-center gap-2 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors
              ${collapsed ? 'w-10 h-10 justify-center' : 'w-full px-2.5 py-2'}`}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : (
                <>
                  <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">Collapse</span>
                </>
              )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-900">{title || 'Dashboard'}</h1>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-gray-100">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-gray-900 bg-opacity-50 z-40 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Desktop sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 ${sidebarW} bg-white border-r border-gray-200 z-50
          hidden lg:block transition-[width] duration-200 ease-in-out overflow-hidden`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar (always w-52, slides in) */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-52 bg-white border-r border-gray-200 z-50
          lg:hidden transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className={`${mainML} pt-14 lg:pt-0 transition-[margin-left] duration-200 ease-in-out`}>
        <main className="p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
