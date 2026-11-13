import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Activity,
  Building2,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { GmailLoginScreen } from './components/GmailLoginScreen';
import { GmailSessionAudit } from './components/GmailSessionAudit';
import { OfficerProfileSettings } from './components/OfficerProfileSettings';
import { WorkforceDashboard } from './components/WorkforceDashboard';
import {
  auth,
  createWorkforceRecord,
  db,
  deleteLoginSession,
  deleteWorkforceRecord,
  handleFirestoreError,
  importWorkforceBatch,
  loadOfficialSsjDataset,
  OperationType,
  signInWithGmail,
  signOutFromGmail,
  syncUserAndCreateSession,
  toDateValue,
  updateOfficerProfile,
  updateWorkforceRecord,
} from './firebase';
import type {
  LoginSession,
  NavSection,
  UserProfile,
  WorkforceInput,
  WorkforceRecord,
} from './types';
import { isExcludedCentralHospital } from './utils/csvParser';

function mapAuthErrorToThai(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const message = err instanceof Error ? err.message : String(err);

  if (message === 'UNVERIFIED_EMAIL') {
    return 'บัญชี Gmail นี้ยังไม่ได้รับการยืนยันอีเมล กรุณาใช้บัญชีที่ยืนยันตัวตนแล้ว';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'คุณได้ปิดหน้าต่างเลือกบัญชี Google ก่อนการยืนยันเสร็จสิ้น กรุณากดเข้าสู่ระบบใหม่อีกครั้ง';
  }
  if (code === 'auth/popup-blocked') {
    return 'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัปของ Google กรุณาอนุญาตป๊อปอัปสำหรับเว็บไซต์นี้แล้วลองใหม่';
  }
  if (code === 'auth/network-request-failed') {
    return 'ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication กรุณาติดต่อผู้ดูแลระบบ';
  }
  return 'เกิดข้อผิดพลาดในการเชื่อมต่อบัญชี Gmail กรุณาลองใหม่อีกครั้ง';
}

