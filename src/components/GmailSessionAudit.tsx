import React, { useState } from 'react';
import {
  CheckCircle2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { LoginSession, UserProfile } from '../types';

interface GmailSessionAuditProps {
  profile: UserProfile | null;
  sessions: LoginSession[];
  currentSessionId: string | null;
  emailVerified: boolean;
  onSwitchAccount: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

function formatThaiDate(date: Date | null): string {
  if (!date) return 'กำลังบันทึกเวลา...';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export const GmailSessionAudit: React.FC<GmailSessionAuditProps> = ({
  profile,
  sessions,
  currentSessionId,
  emailVerified,
  onSwitchAccount,
  onSignOut,
  onDeleteSession,
}) => {
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitch = async () => {
    setIsSwitching(true);
    try {
      await onSwitchAccount();
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Authenticated Gmail Account Card */}
      <section className="bg-white border border-[#E2E8F0] rounded p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full border border-[#CBD5E1] object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#0D7A68] text-white font-display font-bold text-xl flex items-center justify-center shrink-0">
                {profile?.displayName?.[0]?.toUpperCase() || 'U'}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="font-display text-xl font-bold text-[#0D1C2E] truncate">
                  {profile?.displayName || 'ผู้ใช้งานระบบ'}
                </h2>
                {emailVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ยืนยัน Gmail แล้ว
                  </span>
                )}
              </div>
              <p className="text-sm font-mono text-[#3E4946] truncate">
                {profile?.email}
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                {profile?.position} · {profile?.facility}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={isSwitching}
              onClick={() => void handleSwitch()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#1E293B] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSwitching ? 'animate-spin' : ''}`} />
              {isSwitching ? 'กำลังสลับบัญชี...' : 'สลับบัญชี Gmail อื่น'}
            </button>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#DC2626] rounded hover:bg-[#B91C1C] transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              ออกจากระบบ
            </button>
          </div>
        </div>

        {/* Account Metadata Grid */}
        <div className="mt-6 pt-6 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-[#64748B] mb-1">ผู้ให้บริการยืนยันตัวตน</p>
            <p className="text-sm font-medium text-[#0D1C2E]">
              Google Account (OAuth 2.0)
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-1">สิทธิ์การเข้าถึงระบบ</p>
            <p className="text-sm font-medium text-[#0D1C2E]">
              {profile?.role === 'admin' ? 'ผู้ดูแลระบบระดับจังหวัด (Admin)' : 'เจ้าหน้าที่สาธารณสุข (Officer)'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-1">เข้าสู่ระบบล่าสุด</p>
            <p className="text-sm font-mono tabular-nums text-[#0D1C2E]">
              {formatThaiDate(profile?.lastLoginAt ?? null)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-1">รหัสอ้างอิงผู้ใช้ (UID)</p>
            <p className="text-xs font-mono text-[#475569] truncate">
              {profile?.uid}
            </p>
          </div>
        </div>
      </section>

      {/* Session Audit History Table */}
      <section className="bg-white border border-[#E2E8F0] rounded">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#0D7A68]" />
            <h3 className="font-display text-base font-semibold text-[#0D1C2E]">
              ประวัติการเข้าสู่ระบบด้วย Gmail (Session Audit Log)
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#64748B]">
            {sessions.length} รายการ
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#64748B]">
            ยังไม่มีบันทึกประวัติการเข้าสู่ระบบ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-display font-semibold text-[#475569]">
                  <th className="py-3 px-4 whitespace-nowrap">วันเวลาเข้าสู่ระบบ</th>
                  <th className="py-3 px-4 whitespace-nowrap">บัญชี Gmail</th>
                  <th className="py-3 px-4 whitespace-nowrap">อุปกรณ์และเบราว์เซอร์</th>
                  <th className="py-3 px-4 whitespace-nowrap">สถานะเซสชัน</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((sess) => {
                  const isCurrent = sess.id === currentSessionId;
                  return (
                    <tr
                      key={sess.id}
                      className="h-12 border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F0FDFA] transition-colors text-sm"
                    >
                      <td className="py-2 px-4 font-mono text-xs tabular-nums text-[#0D1C2E] whitespace-nowrap">
                        {formatThaiDate(sess.loginAt)}
                      </td>
                      <td className="py-2 px-4 font-mono text-xs text-[#3E4946] whitespace-nowrap">
                        {sess.email}
                      </td>
                      <td className="py-2 px-4 text-[#3E4946] whitespace-nowrap">
                        {sess.deviceLabel}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        {sess.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-lg">
                            {isCurrent ? 'เซสชันปัจจุบัน (Active)' : 'ใช้งานอยู่ (Active)'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] rounded-lg">
                            ออกจากระบบแล้ว
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => void onDeleteSession(sess.id)}
                            aria-label="ลบประวัติเซสชันนี้"
                            className="p-1.5 text-[#64748B] hover:text-[#DC2626] rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
