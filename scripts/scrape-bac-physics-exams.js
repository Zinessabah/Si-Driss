import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'https://moutamadris.ma/';
const OUTPUT_DIR = path.join(ROOT, 'docs', 'programme', 'PC');
const REQUEST_DELAY_MS = Number(process.env.SCRAPER_DELAY_MS ?? 1000);
const MAX_PDF_BYTES = 60 * 1024 * 1024;
const USER_AGENT = 'SiDrissExamDocuments/1.0 (+https://github.com/Zinessabah/Si-Driss)';
const SESSION_NAMES = {
  SN: 'session normale',
  SR: 'session rattrapage',
};

class SourceBlockedError extends Error {}

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return decodeHtml(value)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function readAttribute(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3]) : '';
}

function findYear(value) {
  const match = value.match(/(?<!\d)(20(?:08|09|1\d|2[0-5]))(?!\d)/);
  return match ? Number(match[1]) : null;
}

function findSession(value) {
  const text = normalize(value);
  const retake = /rattrap|session\s+(?:de\s+)?rattrapage|(?:^|[^a-z])sr(?:$|[^a-z])|الاستدراك|استدراكي/.test(text);
  const normal = /session\s+normale|normale|(?:^|[^a-z])sn(?:$|[^a-z])|العادية/.test(text);
  if (retake === normal) return null;
  return retake ? 'SR' : 'SN';
}

function getExamIdentity(filename) {
  const year = findYear(filename);
  const session = findSession(filename);
  return year && session ? `${year}-${session}` : null;
}

async function listPdfFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listPdfFiles(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      files.push(entryPath);
    }
  }
  return files;
}

let lastRequestAt = 0;

async function fetchResponse(url) {
  const wait = REQUEST_DELAY_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30000),
      redirect: 'follow',
    });
  } catch (error) {
    throw new Error(`Impossible de joindre ${url}: ${error.message}`);
  }
  lastRequestAt = Date.now();

  if (response.status === 403 || response.status === 429) {
    throw new SourceBlockedError(
      `Le site a refusé la requête (${response.status}) pour ${url}. ` +
      'Le scraper s’arrête sans contourner la protection du site.',
    );
  }
  return response;
}

async function fetchHtml(url) {
  const response = await fetchResponse(url);
  if (!response.ok) {
    throw new Error(`Échec HTTP ${response.status} lors de la lecture de ${url}`);
  }
  const html = await response.text();
  if (/you have been blocked|attention required|cf-error-details/i.test(html)) {
    throw new SourceBlockedError(
      `Cloudflare bloque l’accès à ${url}. Le scraper s’arrête sans contourner la protection du site.`,
    );
  }
  return html;
}

