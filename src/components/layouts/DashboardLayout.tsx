import { ReactNode, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Users, ChevronDown, ChevronUp } from 'lucide-react';

interface MenuItem {
  label: string;
  path: string;
  icon: ReactNode;
  collapsibleContent?: ReactNode;
}

interface DashboardLayoutProps {
  children: ReactNode;
  menuItems: MenuItem[];
  title?: string;
}

export function DashboardLayout({ children, menuItems, title }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const location = useLocation();

  const toggleCollapsible = (path: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const profiles = [
    { name: 'Admin', path: '/admin', color: 'bg-purple-100 text-purple-700' },
    { name: 'Client', path: '/client', color: 'bg-blue-100 text-blue-700' },
    { name: 'Brand', path: '/brand', color: 'bg-green-100 text-green-700' },
    { name: 'Member', path: '/member', color: 'bg-orange-100 text-orange-700' },
  ];

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
            <h2 className="text-2xl font-bold text-blue-600">RewardHub</h2>
            <p className="text-sm text-gray-600 mt-1">{title || 'Dashboard'}</p>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const isExpanded = expandedItems[item.path];

                return (
                  <li key={item.path}>
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <Link
                          to={item.path}
                          className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                            isActive
                              ? 'bg-blue-50 text-blue-600'
                              : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                          }`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          {item.icon}
                          <span className="font-medium">{item.label}</span>
                        </Link>
                        {item.collapsibleContent && (
                          <button
                            onClick={() => toggleCollapsible(item.path)}
                            className="px-2 py-3 text-gray-500 hover:text-gray-700"
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
                        <div className="mt-2 ml-4 pl-4 border-l-2 border-blue-200">
                          {item.collapsibleContent}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => setShowProfileSwitcher(!showProfileSwitcher)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Switch Profile</span>
            </button>

            {showProfileSwitcher && (
              <div className="mt-2 space-y-2">
                {profiles.map((profile) => (
                  <button
                    key={profile.path}
                    onClick={() => {
                      navigate(profile.path);
                      setShowProfileSwitcher(false);
                      setSidebarOpen(false);
                    }}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${profile.color} hover:opacity-80`}
                  >
                    {profile.name}
                  </button>
                ))}
              </div>
            )}
          </div>
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
