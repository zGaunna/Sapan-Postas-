# AGENTS.md — Sapan Postası

Bu dosya, bu depoda çalışan her kodlama ajanı (Codex, Claude Code vb.) ve insan katkıcı için bağlayıcı çalışma kurallarıdır. Önce bunu oku, sonra değişiklik yap. Şüphede kalırsan **küçük adım at, doğrula, dur ve sor**.

---

## 1. Proje özeti

**Sapan Postası**, gece limanında halkadan halkaya halatla savrulan bir kuryeyi yönettiğin, PC için geliştirilen, tarayıcıda çalışan bir fizik/beceri oyunudur. Amaç: üç mührü topla, fener iskelesine var, canları tüketme. Oyunun ikinci yüzü gezilebilir limandır: NPC sohbetleri, harita, seyir defteri.

- **Platform:** Yalnızca PC (klavye + fare). Dokunmatik kontroller HTML'de bulunur ama gizlidir; genişletme veya kaldırma kararı sahibine aittir.
- **Teknoloji:** Vanilla JavaScript + HTML5 Canvas. Çalışma zamanında bağımlılık, derleme, paket kurulumu, API anahtarı, internet **yoktur** ve **olmayacaktır**.
- **Dağıtım:** `BASLAT.cmd` ile veya `index.html`'e çift tıklayarak (`file://`) açılır. Bu akış bozulmamalıdır.
- **Dil:** Oyun içi metinler Türkçe. Kod, değişken adları, yorumlar, commit mesajları İngilizce.

---

## 2. Kırılmaz kurallar (invariants)

Bunlardan biri ihlal edilecekse önce sahibinden açık onay iste.

1. **Çalışma zamanında sıfır bağımlılık.** `index.html` doğrudan açıldığında oyun çalışmalı. CDN, `npm` paketi, bundler çıktısı zorunlu hale getirilemez. Geliştirme araçları (lint, test runner, CI) yalnızca `devDependencies` olabilir.
2. **`file://` uyumluluğu.** ES modülleri (`<script type="module">`) ve `fetch()` ile yerel dosya okuma, tarayıcıların çoğunda `file://` üzerinden engellenir. Bu yüzden modüle geçiş **tek başına yapılmaz**; önce bir tasarım notu ve sahibinin onayı gerekir (bkz. Bölüm 12).
3. **Deterministik fizik.** Fizik sabit adımla (`PHYSICS_DT = 1/120`) çalışır, çizim hızından bağımsızdır. Aynı girdi dizisi 30/60/120/144/180 Hz'de **birebir aynı** konum, süre, iskele geçişi ve düşüş sonucunu vermelidir. Fizik kodunda `Math.random`, `Date.now`, `performance.now` kullanılmaz (şu an hiçbir dosyada yoktur; böyle kalmalı).
4. **Oyun hissini değiştirme.** Aşağıdaki sabitler ve türevleri izinsiz değiştirilmez: `GRAVITY`, `MIN_ROPE_LENGTH`, `MAX_ROPE_LENGTH`, `ROPE_REEL_SPEED`, `MAX_PLAYER_SPEED`, `BASE_PLAYER_VX_MAX`, `CLEAN_RELEASE_ANGLE`, `SLING`, `FRAGILE_HOLD_SECONDS`, `WINCH_REEL_SPEED`, `PHYSICS_DT`, `SHIFT_SECONDS`, `ROUTE_END`, halka yerleşimi (`anchors`, `anchorHeights`). Zorluk/denge ayarı insan oyun testi gerektirir; otomatik testler zorluğu ölçmez.
5. **Kayıt uyumluluğu.** Kullanıcıların tarayıcıda saklanan verisi bozulmamalı (Bölüm 7). Anahtar adı veya şema değişirse sürümleme ve eski veriyi güvenle okuma/yok sayma zorunludur.
6. **Depolama opsiyoneldir.** `localStorage` engelli, dolu veya bozuk olabilir. Her okuma/yazma try/catch içinde olmalı; oyun ve sohbetler depolamasız çalışmaya devam etmeli.
7. **Testler yeşili boyamak için değiştirilmez.** Bir test kırılıyorsa önce **kodu** düzelt. Test değişikliği yalnızca davranış bilinçli olarak değişiyorsa ve gerekçesi commit mesajında yazılıysa yapılır.

