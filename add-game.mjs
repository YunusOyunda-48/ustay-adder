import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  try {
    const inputPath = process.argv[2];
    if (!inputPath) {
      console.error("HATA: Lutfen bir ZIP dosyasini Mod_Ekle.bat veya Bypass_Ekle.bat uzerine surukleyin.");
      return;
    }

    const filename = path.basename(inputPath);
    console.log(`[INFO] Dosya algilandi: ${filename}`);

    // Parse AppID (e.g. "12345.zip", "12345_online.zip", "12345_bypass.zip")
    const match = filename.match(/^(\d+)(_online|_bypass)?\.zip$/i);
    if (!match) {
      console.error(`HATA: Dosya adi uygun formatta degil! Ornek: '12345.zip', '12345_online.zip' veya '12345_bypass.zip' olmalidir. (Gelen: ${filename})`);
      return;
    }

    const appId = match[1];
    const typeModifier = match[2] ? match[2].toLowerCase() : "";
    const isOnline = typeModifier === "_online";
    const isBypass = typeModifier === "_bypass" || process.argv.includes("--bypass");
    const modeName = isBypass ? "Bypass" : isOnline ? "Online" : "Normal";
    
    console.log(`[INFO] AppID: ${appId} (Mod Turu: ${modeName})`);
    console.log(`[INFO] Steam'den oyun bilgileri cekiliyor...`);

    const steamRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=turkish`);
    const steamData = await steamRes.json();
    
    let gameTitle = `Bilinmeyen Oyun (${appId})`;
    let gameImageUrl = "";
    if (steamData[appId] && steamData[appId].success) {
      gameTitle = steamData[appId].data.name;
      gameImageUrl = steamData[appId].data.header_image || "";
      console.log(`[SUCCESS] Oyun bulundu: ${gameTitle}`);
    } else {
      console.log(`[WARNING] Oyun Steam'de bulunamadi veya magazadan kaldirilmis. Isim varsayilan olarak birakildi.`);
    }

    // Bypass icin ozel not sorgulama veya otomatik okuma
    let bypassNote = "";
    if (isBypass) {
      const inputDir = path.dirname(inputPath);
      const baseNoExt = path.basename(inputPath, path.extname(inputPath));
      const companionNote = path.join(inputDir, `${baseNoExt}_note.txt`);
      const genericNote = path.join(inputDir, "note.txt");

      let noteFound = false;
      try {
        const hasComp = await fs.stat(companionNote).then(() => true).catch(() => false);
        const hasGen = await fs.stat(genericNote).then(() => true).catch(() => false);
        if (hasComp) {
          bypassNote = (await fs.readFile(companionNote, 'utf8')).trim();
          noteFound = true;
          console.log(`[INFO] Not dosyasi otomatik okundu: ${path.basename(companionNote)}`);
        } else if (hasGen) {
          bypassNote = (await fs.readFile(genericNote, 'utf8')).trim();
          noteFound = true;
          console.log(`[INFO] Not dosyasi otomatik okundu: note.txt`);
        }
      } catch (_) {}

      if (!noteFound) {
        console.log(`\n======================================================`);
        console.log(`📌 BYPASS ICIN OZEL TALIMAT / NOT EKLEME`);
        console.log(`Kullanicilarin uygulamada gorecegi bir kurulum notu var mi?`);
        console.log(`(Orn: "Steam kapaliyken kurun, yonetici olarak baslatin.")`);
        console.log(`Eger bir not yoksa direkt ENTER tusuna basabilirsiniz.`);
        console.log(`======================================================\n`);
        try {
          const rl = readline.createInterface({ input, output });
          const answer = await rl.question("Bypass Notu (Opsiyonel): ");
          bypassNote = answer.trim();
          rl.close();
        } catch (e) {
          console.log(`[INFO] Not girisi atlandi.`);
        }
      }

      if (bypassNote) {
        console.log(`[INFO] Kaydedilecek Not: "${bypassNote}"`);
      }
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
      if (gameImageUrl && !existingGame.imageUrl) {
        existingGame.imageUrl = gameImageUrl;
      }
      console.log(`[INFO] Bu oyun zaten manifest'te kayitli (ID: ${gameId}). Sadece ZIP dosyasi eklenecek/guncellenecek.`);
    } else {
      // Generate ID from title (remove special chars, spaces to underscores)
      gameId = gameTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
      console.log(`[INFO] Yeni ID olusturuldu: ${gameId}`);
      
      existingGame = {
        id: gameId,
        title: gameTitle,
        appId: appId,
        imageUrl: gameImageUrl,
        modUrl: "",
        onlineUrl: "",
        bypassUrl: "",
        bypassNote: ""
      };
      manifestData.games.push(existingGame);
    }

    // Ensure package directory exists
    const pkgDir = path.join(__dirname, 'packages', gameId);
    await fs.mkdir(pkgDir, { recursive: true });

    // Copy zip to packages/<id>/<id>_mod.zip or online or bypass
    const destName = isBypass ? `${gameId}_bypass.zip` : isOnline ? `${gameId}_online.zip` : `${gameId}_mod.zip`;
    const destPath = path.join(pkgDir, destName);

    console.log(`[INFO] ZIP dosyasi kopyalaniyor: packages/${gameId}/${destName}...`);
    await fs.copyFile(inputPath, destPath);

    // Update manifest URLs
    const baseUrl = `https://raw.githubusercontent.com/YunusOyunda-48/ustay-adder/main/packages/${gameId}/${destName}`;
    if (isBypass) {
      existingGame.bypassUrl = baseUrl;
      if (bypassNote) {
        existingGame.bypassNote = bypassNote;
      }
    } else if (isOnline) {
      existingGame.onlineUrl = baseUrl;
    } else {
      existingGame.modUrl = baseUrl;
    }

    // Write manifest
    await fs.writeFile(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
    
    console.log(`\n======================================================`);
    console.log(`[SUCCESS] ISLEM TAMAMLANDI!`);
    console.log(`- Oyun: ${gameTitle}`);
    console.log(`- Mod Turu: ${modeName}`);
    console.log(`- Dosya: packages/${gameId}/${destName}`);
    if (isBypass && existingGame.bypassNote) {
      console.log(`- Bypass Notu: ${existingGame.bypassNote}`);
    }
    console.log(`- Manifest json basariyla guncellendi!`);
    console.log(`- DIKKAT: Lutfen GitHub Desktop'tan PUSH (Commit) yapmayi UNUTMAYIN.`);
    console.log(`======================================================\n`);

  } catch (error) {
    console.error(`\n[FATAL ERROR] Beklenmeyen bir hata olustu:\n`, error);
  }
}

run();
