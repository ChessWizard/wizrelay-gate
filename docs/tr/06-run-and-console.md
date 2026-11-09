<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/06-run-and-console.md)
<!-- /nav -->

# Çalıştırma ve konsolu

Relay çalıştırma ekranı tek bir task'ın izlendiği yer; konsol ise onunla konuşulan yer.

## Çalıştırma ekranı

- **Başlık** başlığı, research sürümünü, tracker bağlantısını ve bu task'ın
  yönlendirmesinin ürettiği tam başlatma komutunu taşır.
- **Hatlar** iki kart: araştırma hattı ve geliştirme hattı. Her kart kendi adını, neye
  karşı çalıştığını ve onu çalıştıran düğmeyi taşır — araştırma hattı hub'ı, geliştirme
  hattı işin ineceği projeyi ve hub kataloğundaki rolü rozet olarak gösterir. Bu rol için
  bağlı bir depo yoksa proje rozeti bunu söyler ve depoyu bağlayacak yere bağlanır.
- **Soru döngüsü** hatların altında, açık bir soru varsa durur.
- **Kapı paneli** **Kontroller** ile açılır — deterministik tespitler; her biri onu üreten
  dosya, glob ya da komutla. Konsol, Çıktılar ve Metrikler birer sekmedir.
- **Bağlam sütunu** kapsamı, kabul kriterlerini, yönlendirme özetini ve açık soruları tutar.

Henüz başlayamayan bir kapı hangi kapıyı beklediğini söyler. Seni bekleyen bir kapı,
istemini bir logun içine saklamadan sekmelerin üstünde gösterir.

## Konsol

Konuşabildiğin bir iş günlüğü:

- Claude'un metni; araç çağrıları tek satıra katlanmış, düşünme bir anahtarın arkasında
- çıkış kodu ve çıktısıyla komutlar
- henüz yazılmamışsa "önerildi" diye işaretlenmiş diff'ler
- koruma olayları: `ask` bir isteme dönüşür, `deny` ise buradan geçersiz kılınamayan bir
  bilgi kartına
- yanıtlanana kadar alta sabitlenen açık istem

Yazma alanı mesaj gönderir, slash komutlarını sunar ve 5 MB'a kadar ek kabul eder. Bu
aşamanın modeli ve effort'u Gönder'in yanındadır; oturum, yönlendirmenin önerdiği tier'ın
altında çalışıyorsa uyarı çıkar.

## Çalışan adımı takip etmek

Başlıkta bir anahtar var: **Takip ediyor**. Açıkken hangi kapı çalışmaya başlarsa panel
onun konsoluna geçer. Varsayılan açıktır; dokuz kapılık bir hattı izlemek, aksi hâlde bir
noktanın rengini fark edip tıklamak demek.

Kapatılabilir, çünkü takip tam da biri bir şey okurken yanlıştır. Tercih yalnızca o
tarayıcıda tutulur. Yalnızca **çalışan** kapı takip edilir: cevap bekleyen bir kapı, onu
cevaplamak için açtığın şeyden seni koparmaz.

Bir kapı cevap beklemeye başladığında gelen kutusuna bir bildirim düşer — hangi task,
hangi soru, ve bekleyen konsola giden bağlantı. Task bazında tekilleştirilir.

## Döküm nasıl okunur

Bir tur kimin konuştuğuyla başlar — **Sen** ya da **Claude** — ve arka arkaya gelen
mesajlar tek tur olarak toplanır; her satıra isim damgası basılmaz.

Claude'un yanıtı düz blok olarak değil, **belge olarak** çizilir: başlıklar, listeler,
tablolar ve dil etiketli kod blokları. Okuyucu panelin kendi okuyucusudur ve HTML
üretmez — metin bir modelden gelip doğrudan ekrana gittiği için bu önemli.

