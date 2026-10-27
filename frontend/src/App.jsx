import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Documents from './pages/Documents.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import Compare from './pages/Compare.jsx';
import Chat from './pages/Chat.jsx';
import History from './pages/History.jsx';
import Profile from './pages/Profile.jsx';
import NotFound from './pages/NotFound.jsx';

function LegacyAppRedirect() {
  const location = useLocation();
  return <Navigate to={`/app${location.pathname}${location.search}${location.hash}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      {/* Reset links are opened from email, so they work whether or not someone is signed in */}
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<Layout />}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="analyze" element={<Documents />} />
          <Route path="documents" element={<Documents />} />
          <Route path="compare" element={<Compare />} />
          <Route path="documents/:id" element={<DocumentDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="chat/:documentId" element={<Chat />} />
          <Route path="history" element={<History />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Preserve existing bookmarks and links while moving the workspace under /app. */}
      <Route path="/dashboard" element={<LegacyAppRedirect />} />
      <Route path="/documents" element={<LegacyAppRedirect />} />
      <Route path="/documents/:id" element={<LegacyAppRedirect />} />
      <Route path="/compare" element={<LegacyAppRedirect />} />
      <Route path="/chat" element={<LegacyAppRedirect />} />
      <Route path="/chat/:documentId" element={<LegacyAppRedirect />} />
      <Route path="/history" element={<LegacyAppRedirect />} />
      <Route path="/profile" element={<LegacyAppRedirect />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
