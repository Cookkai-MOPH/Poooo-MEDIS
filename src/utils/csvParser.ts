import type { DutyStatus, J18Status, WorkforceInput } from '../types';

export function cleanThaiText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    // Normalize duplicated Thai vowels/tone marks from spreadsheet exports
    .replace(/([ุูึีิั่้๊๋์])\1+/g, '$1')
    .trim();
}

export function extractDistrictFromHospital(hospital: string): string {
  const cleaned = cleanThaiText(hospital)
    .replace(/^รพช\./, '')
    .replace(/^รพร\./, '')
    .replace(/^โรงพยาบาล/, '')
    .trim();
  return cleaned || 'ปัตตานี';
}

export function isExcludedCentralHospital(hospitalName: string): boolean {
  const h = cleanThaiText(hospitalName);
  return (
    h === 'โรงพยาบาลปัตตานี' ||
    h === 'รพท.ปัตตานี' ||
    h === 'รพ.ปัตตานี'
  );
}

/**
 * RFC-4180 compliant multi-line CSV parser
 */
export function parseCsvMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  const text = csvText.replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

export function parseSsjWorkforceCsv(csvText: string): {
  records: WorkforceInput[];
  excludedCount: number;
} {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    return { records: [], excludedCount: 0 };
  }

  const headers = matrix[0].map((h) => cleanThaiText(h));
  const findCol = (keywords: string[], fallbackIndex: number): number => {
    const idx = headers.findIndex((h) =>
      keywords.some((kw) => h.includes(kw))
    );
    return idx >= 0 ? idx : fallbackIndex;
  };

  const colNo = findCol(['ที่'], 0);
  const colHospital = findCol(['หน่วยงานที่ปฏิบัติงานจริง'], 1);
  const colName = findCol(['ชื่อ - สกุล', 'ชื่อ-สกุล', 'ชื่อ'], 2);
  const colPosNo = findCol(['เลขที่ ตำแหน่ง', 'เลขที่ตำแหน่ง'], 3);
  const colPosTitle = findCol(['ตำแหน่ง'], 4);
  const colLevel = findCol(['ระดับ'], 5);
  const colDocType = findCol(['ประเภทของแพทย์'], 7);
  const colDutyStatus = findCol(['สถานะ การปฏิบัติราชการ', 'สถานะการปฏิบัติราชการ'], 8);
  const colJ18Status = findCol(['สถานะ จ.18', 'สถานะ จ18'], 9);
  const colJ18Hospital = headers.findIndex((h) => h === 'จ.18') >= 0
    ? headers.findIndex((h) => h === 'จ.18')
    : 10;
  const colCert = findCol(['วุฒิบัตร'], 11);
  const colStudyField = findCol(['สาขาที่ลาศึกษา'], 12);
  const colSponsor = findCol(['หน่วยงานเจ้าของทุน'], 13);
  const colStudyStart = findCol(['วันที่ลาศึกษา (พ.ศ.)'], 14);
  const colStudyEnd = findCol(['วันที่จบจากลาศึกษา (พ.ศ.)'], 15);
  const colNote = findCol(['หมายเหตุ'], 18);
  const colReturn = findCol(['รายงานตัวกลับ'], 19);
  const colResigned = findCol(['ลาออกจากราชการ'], 23);

  const records: WorkforceInput[] = [];
  let excludedCount = 0;

  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || r.every((cell) => !cell || !cell.trim())) continue;

    const hospital = cleanThaiText(r[colHospital] || '');
    const fullName = cleanThaiText(r[colName] || '');
    if (!hospital || !fullName) continue;

    if (isExcludedCentralHospital(hospital)) {
      excludedCount++;
      continue;
    }

    const rowNoParsed = parseInt(cleanThaiText(r[colNo] || ''), 10);
    const rowNo = Number.isFinite(rowNoParsed) && rowNoParsed >= 0 ? rowNoParsed : i;
    const licenseNo = cleanThaiText(r[colPosNo] || '') || `PTN-${i}`;
    const positionTitle = cleanThaiText(r[colPosTitle] || '');
    const rankLevel = cleanThaiText(r[colLevel] || '');
    const doctorType = cleanThaiText(r[colDocType] || '') || 'ไม่ระบุ';
    const rawDuty = cleanThaiText(r[colDutyStatus] || '');
    const rawResigned = cleanThaiText(r[colResigned] || '');

    let dutyStatus: DutyStatus = 'active_duty';
    if (rawResigned || rawDuty.includes('ลาออก')) {
      dutyStatus = 'resigned';
    } else if (rawDuty.includes('ลาศึกษา')) {
      dutyStatus = 'study_leave';
    }

    const rawJ18 = cleanThaiText(r[colJ18Status] || '');
    let j18Status: J18Status = 'other';
    if (rawJ18.includes('ไม่ตรง')) {
      j18Status = 'mismatch';
    } else if (rawJ18.includes('ตรง')) {
      j18Status = 'match';
    }

    const j18Hospital = cleanThaiText(r[colJ18Hospital] || '');
    const cert = cleanThaiText(r[colCert] || '');
    const studyField = cleanThaiText(r[colStudyField] || '');
    const specialty = studyField || cert || '-';

    const studySponsor = cleanThaiText(r[colSponsor] || '');
    const startThai = cleanThaiText(r[colStudyStart] || '');
    const endThai = cleanThaiText(r[colStudyEnd] || '');
    const studyPeriod =
      startThai && endThai
        ? `${startThai} – ${endThai}`
        : startThai || endThai || '';

    const noteParts = [
      cleanThaiText(r[colNote] || ''),
      cleanThaiText(r[colReturn] || '') ? `รายงานตัวกลับ: ${cleanThaiText(r[colReturn] || '')}` : '',
      rawResigned ? `ลาออก: ${rawResigned}` : '',
    ].filter(Boolean);

    records.push({
      rowNo,
      licenseNo: licenseNo.slice(0, 32),
      fullName: fullName.slice(0, 120),
      hospital: hospital.slice(0, 120),
      district: extractDistrictFromHospital(hospital).slice(0, 80),
      positionTitle: positionTitle.slice(0, 80),
      rankLevel: rankLevel.slice(0, 60),
      doctorType: doctorType.slice(0, 100),
      dutyStatus,
      j18Status,
      j18Hospital: j18Hospital.slice(0, 120),
      specialty: specialty.slice(0, 200),
      studySponsor: studySponsor.slice(0, 120),
      studyPeriod: studyPeriod.slice(0, 120),
      note: noteParts.join(' · ').slice(0, 240),
    });
  }

  return { records, excludedCount };
}

export function convertGoogleSheetUrlToCsv(inputUrl: string): string | null {
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;

  if (trimmed.includes('output=csv') || trimmed.includes('format=csv')) {
    return trimmed;
  }

  const match = trimmed.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;

  const spreadsheetId = match[1];
  const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
  const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParam}`;
}
