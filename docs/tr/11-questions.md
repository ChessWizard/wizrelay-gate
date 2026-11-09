<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/11-questions.md)
<!-- /nav -->

# Soru döngüsü

İki kişinin arasından geçen tek akış ve panonun dürüstçe ölçtüğü tek şey.

```
Developer    /wizrelay:ask  →  questions.md içinde Q-001 AÇIK  →  kartta bir yorum
Researcher   hub-inbox  →  bir karar  →  decisions.md içinde D-004  →  araştırma v2 yayında
Developer    sync  →  fark  →  plan adımları işaretlenir  →  Q-001 YANITLANDI (D-004)
```

## Soru birine sorulur

Her sorunun bir muhatabı vardır ve soruyu yalnızca muhatabı görür. Soran kendi sorusunu
görmeye devam eder; paneli yönetenler hepsini görür.

Eksik olan buydu. Eskiden her soru herkesin ekranında çıkıyordu; kulağa açık geliyor ama
tam tersi: çoğu başkasına ait olan bir liste kimsenin okumadığı bir listedir ve görevi
asıl bekleten soru günlerce orada kalır.

Muhatabı söylemenin üç yolu var ve hepsi aynı mekanizma:

```markdown
## Q-012 Hangi önbellek stratejisi?

Durum: AÇIK
Soruldu: 2026-11-08
Soran: @isa@ornek.com
Kime: @ayse@ornek.com, @mert
Bağlam: AC-3
```

- **`Kime:`** (İngilizce bir hub'da `Ask:`) bir ya da birkaç kişiyi virgülle ayırarak anar.
- **`@kişi`** sorunun başlığında ya da gövdesinde, nerede olursa olsun, aynı işi görür.
- **Kimse anılmamışsa** soru projenin **araştırma sorumlusuna** düşer; proje başına belirlenir.

Araştırma sorumlusu tanımlı olmayan bir projedeki soru kimseye adreslenmemiştir. Panel
bunu kartın üzerinde söyler — yalnızca bir admin'in bakacağı bir yere koymak yerine.

## Yazarken birini çağırmak

Konsol kutusunda `@`, bir mention'ın anabileceği kişileri önerir: burada giriş yapabilen
herkes ve bağlı tracker çalışma alanındaki herkes. İkinci grup göründüğünden önemlidir —
bir sözleşmenin neden öyle olduğunu bilen kişinin çoğu zaman bu panelde hesabı yoktur ve
ona sorulacak sorunun önce adreslenebilir olması gerekir.

Ok tuşları ve Enter ile seçin ya da yazmaya devam edin. Araya giren şey bir adrestir;
çünkü tekil olan ve yönlendirmenin karşılaştırdığı şey odur.

## Kartta sormak

**Tracker'da sor**, soruyu görevin kartına yorum olarak bırakır, muhatabına adresler ve
tracker onu aynı adresle tanıyorsa üzerine atar.

Yorum kendi kimliğini taşır — ilk satırda `[wizrelay Q-012]` — panel daha sonra kendi
yorumunu ona gelen yanıttan böyle ayırır. Yanıtlar kartta kalır ve burada sorunun altında
görünür; böylece soran kişi cevabı paneli terk etmeden okur.

Yanıt, soruyu anan herhangi bir yorumdur. İnsanlar `Q-012` yazarak cevaplar; belirli bir
sözdizimi istemek, cevap vermemelerini istemektir.

## Ekranda ne var

- **Benim** — sizin sorduğunuz ve beklediğiniz sorular.
- **Gelen kutusu** — yanıtı sizden beklenen sorular.
- soru, soran, muhatap ve hangi kabul kriterini bekletiyor
- **ne kadardır beklediği** — kimsenin takip etmediği, herkesin hissettiği ölçü
- karttan dönen yanıtlar
- yanıtlandığında, soruyu doğuran kararın yanında duran karar ve onu taşıyan sürüm

Çalıştırma ekranında döngü yedi durak olarak çizilir: soruldu, pakete yazıldı, tracker'a
gönderildi, yanıt, karar, yeni araştırma sürümü, depoya çekildi. Her durak kendi durumunu
taşır ve hepsi aynı yerden okunur — diskteki paket. Hiçbir şey tahmin edilmez: tracker
yorumu hiç var olmamış bir durak atlanmış görünür, `decisions.md` içinde olmayan bir
karar durağını boş bırakır.

## Neden sohbet değil de döngü

Yalnızca tracker yorumu olarak verilen bir cevap, paketi okuyan bir sonraki oturum ve diğer
bütün developer'lar için görünmezdir. Döngü `decisions.md` ve bir sürüm artışıyla biter;
bir sonraki `pull` ya da `sync` bunu taşır. Panel bunu yanıtın altında söyler: yanıt
geldiyse araştırmayı güncellemek için paketi çekin.

Erişim kurallarının geri kalanı için [Kim neyi görür](20-access.md) sayfasına bakın.

<!-- foot -->
← Önceki: [Doğrulama raporu](10-verify.md) · [Dokümantasyon](README.md) · Sonraki: [Ayarlar, bağlantılar ve gizlilik](12-settings.md) →
<!-- /foot -->