function internalLinks(html, baseUrl) {
  const links = new Map();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const href = readAttribute(match[1], 'href');
    const label = stripTags(match[2]);
    if (!href) continue;

    let url;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (url.hostname !== new URL(SOURCE).hostname || !/^https?:$/.test(url.protocol)) continue;
    if (/\.(?:pdf)(?:$|[?#])/i.test(url.href)) continue;
    if (url.searchParams.has('s') || /\/(?:category|tag|author|page)\/|\/page\/\d+/i.test(url.pathname)) continue;
    const searchable = normalize(`${url.pathname} ${label}`);
    const subject = /(?:physique|chimie|فيزياء|كيمياء|علوم.?فيزيائية|(?:^|[^a-z])pc(?:$|[^a-z]))/i.test(searchable);
    const exam = /(?:examen|national|sujet|annale|وطني|امتحان|الامتحان|موضوع|دورة|session)/i.test(searchable);
    const bacWithYear = /(?:bac|baccalaureat)/i.test(searchable) && findYear(searchable);
    if (!subject || (!exam && !bacWithYear)) continue;
    if (links.size < 15) links.set(url.href, label);
  }
  return [...links].map(([url, label]) => ({ url, label }));
}

function pdfReferences(html, pageUrl) {
  const references = [];
  const attributePattern = /\b(?:href|src|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

  for (const match of html.matchAll(attributePattern)) {
    const rawUrl = decodeHtml(match[1] ?? match[2] ?? match[3] ?? '');
    if (!rawUrl) continue;

    let url;
    try {
      url = new URL(rawUrl, pageUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;

    if (url.hostname === 'drive.google.com') {
      const driveId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1];
      if (driveId) url = new URL(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`);
    } else if (!/\.pdf(?:$|[?#])/i.test(url.href)) {
      continue;
    }

    const context = stripTags(html.slice(Math.max(0, match.index - 300), match.index + match[0].length + 300));
    references.push({ url: url.href, context });
  }
  return references;
}

function searchUrl(query) {
  const url = new URL(SOURCE);
  url.searchParams.set('s', query);
  return url.href;
}

async function findExamPages(year) {
  const queries = [
    `examen national physique chimie bac PC ${year}`,
    `الامتحان الوطني الفيزياء والكيمياء علوم فيزيائية ${year}`,
  ];
  const pages = new Map();
  for (const query of queries) {
    const html = await fetchHtml(searchUrl(query));
    for (const page of internalLinks(html, SOURCE)) {
      pages.set(page.url, page.label);
    }
  }
  return [...pages].slice(0, 15).map(([url, label]) => ({ url, label }));
}

function chooseCandidate(html, pageUrl, pageLabel, year) {
  const title = stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const heading = stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const pageContext = `${pageLabel} ${title} ${heading}`;
  const pageYear = findYear(pageContext);
  if (pageYear && pageYear !== year) return null;

  const references = pdfReferences(html, pageUrl);
  for (const reference of references) {
    const context = `${reference.context} ${reference.url}`;
    const referenceName = path.posix.basename(new URL(reference.url).pathname);
    const referenceYear = findYear(referenceName) ?? findYear(reference.context);
    if (referenceYear && pageYear && referenceYear !== pageYear) continue;
    const documentYear = referenceYear ?? pageYear;
    const session = findSession(context) ?? findSession(pageContext);
    if (documentYear === year && session) return { year, session, url: reference.url };
  }
  return null;
}

function safeSourceName(url, year, session) {
  const pathname = new URL(url).pathname;
  let basename = decodeURIComponent(path.posix.basename(pathname))
    .replace(/\.pdf$/i, '')
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (!/[a-z]/i.test(basename)) basename = '';
  return `${year}_${session}_PC${basename ? `_${basename}` : ''}.pdf`;
}

async function downloadPdf(url, destination) {
  const response = await fetchResponse(url);
  if (!response.ok) {
    throw new Error(`Échec HTTP ${response.status} lors du téléchargement de ${url}`);
  }

  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_PDF_BYTES) {
    throw new Error(`PDF trop volumineux (${declaredSize} octets): ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_PDF_BYTES) {
    throw new Error(`PDF trop volumineux (${bytes.length} octets): ${url}`);
  }
  if (bytes.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error(`La réponse n’est pas un PDF valide: ${url}`);
  }

  const temporaryPath = `${destination}.${process.pid}.${randomUUID()}.part`;
  try {
    await writeFile(temporaryPath, bytes, { flag: 'wx' });
    await rename(temporaryPath, destination);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function parseArgs(args) {
  const options = { startYear: 2008, endYear: 2025 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/scrape-bac-physics-exams.js [--start-year 2008] [--end-year 2025]');
      process.exit(0);
    }
    if (arg === '--start-year' || arg === '--end-year') {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value)) throw new Error(`Année invalide après ${arg}`);
      options[arg === '--start-year' ? 'startYear' : 'endYear'] = value;
      index += 1;
      continue;
    }
    throw new Error(`Option inconnue: ${arg}`);
  }
  if (options.startYear < 2000 || options.endYear > 2099 || options.startYear > options.endYear) {
    throw new Error('La plage d’années est invalide.');
  }
  return options;
}

async function main() {
  const { startYear, endYear } = parseArgs(process.argv.slice(2));
  const existing = new Set(
    (await listPdfFiles(OUTPUT_DIR))
      .map((file) => getExamIdentity(path.basename(file)))
      .filter(Boolean),
  );
  const found = new Map();

  for (let year = startYear; year <= endYear; year += 1) {
    console.log(`Recherche des examens PC ${year}...`);
    const pages = await findExamPages(year);
    console.log(`  Pages candidates : ${pages.length}`);
    for (const { url, label } of pages) {
      const html = await fetchHtml(url);
      const candidate = chooseCandidate(html, url, label, year);
      if (candidate && !found.has(`${year}-${candidate.session}`)) {
        found.set(`${year}-${candidate.session}`, candidate);
      }
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  for (let year = startYear; year <= endYear; year += 1) {
    for (const session of ['SN', 'SR']) {
      const key = `${year}-${session}`;
      if (existing.has(key)) {
        console.log(`${year} ${SESSION_NAMES[session]}: déjà présent, inchangé.`);
        continue;
      }
      const candidate = found.get(key);
      if (!candidate) continue;

      const destination = path.join(OUTPUT_DIR, safeSourceName(candidate.url, year, session));
      await downloadPdf(candidate.url, destination);
      existing.add(key);
      console.log(`${year} ${SESSION_NAMES[session]}: téléchargé dans ${path.relative(ROOT, destination)}`);
    }
  }

  const missing = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (const session of ['SN', 'SR']) {
      if (!existing.has(`${year}-${session}`)) missing.push(`${year} ${SESSION_NAMES[session]}`);
    }
  }

  if (missing.length) {
    console.error(`Examens non trouvés (${missing.length}): ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Tous les examens demandés sont présents pour ${startYear}-${endYear}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
