import { Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { EmptyState } from './components/States';
import { Button } from './components/ui';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import TasksPage from './pages/TasksPage';
import CalendarPage from './pages/CalendarPage';
import MembersPage from './pages/MembersPage';

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route
          path="*"
          element={
            <div className="card">
              <EmptyState
                icon="search"
                title="Halaman tidak ditemukan"
                description="Alamat yang Anda tuju tidak tersedia. Gunakan menu di samping untuk kembali ke halaman utama."
                action={
                  <Button variant="primary" icon="grid" onClick={() => window.location.assign('/')}>
                    Ke dashboard
                  </Button>
                }
              />
            </div>
          }
        />
      </Routes>
    </AppShell>
  );
}
