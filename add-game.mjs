import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  try {
    const inputPath = process.argv[2];
    if (!inputPath) {
      console.error("HATA: Lutfen bir ZIP dosyasini Mod_Ekle.bat uzerine surukleyin.");
      return;
    }

    const filename = path.basename(inputPath);
    console.log(`[INFO] Dosya algilandi: ${filename}`);

    // Parse AppID (e.g. "12345.zip" or "12345_online.zip")
    const match = filename.match(/^(\d+)(_online)?\.zip$/i);
    if (!match) {
      console.error(`HATA: Dosya adi uygun formatta degil! Ornek: '12345.zip' veya '12345_online.zip' olmalidir. (Gelen: ${filename})`);
      return;
    }

    const appId = match[1];
    const isOnline = !!match[2];
    
    console.log(`[INFO] AppID: ${appId} (Mod Turu: ${isOnline ? 'Online' : 'Normal'})`);
    console.log(`[INFO] Steam'den oyun bilgileri cekiliyor...`);

    const steamRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
    const steamData = await steamRes.json();
    
    let gameTitle = `Bilinmeyen Oyun (${appId})`;
    if (steamData[appId] && steamData[appId].success) {
      gameTitle = steamData[appId].data.name;
      console.log(`[SUCCESS] Oyun bulundu: ${gameTitle}`);
    } else {
      console.log(`[WARNING] Oyun Steam'de bulunamadi veya magazadan kaldirilmis. Isim varsayilan olarak birakildi.`);
    }

    // Read manifest
    const manifestPath = path.join(__dirname, 'manifest.json');
    let manifestData = { games: [] };
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      manifestData = JSON.parse(raw);
    } catch (err) {
      console.log(`[WARNING] manifest.json okunamadi veya yok. Yeni olusturuluyor...`);
    }

    // Check if game exists
    let existingGame = manifestData.games.find(g => g.appId === appId);
    let gameId = "";

    if (existingGame) {
      gameId = existingGame.id;
      console.log(`[INFO] Bu oyun zaten manifest'te kayitli (ID: ${gameId}). Sadece ZIP dosyasi eklenecek/guncellenecek.`);
    } else {
      // Generate ID from title (remove special chars, spaces to underscores)
      gameId = gameTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
      console.log(`[INFO] Yeni ID olusturuldu: ${gameId}`);
      
      existingGame = {
        id: gameId,
        title: gameTitle,
        appId: appId,
        modUrl: "",
        onlineUrl: ""
      };
      manifestData.games.push(existingGame);
    }

    // Ensure package directory exists
    const pkgDir = path.join(__dirname, 'packages', gameId);
    await fs.mkdir(pkgDir, { recursive: true });

    // Copy zip to packages/<id>/<id>_mod.zip
    const destName = isOnline ? `${gameId}_online.zip` : `${gameId}_mod.zip`;
    const destPath = path.join(pkgDir, destName);

    console.log(`[INFO] ZIP dosyasi kopyalaniyor: packages/${gameId}/${destName}...`);
    await fs.copyFile(inputPath, destPath);

    // Update manifest URLs
    const baseUrl = `https://raw.githubusercontent.com/YunusOyunda-48/ustay-adder/main/packages/${gameId}/${destName}`;
    if (isOnline) {
      existingGame.onlineUrl = baseUrl;
    } else {
      existingGame.modUrl = baseUrl;
    }

    // Write manifest
    await fs.writeFile(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
    
    console.log(`\n======================================================`);
    console.log(`[SUCCESS] ISLEM TAMAMLANDI!`);
    console.log(`- Oyun: ${gameTitle}`);
    console.log(`- Dosya: packages/${gameId}/${destName}`);
    console.log(`- Manifest json basariyla guncellendi!`);
    console.log(`- DIKKAT: Lutfen GitHub Desktop'tan PUSH (Commit) yapmayi UNUTMAYIN.`);
    console.log(`======================================================\n`);

  } catch (error) {
    console.error(`\n[FATAL ERROR] Beklenmeyen bir hata olustu:\n`, error);
  }
}

run();
