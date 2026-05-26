import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { addDays, format, parse } from 'date-fns';

pdfjs.GlobalWorkerOptions.workerSrc = '';

const dayHeaderPattern    = /^(\d{1,2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/;
const timePattern         = /^(\d{1,2}:\d{2})(AM|PM)$/i;
const footerPattern       = /^https?:|^Page\s+\d+\s+of\s+\d+$/i;
const headerMetaPattern   = /^(Netchex Scheduler|\d{1,2}\/\d{1,2}\/\d{2},?\s*\d{0,2}|:|\\d{2}|AM|PM)$/i;

const MONTH_NUMS = {
  jan:'01',january:'01',feb:'02',february:'02',mar:'03',march:'03',
  apr:'04',april:'04',may:'05',jun:'06',june:'06',jul:'07',july:'07',
  aug:'08',august:'08',sep:'09',sept:'09',september:'09',
  oct:'10',october:'10',nov:'11',november:'11',dec:'12',december:'12',
};

function normalizeLabel(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function toTime24(value, meridiem) {
  const parsed = parse(`${value}${meridiem.toUpperCase()}`, 'h:mma', new Date());
  return format(parsed, 'HH:mm');
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function sortTextItems(items) {
  return [...items].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    const dy = b.y - a.y;
    if (Math.abs(dy) > 4) return dy;
    return a.x - b.x;
  });
}

function deriveDateRange(items) {
  const text = items.map(i => i.str).join(' ');

  const numMatch = text.match(/(\d{2})\/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})/);
  if (numMatch) {
    const [, sm, sd, sy, em, ed, ey] = numMatch;
    return { start: isoDate(`20${sy}`, sm, sd), end: isoDate(`20${ey}`, em, ed) };
  }

  const MON = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const namedRe = new RegExp(`\\b${MON}\\s+(\\d{1,2})\\s*-\\s*(?:${MON}\\s+)?(\\d{1,2}),?\\s*(20\\d{2})\\b`, 'i');
  const namedMatch = text.match(namedRe);
  if (!namedMatch) return undefined;

  const [, startMonthName, startDay, endMonthName, endDay, year] = namedMatch;
  const startMonth = MONTH_NUMS[startMonthName.toLowerCase()];
  const endMonth   = MONTH_NUMS[(endMonthName ?? startMonthName).toLowerCase()];
  if (!startMonth || !endMonth) return undefined;

  return { start: isoDate(year, startMonth, startDay), end: isoDate(year, endMonth, endDay) };
}

function buildDayColumns(items, rangeStart) {
  const startDate = new Date(`${rangeStart}T00:00:00`);
  const columns = [];

  for (const item of items) {
    const m = item.str.match(dayHeaderPattern);
    if (!m) continue;
    const dayNumber = Number(m[1]);
    for (let offset = 0; offset < 7; offset++) {
      const candidate = addDays(startDate, offset);
      if (candidate.getUTCDate() === dayNumber) {
        columns.push({ shortDay: m[2], date: format(candidate, 'yyyy-MM-dd'), x: item.x });
      }
    }
  }
  return columns.sort((a, b) => a.x - b.x);
}

function groupRows(items) {
  const rows = [];
  for (const item of items) {
    const current = rows.at(-1);
    if (current && current.pageNumber === item.pageNumber && Math.abs(current.y - item.y) <= 4) {
      current.items.push(item);
      continue;
    }
    rows.push({ y: item.y, pageNumber: item.pageNumber, order: rows.length, items: [item] });
  }
  return rows.map(row => ({
    ...row,
    items: [...row.items].sort((a, b) => a.x - b.x),
  }));
}

function rowText(row, minX = -Infinity, maxX = Infinity) {
  return row.items.filter(i => i.x >= minX && i.x <= maxX).map(i => i.str).join(' ').trim();
}

function isHoursText(v) { return /^\d+(?:\.\d+)?\s+Hrs$/i.test(v); }

function isEmployeeStart(row) {
  const left = rowText(row, 40, 130);
  if (!left || !left.includes(',')) return false;
  if (isHoursText(left) || footerPattern.test(left)) return false;
  return !['EMPLOYEES', 'GIWP', 'Netchex Scheduler'].includes(left);
}

