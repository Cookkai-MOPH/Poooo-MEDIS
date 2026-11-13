import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Edit3,
  FileSpreadsheet,
  GraduationCap,
  Link2,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import {
  FIELD_LIMITS,
  SSJ_PATTANI_HOSPITALS,
  type DutyStatus,
  type J18Status,
  type WorkforceInput,
  type WorkforceRecord,
} from '../types';
import {
  convertGoogleSheetUrlToCsv,
  extractDistrictFromHospital,
  parseSsjWorkforceCsv,
} from '../utils/csvParser';

interface WorkforceDashboardProps {
  records: WorkforceRecord[];
  isLoading: boolean;
  onCreateRecord: (input: WorkforceInput) => Promise<void>;
  onUpdateRecord: (id: string, input: WorkforceInput) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onLoadSsjDataset: (replaceExisting: boolean) => Promise<number>;
  onImportRecords: (items: WorkforceInput[], replaceExisting: boolean) => Promise<number>;
}

const DUTY_META: Record<
  DutyStatus,
  { label: string; classes: string; icon: React.ReactNode }
> = {
  active_duty: {
    label: 'ดำรงตำแหน่ง',
    classes: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
    icon: <UserCheck className="w-3.5 h-3.5 shrink-0" />,
  },
  study_leave: {
    label: 'ลาศึกษา',
    classes: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
    icon: <GraduationCap className="w-3.5 h-3.5 shrink-0" />,
  },
  resigned: {
    label: 'ลาออก',
    classes: 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]',
    icon: <UserX className="w-3.5 h-3.5 shrink-0" />,
  },
};

const EMPTY_FORM: WorkforceInput = {
  rowNo: 1,
  licenseNo: '',
  fullName: '',
  hospital: SSJ_PATTANI_HOSPITALS[0],
  district: 'แม่ลาน',
  positionTitle: 'นายแพทย์',
  rankLevel: 'ชำนาญการ',
  doctorType: 'CPRID',
  dutyStatus: 'active_duty',
  j18Status: 'match',
  j18Hospital: SSJ_PATTANI_HOSPITALS[0],
  specialty: '',
  studySponsor: '',
  studyPeriod: '',
  note: '',
};

