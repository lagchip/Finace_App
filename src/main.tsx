import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { readEntries, saveEntry, importEntries, type Entry } from './db';
import { createWorkbook, parseWorkbook } from './excel';
import './style.css';

const categories = ['食品', '日用品', '消耗品', '外食費', '光熱費', '衣類', '交際費', '趣味', '家賃', '通信費', '交通費', '医療費', 'その他'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today().slice(0,7));
  const [kind, setKind] = useState<'支出'|'収入'>('支出');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [memo, setMemo] = useState('');
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [excelMessage, setExcelMessage] = useState('');
  const [preview, setPreview] = useState<Entry[] | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  useEffect(() => { readEntries().then(e => { setEntries(e); setReady(true); }).catch(() => setMessage('保存データを読み込めませんでした。ブラウザの設定をご確認ください。')); }, []);
  const selected = useMemo(() => entries.filter(e => e.date.startsWith(month)).sort((a,b) => b.date.localeCompare(a.date) || b.created-a.created), [entries, month]);
  const expenses = selected.filter(e => e.kind === '支出');
  const spent = expenses.filter(e => e.date <= today()).reduce((s,e) => s+e.amount,0);
  const planned = expenses.filter(e => e.date > today()).reduce((s,e) => s+e.amount,0);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (saving || !ready) return;
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 1 || n > 999999999 || !date) { setMessage('日付と1〜999,999,999円の整数を入力してください。'); return; }
    setSaving(true); setMessage('');
    const entry: Entry = { id: crypto.randomUUID(), date, kind, amount: n, category: kind === '支出' ? category : '', memo: kind === '支出' ? memo : '', created: Date.now() };
    try { await saveEntry(entry); setEntries(previous => [...previous, entry]); setMonth(date.slice(0,7)); setAmount(''); setMemo(''); setMessage('記録しました。'); }
    catch { setMessage('保存できませんでした。ブラウザの保存設定をご確認ください。'); }
    finally { setSaving(false); }
  }
  async function exportExcel() {
    setExcelBusy(true); setExcelMessage('');
    try {
      const bytes = await createWorkbook(await readEntries(), month);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url; a.download = 'kakeibo-prototype.xlsx'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000); setExcelMessage('Excelファイルを出力しました。');
    } catch { setExcelMessage('出力できませんでした。'); } finally { setExcelBusy(false); }
  }
  async function selectExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''; setPreview(null); setExcelMessage('');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setExcelMessage('ファイルは5MB以下にしてください。'); return; }
    setExcelBusy(true);
    try { const parsed = await parseWorkbook(await file.arrayBuffer()); setPreview(parsed); setExcelMessage(`${parsed.length}件を読み込みました。内容を確認してください。`); }
    catch (error) { setExcelMessage(error instanceof Error ? error.message : '読み込めませんでした。'); }
    finally { setExcelBusy(false); }
  }
  async function confirmExcel() {
    if (!preview || excelBusy) return; setExcelBusy(true);
    try { const count = await importEntries(preview); setEntries(await readEntries()); setPreview(null); setExcelMessage(`${count}件を追加しました。同じ内容の取引は追加していません。`); }
    catch (error) { setExcelMessage(error instanceof Error ? error.message : '取り込みに失敗しました。'); }
    finally { setExcelBusy(false); }
  }
  return <main className="page"><header><div className="brand"><div className="mark">K</div><div><strong>くらしの家計簿</strong><small>KAKEIBO / PROTOTYPE</small></div></div><span className="badge">試作版</span></header>
    <section className="intro"><div><p className="eyebrow">YOUR MONEY, AT A GLANCE</p><h1>お金の流れを、<br/><em>もっと身近に。</em></h1><p>日々の記録から、これからの暮らしを見通そう。</p></div><div className="month"><label htmlFor="month">表示する月</label><input id="month" type="month" value={month} onChange={e => setMonth(e.target.value)} /></div></section>
    <section className="summary" aria-label="月の支出"><article className="total"><span>今月の支出合計 <small>予定を含む</small></span><strong>{yen(spent+planned)}</strong><p>選択した月の支出</p></article><article><span>支出済み</span><strong>{yen(spent)}</strong><p>今日までの記録</p></article><article><span>支出予定</span><strong>{yen(planned)}</strong><p>明日以降の記録</p></article></section>
    <div className="content"><section className="panel history"><div className="section-head"><div><p className="eyebrow">TRANSACTIONS</p><h2>今月の記録</h2></div><span className="count">{selected.length} 件</span></div>{selected.length === 0 ? <div className="empty"><div className="empty-icon">✳</div><strong>まだ記録がありません</strong><p>右のフォームから最初の収支を<br/>追加してみましょう。</p></div> : <ul className="entries">{selected.map(e => <li key={e.id}><span className="entry-icon">{e.kind === '支出' ? '↗' : '↙'}</span><div className="entry-text"><strong>{e.category || '収入'}</strong><small>{e.date.replaceAll('-', '.')} {e.memo && ` · ${e.memo}`}</small></div><strong>{e.kind === '支出' ? '−' : '+'}{yen(e.amount)}</strong></li>)}</ul>}</section>
    <section className="panel form-panel"><div className="section-head"><div><p className="eyebrow">NEW ENTRY</p><h2>収支を記録</h2></div><span className="plus">＋</span></div><form onSubmit={submit}><div className="switch" aria-label="種別">{(['支出','収入'] as const).map(k => <button type="button" className={kind===k?'active':''} aria-pressed={kind===k} key={k} onClick={() => setKind(k)}>{k}</button>)}</div><label>金額 <span>必須</span><div className="money"><b>¥</b><input type="number" inputMode="numeric" min="1" max="999999999" step="1" required placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/></div></label><label>日付 <span>必須</span><input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>{kind==='支出' && <><label>カテゴリ <span>必須</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>メモ <span className="optional">任意</span><input maxLength={500} placeholder="何に使いましたか？" value={memo} onChange={e=>setMemo(e.target.value)}/></label></>}<button className="submit" disabled={!ready || saving}>{saving?'保存中…':'記録を追加する'} <span>→</span></button><p className="feedback" role="status">{message}</p></form></section></div>
    <section className="panel excel"><p className="eyebrow">EXCEL / TRIAL</p><h2>Excelで受け渡す</h2><p>全期間の取引を月別シートに出力します。試作版では既存取引の更新や、予算・定期収支の受け渡しには対応していません。</p><div className="excel-actions"><button type="button" onClick={exportExcel} disabled={!ready || excelBusy}>Excelを出力</button><label className="file-button">Excelを選択<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={!ready || excelBusy} onChange={selectExcel}/></label></div><p className="feedback" role="status">{excelMessage}</p>{preview && <div className="preview"><h3>取り込み内容（{preview.length}件）</h3>{preview.length > 0 && <ul>{preview.map(e => <li key={e.id}>{e.date} · {e.kind} · {e.category || '収入'} · {yen(e.amount)}{e.memo && ` · ${e.memo}`}</li>)}</ul>}<button type="button" onClick={confirmExcel} disabled={excelBusy}>新しい取引を取り込む</button> <button type="button" onClick={() => {setPreview(null); setExcelMessage('取り込みをキャンセルしました。');}}>キャンセル</button></div>}</section><footer>データはこのブラウザに保存されます。 <span>Excel連携は検証中です</span></footer></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
