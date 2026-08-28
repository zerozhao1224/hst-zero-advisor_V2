import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_SYSTEM_CONFIG, INITIAL_KNOWLEDGE_BASE } from './src/data/defaultKnowledgeBase.js';
import { KnowledgeItem, SystemConfig, KnowledgeCategory, CityDefenseConfig, SiegePlanWave, AdminUser, AdminInvite } from './src/types.js';

dotenv.config();

// Persistent storage file paths
const DATA_DIR = path.join(process.cwd(), 'data');
const KB_FILE_PATH = path.join(DATA_DIR, 'knowledge-base.json');
const CONFIG_FILE_PATH = path.join(DATA_DIR, 'system-config.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Function to save knowledge base to disk
function saveKnowledgeBaseToDisk() {
  try {
    fs.writeFileSync(KB_FILE_PATH, JSON.stringify(knowledgeBase, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save knowledge base to disk:', err);
  }
}

// Function to save system config to disk
function saveConfigToDisk() {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(systemConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save config to disk:', err);
  }
}

// Load persisted data or fallback to defaults
function loadInitialData(): { kb: KnowledgeItem[]; config: SystemConfig } {
  let kb: KnowledgeItem[] = [...INITIAL_KNOWLEDGE_BASE];
  let config: SystemConfig = { ...DEFAULT_SYSTEM_CONFIG };

  try {
    if (fs.existsSync(KB_FILE_PATH)) {
      const raw = fs.readFileSync(KB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Even if user deleted all or some items, respect the saved array exactly!
        kb = parsed;
      }
    } else {
      // First run only: save initial default knowledge base to disk
      fs.writeFileSync(KB_FILE_PATH, JSON.stringify(kb, null, 2), 'utf-8');
    }
  } catch (e) {
    console.warn('Error reading persisted knowledge base, using defaults:', e);
  }

  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        config = { ...DEFAULT_SYSTEM_CONFIG, ...parsed };
      }
    } else {
      // First run only: save default config to disk
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
    }
  } catch (e) {
    console.warn('Error reading persisted config, using defaults:', e);
  }

  return { kb, config };
}

const initialData = loadInitialData();
let knowledgeBase: KnowledgeItem[] = initialData.kb;
let systemConfig: SystemConfig = initialData.config;

// Root Creator / Super Admin Email
const SUPER_ADMIN_EMAIL = 'zeroatos@gmail.com';
const ADMINS_FILE_PATH = path.join(DATA_DIR, 'admins.json');

interface AdminsStore {
  superAdmin: string;
  admins: AdminUser[];
  invites: AdminInvite[];
}

function loadAdminsData(): AdminsStore {
  let store: AdminsStore = {
    superAdmin: SUPER_ADMIN_EMAIL,
    admins: [
      {
        email: SUPER_ADMIN_EMAIL,
        role: 'super_admin',
        name: '系統建立者 (Creator)',
        invitedBy: '系統創始預設',
        invitedAt: new Date().toISOString(),
        isCreator: true,
      },
    ],
    invites: [],
  };

  try {
    if (fs.existsSync(ADMINS_FILE_PATH)) {
      const raw = fs.readFileSync(ADMINS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.admins)) {
        store.admins = parsed.admins;
        store.invites = Array.isArray(parsed.invites) ? parsed.invites : [];
      }
    } else {
      fs.writeFileSync(ADMINS_FILE_PATH, JSON.stringify(store, null, 2), 'utf-8');
    }
  } catch (e) {
    console.warn('Error reading admins data, using default creator:', e);
  }

  // Ensure root super admin is always present and marked as creator
  const superAdminIndex = store.admins.findIndex(
    (a) => a.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );
  if (superAdminIndex === -1) {
    store.admins.unshift({
      email: SUPER_ADMIN_EMAIL,
      role: 'super_admin',
      name: '系統建立者 (Creator)',
      invitedBy: '系統創始預設',
      invitedAt: new Date().toISOString(),
      isCreator: true,
    });
  } else {
    store.admins[superAdminIndex].role = 'super_admin';
    store.admins[superAdminIndex].isCreator = true;
  }

  return store;
}

let adminsStore: AdminsStore = loadAdminsData();