---

## 3. Dosya haritası

Script'ler `index.html` içinde bu sırayla yüklenir (sıra önemlidir; modüller global ad alanından birbirini bulur):

| Sıra | Dosya | Görev | Dışa açtığı global |
|---|---|---|---|
| 1 | `courier.js` | Kurye karakter modeli, eklemler, pozlar, atkı/çanta hareketi | `CourierRig` |
| 2 | `motion.js` | Görsel efektler, kamera sarsıntısı, azaltılmış hareket | `MotionFX` |
| 3 | `harbor-world.js` | Beş bölgenin çizimi, iskeleler, NPC çizimi, harita çizimi | `HarborWorld` |
| 4 | `harbor-social.js` | Kişiler, nesneler, sohbet dalları, hafıza | `HarborSocial` |
| 5 | `voyage-log.js` | Son 20 normal vardiya kaydı (doğrulamalı depolama) | `VoyageLog` |
| 6 | `game.js` | Ana oyun: durum, fizik, giriş, HUD, çizim döngüsü (tek IIFE) | — |

Ayrıca: `harbor-map.js` (bölge/kontrol noktası/antrenman başlangıç verisi, `HarborMap`), `index.html` (arayüz iskeleti), `style.css`, `BASLAT.cmd`, `README.md` (oyuncu rehberi + doğrulama notları), `work/` (test ve geliştirme betikleri).

> `harbor-map.js` ile `index.html`'deki script sırasını kontrol etmeden dosya ekleme/silme/yeniden adlandırma yapma.

---

## 4. Doğrulama: her değişiklikten sonra çalıştır

Node.js gerekir (depo Node 22 ile doğrulandı). Proje kökünde:

```bash
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
```

Hepsini tek seferde (bash):

```bash
node --check game.js && for f in check-game playtest-route check-frame-loop check-delivery check-courier check-motion check-world check-social check-harbor check-harbor-map check-target check-target-practice check-log check-progression; do node work/$f.cjs || { echo "FAIL: $f"; exit 1; }; done && echo ALL_PASS
```

PowerShell (Windows):

```powershell
node --check game.js; if ($LASTEXITCODE) { exit 1 }
foreach ($f in "check-game","playtest-route","check-frame-loop","check-delivery","check-courier","check-motion","check-world","check-social","check-harbor","check-harbor-map","check-target","check-target-practice","check-log","check-progression") {
  node "work/$f.cjs"; if ($LASTEXITCODE) { Write-Error "FAIL: $f"; exit 1 }
}
"ALL_PASS"
```

Bir `npm test` betiği eklendiğinde (bkz. Bölüm 13) bu liste onunla aynı kalmalı ve bu bölüm güncellenmelidir.

**Gerçek tarayıcı kontrolleri** (Playwright + yerel HTTP sunucusu gerekir; `README.md` "Geliştirme ve doğrulama" bölümüne bak): `browser-motion-check`, `browser-harbor-check`, `browser-progression-check`, `browser-performance-check`. Arayüze, çizime, giriş veya depolamaya dokunduysan bunları da çalıştır; çalıştıramadıysan bunu açıkça raporla. Performans raporu tek başına "her bilgisayarda 180 FPS" iddiası değildir.

`npm ci` sonrasında `npm run lint` ve `npm run typecheck` geliştirme kontrollerini çalıştırır. Tip denetimi kademelidir: ilk kapsam `level-data.js` ve `harbor-map.js`; JSDoc ve `types/game-data.d.ts` kullanılır, çıktı üretilmez. `npm run test:browser` kurulu Brave ile dört tarayıcı kontrolünü sırayla çalıştırır; test sayfasını ve geçici HTTP sunucusunu kendisi hazırlar. Standart Windows kurulumları bulunur; özel yol için `BRAVE_EXECUTABLE_PATH` verilir. Playwright ve diğer araçlar yalnızca `devDependencies` içindedir; oyun paket kurulumu istemez. CI Node 24 ile `npm ci`, lint, typecheck ve `npm test` çalıştırır.

