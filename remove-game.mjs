import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.join(__dirname, 'manifest.json');
const packagesRoot = path.join(__dirname, 'packages');

async function loadManifest() {
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.games)) {
      data.games = [];
    }
    return data;
  } catch (err) {
    console.error('[HATA] manifest.json okunamadi:', err.message);
    return null;
  }
}

async function saveManifest(data) {
  try {
    await fs.copyFile(manifestPath, path.join(__dirname, 'manifest.json.bak'));
  } catch (_) {}
  await fs.writeFile(manifestPath, JSON.stringify(data, null, 2), 'utf8');
}

function cleanQuery(query) {
  if (!query) return '';
  let cleaned = path.basename(query.trim());
  const zipMatch = cleaned.match(/^(\d+)(_online|_bypass|_mod)?\.zip$/i);
  if (zipMatch) {
    return zipMatch[1];
  }
  return cleaned.replace(/\.zip$/i, '');
}

function findMatches(games, query) {
  const q = query.trim();
  const qLower = q.toLowerCase();

  // 1. Exact match by AppID or ID
  const exact = games.filter(
    (g) => (g.appId && String(g.appId) === q) || (g.id && g.id.toLowerCase() === qLower)
  );
  if (exact.length > 0) return exact;

  // 2. Exact match by title
  const exactTitle = games.filter(
    (g) => g.title && g.title.toLowerCase() === qLower
  );
  if (exactTitle.length > 0) return exactTitle;

  // 3. Substring match by title, ID, or AppID
  return games.filter((g) => {
    const titleMatch = g.title && g.title.toLowerCase().includes(qLower);
    const idMatch = g.id && g.id.toLowerCase().includes(qLower);
    const appMatch = g.appId && String(g.appId).includes(q);
    return titleMatch || idMatch || appMatch;
  });
}