function saveAdminsToDisk() {
  try {
    fs.writeFileSync(ADMINS_FILE_PATH, JSON.stringify(adminsStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save admins data to disk:', err);
  }
}

// Clean invalid custom API key if present on startup
if (systemConfig.customApiKey && !(systemConfig.customApiKey.startsWith('AIza') || systemConfig.customApiKey.startsWith('AQ.') || systemConfig.customApiKey.startsWith('AQ'))) {
  systemConfig.customApiKey = undefined;
}

// Helper to find effective Gemini API Key from process.env, .env files, or SystemConfig
function getEffectiveApiKey(): { apiKey: string | null; source: string; isValidFormat: boolean; rawName?: string } {
  const cleanKey = (k: any): string | null => {
    if (!k || typeof k !== 'string') return null;
    let trimmed = k.trim();
    // Remove surrounding single or double quotes
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    // Reject common placeholder values
    if (
      trimmed === '' ||
      trimmed === 'MY_GEMINI_API_KEY' ||
      trimmed === 'YOUR_API_KEY' ||
      trimmed === 'TODO' ||
      trimmed === 'undefined' ||
      trimmed === 'null'
    ) {
      return null;
    }
    return trimmed;
  };

  const checkValid = (k: string) => {
    const trimmed = k.trim();
    return trimmed.length >= 10;
  };

  // 1. Check customApiKey in systemConfig (direct UI entry)
  if (systemConfig.customApiKey) {
    const cleaned = cleanKey(systemConfig.customApiKey);
    if (cleaned) {
      return { apiKey: cleaned, source: 'UI 頁面手動填入 (customApiKey)', isValidFormat: checkValid(cleaned) };
    }
  }

  // 2. Check all common environment variable aliases in process.env
  const candidateEnvNames = [
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'GOOGLE_GENAI_API_KEY',
    'GEMINI_KEY',
    'API_KEY',
    'VITE_GEMINI_API_KEY',
    'GOOGLE_AI_KEY',
    'GEMINI_TOKEN',
  ];

  for (const envName of candidateEnvNames) {
    const rawVal = process.env[envName];
    const cleaned = cleanKey(rawVal);
    if (cleaned) {
      return {
        apiKey: cleaned,
        source: `AI Studio Settings / 環境變數 (${envName})`,
        isValidFormat: checkValid(cleaned),
        rawName: envName,
      };
    }
  }

  // 3. Scan ALL process.env values in case the user named it anything else but provided a Google AI Key (AIza...)
  for (const [keyName, val] of Object.entries(process.env)) {
    const cleaned = cleanKey(val);
    if (cleaned && (cleaned.startsWith('AIza') || cleaned.startsWith('AQ.'))) {
      return {
        apiKey: cleaned,
        source: `AI Studio Settings / 環境變數 (${keyName})`,
        isValidFormat: checkValid(cleaned),
        rawName: keyName,
      };
    }
  }

  // 4. Check .env and .env.local dynamically on disk
  for (const envFile of ['.env', '.env.local']) {
    try {
      if (fs.existsSync(envFile)) {
        const parsed = dotenv.parse(fs.readFileSync(envFile));
        for (const envName of candidateEnvNames) {
          const cleaned = cleanKey(parsed[envName]);
          if (cleaned) {
            process.env.GEMINI_API_KEY = cleaned;
            return {
              apiKey: cleaned,
              source: `本機磁碟設定檔 (${envFile} -> ${envName})`,
              isValidFormat: checkValid(cleaned),
              rawName: envName,
            };
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  return { apiKey: null, source: '尚未偵測到 API Key (未在 Settings 設定或名稱不符)', isValidFormat: false };
}

// Lazy Initialize Gemini Client with graceful fallback
function getAiClient(): GoogleGenAI | null {
  const { apiKey, isValidFormat } = getEffectiveApiKey();
  if (!apiKey || !isValidFormat) {
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (e) {
    console.warn('Failed to construct GoogleGenAI client:', e);
    return null;
  }
}

// Safe Gemini Call with strict timeout to prevent proxy hanging / 504 gateway timeout
async function callGeminiSafe(
  contents: any,
  options: {
    systemInstruction?: string;
    responseMimeType?: string;
    temperature?: number;
    timeoutMs?: number;
  } = {}
): Promise<string | null> {
  const aiClient = getAiClient();
  if (!aiClient) return null;

  const timeoutMs = options.timeoutMs || 8000;

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini API 請求超時 (${Math.round(timeoutMs / 1000)}秒)`)), timeoutMs)
    );

    const callPromise = aiClient.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
      config: {
        systemInstruction: options.systemInstruction,
        responseMimeType: options.responseMimeType,
        temperature: options.temperature ?? 0.3,
      },
    });

    const result = await Promise.race([callPromise, timeoutPromise]);
    return result.text || null;
  } catch (err: any) {
    console.warn('Gemini API call warning (falling back to local engine):', err.message || err);
    return null;
  }
}

// Advanced Chinese token extractor
function extractQueryKeywords(query: string): string[] {
  const cleaned = query
    .replace(/[請問|查詢|的|數值|如何|怎麼樣|多少|請教|推薦|適合|介紹|解析|說明|有何|幫我]/g, ' ')
    .trim();
  const tokens = cleaned.split(/[\s,，。！？?、:：\-_/\\+]+/g).filter((t) => t.length > 0);
  
  // Add 2-char n-grams for Chinese queries without spaces
  const ngrams: string[] = [];
  const pureChinese = query.replace(/[^\u4e00-\u9fa5]/g, '');
  for (let i = 0; i < pureChinese.length - 1; i++) {
    const bigram = pureChinese.substring(i, i + 2);
    if (!['請問', '查詢', '數值', '如何', '怎麼', '什麼', '可以', '推薦'].includes(bigram)) {
      ngrams.push(bigram);
    }
  }

  return Array.from(new Set([...tokens, ...ngrams]));
}

// Helper: Simple TF-IDF / Keyword RAG retrieval score with CJK & Table support
function calculateRelevance(item: KnowledgeItem, query: string, keywords: string[]): number {
  const qLower = query.toLowerCase();
  const titleLower = item.title.toLowerCase();
  const contentLower = item.content.toLowerCase();
  let score = 0;

  // Direct title match
  if (titleLower.includes(qLower)) {
    score += 0.8;
  }

  // Tags match
  for (const tag of item.tags) {
    const tagLower = tag.toLowerCase();
    if (qLower.includes(tagLower) || tagLower.includes(qLower)) {
      score += 0.5;
    }
  }

  // Category boost for generals stat queries
  const isStatQuery = query.includes('數值') || query.includes('初始') || query.includes('屬性') || query.includes('勇武') || query.includes('統率') || query.includes('智謀') || query.includes('內政');
  if (isStatQuery && (item.category === 'generals' || item.title.includes('將領表') || item.title.includes('名將'))) {
    score += 0.35;
  }

  // Keyword / General Name matches
  for (const token of keywords) {
    const tLower = token.toLowerCase();
    if (tLower.length >= 1) {
      if (titleLower.includes(tLower)) score += 0.4;
      if (contentLower.includes(tLower)) {
        score += 0.3;
        if (contentLower.includes(`| ${tLower} `) || contentLower.includes(`|${tLower}|`) || contentLower.includes(`| ${tLower}|`)) {
          score += 0.5; // Table row exact hit
        }
      }
      if (item.tags.some((t) => t.toLowerCase().includes(tLower))) score += 0.4;
    }
  }

  return Math.min(score, 1.0);
}

function retrieveRelevantDocs(query: string, topK: number = 3) {
  const keywords = extractQueryKeywords(query);
  const activeDocs = knowledgeBase.filter((item) =>
    systemConfig.activeCategories.includes(item.category)
  );

  const scored = activeDocs.map((item) => ({
    doc: item,
    score: calculateRelevance(item, query, keywords),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const results = scored
    .filter((s) => s.score > 0.05)
    .slice(0, topK)
    .map((s) => {
      let filteredContent = s.doc.content;
      const lines = s.doc.content.split('\n');
      const isLargeTable = lines.filter((l) => l.includes('|')).length > 8;

      // If document is a large table/catalog and user is searching for specific keywords (e.g. 孔秀)
      if (isLargeTable && keywords.length > 0) {
        let tableHeader = '';
        let tableDivider = '';
        const matchedLines: string[] = [];

        for (const line of lines) {
          if (line.includes('|')) {
            if (!tableHeader && (line.includes('將') || line.includes('名') || line.includes('勇武') || line.includes('屬性') || line.includes('統率') || line.includes('智謀'))) {
              tableHeader = line;
            } else if (!tableDivider && line.includes('---')) {
              tableDivider = line;
            } else if (keywords.some((k) => k.length >= 2 && line.includes(k))) {
              matchedLines.push(line);
            }
          }
        }

        if (matchedLines.length > 0) {
          filteredContent = `### 【精確檢索結果】：\n${tableHeader}\n${tableDivider || '| --- | --- | --- | --- | --- |'}\n${matchedLines.join('\n')}\n\n（註：已自動過濾資料庫中其餘無關武將名冊，僅保留符合「${query}」之目標條目）`;
        }
      }

      return {
        id: s.doc.id,
        title: s.doc.title,
        category: s.doc.category,
        score: Math.round(s.score * 100) / 100,
        contentSnippet: s.doc.content.slice(0, 300) + (s.doc.content.length > 300 ? '...' : ''),
        fullContent: filteredContent,
        originalContent: s.doc.content,
      };
    });

  return results;
}

// High-fidelity RAG Fallback Response Generator
function generateFallbackRagResponse(retrieved: ReturnType<typeof retrieveRelevantDocs>, query: string): string {
  if (retrieved.length === 0) {
    return systemConfig.refusalMessage;
  }

  const keywords = extractQueryKeywords(query);
  const topDoc = retrieved[0];

  // Search across retrieved documents to find if any contains a table row matching the queried keywords (e.g. 孔秀, 關羽)
  const matchedTableLines: string[] = [];
  let tableHeader = '';

  for (const doc of retrieved) {
    const lines = (doc.originalContent || doc.fullContent).split('\n');
    for (const line of lines) {
      if (line.includes('|')) {
        if (!tableHeader && (line.includes('將') || line.includes('名') || line.includes('屬性') || line.includes('統率') || line.includes('勇武') || line.includes('智謀') || line.includes('內政'))) {
          tableHeader = line;
        } else if (keywords.some((k) => k.length >= 2 && line.includes(k))) {
          if (!matchedTableLines.includes(line)) {
            matchedTableLines.push(line);
          }
        }
      }
    }
  }

  // 1. If specific general / row was matched in a table
  if (matchedTableLines.length > 0) {
    const headerCols = tableHeader
      ? tableHeader.split('|').map((c) => c.trim()).filter(Boolean)
      : ['將領名', '基礎勇武', '基礎智謀', '基礎統率', '基礎內政'];

    let text = `主公問及「**${query}**」，亮特查閱官方《熱血三國》名將檔案庫紀錄如下：\n\n`;

    matchedTableLines.forEach((mLine) => {
      const cols = mLine.split('|').map((c) => c.trim()).filter(Boolean);
      const name = cols[0] || query;

      text += `### 🗡️ 【名將檔案】${name} 官方初始屬性面板\n\n`;
      text += `| 屬性項目 | 官方初始數值 | 臥龍軍師戰略解析 |\n`;
      text += `| :--- | :--- | :--- |\n`;

      headerCols.forEach((h, idx) => {
        const val = cols[idx] || '-';
        let evalNote = '官方標準基礎維度';
        const numVal = parseInt(val, 10);

        if (h.includes('勇武') || h.includes('武力')) {
          if (!isNaN(numVal) && numVal >= 110) evalNote = '🔥 神將級別近戰爆發，單挑與攻堅極其強悍！';
          else if (!isNaN(numVal) && numVal >= 95) evalNote = '⚔️ 一流主力戰將，勝任主力攻城先鋒。';
          else if (!isNaN(numVal) && numVal >= 80) evalNote = '🛡️ 中階武勇，可任副將或防守城池。';
          else evalNote = '基礎武勇，初期過渡或駐防使用。';
        } else if (h.includes('智謀') || h.includes('智力')) {
          if (!isNaN(numVal) && numVal >= 110) evalNote = '🔮 頂級軍師智謀，計謀命中與破計極高！';
          else if (!isNaN(numVal) && numVal >= 90) evalNote = '📜 優秀軍師，可擔任軍師輔助主力。';
          else evalNote = '智謀一般，需防禦敵方施放計謀。';
        } else if (h.includes('統率') || h.includes('統禦')) {
          if (!isNaN(numVal) && numVal >= 105) evalNote = '👑 大元帥統軍，兵團防禦與兵力上限加成極大。';
          else if (!isNaN(numVal) && numVal >= 90) evalNote = '🚩 優良統兵將領，適合統領大軍團出征。';
          else evalNote = '中規中矩統禦能力。';
        } else if (h.includes('內政') || h.includes('政治')) {
          if (!isNaN(numVal) && numVal >= 95) evalNote = '🏛️ 治世能臣，適合任命城池太守提高生產效率。';
          else evalNote = '內政普通，不建議擔任主力太守。';
        } else if (h.includes('名') || h.includes('將')) {
          evalNote = '《熱血三國》收錄之三國武將';
        }

        text += `| **${h}** | **${val}** | ${evalNote} |\n`;
      });

      text += `\n💡 **臥龍軍師培養與作戰建議**：\n`;
      text += `* **戰術定位**：【${name}】在《熱血三國》中屬於數值已登載之武將。建議根據其優勢屬性進行加點（勇武高則補勇武主攻、統率高則主加統率帶兵）。\n`;
      text += `* **部隊搭配**：出征時可搭配相應科技（如拋射、統禦）提升部隊攻防效果。\n\n`;
    });

    return text;
  }

  // 2. If it's a regular article (not a giant 50+ row table)
  const topLines = (topDoc.originalContent || topDoc.fullContent).split('\n');
  const isLargeTable = topLines.filter((l) => l.includes('|')).length > 8;
  if (!isLargeTable) {
    let text = `主公問及「**${query}**」，亮特查閱官方《熱血三國》核心資料庫紀錄如下：\n\n`;
    text += `### 📜 【${topDoc.title}】\n\n${topDoc.fullContent}\n\n`;
    if (retrieved.length > 1) {
      text += `\n---\n💡 **主公亦可參考關聯官方文獻**：\n` +
        retrieved.slice(1).map((d) => `* 《**${d.title}**》（分類：${d.category}）`).join('\n');
    }
    return text;
  }

  // 3. Fallback when table had no match
  return `主公抱歉！亮在官方《熱血三國》資料庫（包含《${topDoc.title}》）中，尚未查得「**${query}**」之具體數值紀錄。建議主公確認武將姓名是否正確，或等待官方後續檔案補全。`;
}

// Helper: Check if query is completely non-game related
function isNonGameQuery(query: string): boolean {
  const nonGameKeywords = [
    '世界盃', '足球', '天氣', '台北', '美食', '程式碼', 'python', 'java', '股票', '台股',
    '總統', '政治', '減肥', '電影', '音樂', '減重', '比特幣', '虛擬貨幣', '房價', '交友'
  ];
  const qLower = query.toLowerCase();
  for (const kw of nonGameKeywords) {
    if (qLower.includes(kw)) {
      return true;
    }
  }
  return false;
}

// Local smart parser for Excel/CSV/General tables - Generates a single unified official catalog document
function parseGeneralTableFallback(textContent: string, fileName: string): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];
  const lines = textContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length === 0) return items;

  let headers: string[] = [];
  const rows: string[][] = [];

  for (const line of lines) {
    // Check delimiter: comma, tab, or pipe
    let cols: string[] = [];
    if (line.includes(',')) cols = line.split(',').map((c) => c.trim());
    else if (line.includes('\t')) cols = line.split('\t').map((c) => c.trim());
    else if (line.includes('|')) cols = line.split('|').map((c) => c.trim()).filter(Boolean);

    if (cols.length >= 2) {
      if (headers.length === 0 && (line.includes('將') || line.includes('名') || line.includes('武力') || line.includes('勇武') || line.includes('統率') || line.includes('智力') || line.includes('智謀') || line.includes('內政') || line.includes('陣營') || line.includes('星級'))) {
        headers = cols;
      } else {
        rows.push(cols);
      }
    }
  }

  // If table detected
  if (headers.length > 0 && rows.length > 0) {
    // Generate a single consolidated official table document
    const cleanFileName = fileName ? fileName.replace(/\.[^/.]+$/, '') : '名將數值總表';
    let catalogMarkdown = `## 📜 《${fileName || '將領表.xlsx'}》官方數據彙整\n\n`;
    catalogMarkdown += `| ${headers.join(' | ')} |\n`;
    catalogMarkdown += `| ${headers.map(() => '---').join(' | ')} |\n`;
    rows.forEach((r) => {
      catalogMarkdown += `| ${r.join(' | ')} |\n`;
    });

    const sampleTags = Array.from(new Set(rows.map((r) => r[0]).filter(Boolean))).slice(0, 80);

    items.push({
      id: 'kb-catalog-' + Date.now(),
      title: `【名將圖鑑總表】${cleanFileName}`,
      category: 'generals',
      subcategory: '官方數據總覽',
      tags: ['名將圖鑑', '將領表', '名將數值', '基礎四圍', ...sampleTags],
      content: catalogMarkdown,
      updatedAt: new Date().toISOString().split('T')[0],
      verified: true,
      version: 'v3.2',
    });
  } else {
    // General text fallback (single clean entry)
    items.push({
      id: 'kb-upload-' + Date.now(),
      title: fileName ? `【官方攻略】${fileName.replace(/\.[^/.]+$/, '')}` : '【官方攻略】上傳歸檔文件',
      category: 'generals',
      subcategory: '官方檔案',
      tags: ['官方攻略', '上傳文獻', '名將檔案'],
      content: textContent,
      updatedAt: new Date().toISOString().split('T')[0],
      verified: true,
      version: 'v3.2',
    });
  }

  return items;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API 0: Test Gemini API Key Status
  app.get('/api/test-gemini-key', async (req, res) => {
    const { apiKey, source, isValidFormat } = getEffectiveApiKey();
    if (!apiKey) {
      return res.json({
        success: false,
        keyPresent: false,
        source,
        message: '未於 Settings (⚙️) 中設定 GEMINI_API_KEY 環境變數或 UI 金鑰欄位為空白。',
      });
    }

    if (!isValidFormat) {
      return res.json({
        success: false,
        keyPresent: true,
        source,
        message: '檢測到金鑰長度過短或格式不符，Google Gemini API 金鑰通常為 AIza... 或 AQ.... 開頭之字串。',
      });
    }

    const trimmed = apiKey.trim();
    const maskedKey = trimmed.length > 8
      ? `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
      : '****';

    const aiClient = getAiClient();
    if (!aiClient) {
      return res.json({
        success: false,
        keyPresent: true,
        source,
        maskedKey,
        message: 'GoogleGenAI 客戶端初始化失敗。',
      });
    }

    try {
      let testError: string | null = null;
      const callPromise = aiClient.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: '請用繁體中文回覆：「Gemini API 金鑰測試連線成功，臥龍軍師已準備就緒！」',
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('連線請求逾時 (6秒)')), 6000)
      );

      const result = await Promise.race([callPromise, timeoutPromise]).catch((e) => {
        testError = e.message || String(e);
        return null;
      });

      const responseText = result ? (result as any).text : null;

      if (responseText) {
        return res.json({
          success: true,
          keyPresent: true,
          source,
          maskedKey,
          responseText,
          message: `Gemini API 金鑰測試套用並連線成功！（來源：${source}）`,
        });
      } else {
        return res.json({
          success: false,
          keyPresent: true,
          source,
          maskedKey,
          error: testError,
          message: testError
            ? `Gemini API 連線測試反饋：${testError}`
            : 'Gemini API 請求超時或金鑰未具備有效配額，系統已自動啟用在地 Smart RAG 軍師備援引擎。',
        });
      }
    } catch (err: any) {
      console.error('Gemini Key Test Error:', err);
      return res.json({
        success: false,
        keyPresent: true,
        source,
        maskedKey,
        error: err.message || String(err),
        message: 'Gemini API 呼叫失敗：' + (err.message || String(err)),
      });
    }
  });

  // API 0.5: Admin Authentication & Invitation System (Google Sign-In Verified)
  app.get('/api/admin/status', (req, res) => {
    res.json({
      success: true,
      superAdmin: SUPER_ADMIN_EMAIL,
      totalAdmins: adminsStore.admins.length,
      pendingInvitesCount: adminsStore.invites.filter((i) => i.status === 'pending').length,
    });
  });

  app.post('/api/admin/verify-google', (req, res) => {
    try {
      const { email, name, picture, inviteCode } = req.body || {};
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          error: 'invalid_email',
          message: '請提供有效的 Google / Gmail 帳號資訊。',
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const isSuperAdmin = normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase();

      // Case 1: Root Super Admin (Creator)
      if (isSuperAdmin) {
        let adminUser = adminsStore.admins.find(
          (a) => a.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
        );
        if (!adminUser) {
          adminUser = {
            email: SUPER_ADMIN_EMAIL,
            role: 'super_admin',
            name: name || '系統建立者 (Creator)',
            picture,
            invitedBy: '系統創始',
            invitedAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            isCreator: true,
          };
          adminsStore.admins.unshift(adminUser);
        } else {
          adminUser.name = name || adminUser.name || '系統建立者 (Creator)';
          if (picture) adminUser.picture = picture;
          adminUser.lastLoginAt = new Date().toISOString();
          adminUser.isCreator = true;
          adminUser.role = 'super_admin';
        }
        saveAdminsToDisk();
        return res.json({
          success: true,
          authorized: true,
          role: 'super_admin',
          user: adminUser,
          superAdminEmail: SUPER_ADMIN_EMAIL,
          message: '歡迎最高管理員 (建立者) 登入！',
        });
      }

      // Case 2: Existing Active Admin in Whitelist
      const existingAdmin = adminsStore.admins.find(
        (a) => a.email.toLowerCase() === normalizedEmail
      );
      if (existingAdmin) {
        if (name) existingAdmin.name = name;
        if (picture) existingAdmin.picture = picture;
        existingAdmin.lastLoginAt = new Date().toISOString();
        saveAdminsToDisk();
        return res.json({
          success: true,
          authorized: true,
          role: existingAdmin.role,
          user: existingAdmin,
          superAdminEmail: SUPER_ADMIN_EMAIL,
          message: `歡迎管理員【${existingAdmin.name || normalizedEmail}】登入！`,
        });
      }

      // Case 3: Pending Invite Verification (by Email match or inviteCode)
      const matchingInviteIndex = adminsStore.invites.findIndex((inv) => {
        if (inv.status !== 'pending') return false;
        if (inv.email.toLowerCase() === normalizedEmail) return true;
        if (inviteCode && inv.inviteCode === inviteCode) return true;
        return false;
      });

      if (matchingInviteIndex !== -1) {
        const invite = adminsStore.invites[matchingInviteIndex];
        invite.status = 'accepted';
        invite.acceptedAt = new Date().toISOString();

        const newAdmin: AdminUser = {
          email: normalizedEmail,
          role: 'invited_admin',
          name: name || invite.note || normalizedEmail.split('@')[0],
          picture,
          invitedBy: invite.invitedBy,
          invitedAt: invite.invitedAt,
          lastLoginAt: new Date().toISOString(),
          isCreator: false,
        };

        adminsStore.admins.push(newAdmin);
        saveAdminsToDisk();

        return res.json({
          success: true,
          authorized: true,
          role: 'invited_admin',
          justAccepted: true,
          user: newAdmin,
          superAdminEmail: SUPER_ADMIN_EMAIL,
          message: `恭喜！已成功驗證管理員邀請，歡迎加入【${systemConfig.botName}】管理團隊！`,
        });
      }

      // Case 4: Unauthorized Email
      return res.status(403).json({
        success: false,
        authorized: false,
        error: 'unauthorized',
        email: normalizedEmail,
        superAdminEmail: SUPER_ADMIN_EMAIL,
        message: `⛔ 存取受限：Google 帳號 (${normalizedEmail}) 未在管理員邀請名單內。\n\n本系統管理員後台採嚴格邀請制，如需開通後台權限，請聯絡建立者 (${SUPER_ADMIN_EMAIL}) 寄送邀請郵件。`,
      });
    } catch (err: any) {
      console.error('Google Auth verification error:', err);
      return res.status(500).json({
        success: false,
        error: 'server_error',
        message: '驗證過程發生錯誤，請稍候重試。',
      });
    }
  });

  // API 0.6: List all admins and invites
  app.get('/api/admin/list', (req, res) => {
    res.json({
      success: true,
      superAdmin: SUPER_ADMIN_EMAIL,
      admins: adminsStore.admins,
      invites: adminsStore.invites,
    });
  });

  // API 0.7: Send / Create Admin Invitation
  app.post('/api/admin/invite', (req, res) => {
    try {
      const { email, note, senderEmail } = req.body || {};
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          message: '請輸入正確的受邀者 Gmail / Google 帳號地址。',
        });
      }

      const targetEmail = email.toLowerCase().trim();

      // Check if already an admin
      const isAlreadyAdmin = adminsStore.admins.some(
        (a) => a.email.toLowerCase() === targetEmail
      );
      if (isAlreadyAdmin) {
        return res.status(400).json({
          success: false,
          message: `帳號 ${targetEmail} 已經擁有管理員權限，無需重複邀請。`,
        });
      }

      // Check if there is already a pending invite
      const existingPending = adminsStore.invites.find(
        (i) => i.email.toLowerCase() === targetEmail && i.status === 'pending'
      );
      if (existingPending) {
        return res.json({
          success: true,
          invite: existingPending,
          message: `該帳號 (${targetEmail}) 已有待接受的有效邀請。`,
        });
      }

      const inviteCode = 'rxsg_inv_' + Math.random().toString(36).substring(2, 8) + Date.now().toString(36).substring(3);
      const newInvite: AdminInvite = {
        id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        email: targetEmail,
        role: 'invited_admin',
        invitedBy: senderEmail || SUPER_ADMIN_EMAIL,
        invitedAt: new Date().toISOString(),
        inviteCode,
        status: 'pending',
        note: note || '',
      };

      adminsStore.invites.unshift(newInvite);
      saveAdminsToDisk();

      res.json({
        success: true,
        invite: newInvite,
        message: `已成功建立發送至 ${targetEmail} 的管理員授權邀請！`,
      });
    } catch (err: any) {
      console.error('Invite error:', err);
      res.status(500).json({ success: false, message: '建立邀請失敗：' + err.message });
    }
  });

  // API 0.8: Remove Invited Admin
  app.delete('/api/admin/remove-admin/:email', (req, res) => {
    const targetEmail = decodeURIComponent(req.params.email || '').toLowerCase().trim();
    if (targetEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: '無法移除系統建立者 (Super Admin) 的管理權限。',
      });
    }

    const prevCount = adminsStore.admins.length;
    adminsStore.admins = adminsStore.admins.filter(
      (a) => a.email.toLowerCase() !== targetEmail
    );

    if (adminsStore.admins.length < prevCount) {
      saveAdminsToDisk();
      res.json({ success: true, message: `已成功撤銷 ${targetEmail} 的管理員權限。` });
    } else {
      res.status(404).json({ success: false, message: '找不到該管理員帳號。' });
    }
  });

  // API 0.9: Revoke Pending Invite
  app.delete('/api/admin/revoke-invite/:id', (req, res) => {
    const inviteId = req.params.id;
    const invite = adminsStore.invites.find((i) => i.id === inviteId);
    if (invite) {
      invite.status = 'revoked';
      saveAdminsToDisk();
      res.json({ success: true, message: '已撤回該邀請。' });
    } else {
      res.status(404).json({ success: false, message: '找不到該邀請紀錄。' });
    }
  });

  // API 1: Knowledge Base CRUD
  app.get('/api/knowledge-base', (req, res) => {
    const category = req.query.category as string;
    const search = req.query.search as string;

    let items = [...knowledgeBase];
    if (category && category !== 'all') {
      items = items.filter((item) => item.category === category);
    }
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(s) ||
          item.content.toLowerCase().includes(s) ||
          item.tags.some((t) => t.toLowerCase().includes(s))
      );
    }
    res.json({ success: true, items, total: items.length });
  });

  app.post('/api/knowledge-base', (req, res) => {
    const newItem: KnowledgeItem = {
      id: 'kb-' + Date.now(),
      title: req.body.title || '未命名文件',
      category: req.body.category || 'faq',
      subcategory: req.body.subcategory || '',
      tags: req.body.tags || [],
      content: req.body.content || '',
      updatedAt: new Date().toISOString().split('T')[0],
      verified: req.body.verified ?? true,
      version: req.body.version || 'v1.0',
    };
    knowledgeBase.unshift(newItem);
    saveKnowledgeBaseToDisk();
    res.json({ success: true, item: newItem });
  });

  app.put('/api/knowledge-base/:id', (req, res) => {
    const index = knowledgeBase.findIndex((item) => item.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: '找不到該文件' });
    }
    knowledgeBase[index] = {
      ...knowledgeBase[index],
      ...req.body,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    saveKnowledgeBaseToDisk();
    res.json({ success: true, item: knowledgeBase[index] });
  });

  app.delete('/api/knowledge-base/:id', (req, res) => {
    knowledgeBase = knowledgeBase.filter((item) => item.id !== req.params.id);
    saveKnowledgeBaseToDisk();
    res.json({ success: true, message: '刪除成功' });
  });

  app.post('/api/knowledge-base/bulk-upload', (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: '無效的資料格式' });
    }

    const added: KnowledgeItem[] = [];
    for (const item of items) {
      const formatted: KnowledgeItem = {
        id: item.id || ('kb-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)),
        title: item.title || '批次上傳攻略文件',
        category: (item.category as KnowledgeCategory) || 'generals',
        subcategory: item.subcategory || '上傳歸檔',
        tags: Array.isArray(item.tags) ? item.tags : ['官方攻略', '名將數值', '歸檔'],
        content: item.content || '',
        updatedAt: new Date().toISOString().split('T')[0],
        verified: true,
        version: item.version || 'v3.2',
      };
      knowledgeBase.unshift(formatted);
      added.push(formatted);
    }

    saveKnowledgeBaseToDisk();
    res.json({ success: true, count: added.length, items: added });
  });

  app.post('/api/knowledge-base/reset', (req, res) => {
    knowledgeBase = [...INITIAL_KNOWLEDGE_BASE];
    systemConfig = { ...DEFAULT_SYSTEM_CONFIG };
    saveKnowledgeBaseToDisk();
    saveConfigToDisk();
    res.json({ success: true, message: '重置為官方預設資料庫成功' });
  });

  // API 1.8: Download / Export Full Database Backup JSON
  app.get('/api/knowledge-base/export-backup', (req, res) => {
    const backupData = {
      version: 'v3.2',
      exportedAt: new Date().toISOString(),
      systemConfig,
      knowledgeBase,
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="three_kingdoms_kb_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.send(JSON.stringify(backupData, null, 2));
  });

  // API 1.9: Import Full Database Backup JSON
  app.post('/api/knowledge-base/import-backup', (req, res) => {
    try {
      const { backupData } = req.body;
      if (!backupData) {
        return res.status(400).json({ success: false, message: '無效的備份檔案內容' });
      }

      if (Array.isArray(backupData.knowledgeBase)) {
        knowledgeBase = backupData.knowledgeBase;
      } else if (Array.isArray(backupData)) {
        knowledgeBase = backupData;
      }

      if (backupData.systemConfig && typeof backupData.systemConfig === 'object') {
        systemConfig = { ...DEFAULT_SYSTEM_CONFIG, ...backupData.systemConfig };
        saveConfigToDisk();
      }

      saveKnowledgeBaseToDisk();
      return res.json({ success: true, count: knowledgeBase.length, message: `成功還原備份資料庫，共載入 ${knowledgeBase.length} 筆官方檔案條目！` });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: '匯入備份失敗：' + e.message });
    }
  });

  // API 1.5: Multimodal Document & File Analyzer (Word, PDF, Excel, Images, Text)
  app.post('/api/knowledge-base/analyze-file', async (req, res) => {
    try {
      const { fileName, fileType, mimeType, base64Data, textContent } = req.body;

      if (!base64Data && !textContent) {
        return res.status(400).json({ success: false, message: '請上傳有效檔案內容' });
      }

      const fileAnalysisSystemPrompt = `你是一位《熱血三國》遊戲官方知識庫資料解析與整理專家。
任務：玩家或營運團隊上傳了包含遊戲攻略、將領數值表、數據表格、圖表圖片或文件檔案（Word/PDF/Excel/圖片/文本）。
請徹底分析該檔案內容（包括圖片中的表格、文字、數據面板、名將勇武統率智謀、兵種攻防、科技說明，或文件內的章節表格）。

請整理並提煉出結構嚴密、條理清晰且邏輯連貫的《熱血三國》官方知識庫條目。
每個條目必須包含：
1. title: 簡明扼要且具標示性的標題（例如：「【名將圖鑑】關羽（蜀·勇武97/統率95）」、「【名將圖鑑】趙雲（蜀·勇武96/速度特化）」、「【城防攻堅】10級黃巾城攻破指南」）
2. category: 必須為 "buildings"（城池建築）、"troops"（12大兵種）、"tech"（科技研發）、"generals"（名將圖鑑）、"jewelry_titles"（珠寶爵位）、"mechanics"（刷黃戰術）、"tactics"（戰法陣型）、"lineups"（陣容配置）、"faq" 之一
3. subcategory: 次級分類名稱（如：蜀國名將、魏國名將、神將抓捕、戰略機制等）
4. tags: 陣列，至少3個精準關鍵字標籤（如：["關羽", "蜀國", "五虎上將", "名將數值"]）
5. content: 條理分明、層次清晰的 Markdown 格式詳細內文（包含完整數據表格、重點粗體）
6. version: 遊戲版本號（如 "v3.2"）

請以繁體中文 (Traditional Chinese) 回覆。
務必僅輸出標準 JSON 物件：
{
  "items": [
    {
      "title": "...",
      "category": "buildings" | "troops" | "tech" | "generals" | "jewelry_titles" | "mechanics" | "tactics" | "lineups" | "faq",
      "subcategory": "...",
      "tags": ["..."],
      "content": "...",
      "version": "v3.2"
    }
  ]
}`;

      let items: any[] = [];

      // Try Gemini analysis if client is ready
      const aiClient = getAiClient();
      if (aiClient) {
        try {
          const parts: any[] = [];
          let promptText = `【待分析檔案名稱】：${fileName || '上傳文件'}\n【檔案格式種類】：${fileType || '文件檔'}\n\n`;
          if (textContent) {
            promptText += `【檔案內提取的文本/表格數據】：\n${textContent.slice(0, 15000)}\n\n`;
          }
          promptText += `請分析上述檔案內容，將其重構與提煉為邏輯嚴密的名將與三國策略知識庫條目。`;
          parts.push({ text: promptText });

          if (base64Data && mimeType) {
            const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
            parts.push({
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64,
              },
            });
          }

          const responseText = await callGeminiSafe([{ role: 'user', parts }], {
            systemInstruction: fileAnalysisSystemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.2,
            timeoutMs: 8000,
          });

          if (responseText) {
            const parsed = JSON.parse(responseText);
            if (Array.isArray(parsed.items) && parsed.items.length > 0) {
              items = parsed.items;
            } else if (Array.isArray(parsed) && parsed.length > 0) {
              items = parsed;
            }
          }
        } catch (genAiErr: any) {
          console.warn('File analysis Gemini API call failed, using local table parser:', genAiErr.message || genAiErr);
        }
      }

      // Intelligent Local Fallback Parser if Gemini didn't return items
      if (items.length === 0 && textContent) {
        items = parseGeneralTableFallback(textContent, fileName);
      }

      return res.json({ success: true, fileName, count: items.length, items });
    } catch (err: any) {
      console.error('File analysis error:', err);
      return res.status(500).json({ success: false, message: '檔案解析失敗：' + err.message });
    }
  });

  // Helper: Convert HTML table into Clean Markdown Table
  function convertHtmlTablesToMarkdown(html: string): string {
    return html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
      const rows: string[][] = [];
      const rowMatches = tableContent.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
      for (const rowMatch of rowMatches) {
        const rowInner = rowMatch[1];
        const cellMatches = rowInner.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi);
        const cells: string[] = [];
        for (const cellMatch of cellMatches) {
          const cellText = cellMatch[1]
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .replace(/\|/g, '\\|')
            .trim();
          cells.push(cellText);
        }
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length === 0) return '';
      let mdTable = '\n\n';
      const header = rows[0];
      mdTable += '| ' + header.join(' | ') + ' |\n';
      mdTable += '| ' + header.map(() => '---').join(' | ') + ' |\n';
      for (let i = 1; i < rows.length; i++) {
        mdTable += '| ' + rows[i].join(' | ') + ' |\n';
      }
      mdTable += '\n\n';
      return mdTable;
    });
  }

  // Helper: Clean raw HTML to Structured Markdown with Noise Filtering
  function convertHtmlToCleanMarkdown(rawHtml: string): string {
    let clean = convertHtmlTablesToMarkdown(rawHtml);

    // Strip noise and metadata classes
    clean = clean
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<span\b[^>]*class=["'][^"']*(?:step|index|badge|num)[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<span\b[^>]*>\s*\d+\s*<\/span>/gi, '')
      .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
      .replace(/<p\b[^>]*class=["'][^"']*kicker[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi, '\n**【$1】**\n')
      .replace(/<p\b[^>]*class=["'][^"']*intro[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi, '\n> $1\n')
      .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
      .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n* $1')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    const lines = clean
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return lines.join('\n\n');
  }

  // Deduce Knowledge Category from text
  function deduceCategoryFromText(title: string, content: string): KnowledgeCategory {
    const combined = (title + ' ' + content).toLowerCase();
    if (combined.includes('開局') || combined.includes('新手') || combined.includes('起步') || combined.includes('七天') || combined.includes('七日')) {
      return 'mechanics';
    }
    if (combined.includes('科技') || combined.includes('太學') || combined.includes('拋射') || combined.includes('統禦') || combined.includes('陣法研發') || combined.includes('聯盟科技')) {
      return 'tech';
    }
    if (combined.includes('名將') || combined.includes('武將') || combined.includes('勇武') || combined.includes('統率') || combined.includes('智謀')) {
      return 'generals';
    }
    if (combined.includes('兵種') || combined.includes('鐵騎') || combined.includes('弓兵') || combined.includes('步兵') || combined.includes('衝車') || combined.includes('投石')) {
      return 'troops';
    }
    if (combined.includes('城池') || combined.includes('官府') || combined.includes('農田') || combined.includes('建築') || combined.includes('城防') || combined.includes('烽火台')) {
      return 'buildings';
    }
    if (combined.includes('爵位') || combined.includes('珠寶') || combined.includes('夜明珠') || combined.includes('珍珠') || combined.includes('翡翠')) {
      return 'jewelry_titles';
    }
    if (combined.includes('戰法') || combined.includes('陣型') || combined.includes('克制') || combined.includes('計謀')) {
      return 'tactics';
    }
    if (combined.includes('陣容') || combined.includes('配隊') || combined.includes('主力軍')) {
      return 'lineups';
    }
    return 'mechanics';
  }

  // API 1.5: High-Precision Web Page Scraper & Knowledge Extractor
  app.post('/api/scrape-url', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return res.status(400).json({ success: false, message: '請提供有效的網頁 URL (以 http:// 或 https:// 開頭)' });
      }

      // Fetch webpage content with timeout and standard browser headers
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const fetchRes = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      clearTimeout(timeoutId);

      if (!fetchRes.ok) {
        return res.status(fetchRes.status).json({ success: false, message: `無法連線至目標網址 (HTTP ${fetchRes.status})` });
      }

      const html = await fetchRes.text();

      // Extract metadata from <title> and OpenGraph / Meta tags
      let pageTitle = '';
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogTitleMatch && ogTitleMatch[1]) {
        pageTitle = ogTitleMatch[1].trim();
      } else {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          pageTitle = titleMatch[1].replace(/[-|_].*$/, '').trim();
        }
      }

      // Target Content Area Extraction (Prioritizing main article containers)
      let articleHtml = '';
      const articleTagMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
      if (articleTagMatch && articleTagMatch[1] && articleTagMatch[1].length > 50) {
        articleHtml = articleTagMatch[1];
      } else {
        const mainTagMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
        if (mainTagMatch && mainTagMatch[1] && mainTagMatch[1].length > 50) {
          articleHtml = mainTagMatch[1];
        } else {
          // Check for common guide / post content class wrappers
          const contentClassMatch = html.match(/<div\b[^>]*(?:class|id)=["'][^"']*(?:guide-article|post-content|article-content|entry-content|rich-content|markdown-body|detail-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
          if (contentClassMatch && contentClassMatch[1] && contentClassMatch[1].length > 50) {
            articleHtml = contentClassMatch[1];
          }
        }
      }

      // Fallback: If no dedicated article container found, aggressively strip global noise tags
      if (!articleHtml) {
        articleHtml = html
          .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
          .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
          .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
          .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
          .replace(/<div\b[^>]*(?:class|id)=["'][^"']*(?:sidebar|subfooter|legal-footer|rating-notice|comments|advertisement|ads|related|share|breadcrumb|menu)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
      }

      // Extract kicker / category hint from inside the target article
      let kickerTag = '';
      const kickerMatch = articleHtml.match(/<p\b[^>]*class=["'][^"']*kicker[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
      if (kickerMatch && kickerMatch[1]) {
        kickerTag = kickerMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Clean HTML to Markdown
      const cleanMarkdownText = convertHtmlToCleanMarkdown(articleHtml);

      if (!cleanMarkdownText || cleanMarkdownText.length < 20) {
        return res.status(400).json({ success: false, message: '未能自該網頁擷取出足夠的攻略正文，請確認網址是否需要登入或為純動態 JS 渲染。' });
      }

      // Step 2: Try Gemini AI Deep Precision Extraction if available
      const aiClient = getAiClient();
      let aiExtractedItem: KnowledgeItem | null = null;

      if (aiClient) {
        try {
          const aiExtractPrompt = `你是一位《熱血三國》與 SLG 策略手遊「官方攻略知識庫精準萃取專家」。
任務：玩家提供了自線上網頁抓取之正文內容。
請深入分析這篇攻略，【僅提取該頁面的主要攻略核心正文】（如開局任務、發展順序、資源分配、兵種與名將養成要點、攻防數據表格等）。
【嚴格規則】：
1. 務必徹底剔除任何全站導航選單、無關名將大表、推薦連結、廣告、贊助或版權宣告。
2. 提煉出排版精美、層次清晰且重點粗體的繁體中文 Markdown 官方攻略格式。
3. 輸出規範的 JSON 物件：
{
  "title": "簡潔明瞭的攻略標題（例如：【新手入門】開局七日：從一座孤城到萬人雄師）",
  "category": "buildings" | "troops" | "tech" | "generals" | "jewelry_titles" | "mechanics" | "tactics" | "lineups" | "faq",
  "subcategory": "次分類（例如：新手指南、開局發展、聯盟戰略、城防建設等）",
  "tags": ["3~6個精確標籤，例如：開局七天, 新手入門, 資源循環, 軍團戰"],
  "content": "完整的 Markdown 官方攻略正文（包含導言、各階段標題、要點與數值表格）",
  "version": "v3.2"
}`;

          const userText = `【目標網址】：${url}\n【網頁標題】：${pageTitle}\n【分類提示】：${kickerTag || '攻略指南'}\n\n【網頁純文字與表格數據】：\n${cleanMarkdownText.slice(0, 15000)}`;

          const responseText = await callGeminiSafe(userText, {
            systemInstruction: aiExtractPrompt,
            responseMimeType: 'application/json',
            temperature: 0.2,
            timeoutMs: 8000,
          });

          if (responseText) {
            const parsed = JSON.parse(responseText);
            if (parsed && parsed.title && parsed.content) {
              aiExtractedItem = {
                id: 'kb-url-' + Date.now(),
                title: parsed.title,
                category: (parsed.category as KnowledgeCategory) || deduceCategoryFromText(parsed.title, parsed.content),
                subcategory: parsed.subcategory || kickerTag || '網頁攻略',
                tags: Array.isArray(parsed.tags) ? parsed.tags : ['官方攻略', '熱血三國', '網頁抓取'],
                content: parsed.content,
                updatedAt: new Date().toISOString().split('T')[0],
                verified: true,
                version: parsed.version || 'v3.2',
              };
            }
          }
        } catch (genErr) {
          console.warn('Gemini URL extraction warning (falling back to deterministic parser):', genErr);
        }
      }

      // Step 3: Deterministic Fallback Item if Gemini was offline or bypassed
      const detectedCategory = deduceCategoryFromText(pageTitle, cleanMarkdownText);
      const cleanTitle = kickerTag
        ? `【${kickerTag}】${pageTitle.replace(/【.*?】/g, '')}`
        : (pageTitle.startsWith('【') ? pageTitle : `【官方攻略】${pageTitle}`);

      const fallbackItem: KnowledgeItem = {
        id: 'kb-url-' + Date.now(),
        title: cleanTitle,
        category: detectedCategory,
        subcategory: kickerTag || '官方攻略指南',
        tags: [
          kickerTag || '新手入門',
          '官方攻略',
          '熱血三國',
          ...cleanTitle.replace(/[【】|:：]/g, ' ').split(/\s+/).filter((t) => t.length >= 2),
        ].slice(0, 5),
        content: `## 📜 ${cleanTitle}\n\n${cleanMarkdownText}`,
        updatedAt: new Date().toISOString().split('T')[0],
        verified: true,
        version: 'v3.2',
      };

      const finalItem = aiExtractedItem || fallbackItem;

      return res.json({
        success: true,
        url,
        pageTitle: pageTitle || finalItem.title,
        extractedText: cleanMarkdownText,
        item: finalItem,
        isAiExtracted: !!aiExtractedItem,
      });
    } catch (err: any) {
      console.error('URL scrape error:', err);
      return res.status(500).json({ success: false, message: '網址內容擷取失敗：' + (err.message || '連線逾時或遭對方網站防護阻擋') });
    }
  });

  // API 2: System Config GET & POST
  app.get('/api/config', (req, res) => {
    const keyInfo = getEffectiveApiKey();
    res.json({
      success: true,
      config: systemConfig,
      keyStatus: {
        hasKey: !!keyInfo.apiKey,
        source: keyInfo.source,
        maskedKey: keyInfo.apiKey ? `${keyInfo.apiKey.slice(0, 6)}...${keyInfo.apiKey.slice(-4)}` : null,
      },
    });
  });

  app.post('/api/config', (req, res) => {
    systemConfig = {
      ...systemConfig,
      ...req.body,
    };
    saveConfigToDisk();
    res.json({ success: true, config: systemConfig });
  });

  // API 2.5: Test Gemini API Key connectivity & diagnostics
  app.get('/api/test-gemini-key', async (req, res) => {
    const keyInfo = getEffectiveApiKey();
    if (!keyInfo.apiKey) {
      return res.json({
        success: false,
        keyPresent: false,
        source: keyInfo.source,
        message: '尚未在系統環境變數或自訂設定中偵測到有效的 Gemini API Key。',
        error: '請確認在 AI Studio 左側/上方 Settings (齒輪) -> Secrets / Environment Variables 中，變數名稱為「GEMINI_API_KEY」，值為「AIza...」；或者直接在下方的自訂欄位中填入。',
      });
    }

    try {
      const aiClient = getAiClient();
      if (!aiClient) {
        return res.json({
          success: false,
          keyPresent: true,
          source: keyInfo.source,
          maskedKey: `${keyInfo.apiKey.slice(0, 6)}...${keyInfo.apiKey.slice(-4)}`,
          message: '無法初始化 Google GenAI 用戶端。',
        });
      }

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: '請以三國軍師口吻回覆五個字：「軍師已就緒」',
        config: {
          maxOutputTokens: 30,
          temperature: 0.1,
        },
      });

      const responseText = response.text || '連線正常';

      return res.json({
        success: true,
        keyPresent: true,
        source: keyInfo.source,
        maskedKey: `${keyInfo.apiKey.slice(0, 6)}...${keyInfo.apiKey.slice(-4)}`,
        message: `成功連線至 Google Gemini 模型！`,
        responseText: responseText.trim(),
      });
    } catch (err: any) {
      return res.json({
        success: false,
        keyPresent: true,
        source: keyInfo.source,
        maskedKey: `${keyInfo.apiKey.slice(0, 6)}...${keyInfo.apiKey.slice(-4)}`,
        message: '呼叫 Google Gemini API 失敗。',
        error: err.message || String(err),
      });
    }
  });

  // API 3: Core AI Strategist RAG Query Chat
  app.post('/api/chat', async (req, res) => {
    const startTime = Date.now();
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, message: '請提供提問內容' });
      }

      // Check strict non-game guardrail
      if (systemConfig.strictnessLevel === 'strict' && isNonGameQuery(message)) {
        return res.json({
          success: true,
          text: systemConfig.refusalMessage,
          retrievedDocs: [],
          refused: true,
          executionTimeMs: Date.now() - startTime,
          modelUsed: 'guardrail-interceptor',
        });
      }

      // Perform RAG Retrieval
      const retrieved = retrieveRelevantDocs(message, 3);
      const docsContext = retrieved.length > 0
        ? retrieved
            .map(
              (r, idx) =>
                `【參考文獻 ${idx + 1}】《${r.title}》（分類：${r.category}）\n${r.fullContent}`
            )
            .join('\n\n')
        : '（資料庫中未匹配到相關主題，請根據官方已知規則回答，若無紀錄請禮貌說明並拒絕過度發揮）';

      // Build Prompt with System Instruction and Grounding Context
      const promptText = `【系統指令】：
${systemConfig.systemInstruction}

【預設拒絕回復文本】：
${systemConfig.refusalMessage}

【檢索得到的官方遊戲資料庫文獻】：
${docsContext}

【玩家提問】：
${message}

【精確回答規範（最高準則）】：
1. 【單一目標精確提煉】：若參考文獻包含多名將列表、總表或數據表格，當玩家詢問特定武將（例如「孔秀」、「關羽」）、特定兵種、科技或建築時，你【嚴禁將整份表格或無關名冊全部輸出】！你必須【僅提取該目標對象】（如孔秀）的數值與資訊。
2. 【數值結構化與軍師點評】：將該目標之勇武、智謀、統率、內政等各項屬性整理為清晰的小表格或重點列表，並以三國臥龍軍師口吻附上 1~2 點戰略定位與培養加點建議。
3. 【查無紀錄】：若官方資料庫表格中完全無該名將或內容，請明確說明「官方名將資料庫中目前未有此武將紀錄」，絕不可捏造或輸出整份名冊。
4. 【無關提問】：若提問完全與遊戲無關或超出官方攻略，請直接輸出預設拒絕文本。`;

      let responseText: string | null = null;
      const aiClient = getAiClient();

      if (aiClient) {
        responseText = await callGeminiSafe(promptText, {
          temperature: systemConfig.temperature || 0.3,
          timeoutMs: 6000,
        });
      }

      const isAi = !!responseText;
      if (!responseText) {
        responseText = generateFallbackRagResponse(retrieved, message);
      }

      const isRefused = responseText.includes('拒絕') || responseText.includes('無法為您解答') || responseText.includes(systemConfig.refusalMessage.slice(0, 15));

      return res.json({
        success: true,
        text: responseText,
        retrievedDocs: retrieved.map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          score: r.score,
          contentSnippet: r.contentSnippet,
        })),
        refused: isRefused,
        executionTimeMs: Date.now() - startTime,
        modelUsed: isAi ? 'gemini-3.6-flash' : 'local-smart-rag-engine',
      });
    } catch (err: any) {
      console.error('Chat error:', err);
      return res.status(500).json({
        success: false,
        message: 'AI 軍師處理失敗：' + (err.message || '請稍候重試'),
      });
    }
  });

  // API 4: Siege Plan Evaluator (破防攻城規劃器後端)
  app.post('/api/evaluate-siege-plan', async (req, res) => {
    try {
      const { cityDefense, waves } = req.body as {
        cityDefense: CityDefenseConfig;
        waves: SiegePlanWave[];
      };

      if (!cityDefense || !waves || waves.length === 0) {
        return res.status(400).json({ success: false, message: '請提供目標城池與進攻波次資訊' });
      }

      let totalFodder = 0;
      let totalCatapults = 0;
      let totalRams = 0;
      let totalHeavyCav = 0;
      let totalArchers = 0;

      waves.forEach((w) => {
        totalFodder += (w.troops.militia || 0) + (w.troops.porter || 0);
        totalCatapults += w.troops.catapult || 0;
        totalRams += w.troops.ram || 0;
        totalHeavyCav += w.troops.heavyCavalry || 0;
        totalArchers += w.troops.archer || 0;
      });

      const trapNeed = (cityDefense.traps || 0) + (cityDefense.abatis || 0);
      const trapCleared = totalFodder >= trapNeed;
      const wallDurability = cityDefense.wallDurability || 100000;
      const ramsNeeded = Math.ceil(wallDurability / 400);

      const siegeAnalysisPrompt = `你是一位精通《熱血三國》經典頁遊與手遊攻城機制的頂級大軍師。
請對玩家制定的攻城破防部署進行深度推演。

【目標城池情報】：
- 城池：${cityDefense.cityName}（城牆等級: ${cityDefense.wallLevel}級，耐久度: ${cityDefense.wallDurability}）
- 陷阱: ${cityDefense.traps}，拒馬: ${cityDefense.abatis}，箭塔: ${cityDefense.arrowTowers}，滾木: ${cityDefense.rollingLogs}，檑石: ${cityDefense.catapultStones}
- 守將數值：勇武 ${cityDefense.generalValour}，統率 ${cityDefense.generalLeadership}

【進攻波次部署】：
${waves.map((w) => `第${w.waveNumber}波 [${w.waveName}] (目的:${w.purpose}, 主將勇武:${w.commanderValour}, 拋射:${w.throwingTech}級): ${JSON.stringify(w.troops)}`).join('\n')}

請輸出嚴格 JSON 格式：
{
  "score": 85,
  "strengths": ["戰術亮點1", "戰術亮點2"],
  "weaknesses": ["潛在破綻1", "潛在破綻2"],
  "suggestions": ["微操建議1", "微操建議2"],
  "analysis": "以軍師口吻深入解析破防、拔塔、破門與洗民心抓將之全流程戰況推演..."
}`;

      let parsed: any = null;
      const aiClient = getAiClient();

      if (aiClient) {
        const responseText = await callGeminiSafe(siegeAnalysisPrompt, {
          responseMimeType: 'application/json',
          temperature: 0.2,
          timeoutMs: 6000,
        });

        if (responseText) {
          try {
            parsed = JSON.parse(responseText);
          } catch (e) {
            // ignore
          }
        }
      }

      if (!parsed) {
        // High quality deterministic fallback calculation
        const score = Math.min(
          98,
          Math.max(
            50,
            (trapCleared ? 35 : Math.round((totalFodder / Math.max(1, trapNeed)) * 30)) +
              (totalCatapults >= 1000 ? 30 : Math.round((totalCatapults / 1000) * 25)) +
              (totalRams >= ramsNeeded ? 25 : Math.round((totalRams / Math.max(1, ramsNeeded)) * 20)) +
              (waves.length >= 3 ? 10 : 5)
          )
        );

        parsed = {
          score,
          strengths: [
            trapCleared
              ? `✅ 第1波填坑砲灰總數 (${totalFodder}) 足以完全抵銷城池陷阱與拒馬 (${trapNeed})，確保後續主力零陷阱傷亡。`
              : `⚠️ 填坑砲灰數量 (${totalFodder}) 尚不足以完全消耗陷阱拒馬 (${trapNeed})，主力進場可能受創。`,
            totalCatapults > 0
              ? `✅ 配備投石車 (${totalCatapults}輛) 配合高等拋射科技，能在箭塔射程外安全拔除遠程防禦。`
              : '⚠️ 缺乏遠程投石車拔塔部隊，主力進攻將承受箭塔連續齊射。',
            totalRams >= ramsNeeded
              ? `✅ 衝車數量 (${totalRams}輛) 足夠迅速擊碎城牆 ${wallDurability.toLocaleString()} 耐久度。`
              : `⚠️ 衝車數量 (${totalRams}) 面對城牆耐久度需耗費多回合，建議增補至 ${ramsNeeded} 輛。`,
          ],
          weaknesses: [
            waves.length < 4 ? '未編排第4波連續行軍壓制民心隊，攻陷後若民心回升可能錯失名將俘虜時機。' : '需精確計算各波次行軍抵達秒數，避免主力超前於填坑隊進場。',
          ],
          suggestions: [
            '【行軍微操】：填坑隊出發後，透過校場加速卡或驛站計算，確保各波次以 1~2 秒間隔依序抵達。',
            '【佔領抓將】：城門攻破後，立即以 1000 輕騎兵連續每 15 分鐘洗城一次，將民心壓制至 0 即可招降名將！',
          ],
          analysis: `主公親率大軍攻打【${cityDefense.cityName}】。\n當前部署 ${waves.length} 波梯隊：${
            trapCleared
              ? '先鋒部隊順利踩平敵城陷阱與拒馬，為大軍掃清障礙。'
              : '先鋒填坑兵力略顯吃緊，建議補足義兵後再行攻伐。'
          }\n投石車隊遠程火力壓制箭塔後，${totalRams} 輛衝車直接撞擊耐久 ${wallDurability.toLocaleString()} 的城門，主力鐵騎與弓手隨後入城殲滅守將部隊。破城後請務必銜接第4波輕騎兵壓制民心，方可順利收服城內良將！`,
        };
      }

      return res.json({
        success: true,
        evaluation: parsed,
        isAiPowered: !!aiClient,
      });
    } catch (err: any) {
      console.error('Siege plan evaluation error:', err);
      return res.status(500).json({ success: false, message: '攻城戰術試算失敗：' + err.message });
    }
  });

  // API 5: Discord Webhook & External API Endpoint (Public query spec)
  app.post('/api/v1/query', async (req, res) => {
    try {
      const { query, user } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'Missing query parameter' });
      }

      if (systemConfig.strictnessLevel === 'strict' && isNonGameQuery(query)) {
        return res.json({
          response: systemConfig.refusalMessage,
          refused: true,
          embed: {
            title: `【${systemConfig.botName}】系統告示`,
            description: systemConfig.refusalMessage,
            color: 15158332, // Red
            footer: { text: '《熱血三國》官方 AI 領域防護Guardrail' },
          },
        });
      }

      const retrieved = retrieveRelevantDocs(query, 3);
      const docsContext = retrieved
        .map((r, idx) => `[${idx + 1}] 《${r.title}》:\n${r.fullContent}`)
        .join('\n\n');

      let responseText: string | null = null;
      const aiClient = getAiClient();

      if (aiClient) {
        const prompt = `系統指令：你是《熱血三國》官方 Discord 攻略軍師【${systemConfig.botName}】。
請解答玩家提問：${query}

參考官方資料庫：
${docsContext}

請簡明扼要、條理清晰地回覆。格式適合 Discord 社群閱讀（可適度使用粗體與清單）。`;

        responseText = await callGeminiSafe(prompt, {
          temperature: 0.3,
          timeoutMs: 5000,
        });
      }

      if (!responseText) {
        responseText = generateFallbackRagResponse(retrieved, query);
      }

      return res.json({
        response: responseText,
        refused: false,
        embed: {
          title: `⚔️【${systemConfig.botName}】官方攻略解析`,
          description: responseText,
          color: 3447003, // Blue/Gold
          fields: retrieved.map((r) => ({
            name: `📜 參考文獻：${r.title}`,
            value: `分類: ${r.category} | 相關度: ${Math.round(r.score * 100)}%`,
            inline: true,
          })),
          footer: { text: `《熱血三國》官方 AI 資料庫 | 請求者: ${user || 'Discord 玩家'}` },
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'API Error', message: err.message });
    }
  });

  // Vite Middleware handling for development & static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