Araç çağrıları tek satırlık bir şerit: ne çalıştı, nerede. Komutlar çıkış koduyla.
Oturumun stderr'e yazdığı satırlar uyarıysa amber, gerçekten hataysa kırmızı çizilir —
"8 izin kaydı yok sayıldı" gibi bir not, sağlıklı bir koşuyu bozuk göstermemeli.

İstem konsolda **bir kez** görünür. Komut satırında istemin yerinde `…` vardır, çünkü
istem zaten onun üstündeki satırdır; aynı şekilde oturumun kapanış `result` satırı son
yanıtı tekrarladığı için yalnızca başka hiçbir yanıt gelmediyse yazılır.

## Oturum canlı olarak nasıl görünür

Konuşmalı bir kapı senin makinende `claude -p --output-format stream-json
--include-partial-messages` açar ve oturumun kendi anlattığı her şey konsola düşer.

Claude Code 2.1.311 ile 2026-11-08'de ölçülen, iki araç çağıran bir tur:

```
  1592ms  hook'lar çalışıyor      ← plugin'in SessionStart hook'u
  7920ms  oturum açıldı
  7920ms  modele soruyor
  9086ms  Read çalıştırıyor       ← aracı taşıyan mesajdan ~4 sn önce
 13565ms  düşünüyor               ← araç döndü, model yeniden soruluyor
 26773ms  modele soruyor
 29756ms  yanıt
```

Konsolda alt satır her an hangi aşamada olunduğunu ve o aşamanın kaç saniyedir sürdüğünü
yazar. Uzun bir sessizlik artık "takıldı mı" değil, "düşünüyor · 11s" olarak okunur.

**Token akışı.** Yanıt metni geldiği hızda yazılır, imleçle birlikte. Ölçümde görülen şu:
bir aracın çağrıldığı turlarda olaylar tüm koşuya yayılıyor, ama tek bir yanıt metni
çoğu zaman tek seferde geliyor — `-p` kipinde Claude Code cevabı bütün hâlde üretiyor.
Yani harf harf yazma her zaman görülmez; **aşamalar her zaman görülür**, ve asıl soruyu
("şu an ne yapıyor") cevaplayan onlar.

**Kaydedilen ile gösterilen ayrı.** Token'lar ve aşama satırları yalnızca canlı kanaldan
geçer: diske yazılmaz, relay kaydına işlenmez, sayfayı yenileyince tekrar oynatılmaz.
Kalıcı döküm eskisiyle aynı — mesajlar, araç çağrıları, komutlar, kontroller. Bir token'ı
kaçırmak birkaç harf kaybetmektir; onu kaydetmek dökümü tuş kaydına çevirirdi.

**Neden WebSocket değil.** Bu akış tek yönlü: sunucudan tarayıcıya. Server-sent events
tam olarak bunu yapar, kendi kendine yeniden bağlanır, her proxy'den geçer ve panelin
yanında ikinci bir sunucu istemez. WebSocket burada hiçbir şey kazandırmaz, üçünü birden
kaybettirir.

**Maliyet.** Ölçüldü: bir kapı koşusu ortalama **7 HTTP isteği** üretiyor, veritabanında
her gönderim için tek satır açılıyor ve iş bitince hepsi siliniyor. Ölçümden sonra kalan
satır sayısı sıfır.

## Akış nasıl çalışır

Konsol `/api/relays/<id>/gates/<kapı>/stream` adresine abone olur. Gördüğü son sıra
numarasını geçer; sunucu yalnızca eklenen günlükten sonrasını tekrar oynatır ve ardından
canlı akıtır. Böylece yeniden bağlanmada hiçbir şey kaybolmaz ve konsol hangi durumda
olduğunu söyler: bağlanıyor, akıyor, duraklatıldı, takıldı, yeniden bağlandı ya da
bağlantı yok.

<!-- foot -->
← Önceki: [Relay panosu](05-board.md) · [Dokümantasyon](README.md) · Sonraki: [Kapı istemleri ve onaylar](07-prompts.md) →
<!-- /foot -->