export const WorkforceDashboard: React.FC<WorkforceDashboardProps> = ({
  records,
  isLoading,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord,
  onLoadSsjDataset,
  onImportRecords,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active_duty' | 'study_leave' | 'mismatch'
  >('all');

  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WorkforceRecord | null>(null);
  const [formState, setFormState] = useState<WorkforceInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<WorkforceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import from CSV / Google Sheets Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'url' | 'file'>('url');
  const [sheetUrl, setSheetUrl] = useState('');
  const [replaceOnImport, setReplaceOnImport] = useState(true);
  const [parsedPreview, setParsedPreview] = useState<{
    records: WorkforceInput[];
    excludedCount: number;
    sourceLabel: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const metrics = useMemo(() => {
    const total = records.length;
    const activeDuty = records.filter((r) => r.dutyStatus === 'active_duty').length;
    const studyLeave = records.filter((r) => r.dutyStatus === 'study_leave').length;
    const j18Mismatch = records.filter((r) => r.j18Status === 'mismatch').length;
    return { total, activeDuty, studyLeave, j18Mismatch };
  }, [records]);

  const hospitalSummary = useMemo(() => {
    const counts = new Map<string, { total: number; active: number; study: number }>();
    for (const h of SSJ_PATTANI_HOSPITALS) {
      counts.set(h, { total: 0, active: 0, study: 0 });
    }
    for (const rec of records) {
      const curr = counts.get(rec.hospital) || { total: 0, active: 0, study: 0 };
      curr.total++;
      if (rec.dutyStatus === 'active_duty') curr.active++;
      if (rec.dutyStatus === 'study_leave') curr.study++;
      counts.set(rec.hospital, curr);
    }
    return Array.from(counts.entries()).map(([hospital, stat]) => ({
      hospital,
      ...stat,
    }));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((rec) => {
      if (hospitalFilter !== 'all' && rec.hospital !== hospitalFilter) return false;
      if (statusFilter === 'active_duty' && rec.dutyStatus !== 'active_duty') return false;
      if (statusFilter === 'study_leave' && rec.dutyStatus !== 'study_leave') return false;
      if (statusFilter === 'mismatch' && rec.j18Status !== 'mismatch') return false;
      if (!q) return true;
      return (
        rec.fullName.toLowerCase().includes(q) ||
        rec.licenseNo.toLowerCase().includes(q) ||
        rec.hospital.toLowerCase().includes(q) ||
        rec.specialty.toLowerCase().includes(q) ||
        rec.doctorType.toLowerCase().includes(q) ||
        rec.j18Hospital.toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery, hospitalFilter, statusFilter]);

  const handleLoadSsjClick = async () => {
    setIsLoadingDataset(true);
    setBannerMessage(null);
    try {
      const count = await onLoadSsjDataset(true);
      setBannerMessage(
        `นำเข้าข้อมูลแพทย์สังกัด สสจ.ปัตตานี สำเร็จ ${count} รายการ (11 โรงพยาบาล · ไม่รวม รพท.ปัตตานี)`
      );
    } catch (err) {
      setBannerMessage(
        err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูล สสจ.ปัตตานีได้'
      );
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    setFormState({ ...EMPTY_FORM, rowNo: records.length + 1 });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (record: WorkforceRecord) => {
    setEditingRecord(record);
    setFormState({
      rowNo: record.rowNo,
      licenseNo: record.licenseNo,
      fullName: record.fullName,
      hospital: record.hospital,
      district: record.district,
      positionTitle: record.positionTitle,
      rankLevel: record.rankLevel,
      doctorType: record.doctorType,
      dutyStatus: record.dutyStatus,
      j18Status: record.j18Status,
      j18Hospital: record.j18Hospital,
      specialty: record.specialty,
      studySponsor: record.studySponsor,
      studyPeriod: record.studyPeriod,
      note: record.note,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formState.licenseNo.trim().length < FIELD_LIMITS.licenseNo.min) {
      setFormError('กรุณากรอกเลขที่ตำแหน่ง');
      return;
    }
    if (formState.fullName.trim().length < FIELD_LIMITS.fullName.min) {
      setFormError('กรุณากรอกชื่อ - สกุลอย่างน้อย 2 ตัวอักษร');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: WorkforceInput = {
        ...formState,
        district: extractDistrictFromHospital(formState.hospital),
      };
      if (editingRecord) {
        await onUpdateRecord(editingRecord.id, payload);
      } else {
        await onCreateRecord(payload);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDeleteRecord(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFetchGoogleSheetUrl = async () => {
    setImportError(null);
    setParsedPreview(null);
    const csvUrl = convertGoogleSheetUrlToCsv(sheetUrl);
    if (!csvUrl) {
      setImportError(
        'รูปแบบลิงก์ไม่ถูกต้อง กรุณาวางลิงก์ Google Sheets เช่น https://docs.google.com/spreadsheets/d/...'
      );
      return;
    }

    setIsFetchingSheet(true);
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) {
        throw new Error('HTTP_ERROR');
      }
      const text = await res.text();
      if (text.trim().startsWith('<!DOCTYPE html') || text.includes('<html')) {
        throw new Error('PRIVATE_SHEET');
      }
      const { records: parsed, excludedCount } = parseSsjWorkforceCsv(text);
      if (parsed.length === 0) {
        setImportError('ไม่พบแถวข้อมูลบุคลากรในสเปรดชีตนี้ กรุณาตรวจสอบหัวตาราง');
        return;
      }
      setParsedPreview({
        records: parsed,
        excludedCount,
        sourceLabel: 'Google Sheets URL',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'PRIVATE_SHEET') {
        setImportError(
          'Google Sheet นี้ถูกตั้งค่าเป็นส่วนตัว กรุณาตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์อ่านได้ (Viewer)" หรือดาวน์โหลดเป็นไฟล์ .CSV เพื่อนำเข้า'
        );
      } else {
        setImportError(
          'ไม่สามารถดึงข้อมูลจากลิงก์ Google Sheets นี้ได้โดยตรง (อาจติดสิทธิ์การเข้าถึงหรือ CORS) แนะนำให้ดาวน์โหลดไฟล์เป็น .CSV จาก Google Sheets แล้วอัปโหลดผ่านแท็บ "อัปโหลดไฟล์ .CSV"'
        );
      }
    } finally {
      setIsFetchingSheet(false);
    }
  };

  const handleCsvFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setParsedPreview(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const { records: parsed, excludedCount } = parseSsjWorkforceCsv(text);
      if (parsed.length === 0) {
        setImportError('ไม่พบข้อมูลบุคลากรที่รองรับในไฟล์ CSV นี้');
        return;
      }
      setParsedPreview({
        records: parsed,
        excludedCount,
        sourceLabel: file.name,
      });
    } catch {
      setImportError('ไม่สามารถอ่านไฟล์ CSV ได้');
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedPreview) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const count = await onImportRecords(parsedPreview.records, replaceOnImport);
      setImportModalOpen(false);
      setParsedPreview(null);
      setSheetUrl('');
      setBannerMessage(
        `นำเข้าข้อมูลจาก ${parsedPreview.sourceLabel} สำเร็จ ${count} รายการ` +
          (parsedPreview.excludedCount > 0
            ? ` (ตัดข้อมูล รพท.ปัตตานี ออก ${parsedPreview.excludedCount} รายการ)`
            : '')
      );
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล'
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {bannerMessage && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded px-4 py-3 flex items-center justify-between gap-3 text-xs font-medium text-[#065F46]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            aria-label="ปิดการแจ้งเตือน"
            className="text-[#065F46] hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Metric Strip */}
      <section
        aria-label="ตัวชี้วัดข้อมูลแพทย์ สสจ.ปัตตานี"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-[#E2E8F0] rounded p-5">
          <p className="text-xs font-semibold text-[#475569] mb-2">
            แพทย์ในสังกัด สสจ.ปัตตานี (คน)
          </p>
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-3xl font-bold text-[#0D1C2E] tabular-nums">
              {metrics.total}
            </p>
            <span className="text-xs font-medium text-[#065F46]">
              11 รพช. / รพร. (ไม่รวม รพท.)
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded p-5">
          <p className="text-xs font-semibold text-[#475569] mb-2">
            ดำรงตำแหน่ง (ปฏิบัติราชการจริง)
          </p>
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-3xl font-bold text-[#0D7A68] tabular-nums">
              {metrics.activeDuty}
            </p>
            <span className="text-xs font-medium text-[#3E4946] tabular-nums">
              {metrics.total > 0
                ? `${Math.round((metrics.activeDuty / metrics.total) * 100)}% ของทั้งหมด`
                : '0%'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded p-5">
          <p className="text-xs font-semibold text-[#475569] mb-2">
            อยู่ระหว่างลาศึกษาต่อ (คน)
          </p>
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-3xl font-bold text-[#D97706] tabular-nums">
              {metrics.studyLeave}
            </p>
            <span className="text-xs font-medium text-[#92400E]">
              แพทย์ประจำบ้าน / เฉพาะทาง
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded p-5">
          <p className="text-xs font-semibold text-[#475569] mb-2">
            ปฏิบัติงานไม่ตรง จ.18 (คน)
          </p>
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-3xl font-bold text-[#DC2626] tabular-nums">
              {metrics.j18Mismatch}
            </p>
            <span className="text-xs font-medium text-[#991B1B]">
              ช่วยราชการ / ถือ จ.18 ต่าง รพ.
            </span>
          </div>
        </div>
      </section>

      {/* 11 Community Hospitals Summary Strip */}
      {records.length > 0 && (
        <section
          aria-label="สรุปรายโรงพยาบาลสังกัด สสจ.ปัตตานี"
          className="bg-white border border-[#E2E8F0] rounded p-4"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display text-xs font-semibold text-[#475569]">
              จำนวนแพทย์แยกตามหน่วยงานที่ปฏิบัติงานจริง (คลิกเพื่อกรอง)
            </h2>
            {hospitalFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setHospitalFilter('all')}
                className="text-xs font-medium text-[#0D7A68] hover:underline"
              >
                แสดงทั้งหมด 11 แห่ง
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {hospitalSummary.map((item) => {
              const selected = hospitalFilter === item.hospital;
              return (
                <button
                  key={item.hospital}
                  type="button"
                  onClick={() =>
                    setHospitalFilter(selected ? 'all' : item.hospital)
                  }
                  className={`p-2.5 rounded border text-left transition-colors ${
                    selected
                      ? 'bg-[#F0FDFA] border-[#0D7A68] text-[#005F50]'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1] text-[#0D1C2E]'
                  }`}
                >
                  <p className="text-xs font-semibold truncate">{item.hospital}</p>
                  <p className="font-mono text-xs tabular-nums text-[#475569] mt-0.5">
                    {item.total} คน{' '}
                    <span className="text-[11px] text-[#64748B]">
                      (ลา {item.study})
                    </span>
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter & Action Toolbar */}
      <section className="bg-white border border-[#E2E8F0] rounded">
        <div className="p-4 border-b border-[#E2E8F0] flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อแพทย์, เลขที่ตำแหน่ง, สาขา, ประเภท..."
                className="w-full h-[38px] pl-9 pr-3 text-sm bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68] focus:ring-2 focus:ring-[#0D7A68]/20"
              />
            </div>

            <select
              aria-label="กรองตามโรงพยาบาลสังกัด สสจ.ปัตตานี"
              value={hospitalFilter}
              onChange={(e) => setHospitalFilter(e.target.value)}
              className="h-[38px] px-3 text-sm bg-white border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68] focus:ring-2 focus:ring-[#0D7A68]/20"
            >
              <option value="all">ทุกโรงพยาบาลสังกัด สสจ.ปัตตานี (11 แห่ง)</option>
              {SSJ_PATTANI_HOSPITALS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleLoadSsjClick()}
              disabled={isLoadingDataset}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#1E293B] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Database className="w-3.5 h-3.5 text-[#0D7A68]" />
              {isLoadingDataset
                ? 'กำลังนำเข้า 166 รายการ...'
                : 'ซิงค์ข้อมูล สสจ.ปัตตานี (166 คน)'}
            </button>

            <button
              type="button"
              onClick={() => {
                setImportError(null);
                setParsedPreview(null);
                setImportModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#1E293B] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#0D7A68]" />
              นำเข้า Google Sheet / CSV
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0D7A68] rounded hover:bg-[#075E54] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              เพิ่มรายชื่อแพทย์
            </button>
          </div>
        </div>

        {/* Status Segmented Tabs */}
        <div className="px-4 py-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'all', label: `ทั้งหมด (${records.length})` },
                { id: 'active_duty', label: `ดำรงตำแหน่ง (${metrics.activeDuty})` },
                { id: 'study_leave', label: `ลาศึกษา (${metrics.studyLeave})` },
                { id: 'mismatch', label: `ไม่ตรง จ.18 (${metrics.j18Mismatch})` },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    active
                      ? 'bg-white text-[#0D1C2E] border border-[#CBD5E1]'
                      : 'text-[#475569] hover:text-[#0D1C2E] hover:bg-white/60 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <span className="text-xs font-mono tabular-nums text-[#64748B] whitespace-nowrap">
            แสดง {filteredRecords.length} รายการ
          </span>
        </div>

        {/* High-Density Data Table */}
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="h-12 bg-[#F1F5F9] rounded animate-pulse"
              />
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-display text-base font-semibold text-[#0D1C2E] mb-1">
              {records.length === 0
                ? 'ยังไม่มีรายชื่อแพทย์ในระบบ'
                : 'ไม่พบรายชื่อแพทย์ที่ตรงกับเงื่อนไขการค้นหา'}
            </p>
            <p className="text-sm text-[#475569] mb-5">
              {records.length === 0
                ? 'กดปุ่มด้านล่างเพื่อโหลดฐานข้อมูลแพทย์สังกัด สสจ.ปัตตานี ทั้ง 166 รายการ (ตัด รพท.ปัตตานี ออกแล้ว) หรือนำเข้าจาก Google Sheets / CSV'
                : 'ลองปรับคำค้นหาหรือเลือกดูทั้งหมดใหม่อีกครั้ง'}
            </p>
            {records.length === 0 && (
              <div className="inline-flex flex-wrap justify-center items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleLoadSsjClick()}
                  disabled={isLoadingDataset}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0D7A68] rounded hover:bg-[#075E54] transition-colors whitespace-nowrap"
                >
                  <Database className="w-4 h-4" />
                  {isLoadingDataset
                    ? 'กำลังนำเข้าข้อมูล...'
                    : 'โหลดข้อมูล สสจ.ปัตตานี (166 รายการ)'}
                </button>
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#1E293B] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] transition-colors whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  นำเข้า Google Sheet / CSV
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-display font-semibold text-[#475569] tracking-wide">
                  <th className="py-3 px-4 sticky left-0 bg-[#F8FAFC] z-10 whitespace-nowrap">
                    ชื่อ - สกุล · เลขที่ตำแหน่ง
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">ปฏิบัติงานจริง</th>
                  <th className="py-3 px-4 whitespace-nowrap">ตำแหน่ง / ระดับ</th>
                  <th className="py-3 px-4 whitespace-nowrap">ประเภทแพทย์</th>
                  <th className="py-3 px-4 whitespace-nowrap">สถานะ จ.18 / หน่วย จ.18</th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    วุฒิบัตร / สาขาลาศึกษา
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">สถานะปฏิบัติราชการ</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => {
                  const dutyMeta = DUTY_META[rec.dutyStatus] || DUTY_META.active_duty;
                  return (
                    <tr
                      key={rec.id}
                      className="group h-12 border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F0FDFA] transition-colors text-sm"
                    >
                      <td className="py-2 px-4 sticky left-0 bg-white group-hover:bg-[#F0FDFA] whitespace-nowrap">
                        <div className="font-medium text-[#0D1C2E]">
                          <span className="font-mono text-xs text-[#64748B] tabular-nums mr-1.5">
                            #{rec.rowNo}
                          </span>
                          {rec.fullName}
                        </div>
                        <div className="font-mono text-xs text-[#64748B] tabular-nums">
                          เลขที่ตำแหน่ง {rec.licenseNo}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-[#0D1C2E] font-medium whitespace-nowrap">
                        {rec.hospital}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        <div className="text-[#0D1C2E]">{rec.positionTitle || '-'}</div>
                        <div className="text-xs text-[#64748B]">{rec.rankLevel || '-'}</div>
                      </td>
                      <td className="py-2 px-4 text-xs text-[#3E4946] max-w-[180px] truncate">
                        {rec.doctorType || '-'}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        {rec.j18Status === 'match' ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-lg mr-2">
                            ตรง จ.18
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] rounded-lg mr-2">
                            ไม่ตรง จ.18
                          </span>
                        )}
                        <span className="text-xs text-[#475569]">
                          {rec.j18Hospital || '-'}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-xs text-[#3E4946] max-w-[260px]">
                        <div className="truncate font-medium text-[#0D1C2E]">
                          {rec.specialty || '-'}
                        </div>
                        {(rec.studySponsor || rec.studyPeriod) && (
                          <div className="truncate text-[11px] text-[#64748B]">
                            {[rec.studySponsor && `ทุน ${rec.studySponsor}`, rec.studyPeriod]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-lg ${dutyMeta.classes}`}
                        >
                          {dutyMeta.icon}
                          <span>{dutyMeta.label}</span>
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(rec)}
                            aria-label={`แก้ไข ${rec.fullName}`}
                            className="p-1.5 text-[#475569] hover:text-[#0D7A68] hover:bg-white rounded transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(rec)}
                            aria-label={`ลบ ${rec.fullName}`}
                            className="p-1.5 text-[#475569] hover:text-[#DC2626] hover:bg-white rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Import Google Sheets / CSV Modal */}
      {importModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
          className="fixed inset-0 z-50 bg-[#0D1C2E]/45 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-white border border-[#CBD5E1] rounded shadow-xl">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3
                id="import-modal-title"
                className="font-display text-base font-semibold text-[#0D1C2E]"
              >
                เชื่อมโยง / นำเข้าข้อมูลจาก Google Sheets หรือ CSV
              </h3>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
                className="p-1 text-[#64748B] hover:text-[#0D1C2E]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded">
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('url');
                    setImportError(null);
                  }}
                  className={`flex-1 inline-flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded transition-colors ${
                    importMode === 'url'
                      ? 'bg-white text-[#0D1C2E] shadow-xs'
                      : 'text-[#475569] hover:text-[#0D1C2E]'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  ลิงก์ Google Sheets
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('file');
                    setImportError(null);
                  }}
                  className={`flex-1 inline-flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded transition-colors ${
                    importMode === 'file'
                      ? 'bg-white text-[#0D1C2E] shadow-xs'
                      : 'text-[#475569] hover:text-[#0D1C2E]'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  อัปโหลดไฟล์ .CSV
                </button>
              </div>

              {importMode === 'url' ? (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-[#3E4946]">
                    วางลิงก์ Google Sheets (ต้องเปิดแชร์เป็น &ldquo;ทุกคนที่มีลิงก์ดูได้&rdquo; หรือ Publish as CSV)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="flex-1 h-[38px] px-3 text-sm border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                    />
                    <button
                      type="button"
                      disabled={isFetchingSheet || !sheetUrl.trim()}
                      onClick={() => void handleFetchGoogleSheetUrl()}
                      className="px-4 h-[38px] text-xs font-semibold text-white bg-[#0D7A68] rounded hover:bg-[#075E54] disabled:opacity-60 whitespace-nowrap"
                    >
                      {isFetchingSheet ? 'กำลังดึง...' : 'ดึงข้อมูล'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-[#3E4946]">
                    เลือกไฟล์ .CSV ที่ส่งออกจาก Google Sheets (ไฟล์ → ดาวน์โหลด → .csv)
                  </label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => void handleCsvFileSelect(e)}
                    className="block w-full text-sm text-[#3E4946] file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-[#CBD5E1] file:text-xs file:font-semibold file:bg-[#F8FAFC] file:text-[#0D1C2E] hover:file:bg-[#F1F5F9]"
                  />
                </div>
              )}

              {importError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded flex items-start gap-2 text-xs text-[#991B1B]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {parsedPreview && (
                <div className="p-4 bg-[#F0FDFA] border border-[#A7F3D0] rounded space-y-2 text-xs text-[#065F46]">
                  <p className="font-semibold">
                    ตรวจสอบข้อมูลพร้อมนำเข้า: {parsedPreview.records.length} รายการ
                  </p>
                  {parsedPreview.excludedCount > 0 && (
                    <p>
                      คัดกรองข้อมูล รพท.ปัตตานี ออกอัตโนมัติแล้ว {parsedPreview.excludedCount} รายการ
                    </p>
                  )}
                  <label className="flex items-center gap-2 pt-1 text-[#0D1C2E] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceOnImport}
                      onChange={(e) => setReplaceOnImport(e.target.checked)}
                      className="rounded border-[#CBD5E1] text-[#0D7A68]"
                    />
                    <span>แทนที่ข้อมูลเดิมทั้งหมดในบัญชีนี้ด้วยชุดข้อมูลใหม่</span>
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#1E293B] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9]"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  disabled={!parsedPreview || isImporting}
                  onClick={() => void handleConfirmImport()}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0D7A68] rounded hover:bg-[#075E54] disabled:opacity-50"
                >
                  {isImporting ? 'กำลังนำเข้าข้อมูล...' : 'ยืนยันนำเข้าสู่ระบบ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Physician Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="workforce-modal-title"
          className="fixed inset-0 z-50 bg-[#0D1C2E]/45 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-xl bg-white border border-[#CBD5E1] rounded shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white">
              <h3
                id="workforce-modal-title"
                className="font-display text-base font-semibold text-[#0D1C2E]"
              >
                {editingRecord ? 'แก้ไขข้อมูลบุคลากรแพทย์' : 'เพิ่มข้อมูลแพทย์สังกัด สสจ.ปัตตานี'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
                className="p-1 text-[#64748B] hover:text-[#0D1C2E] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveForm(e)} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded text-xs text-[#991B1B]">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#3E4946] mb-1">
                    เลขที่ตำแหน่ง
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.licenseNo.max}
                    value={formState.licenseNo}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, licenseNo: e.target.value }))
                    }
                    placeholder="138151"
                    className="w-full h-[38px] px-3 text-sm font-mono border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#3E4946] mb-1">
                    ชื่อ - นามสกุล
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.fullName.max}
                    value={formState.fullName}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, fullName: e.target.value }))
                    }
                    className="w-full h-[38px] px-3 text-sm border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#3E4946] mb-1">
                    หน่วยงานที่ปฏิบัติงานจริง
                  </label>
                  <select
                    value={formState.hospital}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, hospital: e.target.value }))
                    }
                    className="w-full h-[38px] px-3 text-sm border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                  >
                    {SSJ_PATTANI_HOSPITALS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3E4946] mb-1">
                    ตำแหน่ง
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.positionTitle.max}
                    value={formState.positionTitle}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, positionTitle: e.target.value }))
                    }
                    className="w-full h-[38px] px-3 text-sm border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#3E4946] mb-1">
                    ระดับ
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.rankLevel.max}
                    value={formState.rankLevel}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, rankLevel: e.target.value }))
                    }
                    className="w-full h-[38px] px-3 text-sm border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3E4946] mb-1">
                    ประเภทของแพทย์
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.doctorType.max}
                    value={formState.doctorType}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, doctorType: e.target.value }))
                    }
                    className="w-full h-[38px] px-3 text-sm border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#3E4946] mb-1">
                    สถานะการปฏิบัติราชการ
                  </label>
                  <select
                    value={formState.dutyStatus}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        dutyStatus: e.target.value as DutyStatus,
                      }))
                    }
                    className="w-full h-[38px] px-3 text-sm border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                  >
                    <option value="active_duty">ดำรงตำแหน่ง</option>
                    <option value="study_leave">ลาศึกษา</option>
                    <option value="resigned">ลาออก</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3E4946] mb-1">
                    สถานะ จ.18
                  </label>
                  <select
                    value={formState.j18Status}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        j18Status: e.target.value as J18Status,
                      }))
                    }
                    className="w-full h-[38px] px-3 text-sm border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                  >
                    <option value="match">ตรง จ</option>
                    <option value="mismatch">ไม่ตรง จ</option>
                    <option value="other">อื่นๆ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3E4946] mb-1">
                    หน่วยงาน จ.18
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.j18Hospital.max}
                    value={formState.j18Hospital}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, j18Hospital: e.target.value }))
                    }
                    className="w-full h-[38px] px-3 text-sm border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3E4946] mb-1">
                  วุฒิบัตรเฉพาะทาง / สาขาที่ลาศึกษา
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.specialty.max}
                  value={formState.specialty}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, specialty: e.target.value }))
                  }
                  className="w-full h-[38px] px-3 text-sm border border-[#CBD5E1] rounded focus:outline-none focus:border-[#0D7A68]"
                />
              </div>

              <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-[#1E293B] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0D7A68] rounded hover:bg-[#075E54] transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 bg-[#0D1C2E]/45 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md bg-white border border-[#CBD5E1] rounded shadow-xl p-6">
            <h3
              id="delete-modal-title"
              className="font-display text-base font-semibold text-[#0D1C2E] mb-2"
            >
              ยืนยันการลบข้อมูลแพทย์
            </h3>
            <p className="text-sm text-[#3E4946] mb-6 leading-relaxed">
              คุณต้องการลบข้อมูลของ <strong>{deleteTarget.fullName}</strong> (เลขที่ตำแหน่ง {deleteTarget.licenseNo}) ออกจากฐานข้อมูลใช่หรือไม่
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[#1E293B] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#DC2626] rounded hover:bg-[#B91C1C] transition-colors disabled:opacity-60"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