**Kural:** "Çalıştı" demek için komutun çıktısını gördün. Çalıştıramadığın her şeyi "doğrulanmadı" olarak yaz.

`?perf` son 240 rAF aralığının p95/p99 kare süresini gösterir; fizik zamanından bağımsızdır. `browser-performance-check` göstergenin isteğe bağlı açılmasını, yüzdelikleri, kayan pencereyi, ham uzun kare aralıklarını ve HTTP/`file://` açılışını da kontrol eder.

`browser-performance-check` içindeki `browser-ui-check`, 220 ms panel geçişini, kapanışta `inert`/fare engelini, 550 ms sonuç sayımında kesin erişilebilir sürenin korunmasını, sıralı ayrım girişini, mühür pop hareketini ve sistem/oyun hareket azaltma tercihini doğrular. `browser-motion-check` kapanış görünürlüğünü geçiş bitince kontrol eder; panel durumu hemen değişir. Sayım mevcut rAF zaman damgasını kullanır, fizik/süre/kayıt hesaplarını değiştirmez.

Su çizgileri iki Path2D ile çizilir. `check-world` eski koordinatların aynen korunduğunu doğrular. `browser-performance-check`, `browser-water-check` yardımcısıyla 261 → 2 stroke sayısını, 15 sahnede sahibinin kabul ettiği en fazla 234 piksel / 9 kanal değeri farkını ve su dışında piksel eşitliğini kontrol eder; önce/sonra arka plan p95/p99 ölçümlerini raporlar.

Statik çizim önbelleği gökyüzü, ay ve dünya koordinatlarına bağlı uzak kıyı için üç canvas kullanır; palet karışımı 1/32 adımlarla, kıyı şeridi 2048 piksel sınırlarında yenilenir. `browser-performance-check` içindeki `browser-static-check` yeniden kullanım, palet/şerit geçişleri ve tam sayı blit'leri doğrular. Su testi bu önbellekten bağımsızdır. Statik önbelleğin tam sayı kaydırma/palet yuvarlaması bütün sahnenin piksel çıktısını bilinçli değiştirir; ön planın çizim komutları ve ayrı çizilmiş pikselleri korunur. `static-layer-report.json` sıcak önbellek ve palet geçişi p95/p99 sonuçlarını içerir.

Parıltı önbelleği en fazla 32 yarıçap/RGB sprite'ı saklar; değişken saydamlık anahtara dahil değildir. Ekran parlaması bağlam/boyut başına en fazla iki renk saklar. `HarborWorld.drawGlow` Canvas durumunu korur; oyun çizimindeki `shadowBlur` yerine sprite kullanılır. `browser-glow-check`, yeniden kullanım, tahliye, Canvas durumu, boyut değişimi ve azaltılmış hareketi doğrular; arka plan gradyan/sprite p95/p99 karşılaştırmasını `glow-sprite-report.json` içine yazar. Blur ve sprite piksel çıktıları birebir eşit değildir.

---

## 5. KRİTİK: Test donanımı `game.js` kaynağını metin olarak yamalar

Testler `game.js`'i `require` etmez. `work/check-game.cjs` ve `work/prepare-browser-playtest.cjs` dosyayı **metin olarak okuyup iki yerini string/regex ile değiştirir**, sonra `vm` içinde çalıştırır:

1. `update(PHYSICS_DT);` ifadesini bulup önüne `globalThis.__beforeFrameStep` çağrısı ekler.
2. Dosyanın sonundaki `})();` kapanışını bulup içine `globalThis.__gameDebug = { ... }` nesnesini enjekte eder. Bu nesne iç fonksiyonlara ve durumlara (`resetRun`, `update`, `finishRun`, `state`, `lives`, `anchors`, `seals`, `player` ... ) erişim sağlar.

Ek olarak test, `game.js` içindeki her `querySelector("#id")` için `index.html`'de `id="..."` olduğunu doğrular ve sahte DOM düğümleri üretir.

