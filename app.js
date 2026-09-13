const sections = [
  { name: '1. 仮設工事', rows: [
    ['養生工事', '共用部を含む', 1, '式', 150000],
    ['搬入出作業', '夜間対応', 2, '人工', 35000]
  ]},
  { name: '2. 解体工事', rows: [
    ['既存間仕切り撤去', '廃材処分を含む', 1, '式', 280000]
  ]},
  { name: '3. 内装工事', rows: [
    ['軽量間仕切り新設', 'LGS + 石膏ボード', 42, '㎡', 12500]
  ]}
];

let sourceWorkbook = null;
const spreadsheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const officeRelNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageRelNs = 'http://schemas.openxmlformats.org/package/2006/relationships';

const yen = value => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(value || 0);
const input = (value, field, type = 'text') => `<input data-field="${field}" type="${type}" value="${value ?? ''}" />`;

function renderBreakdown() {
  document.querySelector('#breakdown .estimate-section-wrap')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'estimate-section-wrap';
  sections.forEach((section, sectionIndex) => {
    const block = document.createElement('div');
    block.className = 'estimate-section';
    const rows = section.rows.map((row, rowIndex) => `<tr>
      <td>${input(row[0], `${sectionIndex}-${rowIndex}-name`)}</td>
      <td>${input(row[1], `${sectionIndex}-${rowIndex}-description`)}</td>
      <td>${input(row[2], `${sectionIndex}-${rowIndex}-quantity`, 'number')}</td>
      <td>${input(row[3], `${sectionIndex}-${rowIndex}-unit`)}</td>
      <td>${input(row[4], `${sectionIndex}-${rowIndex}-unit_price`, 'number')}</td>
      <td class="amount">${yen(row[2] * row[4])}</td>
    </tr>`).join('');
    const subtotal = section.rows.reduce((sum, row) => sum + Number(row[2]) * Number(row[4]), 0);
    block.innerHTML = `<h3>${section.name}</h3><table><thead><tr><th>名称</th><th>摘要</th><th>数量</th><th>単位</th><th>単価</th><th class="number">金額</th></tr></thead><tbody>${rows}<tr class="subtotal-row"><td colspan="5">小計（数式）</td><td>${yen(subtotal)}</td></tr></tbody></table>`;
    wrap.append(block);
  });
  document.querySelector('#breakdown').append(wrap);
}

function valueFromForm(name) { return document.querySelector(`[name="${name}"]`).value.trim(); }

function makeMarkdown() {
  const lines = [
    '---', 'template_id: slate-construction-estimate-landscape-v1', 'status: draft', '---', '',
    '# 工事見積', '', '## 基本情報', '',
    `- 宛先: ${valueFromForm('recipient')}`, `- 発行日: ${valueFromForm('issueDate')}`, `- 工事名: ${valueFromForm('projectName')}`, '', '## 内訳', ''
  ];
  sections.forEach(section => {
    lines.push(`### ${section.name}`, '', '| 名称 | 摘要 | 数量 | 単位 | 単価 |', '|---|---|---:|---|---:|');
    section.rows.forEach(row => lines.push(`| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} |`));
    lines.push('');
  });
  lines.push('## AIへの編集ルール', '', '- 入力値だけを変更する。', '- 金額・小計・税・合計は編集しない。');
  return lines.join('\n');
}

function refresh() {
  let subtotal = 0;
  sections.forEach(section => section.rows.forEach(row => subtotal += Number(row[2]) * Number(row[4])));
  const tax = Math.round(subtotal * 0.1);
  document.querySelector('#subtotal').textContent = yen(subtotal);
  document.querySelector('#tax').textContent = yen(tax);
  document.querySelector('#total').textContent = yen(subtotal + tax);
  document.querySelector('#markdown-preview').textContent = makeMarkdown();
}

renderBreakdown();
document.addEventListener('input', event => {
  const parts = event.target.dataset.field?.split('-');
  if (parts) {
    const [section, row, field] = parts;
    const index = { name: 0, description: 1, quantity: 2, unit: 3, unit_price: 4 }[field];
    sections[section].rows[row][index] = event.target.type === 'number' ? Number(event.target.value) : event.target.value;
    renderBreakdown();
  }
  refresh();
});
document.querySelector('#download').addEventListener('click', () => {
  const blob = new Blob([makeMarkdown()], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: 'values.md' });
  link.click(); URL.revokeObjectURL(url);
});

function workbookSheetPath(zip, sheetName) {
  return Promise.all([zip.file('xl/workbook.xml').async('text'), zip.file('xl/_rels/workbook.xml.rels').async('text')]).then(([workbookXml, relsXml]) => {
    const workbook = new DOMParser().parseFromString(workbookXml, 'application/xml');
    const rels = new DOMParser().parseFromString(relsXml, 'application/xml');
    const sheet = [...workbook.getElementsByTagNameNS(spreadsheetNs, 'sheet')].find(node => node.getAttribute('name') === sheetName);
    if (!sheet) throw new Error(`シート「${sheetName}」が見つかりません。`);
    const relationshipId = sheet.getAttributeNS(officeRelNs, 'id');
    const relationship = [...rels.getElementsByTagNameNS(packageRelNs, 'Relationship')].find(node => node.getAttribute('Id') === relationshipId);
    if (!relationship) throw new Error(`シート「${sheetName}」の参照先が見つかりません。`);
    return `xl/${relationship.getAttribute('Target').replace(/^\.\.\//, '')}`;
  });
}

