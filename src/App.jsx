import { Routes, Route, Navigate } from 'react-router-dom';
import NotFound from './pages/NotFound';
import ErrorPage from './pages/ErrorPage';

function RequireAuth({ children }) {
  return sessionStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

// 시민용 화면들
import Login from './pages/citizen/Login';
import Register from './pages/citizen/Register';
import Landing from './pages/citizen/Landing';
import Home from './pages/citizen/Home';
import MyComplaints from './pages/citizen/MyComplaints';
import Notifications from './pages/citizen/Notifications';
import Settings from './pages/citizen/Settings';
import Faq from './pages/citizen/Faq';
import Chatbot from './pages/citizen/Chatbot';
import DocumentOCR from './pages/citizen/DocumentOCR';

// 담당자용 화면들
import StaffComplaints from './pages/staff/StaffComplaints';
import StaffUrgent from './pages/staff/StaffUrgent';
import StaffStats from './pages/staff/StaffStats';

// 관리자용 화면들
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminSettings from './pages/admin/AdminSettings';
import AdminMonitoring from './pages/admin/AdminMonitoring';
import AdminStats from './pages/admin/AdminStats';
import AdminUsers from './pages/admin/AdminUsers';
import DesignPreview from './pages/DesignPreview';

// App: 어떤 주소(경로)에서 어떤 화면을 보여줄지 정의하는 곳
function App() {
  return (
    <Routes>
      {/* 시민용 경로 */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/my-complaints" element={<RequireAuth><MyComplaints /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/chatbot" element={<RequireAuth><Chatbot /></RequireAuth>} />
      <Route path="/document" element={<RequireAuth><DocumentOCR /></RequireAuth>} />

      {/* 담당자용 경로 */}
      <Route path="/staff" element={<RequireAuth><StaffComplaints /></RequireAuth>} />
      <Route path="/staff/urgent" element={<RequireAuth><StaffUrgent /></RequireAuth>} />
      <Route path="/staff/stats" element={<RequireAuth><StaffStats /></RequireAuth>} />

      {/* 관리자용 경로 */}
      <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/settings" element={<RequireAuth><AdminSettings /></RequireAuth>} />
      <Route path="/admin/monitoring" element={<RequireAuth><AdminMonitoring /></RequireAuth>} />
      <Route path="/admin/stats" element={<RequireAuth><AdminStats /></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth><AdminUsers /></RequireAuth>} />
      <Route path="/preview" element={<DesignPreview />} />
      <Route path="/error/:code" element={<ErrorPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
