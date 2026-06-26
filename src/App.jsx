import { Routes, Route } from 'react-router-dom';

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
      <Route path="/home" element={<Home />} />
      <Route path="/my-complaints" element={<MyComplaints />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/chatbot" element={<Chatbot />} />
      <Route path="/document" element={<DocumentOCR />} />

      {/* 담당자용 경로 */}
      <Route path="/staff" element={<StaffComplaints />} />
      <Route path="/staff/urgent" element={<StaffUrgent />} />
      <Route path="/staff/stats" element={<StaffStats />} />

      {/* 관리자용 경로 */}
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/settings" element={<AdminSettings />} />
      <Route path="/admin/monitoring" element={<AdminMonitoring />} />
      <Route path="/admin/stats" element={<AdminStats />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/preview" element={<DesignPreview />} />
    </Routes>
  );
}

export default App;
