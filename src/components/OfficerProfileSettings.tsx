import React, { useEffect, useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import {
  FIELD_LIMITS,
  PATTANI_FACILITIES,
  type UserProfile,
} from '../types';

interface OfficerProfileSettingsProps {
  profile: UserProfile | null;
  onSaveProfile: (
    updates: Pick<UserProfile, 'displayName' | 'position' | 'department' | 'facility'>
  ) => Promise<void>;
}

export const OfficerProfileSettings: React.FC<OfficerProfileSettingsProps> = ({
  profile,
  onSaveProfile,
}) => {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [position, setPosition] = useState(profile?.position || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [facility, setFacility] = useState(
    profile?.facility || PATTANI_FACILITIES[0]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setPosition(profile.position);
      setDepartment(profile.department);
      setFacility(profile.facility);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedNotice(false);

    if (displayName.trim().length < FIELD_LIMITS.displayName.min) {
      setErrorMsg('กรุณากรอกชื่อ-นามสกุลผู้ใช้งาน');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveProfile({
        displayName,
        position,
        department,
        facility,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3500);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลหน่วยงานได้'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl bg-white border border-[#E2E8F0] rounded">
      <div className="px-6 py-5 border-b border-[#E2E8F0]">
        <h2 className="font-display text-lg font-semibold text-[#0D1C2E]">
          ข้อมูลเจ้าหน้าที่และหน่วยงานต้นสังกัด
        </h2>
        <p className="text-sm text-[#475569] mt-1">
          ปรับปรุงข้อมูลตำแหน่งและโรงพยาบาลสังกัดที่เชื่อมโยงกับบัญชี Gmail ({profile?.email})
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-5">
        {errorMsg && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-xs text-[#991B1B]">
            {errorMsg}
          </div>
        )}

        {savedNotice && (
          <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded flex items-center gap-2 text-xs font-medium text-[#065F46]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            บันทึกข้อมูลโปรไฟล์และหน่วยงานเรียบร้อยแล้ว
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#3E4946] mb-1.5">
            บัญชี Gmail ที่ผูกกับระบบ (ไม่สามารถแก้ไข)
          </label>
          <input
            type="email"
            disabled
            value={profile?.email || ''}
            className="w-full h-[38px] px-3 text-sm font-mono bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] rounded cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3E4946] mb-1.5">
            ชื่อที่แสดงในระบบ (Display Name)
          </label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.displayName.max}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full h-[38px] px-3 text-sm bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68] focus:ring-2 focus:ring-[#0D7A68]/20"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#3E4946] mb-1.5">
              ตำแหน่ง
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.position.max}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="นักวิชาการสาธารณสุขปฏิบัติการ"
              className="w-full h-[38px] px-3 text-sm bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68] focus:ring-2 focus:ring-[#0D7A68]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3E4946] mb-1.5">
              กลุ่มงาน / ฝ่าย
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.department.max}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="กลุ่มงานพัฒนาทรัพยากรบุคคล"
              className="w-full h-[38px] px-3 text-sm bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68] focus:ring-2 focus:ring-[#0D7A68]/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3E4946] mb-1.5">
            หน่วยงาน / โรงพยาบาลสังกัด
          </label>
          <select
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            className="w-full h-[38px] px-3 text-sm bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68] focus:ring-2 focus:ring-[#0D7A68]/20"
          >
            {PATTANI_FACILITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-4 border-t border-[#E2E8F0] flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#0D7A68] rounded hover:bg-[#075E54] transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>
      </form>
    </div>
  );
};
