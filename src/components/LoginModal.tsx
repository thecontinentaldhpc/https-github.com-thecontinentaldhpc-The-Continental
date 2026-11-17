import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { LoginPanel } from './LoginPanel';

export function LoginModal() {
  const { loginModalOpen, loginModalRedirect, closeLoginModal } = useSite();
  const titleId = useId();

  useEffect(() => {
    if (!loginModalOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLoginModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [loginModalOpen, closeLoginModal]);

  if (!loginModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeLoginModal();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="centered-login-modal"
        className="relative w-full max-w-[460px] max-h-[90vh] overflow-y-auto bg-white dark:bg-[#181818] border-2 border-neutral-950 dark:border-neutral-600 shadow-2xl"
      >
        <button
          type="button"
          onClick={closeLoginModal}
          aria-label="Close login panel"
          data-testid="close-login-modal-btn"
          className="absolute top-3.5 right-3.5 p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#262626] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <LoginPanel
          isModal
          titleId={titleId}
          redirectTo={loginModalRedirect}
          onClose={closeLoginModal}
        />
      </div>
    </div>
  );
}
