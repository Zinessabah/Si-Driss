import fs from 'fs';
import {
  extractScannedOfficialWithConfig,
  findPendingScannedPdfs,
  resolveVisionOcrConfig,
} from '../scannedPdfGuard';
import { hasReadablePdfText, upsertCachedDoc } from '../rag';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const onlyExamens = process.argv.includes('--examens');
  const scannedPdfs = findPendingScannedPdfs(onlyExamens ? 'examens' : undefined);

  console.log(`📚 PDF scannés sans texte lisible détectés : ${scannedPdfs.length}`);
  for (const doc of scannedPdfs) {
    console.log(`  - ${doc.relativePath}`);
  }

  if (scannedPdfs.length === 0) {
    console.log('✅ Tous les PDF ciblés ont déjà une transcription lisible.');
    return;
  }

  const engine = resolveVisionOcrConfig(undefined, { allowServerFallback: true });
  if (!engine) {
    console.error('\n❌ Aucune clé Vision trouvée dans les variables d’environnement.');
    console.error('Exemples pour lancer la pré-transcription des PDF scannés :');
    console.error('  GEMINI_API_KEY="AIza..." npm run ocr-scans');
    console.error('  NVIDIA_API_KEY="nvapi-..." npm run ocr-scans');
    console.error('  OPENROUTER_API_KEY="sk-or-..." npm run ocr-scans');
    process.exit(2);
  }

  console.log(`\n🤖 Moteur Vision sélectionné : ${engine.provider.toUpperCase()} (${engine.model})`);
  let successCount = 0;

  for (let i = 0; i < scannedPdfs.length; i++) {
    const doc = scannedPdfs[i];
    console.log(`\n[${i + 1}/${scannedPdfs.length}] Transcription OCR de ${doc.relativePath}...`);
    try {
      const outcome = await extractScannedOfficialWithConfig(doc.absolutePath, doc.name, engine);

      if (outcome.status === 'ok' && hasReadablePdfText(outcome.text)) {
        fs.writeFileSync(`${doc.absolutePath}.extracted.txt`, outcome.text, 'utf-8');
        upsertCachedDoc(doc, outcome.text);
        successCount++;
        console.log(`  ✅ Enregistré : ${doc.relativePath}.extracted.txt`);
      } else {
        console.warn(`  ⚠️ Échec (${outcome.status}) pour ${doc.relativePath}: ${outcome.errorMessage || 'contenu vide'}`);
      }
    } catch (err: any) {
      console.error(`  ❌ Erreur sur ${doc.relativePath}:`, err?.message || err);
    }

    if (i < scannedPdfs.length - 1) {
      await sleep(3000);
    }
  }

  console.log(`\n🎉 Terminé : ${successCount}/${scannedPdfs.length} PDF scanné(s) converti(s).`);
}

main().catch((err) => {
  console.error('❌ Erreur fatale pretranscribeScans:', err);
  process.exit(1);
});