function employeeNameForBlock(rows) {
  const parts = [];
  for (const row of rows) {
    const left = rowText(row, 40, 150);
    if (!left || isHoursText(left)) break;
    if (footerPattern.test(left)) continue;
    parts.push(left);
  }
  return normalizeLabel(parts.join(' '));
}

function columnTimeEntries(rows, column) {
  return rows.flatMap((row, rowIndex) =>
    row.items
      .filter(item => Math.abs(item.x - (column.x - 10)) <= 18 && timePattern.test(item.str))
      .map(item => ({ item, rowIndex }))
  );
}

function departmentForShift(rows, column, afterRowIndex) {
  const parts = rows
    .slice(afterRowIndex + 1)
    .flatMap(row => row.items)
    .filter(item => Math.abs(item.x - column.x) <= 30)
    .filter(item => !timePattern.test(item.str) && item.str !== '-')
    .map(item => item.str)
    .filter(v =>
      !isHoursText(v) &&
      !footerPattern.test(v) &&
      !headerMetaPattern.test(v) &&
      v.toUpperCase() !== 'TIME OFF'
    );
  return normalizeLabel(parts.slice(0, 3).join(' '));
}

function shiftFromTimes(employeeName, column, startItem, endItem, departmentLabel, index) {
  const startMatch = startItem.str.match(timePattern);
  const endMatch   = endItem.str.match(timePattern);
  if (!startMatch || !endMatch) return undefined;

  const dept = departmentLabel || 'Unknown Department';
  if (dept.toUpperCase().includes('UNAVAILABLE') || dept.toUpperCase().includes('TIME OFF')) return undefined;

  return {
    temporaryId: `parsed-${index}`,
    employeeName,
    shiftDate: column.date,
    startTime: toTime24(startMatch[1], startMatch[2]),
    endTime:   toTime24(endMatch[1], endMatch[2]),
    departmentLabel: dept,
    sourceConfidence: dept === 'Unknown Department' ? 'low' : 'medium',
    sourceNotes: dept === 'Unknown Department' ? 'Department label was not found near time block.' : undefined,
  };
}

export async function parseNetchexPdf(buffer, sourceFileName) {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
  });

  const rawItems = [];
  const warnings = [];
  let document;

  try {
    document = await loadingTask.promise;

    for (let p = 1; p <= document.numPages; p++) {
      const page    = await document.getPage(p);
      const content = await page.getTextContent();
      rawItems.push(
        ...content.items
          .map(item => ({ str: item.str.trim(), x: item.transform[4], y: item.transform[5], pageNumber: p }))
          .filter(item => item.str)
      );
    }

    const sorted = sortTextItems(rawItems);
    const range  = deriveDateRange(sorted);

    if (!range) {
      return { sourceFileName, dateRangeStart: '', dateRangeEnd: '', shifts: [], warnings: ['The schedule date range could not be read from the PDF.'] };
    }

    const dayColumns = buildDayColumns(sorted, range.start);
    if (dayColumns.length === 0) warnings.push('No day headers were found in the PDF.');

    const rows                = groupRows(sorted);
    const employeeStartIdxs   = rows.flatMap((row, i) => isEmployeeStart(row) ? [i] : []);
    const shifts              = [];

    for (let ei = 0; ei < employeeStartIdxs.length; ei++) {
      const startIdx  = employeeStartIdxs[ei];
      const endIdx    = employeeStartIdxs[ei + 1] ?? rows.length;
      const blockRows = rows.slice(startIdx, endIdx);
      const empName   = employeeNameForBlock(blockRows);
      if (!empName) continue;

      for (const column of dayColumns) {
        const timeEntries = columnTimeEntries(blockRows, column);
        for (let ti = 0; ti + 1 < timeEntries.length; ti += 2) {
          const startEntry = timeEntries[ti];
          const endEntry   = timeEntries[ti + 1];
          const dept       = departmentForShift(blockRows, column, endEntry.rowIndex);
          const shift      = shiftFromTimes(empName, column, startEntry.item, endEntry.item, dept, shifts.length + 1);
          if (shift) shifts.push(shift);
        }
      }
    }

    return { sourceFileName, dateRangeStart: range.start, dateRangeEnd: range.end, shifts, warnings };
  } finally {
    await document?.destroy();
    await loadingTask.destroy();
  }
}
