<!-- lang -->
[English](README.md) &nbsp;·&nbsp; **Türkçe**
<!-- /lang -->

# <img src="docs/assets/icon.png" alt="" width="34" align="top"> wizrelay-gate

Bir [wizrelay](https://github.com/ChessWizard/wizrelay) task'ını **task kalite
kapılarından** oluşan bir pipeline olarak çalıştıran, yerelde çalışan pano.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020.9-339933.svg)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.5-000000.svg)](package.json)

wizrelay bir Claude Code plugin'idir: bir researcher'ın task analizini tek bir ekip
hub'ından her geliştiricinin AI kodlama oturumuna taşır ve deterministik biçimde uygular.
Terminaldeki slash komutlarıyla sürülür.

wizrelay-gate aynı işin diğer yüzüdür — CI/CD'nin shell script'leri kalite kapıları,
loglar ve manuel onaylar olan aşamalara çevirdiği gibi.

```
ARAŞTIRMA  Alım ─► Araştırma ─► Doğrulama ─► Yayın
                                               │ rol başına dallanma
TESLİM     Çekme ─► Planlama ─► Uygulama ─► Doğrulama raporu ─► Teslim
           └── soru döngüsü bir kapıyı askıya alıp araştırma hattını yeniden açabilir
```

## Ne veriyor

- **Görülebilen bir pipeline** — dokuz kapı; araştırma hattı bir kez, teslim hattı her rol
  için bir kez. İnsana ihtiyaç duyan durum en üstte sıralanır.
- **Bekleyen bir istem** — Claude bir karar, onay ya da dosya istediğinde kapı durur ve
  pano bunu söyler. Yanıtlamak kapıyı devam ettirir.
- **Komutlar açıkta** — her deterministik sonuç onu üreten komutu gösterir; pano ile CLI
  asla sessizce ayrışamaz.
- **İki tasarım yönü** — Control Room (yoğun, koyu öncelikli) ve Studio (sakin, açık
  öncelikli); kurulumda seçilir, sonra değiştirilebilir. İkisi de İngilizce ve Türkçe.

## Kurulum

Boş bir makineden çalışan bir panele kadar her adım, tuzaklarıyla birlikte:
**[Baştan sona kurulum](docs/tr/21-walkthrough.md)**. Bunu bir ekibin önüne koyacaksanız
oradan başlayın.

## Hızlı başlangıç

```bash
npm install
npm run dev
```

<http://localhost:3100> adresini aç. İlk çalıştırmada sihirbaz dilini, bir tasarım yönünü
ve bir hub'ı sorar — ya da sana **örnek çalışma alanını** verir: yedi relay, bütün kapı
durumları, seninkilere hiç dokunmadan.

## Ya da Docker ile çalıştır

Tek bir container kurulumun tamamıdır — imaj kendi PostgreSQL'ini taşır ve kendi göçlerini
uygular:

```bash
docker run -d --name wizrelay-gate \
  -p 3100:3100 \
  -v wizrelay-gate-data:/data \
  -e OWNER_EMAIL=sen@ornek.com \
  -e OWNER_PASSWORD='uzun-bir-parola' \
  wizrelay/gate:beta
```

İlk kararlı sürüme kadar `beta` etiketi yayınlanır; sunucuda bir sürüm numarasına
sabitlemek daha iyidir (`wizrelay/gate:0.1.0-beta.1`).

Mount edilecek bir şey ve yanında çalıştırılacak bir veritabanı yok. Projeler, GitHub
token'ının gördüğü depolar arasından seçilir; kapılar da herkesin kendi makinesinde
çalışır. Kendi PostgreSQL'ini kullanmak dahil bütün ayrıntılar:
[17. Sunucuda çalıştırmak](docs/tr/17-docker.md).

## Gereksinimler

| | |
|---|---|
| Node.js | 20.9 veya üstü |
| git | hub'ı ve proje depolarını okumak için |
| `wizrelay` CLI (Python ≥ 3.9) | isteğe bağlı — kapıları gerçek depolarda çalıştırmak için |
| Claude Code | isteğe bağlı — konuşma kapıları için |

İsteğe bağlı ikisi olmadan kapılar yerleşik bir dökümü oynatır ve pano bunu söyler.

## Dokümantasyon

**[→ Dokümantasyon dizini](docs/tr/README.md)** · tek kılavuz, bölüm başına tek dosya.

| Buradan başla | |
|---|---|
| [1. Genel bakış](docs/tr/01-overview.md) | Ne olduğu ve ne olmadığı |
| [4. Dokuz kapı](docs/tr/04-gates.md) | Pipeline, dallanma, durumlar |
| [13. Kodun düzeni](docs/tr/13-architecture.md) | Feature klasörleri ve katman kuralı |

## Gizlilik

Hesap yok, sunucu yok, telemetri yok. Kendi yapılandırdığın git uzak deposu ve tracker
dışında makinenden hiçbir şey çıkmaz. Durum `.wizrelay-gate/` içinde durur.

## Lisans

[Apache-2.0](LICENSE)
