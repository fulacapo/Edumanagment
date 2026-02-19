import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useParams, useLocation, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, Menu, X, CalendarClock, LogOut, Loader2 } from 'lucide-react';
import Dashboard from './components/Dashboard';
import FeesTable from './components/FeesTable';
import SchedulesTable from './components/SchedulesTable';
import StudentCard from './components/StudentCard';
import StudentsList from './components/StudentsList';
import Login from './components/Login';
import CashRegister from './components/CashRegister';
import HelpBot from './components/HelpBot';
import DebtorsReport from './components/DebtorsReport';
import { DataService } from './services/db';
import { Student, FeesDoc } from './types';
import { useAuth } from './contexts/AuthContext';
import { auth } from './firebase';

// Wrapper to fetch data for Student Card View
const StudentViewWrapper = () => {
  const { id } = useParams();
  const { instituteId } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [fees, setFees] = useState<FeesDoc>({});
  const [schedules, setSchedules] = useState<SchedulesDoc>({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!id || !instituteId) return;
    setLoading(true);
    // Nota: DataService ahora filtra por instituteId internamente si es necesario,
    // pero para un ID específico (ficha), la seguridad la da las reglas de Firestore.
    // getStudents retorna todo el array filtrado, buscamos ahi para mantener consistencia simple
    // o podríamos hacer un getStudentById(id) en el futuro.
    const allStudents = await DataService.getStudents(instituteId);
    const found = allStudents.find(s => s.id === id);
    const feesData = await DataService.getFees(instituteId);
    const schedulesData = await DataService.getSchedules(instituteId);

    setStudent(found || null);
    setFees(feesData);
    setSchedules(schedulesData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id, instituteId]);

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline mr-2" /> Cargando Ficha...</div>;
  if (!student) return <div className="p-10 text-center text-red-500">Estudiante no encontrado o acceso denegado.</div>;

  return <StudentCard student={student} fees={fees} schedules={schedules} onPaymentUpdated={loadData} />;
};

// Sidebar Nav Item
const NavItem = ({ to, icon: Icon, label, exact = false }: { to: string, icon: any, label: string, exact?: boolean }) => {
  const location = useLocation();
  const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${isActive
        ? 'bg-brand-green text-white shadow-lg shadow-brand-green/20 translate-x-1'
        : 'text-gray-500 hover:bg-gray-50 hover:text-brand-green hover:translate-x-1'
        }`}
    >
      <Icon size={20} className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
      <span className={`font-medium tracking-wide ${isActive ? 'font-semibold' : ''}`}>{label}</span>
      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/40" />}
    </Link>
  );
};

// Layout Component handles Sidebar and Protected Content Structure
const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth(); // Assuming we might want to show user info

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex font-sans text-gray-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-brand-dark/60 z-40 md:hidden backdrop-blur-sm animate-in fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-gray-100/80 z-50 transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) shadow-2xl md:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="h-full flex flex-col">
          {/* Logo Section */}
          <div className="p-8 border-b border-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-green to-[#1e3f2e] rounded-xl flex items-center justify-center text-white font-serif font-bold text-lg shadow-md shadow-brand-green/20">
                EM
              </div>
              <div>
                <h1 className="font-serif font-bold text-xl text-gray-900 tracking-tight leading-none">EduManage</h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand-gold font-bold mt-1">Professional</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6 space-y-1 overflow-y-auto">
            <div className="mb-2 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Principal</div>
            <NavItem to="/" icon={LayoutDashboard} label="Panel General" exact />
            <NavItem to="/caja" icon={CreditCard} label="Caja y Movimientos" />
            <NavItem to="/students" icon={Users} label="Alumnos & Fichas" />

            <div className="mt-8 mb-2 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Configuración</div>
            <NavItem to="/fees" icon={CreditCard} label="Precios y Cuotas" />
            <NavItem to="/schedules" icon={CalendarClock} label="Horarios y Cursos" />
          </nav>

          {/* User Profile & Logout */}
          <div className="p-6 border-t border-gray-50 bg-gray-50/30">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-brand-gold/20 text-brand-gold flex items-center justify-center font-bold text-sm">
                {user?.email?.charAt(0).toUpperCase() || 'D'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">Directora</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 w-full rounded-xl text-left transition-all duration-200 group"
            >
              <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
            <p className="text-center text-[10px] text-gray-300 mt-4 font-mono">v2.5.0 • Stitch Ready</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[#F9FAFB]">
        {/* Mobile Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 p-4 flex items-center justify-between md:hidden sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Menu size={24} />
            </button>
            <span className="font-serif font-bold text-lg text-gray-900">EduManage Pro</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:px-8 md:py-8 scroll-smooth relative">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>

        {/* Floating Help Bot - Available on all protected screens */}
        <div className="fixed bottom-6 right-6 z-40">
          <HelpBot />
        </div>
      </main>
    </div>
  );
};

const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500"><Loader2 className="animate-spin mr-2" /> Iniciando EduManage...</div>;
  }

  return (
    <HashRouter>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={
          user ? <Navigate to="/" replace /> : <Login onLogin={() => { }} />
        } />

        {/* Protected Routes */}
        <Route element={
          user ? <Layout /> : <Navigate to="/login" replace />
        }>
          <Route path="/" element={<Dashboard />} />
          <Route path="/students" element={<StudentsList />} />
          <Route path="/fees" element={<FeesTable />} />
          <Route path="/schedules" element={<SchedulesTable />} />
          <Route path="/caja" element={<CashRegister />} />
          <Route path="/student/:id" element={<StudentViewWrapper />} />
          <Route path="/deudores" element={<DebtorsReport />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;