Sonuçları:

- `game.js`'te bu iki metin kalıbını (tam `update(PHYSICS_DT);` çağrısını ve dosya sonundaki `})();`) veya `__gameDebug` içinde adı geçen herhangi bir iç değişken/fonksiyonu **yeniden adlandırma, taşıma veya silme** testleri kırar. Bu bir **davranış hatası değil, donanım uyumsuzluğudur**.
- `globalThis.__playtestRun`, `globalThis.__beforeFrameStep` ve `globalThis.__gameDebug` test kancalarıdır. `__playtestRun` üretim kodunda (`finishRun` içinde, kayıt modunu `"test"` yapmak için) okunur; bu bilinçli bir kusurdur ve kaldırılması planlıdır (Bölüm 13).
- Büyük refactor'lardan (durum makinesi, modül bölme) **önce** test donanımı, kaynak yamalamaya değil açık ve desteklenen bir test arayüzüne (örn. tek bir `createGame({ debug: true })` ya da açıkça dışa verilmiş bir test API'si) taşınmalıdır. Bu geçiş **kendi başına ayrı bir adımdır** ve kendi commit'inde, sayısal çıktılar değişmeden yapılır.

**Donanım değişikliği protokolü:** (a) değişiklikten önce 14 kontrolün çıktısını kaydet, (b) donanımı değiştir, (c) tüm kontroller aynı çıktıyı vermeli, (d) commit mesajına "test-harness only, no behavior change" yaz.

---

## 6. Oyun mimarisi notları

