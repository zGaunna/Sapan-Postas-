(() => {
  "use strict";
  const people = [
    { id: "emine", dock: "rihtim", name: "Emine abla", role: "Postahane", x: 310, look: "postaci", color: "#ab7765" },
    { id: "hasan", dock: "rihtim", name: "Hasan abi", role: "Balıkçı", x: 710, look: "balikci", color: "#779f91" },
    { id: "okan", dock: "vinc", name: "Okan abi", role: "Tamirci", x: 5720, look: "tamirci", color: "#d7a86e" },
    { id: "nermin", dock: "vinc", name: "Nermin abla", role: "Çay ocağı", x: 6140, look: "cayci", color: "#ad858f" },
    { id: "leyla", dock: "dalgakiran", name: "Leyla abla", role: "İskele görevlisi", x: 11010, look: "postaci", color: "#7b9da5" },
    { id: "sefa", dock: "dalgakiran", name: "Sefa", role: "Tekneci", x: 11450, look: "balikci", color: "#9b9567" },
    { id: "yusuf", dock: "fener", name: "Yusuf abi", role: "Fener bekçisi", x: 17530, look: "fenerci", color: "#b4a084" }
  ];
  const objects = [
    { id: "ilan", dock: "rihtim", name: "İlan panosu", x: 520, kind: "board" },
    { id: "makara", dock: "vinc", name: "Makara tezgâhı", x: 5920, kind: "tools" },
    { id: "zil", dock: "dalgakiran", name: "İskele zili", x: 11220, kind: "bell" },
    { id: "defter", dock: "fener", name: "Seyir defteri", x: 17250, kind: "book" }
  ];
  const line = (text, choices = []) => ({ text, choices });
  const choice = (text, next) => ({ text, next });
  const dialogues = {
    emine: {
      start: line("Gel kardeşim, zarfları şuradan al. Hasan'ın paketini ayrı koydum; üstünde mavi ip var.", [choice("Emine abla, bugün kime gidiyoruz?", "rota"), choice("Niye bu saatte yolluyorsun beni?", "saat"), choice("Tamam abla, ben çıkıyorum.", null)]),
      rota: line("Önce balıkçıların oraya, sonra vinçlerin arkasına. Sonuncusu fener yolunda. Üçünü de alıp Yusuf abine bırakıyorsun. İsimleri karıştırma yeter.", [choice("Yolda bir nefes alırım ben.", "mola"), choice("Tamam, hallederim.", null)]),
      saat: line("İlk tekne beşte kalkıyor, ondan. Gündüz versek de olurdu ama Hasan gene son dakika getirdi zarfı. Ona da söylersin, bir dahakine erken getirsin.", [choice("Hasan abi yine mi?", "hasan"), choice("Yetişirim abla, merak etme.", null)]),
      hasan: line("Yine. Bir de 'iki dakika sürer' diyor. İki dakika ona, bütün gece bize. Neyse, çayın burada duruyor; dönünce içeriz.", [choice("Dönerken uğrarım.", null)]),
      mola: line("Al tabii. Acele edeceğim diye suya düşme. Okan'ın yanında bir iskele var; Nermin ablan da çayı yeni koymuştur.", [choice("İyi dedin, sağ ol abla.", null)]),
      done: line("Hoş geldin kardeşim. Yetiştirdin mi? Güzel. Zarfları bırak, şuraya otur. Çayı bir daha ısıtırım, soğumuştur şimdi.", [choice("Hasan abiye erken getirmesini söyledim.", "hasan"), choice("Eline sağlık abla.", null)])
    },
    hasan: {
      start: line("Heh, geldin kardeşim. Benim paketi Emine verdi mi sana? Mavi ipli olan, onu diyorum.", [choice("Verdi abi. Bir dahakine erken getir diyor.", "erken"), choice("Bu gece deniz nasıl?", "deniz"), choice("Kolay gelsin Hasan abi.", null)]),
      erken: line("Haklı kadın. Eve uğradım, çocuk uyumamış; bir onu yatırayım dedim, saat geçmiş. Söz, yarın ilk iş götürürüm.", [choice("Yusuf abiye bırakırım ben.", "teslim"), choice("Olur abi, söylerim.", null)]),
      deniz: line("Şimdilik sakin. Vinçlerden sonra rüzgâr alırsın yalnız. Kıyıya yakın git, kardeşim. Açıkta gereksiz yere oyalanma.", [choice("Dalgakırandaki Sefa çıktı mı?", "sefa"), choice("Sağ ol abi.", null)]),
      sefa: line("Daha burada görmedim. Çıktıysa Leyla bilir. Bir uğra, kadın tekne defterini tutuyor zaten.", [choice("Tamam, sorarım.", null)]),
      teslim: line("Sağ ol. Parası değil, içindeki evrak önemli. Islanmasın yeter. Sen de üşüdüysen gel, ceketin yedeği teknede var.", [choice("İyiyim abi, sağ ol.", null)])
    },
    okan: {
      start: line("Dur kardeşim, şu eldiveni bir göreyim. Avucu açılmış bunun. Halatı böyle tutarsan elini keser.", [choice("Bir vardiya daha çıkarır mı abi?", "eldiven"), choice("Şu sarı makaralar senin mi?", "makara"), choice("İşini bölmeyeyim abi.", null)]),
      eldiven: line("Çıkarır da, dönüşte bana bırak. Derisi var burada, iki dikiş atarım. Şimdilik düğümü parmağına dolama, yeter.", [choice("Tamam abi, dönerken uğrarım.", null)]),
      makara: line("Ben taktım. Sarı olan ipi kendi toplar. Aşağı basıp karşı koyabilirsin. Kırmızı halkalarda da fazla bekleme, eski parçaları değiştiremedik daha.", [choice("Çok hızlı topluyor gibi geldi.", "hiz"), choice("Sağ ol abi, anladım.", null)]),
      hiz: line("Evet, biraz sert ayarlamışım. İpi uzatınca sakinleşir. Sonra aynı anda hem çekip hem salmaya uğraşma, kafanı karıştırırsın.", [choice("Bir daha deneyeyim ben.", null)])
    },
    nermin: {
      start: line("Hoş geldin kardeşim. Çay taze, ister misin? Şu sandalyeyi de çek, ayakta içme.", [choice("İçerim Nermin abla, sağ ol.", "cay"), choice("Buralarda hep gece mi çalışıyorsunuz?", "gece"), choice("Sonra içerim abla, yetişmem lazım.", "acele")]),
      cay: line("Al bakalım. Şeker şurada. Okan'a da bir bardak götürür müsün, sabahtan beri aynı tezgâhın başında.", [choice("Götürürüm abla.", "okan"), choice("Senin işin de hiç bitmiyor.", "gece"), choice("Eline sağlık.", null)]),
      okan: line("İyi olur. 'Az sonra gelirim' dedi, iki saat oldu. Tamir biter de kendi gelmez. Neyse, sen de kendini yorma.", [choice("Söylerim abla.", null)]),
      gece: line("Tekneler gece geliyor, bizim iş de onlara bakıyor. Gündüz daha sakin. Çocuk okuldan çıkınca kapatıyorum zaten.", [choice("Kolay gelsin abla.", null)]),
      acele: line("Peki, dönüşte uğra. Çayı koyarız gene. Yalnız fener yolunda rüzgâr var; montun açık kalmış, onu bir kapat.", [choice("Sağ ol abla, kapattım.", null)])
    },
    leyla: {
      start: line("Gel kardeşim. Sefa'nın teknesini görürsen haber ver, deftere saatini yazacağım. Çıkarken uğramamış yine.", [choice("Biraz ileride gördüm abla.", "sefa"), choice("Fener yolunda hangi tarafa gideyim?", "yol"), choice("Zil hâlâ çalışıyor mu?", "zil")]),
      sefa: line("İyi, döndüyse ben de rahat ederim. Ona de ki şu deftere kendi gelip imza atsın. Her gece peşinden koşmayacağım.", [choice("Söylerim abla.", null)]),
      yol: line("Taşların yanındaki halkaları takip et. Üçüncü paket biraz yukarıda; ipi kısaltıp geç bırakınca yaklaşırsın. Su tarafına çok açılma.", [choice("Yusuf abi fenerde midir?", "yusuf"), choice("Sağ ol abla.", null)]),
      yusuf: line("Oradadır. Işığı gördün mü zaten anlarsın. Kapısı açık olur, çekinmeden gir.", [choice("Tamam, ben gidiyorum.", null)]),
      zil: line("Çalışıyor. Şu kenardaki kolu çekmen yeter. Sis bastırınca tekneler sesi takip ediyor. Şimdi çalarsan Sefa da duyar.", [choice("Bir deneyeyim.", null)])
    },
    sefa: {
      start: line("Abi, iyi ki geldin. Fenerden dönerken şu ipi Yusuf abiye bırakır mısın? Benim elim dolu, tekneyi bağlayacağım.", [choice("Bırakırım. Leyla abla imza bekliyor.", "defter"), choice("Tekneyi hep tek başına mı bağlıyorsun?", "tekne"), choice("Kolay gelsin kardeşim.", null)]),
      defter: line("Hah, onu unuttum. Kızacak şimdi. Bunu bağlayayım, hemen gidiyorum. Sen söylersen gelir diye düşünmesin, kendim gideceğim.", [choice("Git de beklemesin kadın.", null)]),
      tekne: line("Babam bu hafta evde. Belini incitti. Ben de ağır gelen kısmı yavaş yapıyorum. Şu fenerin altında daha rahat bağlanıyor aslında.", [choice("Geçmiş olsun, selam söyle.", "baba"), choice("Dikkat et eline.", null)]),
      baba: line("Sağ ol abi, söylerim. Sana da selamı vardır. Bir dahaki gelişinde çaya otururuz.", [choice("Olur kardeşim.", null)])
    },
    yusuf: {
      start: line("Hoş geldin kardeşim. Çantanı masaya bırak, ağırdır o. Rüzgâr iyice çıktı mı aşağıda?", [choice("Çıktı abi, biraz uğraştırdı.", "ruzgar"), choice("Paketleri getirdim.", "paket"), choice("Fenerin ışığını sen mi ayarlıyorsun?", "isik")]),
      ruzgar: line("Belli, saçın başın dağılmış. Sobayı yeni yaktım, iki dakika dur da ısın. Eve giderken kıyı yolundan dönersin.", [choice("Çay var mı abi?", "cay"), choice("Sağ ol abi.", null)]),
      paket: line("Sağ olasın. Üçü de geldiyse şuraya koy, sabah tekneye ben veririm. Bir şey eksikse de söyle; şimdi kimseyi tekrar koşturmayalım.", [choice("Emine abla dönüşte uğra dedi.", "emine"), choice("Tamam abi.", null)]),
      isik: line("Evet. Şu kolu çevirince yönü değişiyor. Ama her rüzgârda yeniden ayarlamak gerekiyor; bir kere yapıp bırakılmıyor.", [choice("Geceleri sıkılmıyor musun abi?", "gece"), choice("Kolay iş değilmiş.", null)]),
      gece: line("Arada sıkılıyorum. Radyo var, çay var. Bir de sizin gibi biri uğrayınca iki laf ediyoruz. Sabahı buluyor işte.", [choice("Arada uğrarım ben de.", null)]),
      cay: line("Var tabii. Bardakları raftan al, ben doldurayım. Şekersiz içiyordun, değil mi?", [choice("Öyle abi, sağ ol.", null)]),
      emine: line("Uğra kardeşim, bekler o. Sen dönene kadar çayı üç kere ısıtır yine. Hasan da buraya gelirse erken uğrasın diyeceğim.", [choice("İyi geceler abi.", null)]),
      done: line("Üç paket de tamam. Eline sağlık kardeşim, bu gecelik iş bitti. İstersen otur, çayı döktüm daha.", [choice("Oturayım biraz abi.", "cay"), choice("Emine ablaya uğrayacağım.", "emine"), choice("İyi geceler abi.", null)])
    },
    ilan: { start: line("Panoda Hasan'ın aceleyle yazdığı bir not var: 'Ağ tamiri yapılır. Borcu olan çay ısmarlasın.' Altına biri eklemiş: 'Önce kendi borcunu öde Hasan abi.'", [choice("Notu yerine bırak.", null)]) },
    makara: { start: line("Tezgâhta açık bir makara, birkaç anahtar ve yarım bardak çay duruyor. Sarı etikette Okan'ın yazısı: 'İp kendiliğinden toplanır. Önce boşta dene, sonra yük ver.'", [choice("Tezgâha dokunmadan geri çekil.", null)]) },
    zil: { start: line("Zili bir kez çalıyorsun. Sesi taşların arasından denize yayılıyor. Sefa başını kaldırıp el sallıyor: 'Duydum abi, buradayım!'", [choice("Kolu bırak.", null)]) },
    defter: { start: line("Yusuf abi bugünün sayfasına küçük bir not düşmüş: 'Rüzgâr kuzeyden. Hasan yine geç geldi. Sefa'nın ipi değişecek.' Kenardaki mürekkep henüz kurumamış.", [choice("Defteri kapat.", null)]),
      done: line("Yusuf abi yeni bir satır eklemiş: 'Üç paket de geldi. Çocuk bu gece yetiştirdi.' Bir önceki sayfada çay lekesi var.", [choice("Defteri kapat.", null)]) }
  };
  const contacts = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem("sapan-postasi-sohbet-v1") || "[]");
    if (Array.isArray(saved)) for (const id of saved) if (people.some(p => p.id === id)) contacts.add(id);
  } catch { /* Conversations remain playable without storage. */ }
  function remember(id) {
    if (!people.some(p => p.id === id)) return;
    contacts.add(id);
    try { localStorage.setItem("sapan-postasi-sohbet-v1", JSON.stringify([...contacts])); } catch { /* Optional. */ }
  }
  function targets(dockId) { return [...people, ...objects].filter(p => p.dock === dockId); }
  function nearest(dockId, x, distance = 90) {
    if (!Number.isFinite(x)) return null;
    return targets(dockId).filter(p => Math.abs(p.x - x) <= distance)
      .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0] || null;
  }
  function getNode(id, node = "start", context = {}) {
    const person = [...people, ...objects].find(p => p.id === id);
    if (!person) return null;
    if (node === "start" && context.delivered && dialogues[id]?.done) node = "done";
    const value = dialogues[id]?.[node];
    return value ? { person, node, text: value.text, choices: value.choices } : null;
  }
  globalThis.HarborSocial = { people, objects, targets, nearest, getNode, remember,
    contacts: () => [...contacts] };
})();
