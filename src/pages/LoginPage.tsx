import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoginPanel } from '../components/LoginPanel';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '';
  const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '';

  useEffect(() => {
    document.title = 'Login | THE CONTINENTAL';
  }, []);

  return (
    <main className="max-w-lg mx-auto px-4 sm:px-6 py-14">
      <LoginPanel redirectTo={safeRedirect} />
    </main>
  );
}
