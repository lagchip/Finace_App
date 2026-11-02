import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createWorkbook, parseWorkbook } from '../src/excel.ts';

const entries = [
  {id:'a',date:'2026-11-01',kind:'支出',amount:1200,category:'食品',memo:'=1+1',created:123},
  {id:'b',date:'2026-12-02',kind:'収入',amount:3000,category:'',memo:'',created:124},
];
test('月別シートの出力と読み込みで取引を保持する', async () => {
  const bytes = await createWorkbook(entries, '2026-11');
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes);
  assert.deepEqual(book.worksheets.map(s=>s.name), ['2026-11','2026-12','形式情報']);
  assert.deepEqual(book.getWorksheet('2026-11').getRow(1).values.slice(1), ['日付', '種別', '金額', 'カテゴリ', 'メモ', '取引ID', '作成日時']);
  assert.equal(book.getWorksheet('2026-11').getCell('E2').value, '=1+1');
  assert.equal(book.getWorksheet('2026-11').getCell('A2').value, '2026-11-01');
  assert.deepEqual(await parseWorkbook(bytes), entries);
});
test('入力セルの数式と重複IDを拒否する', async () => {
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await createWorkbook(entries, '2026-11'));
  book.getWorksheet('2026-11').getCell('C2').value = {formula:'1+1', result:2};
  const bytes = await book.xlsx.writeBuffer();
  await assert.rejects(() => parseWorkbook(bytes), /数式/);
  book.getWorksheet('2026-11').getCell('C2').value = 1200;
  book.getWorksheet('2026-12').getCell('F2').value = 'a';
  const duplicate = await book.xlsx.writeBuffer();
  await assert.rejects(() => parseWorkbook(duplicate), /ID/);
});
test('形式情報のないブックを拒否する', async () => {
  const book = new ExcelJS.Workbook(); book.addWorksheet('2026-11');
  const bytes = await book.xlsx.writeBuffer();
  await assert.rejects(() => parseWorkbook(bytes), /形式情報/);
});
test('選択月を開き、以前の列順のファイルも読み込める', async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await createWorkbook(entries, '2026-12'));
  assert.equal(book.views[0].activeTab, 1);
  const old = new ExcelJS.Workbook();
  old.addWorksheet('形式情報').addRow(['家計簿試作', '1']);
  const sheet = old.addWorksheet('2026-11');
  sheet.addRow(['取引ID', '日付', '種別', '金額', 'カテゴリ', 'メモ', '作成日時']);
  sheet.addRow(['a', '2026-11-01', '支出', 1200, '食品', '=1+1', 123]);
  assert.deepEqual(await parseWorkbook(await old.xlsx.writeBuffer()), [entries[0]]);
});
