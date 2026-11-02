import ExcelJS from 'exceljs';
import type { Entry } from './db';

const headers = ['日付', '種別', '金額', 'カテゴリ', 'メモ', '取引ID', '作成日時'];
const categories = ['食品', '日用品', '消耗品', '外食費', '光熱費', '衣類', '交際費', '趣味', '家賃', '通信費', '交通費', '医療費', 'その他'];
const validDate = (s: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s; };
export async function createWorkbook(entries: Entry[], month: string): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  const months = [...new Set(entries.map(e => e.date.slice(0, 7)))].sort();
  if (!months.length) months.push(month);
  for (const m of months) {
    const sheet = book.addWorksheet(m); sheet.addRow(headers);
    sheet.columns = [{width:14},{width:10},{width:14},{width:14},{width:32},{width:38},{width:18}];
    sheet.getRow(1).font = { bold: true };
    for (const e of entries.filter(e => e.date.startsWith(m))) sheet.addRow([e.date, e.kind, e.amount, e.category, e.memo, e.id, e.created]);
  }
  const meta = book.addWorksheet('形式情報'); meta.addRow(['家計簿試作', '1']);
  const selected = Math.max(0, months.indexOf(month));
  book.views = [{ x: 0, y: 0, width: 12000, height: 8000, firstSheet: selected, activeTab: selected, visibility: 'visible' }];
  return await book.xlsx.writeBuffer() as ArrayBuffer;
}
export async function parseWorkbook(bytes: ArrayBuffer): Promise<Entry[]> {
  const book = new ExcelJS.Workbook();
  try { await book.xlsx.load(bytes); } catch { throw new Error('Excelファイルを読み込めません。試作版から出力した .xlsx を選んでください。'); }
  const meta = book.getWorksheet('形式情報');
  if (!meta || meta.getCell('A1').value !== '家計簿試作' || meta.getCell('B1').value !== '1') throw new Error('試作版の形式情報が見つかりません。');
  const result: Entry[] = []; const ids = new Set<string>();
  const sheets = book.worksheets.filter(s => /^\d{4}-\d{2}$/.test(s.name));
  if (!sheets.length) throw new Error('月別シートが見つかりません。');
  for (const sheet of sheets) {
    const positions = headers.map(h => { const matches: number[] = []; sheet.getRow(1).eachCell((c, col) => { if (c.value === h) matches.push(col); }); if (matches.length !== 1) throw new Error(`${sheet.name}: 見出し「${h}」を確認してください。`); return matches[0]; });
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber); if (!row.hasValues) continue;
      const values = positions.map(col => row.getCell(col).value);
      if (values.some(v => v !== null && typeof v === 'object' && !(v instanceof Date))) throw new Error(`${sheet.name} ${rowNumber}行: 数式などは使用できません。`);
      const [rawDate, kind, amount, category, memo, id, created] = values;
      const date = rawDate instanceof Date ? rawDate.toISOString().slice(0,10) : rawDate;
      const fail = () => { throw new Error(`${sheet.name} ${rowNumber}行: ID、日付、種別、金額、カテゴリまたはメモを確認してください。`); };
      if (typeof id !== 'string' || !id || ids.has(id) || typeof date !== 'string' || !validDate(date) || (kind !== '支出' && kind !== '収入') || typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > 999999999 || typeof created !== 'number' || !Number.isFinite(created)) fail();
      const cat = category ?? ''; const note = memo ?? '';
      if (typeof cat !== 'string' || typeof note !== 'string' || note.length > 500 || (kind === '支出' ? !categories.includes(cat as string) : cat !== '' || note !== '')) fail();
      ids.add(id as string); result.push({ id: id as string, date: date as string, kind: kind as Entry['kind'], amount: amount as number, category: cat as string, memo: note as string, created: created as number });
    }
  }
  return result;
}
