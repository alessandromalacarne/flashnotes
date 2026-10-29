import { Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { PublicOnly } from './auth/PublicOnly';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { DeckDumpsPage } from './pages/DeckDumpsPage';
import { DecksPage } from './pages/DecksPage';
import { DumpPage } from './pages/DumpPage';
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
          <Route index element={<DumpPage />} />
          <Route path="decks" element={<DecksPage />} />
          <Route path="deck/:deck" element={<DeckDumpsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
