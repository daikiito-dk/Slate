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
refresh();
