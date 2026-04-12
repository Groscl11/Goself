import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, ChevronUp } from 'lucide-react';

interface MenuItem {
  label: string;
  path: string;
  icon: ReactNode;
  collapsibleContent?: ReactNode;
  /** Optional section header label. When this changes between consecutive items, a section divider is rendered. */
  section?: string;
}

interface DashboardLayoutProps {
  children: ReactNode;
  menuItems: MenuItem[];
  title?: string;
}

export function DashboardLayout({ children, menuItems, title }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const location = useLocation();

  const toggleCollapsible = (path: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Detect first occurrence of each section to render a header
  const renderedSections = new Set<string>();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{title || 'Dashboard'}</h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div
        className={`fixed inset-0 bg-gray-900 bg-opacity-50 z-40 lg:hidden transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-blue-600">GoSelf</h2>
            <p className="text-sm text-gray-500 mt-0.5">Client Portal</p>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-3">
            <ul className="space-y-0.5">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/client' && location.pathname.startsWith(item.path + '/'));
                const isExpanded = expandedItems[item.path];
                const showSectionHeader = item.section && !renderedSections.has(item.section);

                if (item.section) renderedSections.add(item.section);

                return (
                  <li key={item.path}>
                    {showSectionHeader && (
                      <p className="px-3 pt-4 pb-1 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                        {item.section}
                      </p>
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <Link
                          to={item.path}
                          className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-semibold'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                          }`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                        {item.collapsibleContent && (
                          <button
                            onClick={() => toggleCollapsible(item.path)}
                            className="px-2 py-2 text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                      {item.collapsibleContent && isExpanded && (
                        <div className="mt-1 ml-3 pl-3 border-l-2 border-blue-100">
                          {item.collapsibleContent}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>


        </div>
      </aside>

      <div className="lg:ml-64 pt-16 lg:pt-0">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
