import { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { ArrowRight, CheckCircle2, Droplets, MessageSquare, PackageCheck } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { CATEGORY_IMAGES } from '../types/hub';

export const ALLOWED_OWNER_EMAIL = 'andrewandrre88@gmail.com';

interface AuthGateProps {
  externalError?: string | null;
  onClearExternalError?: () => void;
}

export function AuthGate({ externalError, onClearExternalError }: AuthGateProps) {
  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setErrorMessage(null);
    onClearExternalError?.();
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const email = (cred.user.email || '').trim().toLowerCase();
      if (!cred.user.emailVerified || email !== ALLOWED_OWNER_EMAIL) {
        await signOut(auth);
        setErrorMessage(
          `Access denied: ${cred.user.email || 'this account'} is not authorized. Only ${ALLOWED_OWNER_EMAIL} may access Yi Lai Hub.`
        );
        setSigningIn(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to complete sign in.';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMessage('Sign-in popup was closed before finishing. Please try again.');
      } else if (msg.includes('popup-blocked')) {
        setErrorMessage('Popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setErrorMessage(msg);
      }
      setSigningIn(false);
    }
  };

  const showcaseItems = [
    {
      title: 'Trigger Sprayers',
      spec: '28/410 · 28/400 · Chemical & Homecare',
      src: CATEGORY_IMAGES.trigger_sprayer,
    },
    {
      title: 'Lotion Pumps',
      spec: '24/410 · 28/410 · Brushed & PP Collars',
      src: CATEGORY_IMAGES.lotion_pump,
    },
    {
      title: 'Fine Mist Sprayers',
      spec: '18/410 · 20/410 · Anodized & Standard',
      src: CATEGORY_IMAGES.fine_mist_sprayer,
    },
    {
      title: 'Foam & Treatment Pumps',
      spec: '43/410 · Dual-Mesh Micro-Foam',
      src: CATEGORY_IMAGES.foam_pump,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Yi Lai Hub
        </span>
        <span className="text-xs font-medium text-slate-500">
          Dispensing Packaging Sales Operations
        </span>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wider text-teal-700 uppercase">
              Wholesale & Factory Sales Workspace
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance leading-[1.15]">
              Manage factory pricing, client WhatsApp contacts, and dispensing orders in one hub.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              Purpose-built for selling trigger sprayers, lotion pumps, and fine mist sprayers.
              Compare factory cost against quoted selling prices, reach buyers directly on WhatsApp,
              and track every order from quote to shipment.
            </p>
          </div>

          <div className="space-y-2.5 pt-1 text-sm text-slate-700">
            <div className="flex items-center gap-2.5">
              <PackageCheck className="w-4 h-4 text-teal-700 shrink-0" />
              <span>Save SKU specs, neck sizes, MOQ, and factory vs. selling unit prices</span>
            </div>
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-teal-700 shrink-0" />
              <span>Store buyer WhatsApp numbers with one-click chat and order quote sharing</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Droplets className="w-4 h-4 text-teal-700 shrink-0" />
              <span>Track order pipeline, payment milestones, and real-time gross margin</span>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              <span>{signingIn ? 'Signing in...' : 'Sign in with Google to Open Hub'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {(errorMessage || externalError) && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 max-w-md">
                {errorMessage || externalError}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Your product prices, client WhatsApp directory, and order history are stored privately
              in your cloud workspace.
            </p>
          </div>
        </div>

        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          {showcaseItems.map((item) => (
            <div
              key={item.title}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                <img
                  src={item.src}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3.5">
                <h2 className="text-sm font-semibold text-slate-900">{item.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{item.spec}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Yi Lai Hub</span>
        <span>Private Cloud Sync Enabled</span>
      </footer>
    </div>
  );
}