- **Durum:** `game.js` içinde durum, `state` metin değişkeniyle taşınır: `menu`, `playing`, `exploring`, `paused`, `map`, `history`, `won`, `lost` (+ `recoveryReady` bayrağı ve `logOrigin` gibi yardımcılar). Geçişler dağınık `if` zincirleriyle yönetilir. Bu, en yüksek hata riskli bölgedir; `frame()` ve `setPanels()` değişirken ekstra dikkat et.
- **Kare döngüsü:** `frame(timestamp)` zamanı biriktirir (`frameAccumulator`), sabit adımla `update(PHYSICS_DT)` (oynarken) veya `updateSocial(PHYSICS_DT)` (limanda) çağırır, kare başına işlenen süreyi 0,035 sn ile sınırlar. `renderAlpha` ile fizik adımları arası ara kare çizilir. Bu sınırı ve ara kare mantığını bozma.
- **Kamera:** Uçuş ve liman takibi ortak `damp` yardımcısını kullanır (5/s); hıza bağlı 0,16 saniyelik ileri bakış −60/+140 piksel arasında sınırlıdır. Kadraj oranları uçuşta 0,36, limanda 0,45'tir. `check-frame-loop` sabit hedefte 30/60/144/240 Hz yakınsama eşitliğini, sınırları ve takip entegrasyonunu doğrular; oynanış fiziği ayrı kalır.
- **Fizik:** Halat kısıtı (`applyRopeConstraint`), hız sınırlaması (`limitPlayerSpeed`, `limitRopeSpeed`), temiz bırakış (`isCleanRelease`, `applySlingBoost`), özel halkalar (`fragile`, `winch`). Uçuş önizlemesi (`predictReleasePath`) gerçek fiziği **aynı adımla** simüle eder; fizik değişirse önizleme otomatik olarak uyumlu kalmalı ve `check-target-practice` bunu doğrulamalıdır.
- **Çizim ve fizik ayrımı:** Çizim fonksiyonları (`draw*`) oyun durumunu veya Canvas durumunu **değiştirmemelidir** (`check-world`, `check-courier`, `check-motion` bunu doğrular). Karakter/atkı/çanta hareketi görsel olup oynanış fiziğini etkilemez.
- **Sarsıntı:** `MotionFX.trauma` olaylarla birikir (hasar 0,5; diğerleri 0,12), 0–1 arasında kalır ve saniyede 1,6 azalır. Görsel kaydırma trauma'nın karesi ve iki sinüsle hesaplanır; yatay sınır 14, dikey sınır 8,4 pikseldir. Azaltılmış harekette kaydırma sıfır olur. `check-motion` zaman adımı eşitliğini ve sınırları; Brave kontrolü çizim entegrasyonunu doğrular.
- **Parçacıklar:** `MotionFX.particles` 220 kapasiteli tipli dizi havuzudur; `live`/`length` canlı sayıyı gösterir. Süresi dolan parçacık son canlıyla değiştirilir; dolu havuz en eskiyi çıkarır. Rastgele sayı akışı korunur. Çizim renk/dört alfa kovası ve kova başına ortalama kalınlık kullanır; Float32 ve toplu stroke eski piksel çıktısını değiştirir. `check-motion` eski akış fixture'larını ve havuz yaşam döngüsünü; `browser-particle-check` aynı tohumda piksel eşitliğini, stroke sınırını ve p95/p99 çizim sürelerini doğrular.
- **Görsel halat:** `MotionFX.VerletRope` 12 segmenti 1/120 saniyede çözer; fizik halat kısıtına yazmaz. Yakalamada sıfırlanır, bırakmada 0,16 saniyelik yanal tepki/sönüm gösterir. Azaltılmış harekette eski Bézier kullanılır. Kurtarmadan fırlatmada görsel karakter pozu sıfırlanır; böylece elin bekleyiş animasyonu sabit adım tekrarını etkilemez. `check-motion` geometri/çizim saflığı ve yaşam döngüsünü; `check-frame-loop` 30–180 Hz tam rota halat verisi eşitliğini; Brave hareket kontrolü çizim uçlarını ve azaltılmış hareket dönüşünü doğrular.
- **Kurye ölçeği:** `MotionFX.Spring` (k=220, c=18) yalnızca görsel squash/stretch içindir; 1/120 saniyede ilerler. Yakalama −2, bırakma +3, hasar/su −3 itki verir. Çizim değeri ±0,2 ile sınırlıdır; halat eli aynı ölçeğe dönüştürülür. Azaltılmış hareket, yeniden başlama ve kurtarma yayı sıfırlar. `check-motion`, `check-frame-loop` ve Brave hareket kontrolü yay tekrarını, ölçek/halat uyumunu ve Canvas saflığını doğrular. Fizik adımı durdurulmaz.
- **Antrenman:** Süre/can sınırı yok; rekor kaydı yok; seyir defterine yazılmaz.
- **Rekorlar:** `Teslimat süresi` (3/3 mühür + fener) ve `Fener süresi` ayrı tutulur. Antrenman, kayıp ve eksik mühürlü varış teslimat rekorunu değiştirmez.

---

## 7. Saklanan veri (geriye dönük uyumluluk)

Tarayıcı `localStorage` anahtarları (ön ek `sapan-postasi-`):

| Anahtar | İçerik |
|---|---|
| `sapan-postasi-best` | En iyi skor |
| `sapan-postasi-best-time` | Fener süresi rekoru |
| `sapan-postasi-best-time-full` | Teslimat süresi rekoru |
| `sapan-postasi-motion` | Hareket tercihi (`reduced` / `full`) |
| `sapan-postasi-sound` | Ses tercihi |
| `sapan-postasi-tutorial` | Öğretici tamamlandı mı |
| `sapan-postasi-sohbet-v1` | Tanışılan kişiler / sohbet hafızası |
| `sapan-postasi-voyages-v1` | Seyir defteri (`{ version: 1, runs: [...] }`, en fazla 20 kayıt) |

Kurallar:

- Okurken türü, aralığı ve şekli **doğrula**. `voyage-log.js` örnek alınmalıdır: 64 KB üstü ham veriyi reddeder, sürümü kontrol eder, `__proto__` kirletme girişimlerine karşı alan beyaz listesi kullanır (`check-log` bunu test eder). Yeni depolama kodu aynı titizlikte olmalı.
- Şema değişirse yeni sürüm anahtarı (`-v2`) aç, eskiyi sessizce yok say veya güvenle dönüştür; **asla** eski veriyi çökerek okuma.
- Antrenman ve otomatik test koşuları kayıt defterine yazılmaz.