const SECTION_META: Record<NavSection, { title: string; subtitle: string }> = {
  workforce: {
    title: 'ข้อมูลแพทย์สังกัด สสจ.ปัตตานี',
    subtitle: 'ระบบบริหารจัดการกำลังคนแพทย์ 11 โรงพยาบาลชุมชน/รพร. ภายใต้สำนักงานสาธารณสุขจังหวัดปัตตานี (ไม่รวม รพท.ปัตตานี)',
  },
  'gmail-account': {
    title: 'บัญชี Gmail และประวัติการเข้าสู่ระบบ',
    subtitle: 'ตรวจสอบข้อมูลบัญชี Google ที่ยืนยันตัวตนและประวัติเซสชันการใช้งาน',
  },
  'profile-settings': {
    title: 'ข้อมูลเจ้าหน้าที่และหน่วยงาน',
    subtitle: 'จัดการตำแหน่ง กลุ่มงาน และโรงพยาบาลต้นสังกัดในสังกัด สสจ.ปัตตานี',
  },
};

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() =>
    sessionStorage.getItem('pmedis_session_id')
  );

  const [activeSection, setActiveSection] = useState<NavSection>('workforce');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceRecord[]>([]);
  const [workforceLoading, setWorkforceLoading] = useState(true);

  const isSigningInRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.emailVerified) {
        setUser(firebaseUser);
        if (!isSigningInRef.current && !sessionStorage.getItem('pmedis_session_id')) {
          try {
            const newSessionId = await syncUserAndCreateSession(firebaseUser);
            sessionStorage.setItem('pmedis_session_id', newSessionId);
            setCurrentSessionId(newSessionId);
          } catch (err) {
            console.error('Failed to sync reloaded session:', err);
          }
        }
      } else {
        setUser(null);
        setProfile(null);
        setSessions([]);
        setWorkforce([]);
        sessionStorage.removeItem('pmedis_session_id');
        setCurrentSessionId(null);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    const userDocPath = `users/${user.uid}`;
    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            uid: data.uid,
            email: data.email,
            displayName: data.displayName,
            photoURL: data.photoURL || '',
            position: data.position || '',
            department: data.department || '',
            facility: data.facility || '',
            role: data.role || 'officer',
            lastLoginAt: toDateValue(data.lastLoginAt),
            createdAt: toDateValue(data.createdAt),
            updatedAt: toDateValue(data.updatedAt),
          });
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, userDocPath)
    );

    const sessionsPath = `users/${user.uid}/sessions`;
    const sessionsQuery = query(
      collection(db, sessionsPath),
      where('userId', '==', user.uid)
    );
    const unsubSessions = onSnapshot(
      sessionsQuery,
      (snap) => {
        const list: LoginSession[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId,
            email: data.email,
            provider: data.provider,
            deviceLabel: data.deviceLabel,
            status: data.status,
            loginAt: toDateValue(data.loginAt),
            createdAt: toDateValue(data.createdAt),
          };
        });
        list.sort(
          (a, b) => (b.loginAt?.getTime() || 0) - (a.loginAt?.getTime() || 0)
        );
        setSessions(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, sessionsPath)
    );

    setWorkforceLoading(true);
    const workforcePath = 'workforce';
    const workforceQuery = query(
      collection(db, workforcePath),
      where('ownerId', '==', user.uid)
    );
    const unsubWorkforce = onSnapshot(
      workforceQuery,
      (snap) => {
        const list: WorkforceRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ownerId: data.ownerId,
              rowNo: Number(data.rowNo ?? 0),
              licenseNo: data.licenseNo || '-',
              fullName: data.fullName || '',
              hospital: data.hospital || '',
              district: data.district || '',
              positionTitle: data.positionTitle || '',
              rankLevel: data.rankLevel || '',
              doctorType: data.doctorType || '',
              dutyStatus: data.dutyStatus || 'active_duty',
              j18Status: data.j18Status || 'other',
              j18Hospital: data.j18Hospital || '',
              specialty: data.specialty || '-',
              studySponsor: data.studySponsor || '',
              studyPeriod: data.studyPeriod || '',
              note: data.note || '',
              createdAt: toDateValue(data.createdAt),
              updatedAt: toDateValue(data.updatedAt),
            };
          })
          .filter((rec) => !isExcludedCentralHospital(rec.hospital));

        list.sort((a, b) => (a.rowNo || 9999) - (b.rowNo || 9999));
        setWorkforce(list);
        setWorkforceLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, workforcePath)
    );

    return () => {
      unsubProfile();
      unsubSessions();
      unsubWorkforce();
    };
  }, [authReady, user]);

  const handleGmailLogin = async () => {
    setAuthError(null);
    setIsLoggingIn(true);
    isSigningInRef.current = true;
    try {
      const { sessionId } = await signInWithGmail();
      sessionStorage.setItem('pmedis_session_id', sessionId);
      setCurrentSessionId(sessionId);
    } catch (err) {
      setAuthError(mapAuthErrorToThai(err));
    } finally {
      isSigningInRef.current = false;
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    const uid = user?.uid;
    const sessId = currentSessionId;
    sessionStorage.removeItem('pmedis_session_id');
    setCurrentSessionId(null);
    await signOutFromGmail(uid, sessId);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 rounded bg-[#0D7A68] text-white font-display font-bold text-lg flex items-center justify-center mb-3">
          P
        </div>
        <p className="text-sm font-medium text-[#3E4946]">
          กำลังตรวจสอบสถานะการเข้าสู่ระบบ...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <GmailLoginScreen
        onLogin={handleGmailLogin}
        isLoggingIn={isLoggingIn}
        errorMessage={authError}
      />
    );
  }

  const navItems: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    {
      id: 'workforce',
      label: 'ข้อมูลแพทย์ สสจ.ปัตตานี',
      icon: <Activity className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'gmail-account',
      label: 'บัญชี Gmail และเซสชัน',
      icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'profile-settings',
      label: 'ข้อมูลหน่วยงาน',
      icon: <Building2 className="w-4 h-4 shrink-0" />,
    },
  ];

  const sectionMeta = SECTION_META[activeSection];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Sidebar (260px Fixed) */}
      <aside className="hidden lg:flex lg:w-[260px] lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-[#E2E8F0]">
        <div className="h-16 px-5 border-b border-[#E2E8F0] flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#0D7A68] text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
            P
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-[#0D1C2E] truncate">
              P-MEDIS
            </p>
            <p className="text-[11px] text-[#64748B] truncate">
              สสจ.ปัตตานี Intelligence
            </p>
          </div>
        </div>

        <nav aria-label="เมนูหลัก" className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded transition-colors text-left ${
                  active
                    ? 'bg-[#F0FDFA] text-[#005F50] font-semibold'
                    : 'text-[#3E4946] hover:bg-[#F8FAFC] hover:text-[#0D1C2E]'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-3 mb-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={profile?.displayName || user.displayName || 'Gmail User'}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full border border-[#CBD5E1] object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#0D7A68] text-white font-display font-semibold text-sm flex items-center justify-center shrink-0">
                {(profile?.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0D1C2E] truncate">
                {profile?.displayName || user.displayName || 'ผู้ใช้งาน'}
              </p>
              <p className="text-[11px] font-mono text-[#64748B] truncate">
                {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#1E293B] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile Off-Canvas Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0D1C2E]/45"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white border-r border-[#E2E8F0] flex flex-col z-10">
            <div className="h-16 px-5 border-b border-[#E2E8F0] flex items-center justify-between">
              <span className="font-display text-sm font-bold text-[#0D1C2E]">
                P-MEDIS สสจ.ปัตตานี
              </span>
              <button
                type="button"
                aria-label="ปิดเมนู"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 text-[#475569] hover:text-[#0D1C2E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded text-left ${
                      active
                        ? 'bg-[#F0FDFA] text-[#005F50] font-semibold'
                        : 'text-[#3E4946] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#E2E8F0]">
              <p className="text-xs font-mono text-[#475569] truncate mb-3">
                {user.email}
              </p>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#1E293B] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9]"
              >
                <LogOut className="w-3.5 h-3.5" />
                ออกจากระบบ
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[260px] flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="เปิดเมนูนำทาง"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 text-[#1E293B] hover:bg-[#F1F5F9] rounded"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-display font-semibold text-[#64748B] hidden sm:inline whitespace-nowrap">
                P-MEDIS
              </span>
              <span className="text-[#CBD5E1] hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-display font-semibold text-[#0D1C2E] truncate">
                {sectionMeta.title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('gmail-account')}
              className="hidden sm:inline-flex items-center gap-2 text-xs font-mono text-[#3E4946] hover:text-[#0D7A68] transition-colors whitespace-nowrap"
            >
              <span>{user.email}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#1E293B] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              ออกจากระบบ
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1400px] w-full mx-auto">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-[#0D1C2E] tracking-tight">
              {sectionMeta.title}
            </h1>
            <p className="text-sm text-[#475569] mt-1">{sectionMeta.subtitle}</p>
          </div>

          {activeSection === 'workforce' && (
            <WorkforceDashboard
              records={workforce}
              isLoading={workforceLoading}
              onCreateRecord={(input: WorkforceInput) =>
                createWorkforceRecord(user.uid, input)
              }
              onUpdateRecord={(id: string, input: WorkforceInput) =>
                updateWorkforceRecord(id, input)
              }
              onDeleteRecord={(id: string) => deleteWorkforceRecord(id)}
              onLoadSsjDataset={(replaceExisting) =>
                loadOfficialSsjDataset(
                  user.uid,
                  replaceExisting ? workforce.map((r) => r.id) : undefined
                )
              }
              onImportRecords={(items, replaceExisting) =>
                importWorkforceBatch(
                  user.uid,
                  items,
                  replaceExisting ? workforce.map((r) => r.id) : undefined
                )
              }
            />
          )}

          {activeSection === 'gmail-account' && (
            <GmailSessionAudit
              profile={profile}
              sessions={sessions}
              currentSessionId={currentSessionId}
              emailVerified={user.emailVerified}
              onSwitchAccount={handleGmailLogin}
              onSignOut={handleSignOut}
              onDeleteSession={(sessionId: string) =>
                deleteLoginSession(user.uid, sessionId)
              }
            />
          )}

          {activeSection === 'profile-settings' && (
            <OfficerProfileSettings
              profile={profile}
              onSaveProfile={(updates) => updateOfficerProfile(user.uid, updates)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
