<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/13-architecture.md)
<!-- /nav -->

# Kodun düzeni

Feature klasörleri ve bir testin uyguladığı katman kuralı.

```
src/
├── app/           yalnızca Next.js yolları — her sayfa bir ekranı bağlar, mantık taşımaz
├── core/          saf alan: kapılar, durumlar, relay'ler, yönlendirme, ayrıştırıcılar, zaman
├── services/      dünyaya dokunan her şey: CLI, git, depo, motorlar
├── features/      özellik başına bir klasör; bileşenleri ve server action'larıyla
└── shared/        tasarım sistemi, UI kiti, i18n, küçük yardımcılar
```

## Katman kuralı

```
core (saf, IO yok)  ←  services (git, dosya sistemi, süreçler)  ←  features  ←  app
```

`core` üstündeki hiçbir şeyi import etmez. `services` bir feature'a uzanamaz. `shared`
services ya da features'a uzanamaz. Bunlardan biri bozulduğunda
`tests/architecture.test.ts` derlemeyi düşürür — wizrelay plugin'inin kendi katmanlarının
üstünde tuttuğu korumanın aynısı.

## Feature'lar

`shell` · `board` · `relay-run` · `console` · `gate-prompts` · `initialize` ·
`package-workspace` · `validate` · `routing` · `audit` · `verify` · `questions` ·
`packages` · `settings` · `system`

## Motorlar

Bir kapı, ortasında duraklama olan bir async fonksiyondur. Bunu üç motor uygular:

| Motor | Ne zaman çalışır |
|---|---|
| **scripted** | örnek çalışma alanı ve gerçek araçların olmadığı her yer — deterministik bir dökümü oynatır ve her istemde gerçekten durur |
| **live CLI** | bağlı bir çalışma alanındaki deterministik kapılar: `wizrelay pull`, `wizrelay audit` ve benzerlerini çalıştırır, çıktılarını kontrollere çevirir |
| **claude** | bağlı bir çalışma alanındaki konuşma kapıları: konsola akıtılan başsız bir `claude -p` oturumu |

Runner neyin çalıştığını bilir, her olayı günlüğe ekler, relay'in kapı durumunu eşzamanlı
tutar ve bir kişi yanıtladığında istemi çözer. Kaydı `globalThis` üzerinde durur; çünkü
bir server action ile bir route handler aksi hâlde aynı modülün ayrı örneklerini alabilir.

## Tasarım sistemi

`src/shared/design-system/wizrelay-gate.css` tasarım tuvalinden birebir gelir ve token'lar
ile bileşen stilleri için tek doğruluk kaynağıdır. React bileşenleri onun tanımladığı
sınıfları üretir; `src/app/globals.css` yalnızca gerçek bir belgenin ihtiyaç duyduğu, bir
artboard'ın duymadığı şeyleri ekler.

## Bir paket dosyası nasıl gösterilir

Paket, Markdown ve JSON'dur. Araştırma paketi ekranı onu bir `<pre>` içine basmak yerine
belge olarak çizer: başlıklar, işaretli plan adımları, kabul tablosu ve en önemlisi
doldurulmamış `{{yer tutucu}}`lar görünür olur. Her dosyanın üstünde **Okunur** ile
**Kaynak** arasında bir geçiş vardır; kaynak, diskteki baytların kendisidir, çünkü
"buradaki düzenlemeler pakete yazılır" sözü ancak yazılanın göründüğü bir görünümle
tutulabilir. JSON ise katlanabilir bir ağaç olarak gösterilir.

Okuyucu `src/core/markdown/parse.ts` içinde yaşar, saftır ve HTML üretmez de kabul de
etmez: paket, hub'a yazabilen herkesin yazdığı bir depodan gelir, dolayısıyla ham biçimini
tarayıcıya vermenin güvenli bir yolu yoktur. Anlaşılmayan her şey metin olarak kalır.

CommonMark'tan bilerek ayrıldığı üç yer var:

- **Paragraf içindeki tek satır sonu korunur.** CommonMark onları boşluğa çevirir; bu da
  her kabul dosyasının yazıldığı Given / When / Then düzenini tek bir cümleye çökertirdi.
- **Kod aralıkları vurgudan önce okunur.** Bir kapsam dosyası `app/quota/**` gibi
  glob'larla doludur; vurgu önce okunsaydı iki ayrı glob'un yıldızları eşleşir ve aradaki
  metin kalın yazılırdı.
- **`{{…}}` kod aralığının içinde de işaretlenir.** `wizrelay hub validate` dosyayı düz
  metin olarak tarar ve yer tutucuyu nerede olursa olsun hata sayar. Başka türlü sayılsa,
  panel paketi hazır gösterirken kapı onu geri çevirirdi.

Desteklenmeyen ve bilerek düz metin bırakılanlar: referanslı bağlantılar, dipnotlar,
setext başlıkları, HTML blokları ve ters eğik çizgi kaçışları. Bağlantılar yalnızca
`http(s)`, `mailto` ve belge içi hedeflere açılır; başka bir şema metin olarak gösterilir.
Görseller de bağlantı olarak çizilir — uzak bir görseli yüklemek, paneli kimin okuduğunu o
sunucuya söylerdi.

## Küçük alana sığmayan şeyler

Bazı paneller bir belge dolusu malzemeyi düzenin ayırabildiği bir sütunda tutar: yirmi beş
maddelik kabul listesi, kırk glob'luk bir kapsam, kararlar, paket dosyasının kendisi.
Bulmak için doğru boy, okumak için yanlış boy.

Bu yüzden yoğun olanların köşesinde bir büyütme ikonu var; aynı içerik ekran boyunda bir
pencerede açılır. İçerik **kopyalanmaz, taşınır** — ikinci bir kopya kendi durumunu
tutardı, yani "Kaynak" sekmesinde açık bir dosya pencerede "Okunur"a dönerdi.

## Sayılar nereden geliyor

Her ekran paketi diskten okur: araştırmacının dosyaları için hub'ın çalışma kopyası,
geliştiricinin dosyaları için proje deposu — `plan.md`, `questions.md`,
`verification.md`. Aynı dosya ikisinde de varsa deponun kopyası kazanır, çünkü iş onun
üzerinde yapılmıştır; dosya ağacı hangi klasörün yanıt verdiğini söyler.

| Ekran | Nereden okur |
|---|---|
| Kabul kriterleri | pakette `acceptance.md` |
| Kararlar | pakette `decisions.md` |
| Doğrulama raporu | proje deposunda `verification.md` |
| Paket doğrulama raporu | `wizrelay hub validate` |
| Kapsam ve denetim | `wizrelay audit --format json` |
| Yönlendirme sinyalleri | `task.json` içinde `routing.signals` |

Bunlardan biri yoksa ekran bunu söyler. Yerine örnek bir rapor koymaz: başkasına ait temiz
bir denetim, *sizin* çalışma ağacınız hakkında bir iddia gibi okunur ve bu, cevapsızlıktan
kötüdür. Paketin örnek hâli yalnızca demo çalışma alanında görünür, o da panoda kendini
duyurur.

<!-- foot -->
← Önceki: [Ayarlar, bağlantılar ve gizlilik](12-settings.md) · [Dokümantasyon](README.md) · Sonraki: [wizrelay-gate üzerinde çalışmak](14-development.md) →
<!-- /foot -->
