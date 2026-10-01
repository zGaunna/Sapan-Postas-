# Geliştirme ve doğrulama

Projenin GitHub deposu: [zGaunna/Sapan-Postas-](https://github.com/zGaunna/Sapan-Postas-).

Oyun Vanilla JavaScript ve Canvas kullanır; paket kurulumu veya derleme gerekmez. Node.js kuruluysa proje klasöründe şu kontrolleri çalıştırabilirsin:

`npm test` aşağıdaki kontrolleri sırayla çalıştırır; ayrıca `level-data.js` ve `game-start.js` sözdizimini denetler. Paket kurulumu gerekmez. Çalıştırıcı, OneDrive yollarındaki Node `EPERM` hatasını önlemek için `--preserve-symlinks` ve `--preserve-symlinks-main` kullanır.

Geliştirme araçları için Node 24 ve `npm ci` kullanılır. ESLint, TypeScript ve Playwright yalnızca `devDependencies` içindedir; oyun bunları yüklemez ve `file://` açılışı paket kurulumu gerektirmez.

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run test:browser
```

`eslint.config.mjs` önerilen hata kontrollerini, oyun dosyalarında çift tırnak ve noktalı virgül kullanımını denetler. Mevcut geliştirme betiklerinin iki tırnak stili korunur; eski kullanılmayan değişkenler bu aşamada temizlenmez. `.editorconfig` iki boşluk ve UTF-8 ayarını tanımlar; toplu biçimlendirme yapılmaz. `// @ts-check` ve JSDoc ile ilk tip kontrolü kapsamı `level-data.js` ve `harbor-map.js` dosyalarıdır. `types/game-data.d.ts` klasik script globallerini tanımlar; `npm run typecheck` strict denetim yapar ve dosya üretmez. `.github/workflows/checks.yml`, push ve pull request sırasında Node 24 üzerinde `npm ci`, lint, tip kontrolü ve `npm test` çalıştırır.

```sh
node --check game.js
node work/check-game.cjs
node work/playtest-route.cjs
node work/check-frame-loop.cjs
node work/check-delivery.cjs
node work/check-courier.cjs
node work/check-motion.cjs
node work/check-world.cjs
node work/check-social.cjs
node work/check-harbor.cjs
node work/check-harbor-map.cjs
node work/check-target.cjs
node work/check-target-practice.cjs
node work/check-log.cjs
node work/check-progression.cjs
node work/check-result.cjs
node work/check-state-machine.cjs
node work/check-rendering.cjs
```

Veri içeren HTML şablonları tek `escapeHtml` yardımcısını kullanır; metin ve tırnaklı öznitelik değerleri HTML olarak yorumlanmaz. `check-rendering`, zararlı localStorage kayıtlarını, sonuç bölümlerini, sohbet seçeneklerini ve harita özniteliklerini denetler. Gerçek tarayıcıdaki `browser-progression-check` de zararlı depolamayla açılışı, metnin birebir görünmesini, HTML elemanı oluşmamasını ve cevap düğmesinin çalışmasını doğrular.

İlk test; antrenman modlarını, yeniden denemeyi, süreyi, özel halkaları, rekor ayrımını, bozuk/engellenmiş depolamayı, iskele sürelerini, güvenli kurtarmayı ve uçuş önizlemesinin gerçek oyun fiziğiyle eşleşmesini kontrol eder. Parkur testi, aynı girdilerle tekrarlanabilir bir kontrol stratejisinin vardiyayı bitirdiğini doğrular. Kare döngüsü testi, kaydedilen bütün parkur girdilerini 30/60/120/144/180 Hz çizim döngülerinde oynatıp konum, süre, iskele geçişleri ve düşüşlerin birebir eşleştiğini kontrol eder.

`level-data.js`, 27 halkanın yükseklik dizisini, başlangıç konumunu, aralığını ve kırılgan/motorlu halka kimliklerini içerir; `game.js` öncesinde klasik script olarak yüklenir. Seviye tanımları dondurulmuştur; ziyaret ve aşınma durumu oyundaki ayrı kopyalarda tutulur. `game.js` açık `SapanGame.create(options)` arayüzünü tanımlar; klasik `game-start.js` scripti seçenek vermeden oyunu başlatır. Test donanımı `{ debug: true, testRun: true, beforeStep }` seçenekleriyle aynı oyunu oluşturur; dönen test API'si kontrollü adımlama ve durum okumayı sağlar. Kaynak metni yamalanmaz; normal açılış test API'si döndürmez. Üretim kodu `globalThis.__playtestRun` okumaz.

`finishRun()` sonuç hesabını saf `computeResult(runState)` fonksiyonuna, depolamayı `persistRunResult(result)` fonksiyonuna ve sonuç ekranını `renderRunResult(result, records)` fonksiyonuna ayırır. Hesap girdisini veya canlı oyun durumunu değiştirmez; puanı, sonuç metnini, iskele sürelerini ve kayıt adaylarını döndürür. Antrenmanda hiçbir rekor adayı yoktur; normal kayıp skor rekoruna, normal kazanım fener süresine, 3/3 mühürlü normal kazanım teslimat süresine adaydır. `check-result` kazanma/kaybetme, süre dolması, 0–3 mühür, antrenman ve hedef mühür ayrımını; girdi değişmezliğini ve DOM/depolamadan bağımsızlığı doğrular.

Oyun sekiz durum nesnesiyle yönetilir: `menu`, `playing`, `exploring`, `paused`, `map`, `history`, `won`, `lost`. Her durumun `enter/update/draw/exit` yaşam döngüsü vardır; geçişler önce çıkışı, sonra yeni durumun girişini çağırır. Kare döngüsü aktif durumun sabit adım ve görsel zaman kararını kullanır. Harita, defter ve duraklatma dönüş noktalarını durum nesnesi olarak saklar; çıkışlar basılı girdiyi veya saklanan uçuşu temizlemez. `check-state-machine` yaşam döngüsü sırasını, aynı duruma yeniden girişi, geçersiz hedef reddini, dönüş ekranlarını, saatleri ve Web Audio başlangıcını doğrular.

Teslimat testi aynı tekrar kontrolünü 3/3 mühürlü gerçek koşuda yapar; makara atışında en az 0,25 saniyelik farklı bırakışları, birkaç ip uzunluğunu ve üç hedef atışında 0–4 fizik adımı gecikmenin 125 birleşimini doğrular. Ayrıca mühür bildirimi/kurtarma kurallarını ve iki süre kaydının ayrılığını kontrol eder. İnsan oyuncunun zorluğu bu otomatik testlerle ölçülmez.

Karakter testi eklem/halat hizasını, pozları, çizimin durumu değiştirmediğini, uç hızlarda sonlu değerleri ve atkı sınırlarını denetler. Hareket testi ara kareleri, duraklatmayı, kurtarmada kamera sıfırlamasını, efekt sınırlarını ve azaltılmış hareket kontrolünü denetler.

`npm run test:browser`, kurulu Brave ile dört gerçek tarayıcı kontrolünü sırayla çalıştırır. Playwright otomasyonu Brave'i `executablePath` ile açar; başka bir tarayıcı indirilmez. Çalıştırıcı test sayfasını hazırlar, boş bir yerel portta HTTP sunucusu açar ve testler bitince veya hata verince kapatır. Windows'taki standart Brave kurulumları otomatik bulunur; özel kurulum veya başka işletim sistemi için `BRAVE_EXECUTABLE_PATH` tam çalıştırılabilir dosya yoluna ayarlanır. Örneğin PowerShell'de `$env:BRAVE_EXECUTABLE_PATH = 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe'`. Tarayıcı testleri normal `npm test`ten ayrıdır.

`browser-motion-check`, oyuncunun kayıtlarını değiştirmeden klavye/fare, duraklatma, geniş ekranda tam ekran ve üç mühürlü tam parkuru denetler; ekran görüntülerini `work/evidence/` içine yazar. Oyunun kendisi Playwright gerektirmez. Kontroller tek başına da mevcut HTTP sunucusuna karşı çalıştırılabilir; Playwright ayrı bir klasördeyse paket klasörü ikinci argüman olarak verilebilir.

Tam piksel karşılaştırmaları için geçici Brave test oturumunda sRGB renk profili kullanılır ve Canvas parmak izi rastgeleleştirmesi (`BraveFarbling`) kapatılır. Bu başlatma bayrakları kullanıcının normal Brave profiline veya ayarlarına yazılmaz; özgün piksel beklentileri değiştirilmez.

`node work/browser-harbor-check.cjs` gerçek yürüyüşü, sohbet dallarını, haritayı, dört iskeleyi ve rota dönüşünü kontrol eder. `node work/browser-progression-check.cjs` hedef antrenman düğmelerini, normal/antrenman kayıt ayrımını, tercihlerin yeniden yüklenmesini, 1024×600 PC penceresini ve internet kapalıyken `file://` açılışını kontrol eder. Aynı Playwright paket argümanını bu komutlara da verebilirsin.

`node work/browser-performance-check.cjs` beş bölgede çizimi gerçek tarayıcı kareleri arasında örnekler; çizim çağrısının CPU süresini ve kare aralıklarını raporlar. Bu rapor tek başına 180 FPS veya her bilgisayarda aynı performans iddiası değildir. Dünya testi çizimlerin oyun verisini ve Canvas durumunu bozmadığını; iskele testi asılı halatla ziyaret sonrası fiziksel uçuşun ziyaretsiz koşuyla aynı kaldığını da doğrular.
