import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon, { type IconName } from './Icon';
import { Button, IconButton } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Ringkasan',
    items: [{ to: '/', label: 'Dashboard', icon: 'grid', end: true }],
  },
  {
    label: 'Ruang kerja',
    items: [
      { to: '/projects', label: 'Proyek', icon: 'folder' },
      { to: '/tasks', label: 'Tugas', icon: 'list-todo' },
      { to: '/calendar', label: 'Kalender kerja', icon: 'calendar' },
      { to: '/members', label: 'Sumber daya', icon: 'users' },
    ],
  },
];

const PAGE_TITLE: Array<{ match: (path: string) => boolean; title: string }> = [
  { match: (p) => p === '/', title: 'Dashboard' },
  { match: (p) => p.startsWith('/projects/'), title: 'Detail proyek' },
  { match: (p) => p.startsWith('/projects'), title: 'Proyek' },
  { match: (p) => p.startsWith('/tasks'), title: 'Tugas' },
  { match: (p) => p.startsWith('/calendar'), title: 'Kalender kerja' },
  { match: (p) => p.startsWith('/members'), title: 'Sumber daya' },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  // Tutup drawer navigasi saat berpindah halaman
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const title = PAGE_TITLE.find((p) => p.match(location.pathname))?.title ?? 'ProjectMS';
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="app-shell">
      <aside className={`sidebar${navOpen ? ' open' : ''}`} aria-label="Navigasi utama">
        <Link to="/" className="sidebar-brand">
          <span className="brand-mark">PM</span>
          <span>
            <span className="brand-title">ProjectMS</span>
            <span className="brand-sub">Manajemen Proyek</span>
          </span>
        </Link>

        <nav className="nav">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <span className="nav-icon">
                    <Icon name={it.icon} size={16} />
                  </span>
                  <span>{it.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sf-title">Analitik proyek</div>
          <div className="sf-sub">Gantt · Network Diagram · PERT · CPM tersedia di setiap proyek.</div>
        </div>
      </aside>

      <div
        className={`sidebar-backdrop${navOpen ? ' open' : ''}`}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <div className="main-area">
        <header className="topbar">
          <IconButton
            name="menu"
            label="Buka menu navigasi"
            onClick={() => setNavOpen((v) => !v)}
            variant="default"
            size={18}
            className="menu-toggle"
          />
          <span className="topbar-title">{title}</span>
          <span className="topbar-date">· {today}</span>
          <span className="topbar-spacer" />
          <div className="topbar-actions">
            <Button variant="primary" icon="plus" onClick={() => navigate('/projects?baru=1')}>
              Tambah Proyek
            </Button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
