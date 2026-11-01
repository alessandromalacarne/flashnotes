import { Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { PublicOnly } from './auth/PublicOnly';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { GroupNotesPage } from './pages/GroupNotesPage';
import { GroupsPage } from './pages/GroupsPage';
import { NotePage } from './pages/NotePage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnly>
              <SignUpPage />
            </PublicOnly>
          }
        />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<NotePage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="group/:group" element={<GroupNotesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
