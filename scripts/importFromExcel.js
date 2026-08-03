/**
 * Importa a aba "DEVICES TAGO (SD)" da planilha pro NOVO modelo (Fase 1/2):
 * Equipment (categoria RASTREADOR) + Chip com os status atuais
 * (EM_ESTOQUE / ENTREGUE / INSTALADO / PERDIDO / BLOQUEADO).
 *
 * Reaproveita a mesma lógica de detecção de seções da versão anterior do
 * script (a aba tem ~10 blocos empilhados, cada um com uma linha-título na
 * coluna A), só que remapeando os status antigos pros novos enums.
 *
 * Uso:
 *   node scripts/importFromExcel.js --dry-run   -> só analisa, não grava
 *   node scripts/importFromExcel.js             -> importa de verdade
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const DRY_RUN = process.argv.includes('--dry-run');

const EXCEL_PATH = process.env.EXCEL_PATH || './Controle_de_Ativos.xlsx';
const SHEET_NAME = process.env.EXCEL_SHEET || 'DEVICES TAGO (SD)';

// ---------------------------------------------------------------------
// Remapeamento: status antigo da planilha -> novo enum do sistema
// ---------------------------------------------------------------------
const EQUIPMENT_STATUS_MAP = {
  'instalado': { status: 'INSTALADO', configurado: true, testado: true },
  'configurar/testar': { status: 'EM_ESTOQUE', configurado: false, testado: false },
  'testando': { status: 'EM_ESTOQUE', configurado: true, testado: false },
  'testado': { status: 'EM_ESTOQUE', configurado: true, testado: true },
  'estoque': { status: 'EM_ESTOQUE', configurado: true, testado: true },
  'entregue': { status: 'ENTREGUE', configurado: true, testado: true },
  'devolução': { status: 'RETORNADO_ESTOQUE', configurado: true, testado: true },
  'devolucao': { status: 'RETORNADO_ESTOQUE', configurado: true, testado: true },
  'deifeito': { status: 'EM_MANUTENCAO', configurado: true, testado: true },
  'defeito': { status: 'EM_MANUTENCAO', configurado: true, testado: true },
  'perdido': { status: 'EM_MANUTENCAO', configurado: true, testado: true, ativo: false, motivoInativacao: 'Perdido (migrado da planilha)' },
};

const CHIP_STATUS_MAP = {
  'estoque': 'EM_ESTOQUE',
  'testado': 'EM_ESTOQUE',
  'testando': 'EM_ESTOQUE',
  'configurar/testar': 'EM_ESTOQUE',
  'cancelado': 'BLOQUEADO',
  'cancelar linha': 'BLOQUEADO',
  'devolução': 'EM_ESTOQUE',
  'devolucao': 'EM_ESTOQUE',
  'deifeito': 'BLOQUEADO',
  'defeito': 'BLOQUEADO',
  'perdido': 'PERDIDO',
  'entregue': 'ENTREGUE',
};

const PLACEHOLDER_UNIT_PATTERNS = [
  /^cancelar linha$/i,
  /^cancelado$/i,
  /^estoque( arqia)?$/i,
  /^moldem$/i,
  /^teste\d*$/i,
  /^\s*$/,
];
function isPlaceholderUnit(nome) {
  if (!nome) return true;
  return PLACEHOLDER_UNIT_PATTERNS.some((re) => re.test(nome.trim()));
}

function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim();
}
function normStatusKey(v) {
  return norm(v) ? norm(v).toLowerCase() : null;
}
function parseDataInstalado(v) {
  return v instanceof Date && !isNaN(v) ? v : null;
}
function looksLikeDeviceId(v) {
  if (!v) return false;
  return /^[0-9a-f]{24}$/.test(v) || /^[A-Z]{2}\d{2}[A-Z]{3,4}\d+$/.test(v);
}

function readSheetRows() {
  const fullPath = path.resolve(EXCEL_PATH);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Planilha não encontrada em ${fullPath}. Ajuste EXCEL_PATH no .env`);
  }
  const wb = XLSX.readFile(fullPath, { cellDates: true });
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`Aba "${SHEET_NAME}" não encontrada no arquivo`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
}

const COLS = {
  DEVICE_TAGO_ID: 0, IMEI: 1, NF: 2, ICCID: 3, NUMERO: 4, UNIDADE: 5,
  CODIGO_ATIVO: 6, COBRANCA: 7, MODELO: 8, NIATRON: 9, ATIVO_NA_TAGO: 10,
  INSTALADO_EM: 11, STATUS: 12, OPERADORA: 13,
};

function splitIntoSections(rows) {
  const sections = [{ nome: 'PRINCIPAL', linhas: [] }];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const a = norm(row[COLS.DEVICE_TAGO_ID]);
    const restoVazio = row.slice(1, 13).every((v) => norm(v) === null);
    const ehMarcador = a && !looksLikeDeviceId(a) && restoVazio && a.length > 3;
    if (ehMarcador) sections.push({ nome: a, linhas: [] });
    else if (row.some((v) => norm(v) !== null)) sections[sections.length - 1].linhas.push(row);
  }
  return sections;
}

const SECTION_DEFAULTS = {
  'PRINCIPAL': { device: 'instalado', chip: 'instalado' },
  'DEVOLUÇÃO': { device: 'devolução', chip: 'devolução' },
  'REMOVIDO DA TAGO POR NÃO PAGAR': { device: 'devolução', chip: 'devolução' },
  'COM FRANQUIAS/cliente': { device: 'entregue', chip: 'entregue' },
  'EM ESTOQUE': { device: 'estoque', chip: 'estoque' },
  'NLT VIVO - CANCELADOS': { device: 'defeito', chip: 'cancelado', forcarChip: true },
  'ARQIA': { device: 'estoque', chip: 'entregue', unidadeFixa: 'ARQIA', forcarChip: true },
  'KORE BRANCO - CANCELADOS': { device: 'defeito', chip: 'cancelado', forcarChip: true },
  'CHIPS CANCELADOS': { device: 'defeito', chip: 'cancelado', forcarChip: true },
  'DEFEITO': { device: 'defeito', chip: 'defeito' },
  'PERDIDO': { device: 'perdido', chip: 'perdido' },
};

function resolveEquipmentStatus(textoLinha, fallbackKey) {
  const key = normStatusKey(textoLinha);
  return EQUIPMENT_STATUS_MAP[key] || EQUIPMENT_STATUS_MAP[fallbackKey];
}
function resolveChipStatus(textoLinha, fallbackKey) {
  const key = normStatusKey(textoLinha);
  return CHIP_STATUS_MAP[key] || CHIP_STATUS_MAP[fallbackKey] || 'EM_ESTOQUE';
}

function parseRows(rows) {
  const sections = splitIntoSections(rows);
  const equipamentos = [];
  const chips = [];
  const unitNames = new Set();
  const paraRevisar = [];

  for (const section of sections) {
    const regra = SECTION_DEFAULTS[section.nome] || { device: 'configurar/testar', chip: 'estoque' };

    for (const row of section.linhas) {
      const deviceTagoId = norm(row[COLS.DEVICE_TAGO_ID]);
      const imei = norm(row[COLS.IMEI]);
      const modelo = norm(row[COLS.MODELO]);
      const iccid = norm(row[COLS.ICCID]);
      const unidadeTexto = norm(row[COLS.UNIDADE]);
      const statusTexto = norm(row[COLS.STATUS]);

      const ehEquipamento = Boolean(deviceTagoId || imei || modelo);
      const ehChip = Boolean(iccid);

      let unidadeNome = regra.unidadeFixa || null;
      if (!unidadeNome && unidadeTexto && !isPlaceholderUnit(unidadeTexto)) unidadeNome = unidadeTexto;
      if (unidadeNome) unitNames.add(unidadeNome);

      let equipDoc = null;
      if (ehEquipamento) {
        const resolved = resolveEquipmentStatus(statusTexto, regra.device);
        equipDoc = {
          categoria: 'RASTREADOR',
          modelo: modelo || 'Não informado',
          imei,
          nf: norm(row[COLS.NF]),
          niatron: norm(row[COLS.NIATRON]),
          codigo_ativo: norm(row[COLS.CODIGO_ATIVO]),
          ativo_na_tago: normStatusKey(row[COLS.ATIVO_NA_TAGO]) === 'sim',
          cobranca: normStatusKey(row[COLS.COBRANCA]) === 'sim',
          status: resolved.status,
          configurado: resolved.configurado,
          testado: resolved.testado,
          ativo: resolved.ativo !== false,
          data_instalacao: parseDataInstalado(row[COLS.INSTALADO_EM]),
          observacao: resolved.motivoInativacao || '',
          categoria_origem: section.nome,
          unidade_nome: unidadeNome,
          _iccid_vinculado: iccid,
        };
        equipamentos.push(equipDoc);
      }

      if (ehChip) {
        const statusChip = regra.forcarChip ? resolveChipStatus(null, regra.chip) : resolveChipStatus(statusTexto, regra.chip);
        const obsPecas = [];
        if (unidadeTexto && isPlaceholderUnit(unidadeTexto)) obsPecas.push(unidadeTexto);

        chips.push({
          iccid,
          numero: norm(row[COLS.NUMERO]),
          operadora: norm(row[COLS.OPERADORA]),
          status: ehEquipamento ? 'INSTALADO' : statusChip,
          unidade_nome: !ehEquipamento ? unidadeNome : null,
          observacao: obsPecas.join(' | '),
          categoria_origem: section.nome,
          _vinculado_a_equip: ehEquipamento,
        });
      }

      if (!ehEquipamento && !ehChip) {
        paraRevisar.push({ secao: section.nome, linha: JSON.stringify(row) });
      }
    }
  }

  return { equipamentos, chips, unitNames, paraRevisar };
}

async function main() {
  const rows = readSheetRows();
  const { equipamentos, chips, unitNames, paraRevisar } = parseRows(rows);

  console.log('--- Resumo do parse ---');
  console.log('Rastreadores encontrados:', equipamentos.length);
  console.log('Chips encontrados:', chips.length);
  console.log('Unidades distintas:', unitNames.size);
  console.log('Linhas p/ revisão manual:', paraRevisar.length);

  const csvPath = path.join(__dirname, 'revisar_manualmente.csv');
  fs.writeFileSync(
    csvPath,
    'secao,linha\n' + paraRevisar.map((r) => `${r.secao},"${(r.linha || '').replace(/"/g, "'")}"`).join('\n')
  );
  console.log(`Detalhes salvos em: ${csvPath}`);

  if (DRY_RUN) {
    console.log('\n[dry-run] Nenhum dado foi gravado no banco.');
    return;
  }

  const mongoose = require('mongoose');
  const connectDB = require('../src/config/db');
  const Unit = require('../src/models/Unit');
  const Chip = require('../src/models/Chip');
  const { Rastreador } = require('../src/models/Equipment');

  await connectDB();

  console.log('\nLimpando coleções antes de importar...');
  await Promise.all([Unit.deleteMany({}), Chip.deleteMany({}), Rastreador.deleteMany({})]);

  console.log('Criando unidades...');
  const unitDocs = await Unit.insertMany([...unitNames].map((nome) => ({ nome })), { ordered: false });
  const unitByName = new Map(unitDocs.map((u) => [u.nome, u._id]));

  console.log('Criando rastreadores...');
  const equipInsertResult = await Rastreador.insertMany(
    equipamentos.map(({ unidade_nome, _iccid_vinculado, ...d }) => ({
      ...d,
      unidade_id: unidade_nome ? unitByName.get(unidade_nome) : null,
    })),
    { ordered: false }
  );

  const equipIdByIccid = new Map();
  equipamentos.forEach((d, idx) => {
    if (d._iccid_vinculado) equipIdByIccid.set(d._iccid_vinculado, equipInsertResult[idx]._id);
  });

  console.log('Criando chips (ignorando ICCIDs duplicados)...');
  const iccidsVistos = new Set();
  const chipsParaInserir = [];
  for (const c of chips) {
    if (iccidsVistos.has(c.iccid)) continue;
    iccidsVistos.add(c.iccid);
    chipsParaInserir.push({
      iccid: c.iccid,
      numero: c.numero,
      operadora: c.operadora,
      status: c.status,
      unidade_reservada: c.unidade_nome ? unitByName.get(c.unidade_nome) : null,
      equipment_id: c._vinculado_a_equip ? equipIdByIccid.get(c.iccid) || null : null,
      observacao: c.observacao,
      categoria_origem: c.categoria_origem,
    });
  }
  const chipInsertResult = await Chip.insertMany(chipsParaInserir, { ordered: false });

  console.log('Vinculando chips <-> rastreadores...');
  for (const chip of chipInsertResult) {
    if (chip.equipment_id) await Rastreador.findByIdAndUpdate(chip.equipment_id, { chip_id: chip._id });
  }

  console.log('\nImportação concluída:');
  console.log(`  ${unitDocs.length} unidades`);
  console.log(`  ${equipInsertResult.length} rastreadores`);
  console.log(`  ${chipInsertResult.length} chips (${chips.length - chipInsertResult.length} ICCIDs duplicados ignorados)`);

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Erro na importação:', err);
    process.exit(1);
  });
}

module.exports = { readSheetRows, parseRows, splitIntoSections };
