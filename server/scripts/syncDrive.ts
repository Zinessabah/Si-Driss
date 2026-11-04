import dotenv from 'dotenv';
dotenv.config();

import { syncAllDriveFolders } from '../driveSync';
import { GOOGLE_DRIVE_FOLDER_PC, GOOGLE_DRIVE_FOLDER_SM } from '../config';

async function runCliSync() {
  console.log('=======================================================');
  console.log('🔄 Si Driss — Synchronisation Google Drive & RAG');
  console.log('=======================================================');
  console.log('Dossier PC configuré :', GOOGLE_DRIVE_FOLDER_PC ? 'Oui (Protégé)' : 'Non défini');
  console.log('Dossier SM configuré :', GOOGLE_DRIVE_FOLDER_SM ? 'Oui (Protégé)' : 'Non défini');
  console.log('Lancement du téléchargement et de l’indexation locale...');

  try {
    const result = await syncAllDriveFolders();

    console.log('\n--- RÉSULTAT DE LA SYNCHRONISATION ---');
    console.log(`Filière PC : ${result.pc.message}`);
    if (result.pc.downloadedFiles.length > 0) {
      console.log(`  -> Fichiers : ${result.pc.downloadedFiles.join(', ')}`);
    }

    console.log(`Filière SM : ${result.sm.message}`);
    if (result.sm.downloadedFiles.length > 0) {
      console.log(`  -> Fichiers : ${result.sm.downloadedFiles.join(', ')}`);
    }

    console.log(`\n🎉 Total : ${result.totalDownloaded} document(s) enrichi(s) dans le RAG de Si Driss.`);
    console.log('Les élèves ne voient pas ces fichiers ni vos liens Drive ; seul le RAG en bénéficie.');
  } catch (err: any) {
    console.error('❌ Erreur lors de la synchronisation:', err?.message || err);
    process.exit(1);
  }
}

runCliSync();