async function removeGame(targetGame, rl) {
  console.log(`\n======================================================`);
  console.log(`⚠️  OYUN SILME ONAYI`);
  console.log(`------------------------------------------------------`);
  console.log(`Oyun Adi    : ${targetGame.title}`);
  console.log(`AppID       : ${targetGame.appId || 'Yok'}`);
  console.log(`Klasor ID   : ${targetGame.id}`);
  console.log(`Klasor Yolu : packages/${targetGame.id}`);
  console.log(`------------------------------------------------------`);
  console.log(`Bu oyun manifest.json'dan kaldirilacak ve packages/${targetGame.id}`);
  console.log(`klasorundeki tum dosyalar KALICI OLARAK SILINECEKTIR!`);
  console.log(`======================================================`);

  const answer = (await rl.question(`Bu oyunu silmek istediginize emin misiniz? [E/h]: `)).trim().toLowerCase();
  if (answer !== 'e' && answer !== 'evet' && answer !== 'y' && answer !== 'yes') {
    console.log(`[BILGI] Silme islemi iptal edildi.`);
    return false;
  }

  // 1. Manifest'ten kaldir
  const manifestData = await loadManifest();
  if (!manifestData) return false;

  const initialCount = manifestData.games.length;
  manifestData.games = manifestData.games.filter(
    (g) => g.id !== targetGame.id && (!targetGame.appId || g.appId !== targetGame.appId)
  );
  const removedFromManifest = manifestData.games.length < initialCount;
  if (removedFromManifest) {
    await saveManifest(manifestData);
    console.log(`[OK] manifest.json guncellendi (Yedek: manifest.json.bak).`);
  } else {
    console.log(`[BILGI] Oyun manifest.json'da bulunamadi veya zaten silinmis.`);
  }

  // 2. Packages klasorunu sil
  const pkgDir = path.join(packagesRoot, targetGame.id);
  let folderExisted = false;
  try {
    const stat = await fs.stat(pkgDir);
    if (stat.isDirectory()) {
      folderExisted = true;
      await fs.rm(pkgDir, { recursive: true, force: true });
      console.log(`[OK] 'packages/${targetGame.id}' klasoru ve tum icerigi basariyla silindi.`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[UYARI] Klasor silinirken hata olustu:`, err.message);
    }
  }

  if (!folderExisted) {
    console.log(`[BILGI] 'packages/${targetGame.id}' klasoru diskte zaten yoktu.`);
  }

  console.log(`\n======================================================`);
  console.log(`✅ [BASARILI] '${targetGame.title}' basariyla kaldirildi!`);
  console.log(`- Kalan toplam oyun sayisi: ${manifestData.games.length}`);
  console.log(`- DIKKAT: Lutfen GitHub Desktop'tan PUSH (Commit) yapmayi UNUTMAYIN.`);
  console.log(`======================================================\n`);
  return true;
}

async function handleSingleQuery(rawQuery, rl) {
  const query = cleanQuery(rawQuery);
  if (!query) return;

  const manifestData = await loadManifest();
  if (!manifestData) return;

  const matches = findMatches(manifestData.games, query);

  if (matches.length === 0) {
    // Check if an orphaned packages folder exists
    const orphanDir = path.join(packagesRoot, query);
    let orphanExists = false;
    try {
      const s = await fs.stat(orphanDir);
      orphanExists = s.isDirectory();
    } catch (_) {}

    if (orphanExists) {
      console.log(`\n[UYARI] '${query}' manifest.json'da bulunamadi ancak 'packages/${query}' klasoru mevcut!`);
      const ans = (await rl.question(`Bu sahipsiz klasoru silmek ister misiniz? [E/h]: `)).trim().toLowerCase();
      if (ans === 'e' || ans === 'evet' || ans === 'y' || ans === 'yes') {
        await fs.rm(orphanDir, { recursive: true, force: true });
        console.log(`[OK] 'packages/${query}' klasoru silindi.`);
      }
    } else {
      console.log(`\n[HATA] '${query}' ile eslesen hicbir oyun veya klasor bulunamadi.`);
    }
    return;
  }

  let selectedGame = null;

  if (matches.length === 1) {
    selectedGame = matches[0];
  } else {
    console.log(`\nBirden fazla eslesen oyun bulundu:`);
    matches.forEach((g, index) => {
      console.log(` [${index + 1}] ${g.title} (AppID: ${g.appId || 'Yok'} | ID: ${g.id})`);
    });
    console.log(` [0] Iptal et`);

    const selStr = await rl.question(`\nSilmek istediginiz oyunun numarasini girin (1-${matches.length}): `);
    const selIdx = parseInt(selStr.trim(), 10);
    if (isNaN(selIdx) || selIdx < 1 || selIdx > matches.length) {
      console.log(`[BILGI] Secim iptal edildi.`);
      return;
    }
    selectedGame = matches[selIdx - 1];
  }

  await removeGame(selectedGame, rl);
}

async function run() {
  const rl = readline.createInterface({ input, output });

  try {
    const arg = process.argv[2];

    if (arg) {
      // Direct argument passed (drag & drop or command line)
      await handleSingleQuery(arg, rl);
    } else {
      // Interactive mode
      console.log(`======================================================`);
      console.log(`🗑️   ustaY OYUN SILME ARACI`);
      console.log(`======================================================`);

      const manifestData = await loadManifest();
      if (manifestData) {
        console.log(`Kutuphanede kayitli toplam oyun sayisi: ${manifestData.games.length}`);
      }
      console.log(`Cikmak icin 'q' veya 'cikis' yazabilirsiniz.\n`);

      while (true) {
        const query = await rl.question(`Silinecek oyunun AppID'si, Adi veya Klasor ID'si: `);
        const trimmed = query.trim();

        if (!trimmed || trimmed.toLowerCase() === 'q' || trimmed.toLowerCase() === 'cikis') {
          console.log(`Cikis yapiliyor...`);
          break;
        }

        await handleSingleQuery(trimmed, rl);

        const again = (await rl.question(`Baska bir oyun silmek ister misiniz? [e/H]: `)).trim().toLowerCase();
        if (again !== 'e' && again !== 'evet' && again !== 'y' && again !== 'yes') {
          console.log(`Islem tamamlandi. Cikis yapiliyor...`);
          break;
        }
        console.log(``);
      }
    }
  } catch (err) {
    console.error(`\n[FATAL ERROR] Beklenmeyen hata:`, err);
  } finally {
    rl.close();
  }
}

run();
