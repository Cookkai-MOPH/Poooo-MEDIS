export type UserRole = 'officer' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  position: string;
  department: string;
  facility: string;
  role: UserRole;
  lastLoginAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type SessionStatus = 'active' | 'signed_out';

export interface LoginSession {
  id: string;
  userId: string;
  email: string;
  provider: 'google.com';
  deviceLabel: string;
  status: SessionStatus;
  loginAt: Date | null;
  createdAt: Date | null;
}

export type DutyStatus = 'active_duty' | 'study_leave' | 'resigned';
export type J18Status = 'match' | 'mismatch' | 'other';

export interface WorkforceRecord {
  id: string;
  ownerId: string;
  rowNo: number;
  licenseNo: string;
  fullName: string;
  hospital: string;
  district: string;
  positionTitle: string;
  rankLevel: string;
  doctorType: string;
  dutyStatus: DutyStatus;
  j18Status: J18Status;
  j18Hospital: string;
  specialty: string;
  studySponsor: string;
  studyPeriod: string;
  note: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type WorkforceInput = Omit<
  WorkforceRecord,
  'id' | 'ownerId' | 'createdAt' | 'updatedAt'
>;

export type NavSection = 'workforce' | 'gmail-account' | 'profile-settings';

export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export const FIELD_LIMITS = {
  displayName: { min: 1, max: 120 },
  position: { min: 0, max: 100 },
  department: { min: 0, max: 120 },
  facility: { min: 0, max: 120 },
  licenseNo: { min: 1, max: 32 },
  fullName: { min: 2, max: 120 },
  hospital: { min: 2, max: 120 },
  district: { min: 2, max: 80 },
  positionTitle: { min: 0, max: 80 },
  rankLevel: { min: 0, max: 60 },
  doctorType: { min: 0, max: 100 },
  j18Hospital: { min: 0, max: 120 },
  specialty: { min: 0, max: 200 },
  studySponsor: { min: 0, max: 120 },
  studyPeriod: { min: 0, max: 120 },
  note: { min: 0, max: 240 },
} as const;

// 11 โรงพยาบาลชุมชน/รพร. ภายใต้สังกัด สสจ.ปัตตานี (ไม่รวม รพท.ปัตตานี)
export const SSJ_PATTANI_HOSPITALS = [
  'รพช.แม่ลาน',
  'รพช.หนองจิก',
  'รพช.ปะนาเระ',
  'รพช.กะพ้อ',
  'รพช.มายอ',
  'รพร.สายบุรี',
  'รพช.ยะหริ่ง',
  'รพช.ยะรัง',
  'รพช.ไม้แก่น',
  'รพช.ทุ่งยางแดง',
  'รพช.โคกโพธิ์',
] as const;

export const PATTANI_FACILITIES = [
  'สำนักงานสาธารณสุขจังหวัดปัตตานี',
  ...SSJ_PATTANI_HOSPITALS,
] as const;

export const PATTANI_DISTRICTS = [
  'แม่ลาน',
  'หนองจิก',
  'ปะนาเระ',
  'กะพ้อ',
  'มายอ',
  'สายบุรี',
  'ยะหริ่ง',
  'ยะรัง',
  'ไม้แก่น',
  'ทุ่งยางแดง',
  'โคกโพธิ์',
] as const;
