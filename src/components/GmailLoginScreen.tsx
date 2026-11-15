import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, MailCheck, ShieldCheck } from 'lucide-react';
import pavilionImage from '../assets/images/pmedis_medical_pavilion_1794556871460.jpg';

interface GmailLoginScreenProps {
  onLogin: () => Promise<void>;
  isLoggingIn: boolean;
  errorMessage: string | null;
}

export const GmailLoginScreen: React.FC<GmailLoginScreenProps> = ({
  onLogin,
  isLoggingIn,
  errorMessage,
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="premium-login min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Left Institutional Visual Panel */}
      <div className="relative lg:w-[46%] min-h-[260px] lg:min-h-screen bg-[#0D1C2E] overflow-hidden flex flex-col justify-between">
        {!imageError ? (
          <img
            src={pavilionImage}
            alt="P-MEDIS Provincial Public Health Center Architecture"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-[#005F50] via-[#0D1C2E] to-[#1E293B]"
          />
        )}

        {/* Measured Contrast Scrim */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0D1C2E]/95 via-[#0D1C2E]/55 to-[#0D1C2E]/35"
        />

        {/* Top Institutional Mark */}
        <div className="relative z-10 p-8 lg:p-12">
          <div className="inline-flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#0D7A68] flex items-center justify-center text-white font-display font-bold text-base">
              P
            </div>
            <div>
              <p className="font-display text-white font-semibold text-base tracking-tight leading-tight">
                P-MEDIS
              </p>
              <p className="text-xs text-[#99F3DD] tracking-wide">
                Healthcare Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Governance Summary */}
        <div className="relative z-10 p-8 lg:p-12 max-w-xl">
          <h1
            className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug mb-3"
            style={{ textWrap: 'balance' }}
          >
            ระบบสารสนเทศบริหารจัดการกำลังคนทางการแพทย์ระดับจังหวัด
          </h1>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed mb-8">
            เชื่อมต่อข้อมูลบุคลากร ตารางเวรปฏิบัติงาน และกรอบอัตรากำลังโรงพยาบาลเครือข่ายจังหวัดปัตตานีอย่างปลอดภัยผ่านการยืนยันตัวตนด้วยบัญชี Gmail
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/15 pt-6">
            <div>
              <p className="font-display text-sm font-semibold text-white mb-1">
                Google OAuth 2.0
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                ยืนยันตัวตนด้วยบัญชี Gmail โดยไม่ต้องจำรหัสผ่านใหม่
              </p>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-white mb-1">
                Session Audit
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                บันทึกประวัติการเข้าสู่ระบบและอุปกรณ์ที่ใช้งานแบบเรียลไทม์
              </p>
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-white mb-1">
                Role Governance
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                จำกัดสิทธิ์เข้าถึงข้อมูลส่วนบุคคลตามบัญชีเจ้าหน้าที่ที่ได้รับอนุญาต
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Gmail Authentication Surface */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-[440px]">
          <div className="bg-white border border-[#E2E8F0] rounded p-8 sm:p-10">
            <div className="mb-8">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0D7A68] mb-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>ระบบยืนยันตัวตนเจ้าหน้าที่ · Gmail Authentication</span>
              </div>
              <h2
                className="font-display text-2xl font-bold text-[#0D1C2E] tracking-tight mb-2"
                style={{ textWrap: 'balance' }}
              >
                เข้าสู่ระบบด้วยบัญชี Gmail
              </h2>
              <p className="text-sm text-[#3E4946] leading-relaxed">
                กรุณาลงชื่อเข้าใช้ด้วยบัญชี Gmail หรือ Google Workspace ของท่าน เพื่อเข้าถึงแดชบอร์ดและฐานข้อมูลบุคลากร P-MEDIS
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mb-6 bg-[#FEF2F2] border border-[#FECACA] rounded p-3.5 flex items-start gap-2.5 text-[#991B1B]"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold mb-0.5">ไม่สามารถเข้าสู่ระบบได้</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => void onLogin()}
              disabled={isLoggingIn}
              className="gsi-material-button w-full"
              aria-label="Sign in with Google Gmail"
            >
              <div className="gsi-material-button-content-wrapper">
                {isLoggingIn ? (
                  <span
                    className="w-5 h-5 border-2 border-[#0D7A68] border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <div className="gsi-material-button-icon" aria-hidden="true">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="block w-full h-full"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                )}
                <span>
                  {isLoggingIn
                    ? 'กำลังเชื่อมต่อบัญชี Gmail...'
                    : 'ดำเนินการต่อด้วยบัญชี Gmail (Sign in with Google)'}
                </span>
              </div>
            </button>

            <div className="mt-8 pt-6 border-t border-[#E2E8F0] space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-[#475569]">
                <MailCheck className="w-4 h-4 text-[#0D7A68] shrink-0 mt-0.5" />
                <span>
                  รองรับเฉพาะบัญชี Gmail ที่ผ่านการยืนยันอีเมลแล้ว (`email_verified`) และสามารถเลือกสลับบัญชี Google ได้ทุกครั้งที่เข้าสู่ระบบ
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#475569]">
                <Lock className="w-4 h-4 text-[#0D7A68] shrink-0 mt-0.5" />
                <span>
                  ข้อมูลโปรไฟล์และบันทึกการเข้าสู่ระบบจะถูกจัดเก็บแยกเฉพาะเจ้าของบัญชีตามมาตรฐานความปลอดภัย
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#475569]">
                <CheckCircle2 className="w-4 h-4 text-[#0D7A68] shrink-0 mt-0.5" />
                <span>
                  เมื่อกดเข้าสู่ระบบ หน้าต่างเลือกบัญชี Google จะปรากฏขึ้นให้ท่านอนุญาตการเข้าใช้งาน
                </span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[#64748B]">
            P-MEDIS Healthcare Intelligence · สำนักงานสาธารณสุขจังหวัดปัตตานี
          </p>
        </div>
      </main>
    </div>
  );
};