---

## 8. Kod stili ve kalite çıtası

Mevcut kod tarzı: 2 boşluk, çift tırnak, `const`/`let`, kısa ok fonksiyonları, `"use strict"`. Yeni kod bu stile uyar; stil dayatan araçlar eklenirse (ESLint/Prettier) mevcut stil esas alınarak yapılandırılır, tüm dosyalar tek seferde "yeniden biçimlendirilmez" (diff gürültüsü).

- Fonksiyonlar tek iş yapsın. Yeni fonksiyon ~40 satırı geçmesin; mevcut uzun fonksiyonlar (`update`, `finishRun`, `drawAnchor`, `predictReleasePath`) yalnızca **davranışı koruyan** küçük adımlarla bölünür.
- Sihirli sayı yok: adlandırılmış sabit kullan; fizikle ilgili olanlar dosyanın başındaki sabitlerle birlikte durur.
- İş mantığını (kurallar, hesap) DOM'dan ayır: saf fonksiyonlar yaz, test edilebilir olsun; DOM yazımı kenarda kalsın.
- Hata yutma yok. Kasıtlı yutma varsa (depolama gibi) nedenini yorumla açıkla.
- Yorumlar "ne"yi değil "neden"i anlatır.
- Kullanıcıdan veya depolamadan gelen veriyi DOM'a **asla** ham `innerHTML` ile basma (bkz. Bölüm 10).
- Ölü kod, yoruma alınmış kod ve "TODO" ile bırakılmış yarım mantık teslim edilmez.
- Küçük, sebepli bağımlılık bile eklemeden önce sor; çalışma zamanı bağımlılığı eklenemez (kural 1).

---

## 9. Arayüz, erişilebilirlik, metin

- Tüm oyuncuya görünen metinler Türkçe, mevcut ton ve terimlerle tutarlı (Vardiya, Mühür, İskele, Seyir defteri, Fener süresi, Teslimat süresi...). Terimleri değiştirme.
- Kısayollar README ile birebir uyumlu kalmalı: SPACE/fare, ↑↓/W S, ←→/A D, ESC/P, F, M, H, G, E, 1/2/3, R, Shift. Kısayol eklersen/değiştirirsen README'yi aynı değişiklikte güncelle.
- Hareket azaltma (`≈` düğmesi ve `prefers-reduced-motion`) her yeni efektte saygı görmeli.
- Ses ve hareket tercihleri depolamada saklanır; depolama yoksa oturumluk çalışır.
- Büyük PC ekranlarında oyun alanı 1600 piksele kadar büyür, 16:9 oran korunur. 1024×600 pencerede de kullanılabilir olmalı.
- Yeni bir `id` ekler/silersen `index.html` ile `game.js` birlikte güncellenmeli (`check-game` her `querySelector("#id")`'nin HTML'de var olduğunu doğrular).

---

## 10. Güvenlik

Bu çevrimdışı bir oyun, ama aynı tarayıcı profilinde saklanan veri ve ileride eklenebilecek kullanıcı metni (örn. oyuncu adı, içe/dışa aktarma) risk yüzeyidir.