function firstCell(range) { return range.split(':')[0]; }

function setCellValue(sheet, reference, value, kind = 'text') {
  const rowNumber = reference.match(/\d+$/)[0];
  let row = [...sheet.getElementsByTagNameNS(spreadsheetNs, 'row')].find(node => node.getAttribute('r') === rowNumber);
  const sheetData = sheet.getElementsByTagNameNS(spreadsheetNs, 'sheetData')[0];
  if (!row) {
    row = sheet.createElementNS(spreadsheetNs, 'row'); row.setAttribute('r', rowNumber); sheetData.append(row);
  }
  let cell = [...row.getElementsByTagNameNS(spreadsheetNs, 'c')].find(node => node.getAttribute('r') === reference);
  if (!cell) { cell = sheet.createElementNS(spreadsheetNs, 'c'); cell.setAttribute('r', reference); row.append(cell); }
  [...cell.getElementsByTagNameNS(spreadsheetNs, 'v'), ...cell.getElementsByTagNameNS(spreadsheetNs, 'is'), ...cell.getElementsByTagNameNS(spreadsheetNs, 'f')].forEach(node => node.remove());
  if (kind === 'number') {
    cell.removeAttribute('t');
    const node = sheet.createElementNS(spreadsheetNs, 'v'); node.textContent = String(Number(value) || 0); cell.append(node);
    return;
  }
  cell.setAttribute('t', 'inlineStr');
  const inlineString = sheet.createElementNS(spreadsheetNs, 'is');
  const text = sheet.createElementNS(spreadsheetNs, 't'); text.textContent = value;
  inlineString.append(text); cell.append(inlineString);
}

function updateCalcSettings(workbookXml) {
  const document = new DOMParser().parseFromString(workbookXml, 'application/xml');
  let calc = document.getElementsByTagNameNS(spreadsheetNs, 'calcPr')[0];
  if (!calc) { calc = document.createElementNS(spreadsheetNs, 'calcPr'); document.documentElement.append(calc); }
  calc.setAttribute('calcMode', 'auto'); calc.setAttribute('fullCalcOnLoad', '1'); calc.setAttribute('forceFullCalc', '1');
  return new XMLSerializer().serializeToString(document);
}

async function exportWorkbook() {
  if (!sourceWorkbook) return;
  const exportButton = document.querySelector('#excel-export');
  exportButton.disabled = true; exportButton.textContent = '書き出し中…';
  try {
    const zip = await JSZip.loadAsync(sourceWorkbook);
    const [coverPath, breakdownPath] = await Promise.all([workbookSheetPath(zip, '表紙'), workbookSheetPath(zip, '内訳')]);
    const cover = new DOMParser().parseFromString(await zip.file(coverPath).async('text'), 'application/xml');
    setCellValue(cover, 'A4', valueFromForm('recipient'));
    setCellValue(cover, 'W4', valueFromForm('issueDate'));
    setCellValue(cover, 'A9', valueFromForm('projectName'));
    zip.file(coverPath, new XMLSerializer().serializeToString(cover));

    const breakdown = new DOMParser().parseFromString(await zip.file(breakdownPath).async('text'), 'application/xml');
    const detailRows = [[5, 6, 7, 8, 9], [13, 14, 15, 16, 17], [21, 22, 23, 24, 25]];
    sections.forEach((section, sectionIndex) => section.rows.forEach((row, rowIndex) => {
      const targetRow = detailRows[sectionIndex][rowIndex];
      setCellValue(breakdown, `B${targetRow}`, row[0]);
      setCellValue(breakdown, `E${targetRow}`, row[1]);
      setCellValue(breakdown, `F${targetRow}`, row[2], 'number');
      setCellValue(breakdown, `G${targetRow}`, row[3]);
      setCellValue(breakdown, `H${targetRow}`, row[4], 'number');
    }));
    zip.file(breakdownPath, new XMLSerializer().serializeToString(breakdown));
    zip.file('xl/workbook.xml', updateCalcSettings(await zip.file('xl/workbook.xml').async('text')));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const name = sourceWorkbook.name.replace(/\.xlsx$/i, '') || 'estimate';
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${name}-Slate.xlsx` });
    link.click(); URL.revokeObjectURL(link.href);
  } catch (error) {
    window.alert(`Excelを書き出せませんでした。${error.message}`);
  } finally {
    exportButton.disabled = false; exportButton.textContent = 'Excelを書き出す';
  }
}

document.querySelector('#excel-file').addEventListener('change', event => {
  const [file] = event.target.files;
  if (!file) return;
  sourceWorkbook = file;
  document.querySelector('#excel-export').disabled = false;
  document.querySelector('.template').textContent = `${file.name} を読み込み済み`;
});
document.querySelector('#excel-export').addEventListener('click', exportWorkbook);
refresh();
