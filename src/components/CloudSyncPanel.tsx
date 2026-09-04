import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { pushSave, pullSave } from '@/game/cloudSync';

interface Props {
  onSynced: () => void;
  panelStyle: React.CSSProperties;
  btnPrimary: React.CSSProperties;
  btnSecondary: React.CSSProperties;
  onBack: () => void;
}

export default function CloudSyncPanel({ onSynced, panelStyle, btnPrimary, btnSecondary, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    supabase.auth.getSession().then(({ data }) => setUserEmail(data.session?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(ok); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(false); }
  };

  const emailAuth = () => run(async () => {
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  }, mode === 'signup' ? 'Account created — check your email if confirmation is required.' : 'Signed in!');

  const googleAuth = () => run(async () => {
    const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
    if (result.error) throw new Error(result.error.message || 'Google sign-in failed');
  }, 'Signed in with Google!');

  return (
    <div className="absolute inset-0 flex flex-col items-center z-20 overflow-auto py-8 px-4">
      <div className="w-full max-w-md rounded-2xl p-6" style={panelStyle}>
        <h2 className="font-display text-2xl font-bold mb-1 text-center" style={{ color: 'hsl(var(--primary))' }}>☁ CLOUD SYNC</h2>
        <p className="font-body text-xs text-center mb-5" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Optional. Keep settings, unlocked skins, achievements and scores across devices.
        </p>

        {!userEmail ? (
          <>
            <div className="flex gap-2 mb-4">
              {(['signin', 'signup'] as const).map(m => (
                <button key={m} className="flex-1 font-display text-xs py-2 rounded-lg"
                  style={mode === m ? btnPrimary : btnSecondary}
                  onClick={() => setMode(m)}>
                  {m === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                </button>
              ))}
            </div>
            <label className="font-body text-[10px] uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }} htmlFor="sync-email">Email</label>
            <input id="sync-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
              className="w-full mb-3 mt-1 rounded-lg px-3 py-2 font-body text-sm"
              style={{ backgroundColor: 'hsl(var(--muted) / 0.4)', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }} />
            <label className="font-body text-[10px] uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }} htmlFor="sync-pass">Password</label>
            <input id="sync-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
              className="w-full mb-4 mt-1 rounded-lg px-3 py-2 font-body text-sm"
              style={{ backgroundColor: 'hsl(var(--muted) / 0.4)', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }} />
            <button disabled={busy} className="w-full font-display text-sm py-3 rounded-lg mb-2" style={btnPrimary} onClick={emailAuth}>
              {busy ? 'PLEASE WAIT…' : mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>
            <button disabled={busy} className="w-full font-display text-sm py-3 rounded-lg mb-4" style={btnSecondary} onClick={googleAuth}>
              CONTINUE WITH GOOGLE
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'hsl(var(--muted) / 0.4)' }}>
              <div className="font-body text-[10px] uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>Signed in as</div>
              <div className="font-display text-sm font-bold" style={{ color: 'hsl(var(--foreground))' }}>{userEmail}</div>
            </div>
            <button disabled={busy} className="w-full font-display text-sm py-3 rounded-lg mb-2" style={btnPrimary}
              onClick={() => run(pushSave, 'Progress uploaded to the cloud.')}>⬆ UPLOAD THIS DEVICE</button>
            <button disabled={busy} className="w-full font-display text-sm py-3 rounded-lg mb-2" style={btnSecondary}
              onClick={() => run(async () => {
                const found = await pullSave();
                if (!found) throw new Error('No cloud save yet — upload first.');
                onSynced();
              }, 'Cloud progress merged into this device.')}>⬇ RESTORE FROM CLOUD</button>
            <button disabled={busy} className="w-full font-display text-sm py-3 rounded-lg mb-4" style={btnSecondary}
              onClick={() => run(async () => { await supabase.auth.signOut(); }, 'Signed out.')}>SIGN OUT</button>
          </>
        )}

        {msg && (
          <p className="font-body text-xs text-center mb-4" style={{ color: 'hsl(var(--secondary))' }} role="status">{msg}</p>
        )}

        <button className="w-full font-display text-sm py-3 rounded-lg" style={btnSecondary} onClick={onBack}>BACK</button>
      </div>
    </div>
  );
}