- `innerHTML` şu an doğrulanmış sayısal veriler ve sabit Türkçe metinlerle kullanılıyor (log satırları, split'ler, sohbet seçenekleri `escape()` ile). Kullanıcı kaynaklı **herhangi bir** metin ekleniyorsa `textContent` veya tek bir merkezi `escape` yolu zorunlu.
- `eval`, `new Function`, uzak script/stil/yazı tipi yükleme yok.
- `localStorage` verisi güvenilmez girdidir (Bölüm 7).
- Test kancaları (`__playtestRun` vb.) üretim davranışını değiştirmemeli; kaldırma planı Bölüm 13'te.

---

## 11. Değişiklik protokolü (ajan ve insan için)

1. **Önce oku.** Dokunacağın fonksiyonu ve onu çağıran/test eden yerleri bul (`grep`). Test donanımının dokunduğu isimleri kontrol et (Bölüm 5).
2. **Küçük ve geri alınabilir adımlar.** Bir commit = tek niyet. Davranış değiştiren ve davranış korumayan değişikliği aynı commit'te karıştırma. Refactor commit'inde "no behavior change" iddiası, kanıtla (tüm kontroller aynı sayısal çıktı) desteklenmeli.
3. **Davranışı korurken önce karakterize et.** Kapsamı olmayan bir alanı değiştireceksen önce mevcut davranışı pinleyen test ekle, sonra değiştir.
4. **Her adımdan sonra Bölüm 4'teki komutları çalıştır.** Kırıldıysa: nedenini bul, kodu düzelt veya adımı geri al. Testleri gevşetme.
5. **README'yi gerçekle senkron tut.** Kontroller, kurallar, test listesi değiştiyse README ve bu dosya aynı değişiklikte güncellenir.
6. **Kapsam taşırma.** İstenmeyen iyileştirme, yeniden adlandırma, toplu biçimlendirme yapma. Fark ettiğin ek sorunları değiştirmek yerine raporla.
7. **Emin değilsen dur ve sor.** Özellikle: fizik sabitleri, halka yerleşimi, kayıt şeması, script yükleme sırası, `file://` akışı, bağımlılık eklemek.

### Commit mesajları (İngilizce, Conventional Commits)

`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. Örnek: `refactor(game): extract computeResult from finishRun (no behavior change)`.

---

## 12. `/goal` (uzun otonom çalışma) kuralları

Codex `/goal` ile çalışırken (veya benzeri uzun döngülerde):

- **Her hedefin açık bitiş ölçütü olsun:** "Bölüm 4'teki tüm komutlar geçer ve `check-frame-loop` / `check-delivery` sayısal çıktıları değişmemiştir."
- **Her hedefin kapsam ve süre/bütçe sınırı olsun** ve "dokunma" listesi (Bölüm 2'deki fizik sabitleri, kayıt anahtarları) açık olsun.
- **Büyük işi tek hedefe verme.** Durum makinesi, modül bölme gibi işler alt hedeflere ayrılır; her alt hedef kendi commit(ler)iyle biter.
- **Kırık test = dur.** Çıktıları değiştirerek veya testi gevşeterek "yeşile" boyama. Farkı raporla ve ilgili adımı geri al.
- **Aynı şeyi tekrar tekrar yeniden yazıyorsan** (döngüye girdin) dur, ne denediğini ve neden olmadığını yaz.
- **Her hedef sonunda rapor:** ne değişti, neden, hangi komutlar çalıştı ve sonuçları, doğrulanamayanlar, kalan riskler, sonraki öneri.
- **ES modülü geçişi bir hedef değil, önce bir karardır:** `file://` kısıtı yüzünden alternatifleri (klasik script + tek ad alanı, isteğe bağlı derleme ile tek `index.html`) karşılaştıran kısa bir tasarım notu üret ve sahibinden onay al.

---

## 13. Yol haritası (öncelik sırasıyla)

Bu bölüm projenin yönünü gösterir. Hedefler sırayla ve birbirini kırmadan yapılır.

**Aşama 0 — Güvenlik ağı (geliştirme araçları, çalışma zamanına dokunmaz)**
- `package.json` ve `npm test` (Bölüm 4'teki listeyi çalıştırır; sıfır çalışma zamanı bağımlılığı).
- Tamamlandı: ESLint mevcut stile göre yapılandırıldı; iki boşluk/UTF-8 `.editorconfig` ile tanımlandı. Toplu biçimlendirme yapılmadı.
- Tamamlandı: `// @ts-check` + JSDoc ile kademeli tip kontrolü başladı (`level-data.js`, `harbor-map.js`).
- Tamamlandı: GitHub Actions, Node 24 ile lint, typecheck ve `npm test` çalıştırır. Dört Brave kontrolü ayrı `npm run test:browser` betiğindedir.

**Aşama 1 — Test donanımını desteklenen bir arayüze taşı (davranış değişmez)**
- Kaynak metin yamalamayı (Bölüm 5) açık bir test arayüzüyle değiştir; çıktılar bire bir aynı kalsın.
- Bu aşama bitmeden Aşama 3'e girme.

**Aşama 2 — Düşük riskli temizlik**
- `__playtestRun` üretim kancasını enjekte edilen seçenekle değiştir.
- Halka/seviye verisini (`anchors`, `anchorHeights`, `fragile`/`winch` kimlikleri, aralıklar) ayrı bir veri dosyasına çıkar; yeni parkur kod değiştirmeden eklenebilsin.
- `finishRun` içinden saf `computeResult(runState)` çıkar, birim testlerini yaz; DOM yazımı ayrı kalsın.

**Aşama 3 — Durum makinesi**
- Metin tabanlı `state` bayraklarını açık bir durum makinesine (`enter/update/draw/exit`) taşı; `frame()` sadeleşsin.
- Durum başına tek commit; her adımda tüm kontroller ve kare döngüsü tekrarı aynı çıktıyı vermeli.
- `update`, `drawAnchor`, `predictReleasePath` gibi uzun fonksiyonları davranışı koruyarak böl.

**Aşama 4 — Sertleştirme**
- `innerHTML` ile veri basan yerleri (log satırları, split'ler, sohbet seçenekleri, HUD ipuçları) `textContent`/DOM kurma veya tek merkezi `escape` ile değiştir; düşmanca string'lerle test ekle.

**Aşama 5 — Kararlar (sahibi onaylamadan başlama)**
- Modül sistemi: `file://` ile uyumlu seçenek (Bölüm 12).
- TypeScript'e geçiş gerekli mi, yoksa JSDoc yeterli mi.
- Seviye editörü / yeni parkur / yeni bölge içeriği.
- Java (libGDX/JavaFX) portu: ayrı bir proje olarak planlanır; bu depodaki saf fizik/kural mantığı ve `check-*` senaryoları karakterizasyon testi olarak taşınabilir.

**Kapsam dışı (şimdilik)**
- Mobil/dokunmatik tam destek, çok oyunculu, çevrimiçi sıralama, hesaplar, analitik/telemetri, reklam, harici API.

---

## 14. "Bitti" tanımı

Bir iş şu koşulların hepsi sağlanınca bitmiştir:

- [ ] Bölüm 4'teki tüm komutlar geçiyor (veya doğrulanamayanlar açıkça belirtildi).
- [ ] Deterministik fizik sonuçları (`check-frame-loop`, `check-delivery`, `playtest-route`) davranış değişmeyen işlerde **birebir aynı**.
- [ ] Yeni/değişen davranış için test var; testler yeşile boyanmadı.
- [ ] `file://` ile açılış, depolamasız çalışma ve Türkçe metinler bozulmadı.
- [ ] Kayıt anahtarları/şemaları uyumlu.
- [ ] README ve bu dosya gerekiyorsa güncellendi.
- [ ] Commit'ler küçük, tek niyetli, İngilizce ve anlamlı.
- [ ] Kapsam dışı değişiklik yok; fark edilen ek sorunlar raporlandı.

---

## 15. Bilinen riskler ve tuzaklar

- **Metin yamalı test donanımı (Bölüm 5):** `game.js`'te yapılan masum görünen bir yeniden adlandırma bütün testleri kırabilir.
- **`game.js` büyük tek IIFE** (yaklaşık 1.800 satır, 50'den fazla durum değişkeni): iç içe koşullar `frame()`/`update()` içinde kolay yanlış anlaşılır. Okurken durum geçişlerini önce çıkar.
- **Global ad alanı ve script sırası:** Modüller `globalThis`'e bağlı; sıra bozulursa sessizce `undefined` olur.
- **Otomatik testler insan zorluğunu ölçmez:** "Parkur bitiyor" ≠ "oynaması keyifli". Denge değişikliği insan testi ister.
- **Performans raporu garanti değildir:** 28 FPS altında oyun zamanı bilinçli olarak yavaşlar.
- **`work/` bir geliştirme klasörü:** `work/backup-*`, `work/claude-handoff.md`, `work/probe-*`, `work/evidence/` `.gitignore`'dadır; commit'leme.
