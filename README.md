# Sapan Postası

Gece limanında paket yetiştiren kuryeyi halkadan halkaya savur. Üç mührü toplamaya çalış; canlarını tüketmeden fener iskelesine var.

## Başlatma

Windows'ta `BASLAT.cmd` dosyasına çift tıkla. Oyun varsayılan tarayıcıda açılır. İstersen `index.html` dosyasını doğrudan da açabilirsin.

Oyun internetsiz çalışır; kurulum, eklenti veya API anahtarı istemez. En iyi skor bu tarayıcıda yerel olarak saklanır.

## PC'de antrenman

Ana menüde **Antrenman** bölümünden **Başlangıç**, **Orta iskele** veya **Fener hattı** seç. Menü açıkken aynı noktaları **1**, **2** ve **3** tuşlarıyla da açabilirsin. Antrenmanda süre ve can sınırı yoktur; **R** son güvenli iskeleye döndürür. Skor rekor olarak kaydedilmez. Normal koşu için **Vardiyaya başla** düğmesini kullan.

## Kontroller

Antrenmanda bir halkaya bağlıyken noktalı çizgi, şimdi bırakırsan yaklaşık bir saniye boyunca izleyeceğin uçuş yolunu gösterir. **G** veya sağ üstteki **YOL** düğmesiyle açıp kapatabilirsin. Temiz fırlatma yolu sarı, normal yol turkuaz; suya, üst sınıra veya geri dönüş sınırına ulaşacak yol kırmızıdır. Tahmin, mevcut yön tuşunu basılı tutacağını varsayar; şamandıra çarpışmalarını ve sonraki halkaya tutunmayı hesaba katmaz. Normal vardiyada bu yardımcı kapalıdır.

- **SPACE** veya oyun alanında fareyi basılı tut: Yakındaki halkaya tutun.
- **SPACE** veya fareyi bırak: Halatı bırakıp ivmeyle fırlat.
- Halata bağlıyken **↑ / W** ile kısalt, **↓ / S** ile uzat. İpi içeri toplamak gerili salınımda teğetsel hızı artırır; hız mevcut fizik sınırlarında tutulur.
- **Sol / sağ ok** ya da **A / D**: Havada yön ver.
- **ESC** veya **P**: Duraklat; dokunmatik ekranda oyun alanındaki duraklat düğmesini kullan.
- Dokunmatik ekranda **TUTUN** düğmesini basılı tut; kancaya bağlıyken parmağını ilk bastığın noktanın üstünde tutarak ipi kısalt, altında tutarak uzat. Parmağını başlangıç noktasına döndürünce ayar durur; kaldırınca halat bırakılır. Sol/sağ düğmeleriyle yön ver.

İlk koşuda halkaya tutunmayı, ipi yönetmeyi, temiz atışı ve havada yön vermeyi gösteren kısa bir öğretici açılır; bu sırada vardiya sayacı durur. Yön vererek tamamlayabilir veya **ATLA** ile kapatabilirsin. Son ipucu güvenli bir anda kendiliğinden kaybolur; tamamlamadıysan sonraki koşuda yeniden gösterilir.

Halatla savrulurken **ŞİMDİ BIRAK · TEMİZ FIRLATMA** bildirimi görünürse bırakma zamanı gelmiştir. Temiz atış kombona ek puan ve ileri doğru sapan ivmesi kazandırır; salınımın en dibine yakın bırakınca ivme güçlenir.

Bazı halkalar farklı davranır; oyun içindeki görünümleri ve ipuçları onları tanıtır. **Kırılgan halka** tutunduktan 1,55 saniye sonra kopar. **Motorlu makara** ipi otomatik olarak saniyede 135 piksel toplar; **S** tuşuyla buna karşı koyabilirsin.

Üç mühür ve güvenli geçişler puan kazandırır. Kırmızı şamandıralardan ve suya düşmekten kaçın; düşüş bir can götürür ve son güvenli iskelede devam edersin.

Kurtarıldığında iskelede bekleyebilirsin. Hazır olunca **yeniden** SPACE/fare veya yön/ip kontrolüne bas; düşmeden önce basılı tuttuğun tuşu önce bırakmalısın. Bu bekleme, duraklatma ve öğretici süreleri vardiya sayacına ve süre rekoruna eklenmez. Şamandıra dokunulmazlığı suya düşmeyi engellemez.

Orta iskele ve fener hattında geçiş süren gösterilir. Sonuç ekranında toplam süreyi, iskele geçişlerini, temiz atış sayısını ve düşüş/çarpışmaları görebilirsin. **Fener süresi** rekorunu yalnızca iskeleye ulaşan normal vardiyalar kaydeder; antrenman veya başarısız koşu değiştirmez. Üç mühürden azıyla varırsan sonuç bunu açıkça gösterir; üçü de toplandıysa teslimat tamamlanır. Yeniden doğduğunda o ana kadarki aktif süre korunur. Fener yaklaşımında son bir normal halka bulunur.

## Geliştirme ve doğrulama

Projenin GitHub deposu: [zGaunna/Sapan-Postas-](https://github.com/zGaunna/Sapan-Postas-).

Oyun Vanilla JavaScript ve Canvas kullanır; paket kurulumu veya derleme gerekmez. Node.js kuruluysa proje klasöründe şu kontrolleri çalıştırabilirsin:

```sh
node --check game.js
node work/check-game.cjs
node work/playtest-route.cjs
```

İlk test; antrenman modlarını, yeniden denemeyi, süreyi, özel halkaları, rekor ayrımını, bozuk/engellenmiş depolamayı, iskele sürelerini, güvenli kurtarmayı ve uçuş önizlemesinin gerçek oyun fiziğiyle eşleşmesini kontrol eder. Parkur testi, aynı girdilerle tekrarlanabilir bir kontrol stratejisinin 30/60/120/180 Hz adımlarında vardiyayı bitirdiğini doğrular; insan oyuncunun zorluğunu ölçmez ve üç mührün de toplanabildiğini henüz kanıtlamaz.
