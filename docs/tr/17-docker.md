<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/17-docker.md)
<!-- /nav -->

# Paneli sunucuda çalıştırmak

**Bu sayfa paneli kuran kişi içindir.** Depoya, Node'a, derlemeye ihtiyacınız yok —
yalnızca Docker. İmaj Docker Hub'da yayınlanmıştır; aşağıdakiler onu çekip çalıştırır.

Panelin kendisi üzerinde çalışacaksanız [wizrelay-gate üzerinde çalışmak](14-development.md)
sayfasına bakın; sürüm yayınlamak da oradadır.

wizrelay-gate bir ekibin giriş yaptığı bir paneldir. Tek bir container kurulumun
tamamıdır: imaj kendi PostgreSQL'ini taşır, kendi göçlerini uygular ve her şeyi tek bir
birimde tutar.

## En kısa yol

```bash
docker run -d --name wizrelay-gate \
  -p 3100:3100 \
  -v wizrelay-gate-data:/data \
  -e OWNER_EMAIL=siz@ornek.com \
  -e OWNER_PASSWORD='uzun-bir-parola' \
  wizrelay/gate:beta
```

Hepsi bu. Container ilk açılışta veritabanını hazırlar, göçleri uygular, ilk owner'ı
oluşturur ve paneli 3100 portunda sunar. `AUTH_SECRET` vermezseniz kendisi üretip birime
yazar; böylece oturumlar yeniden başlatmayı atlatır.

## Compose ile

Depoya ihtiyacınız yok. Bir klasör açın, şu iki dosyayı yazın ve kaldırın.

`docker-compose.yml`:

```yaml
services:
  gate:
    image: wizrelay/gate:beta
    restart: unless-stopped
    ports:
      - '3100:3100'
    env_file: .env
    volumes:
      - gate-data:/data

volumes:
  gate-data:
```

`.env`:

```ini
# İlk owner; yalnızca ilk açılışta oluşturulur.
OWNER_EMAIL=siz@sirket.com
OWNER_PASSWORD=uzun-bir-parola

# Panelin dışarıdan görünen adresi. Proxy arkasındaysanız bunu yazın.
WIZRELAY_GATE_URL=https://panel.sirket.com

# Kapılar herkesin kendi makinesinde koşsun.
WIZRELAY_GATE_EXECUTION=agent

# Boş bırakılırsa container kendi PostgreSQL'ini ve kendi imza anahtarını kullanır.
DATABASE_URL=
AUTH_SECRET=
```

```bash
docker compose up -d
```

Tek servis; yanında çalıştırılacak ayrı bir veritabanı servisi yok. `.env` parola taşır —
dosyayı kimse okuyamayacak şekilde bırakın (`chmod 600 .env`) ve sürüm kontrolüne koymayın.

## Hangi sürümü çekmeli

| Etiket | Ne demek |
|---|---|
| `wizrelay/gate:0.1.0-beta.1` | Tam olarak o sürüm. Sunucuda doğrusu budur: ne zaman değişeceğine siz karar verirsiniz. |
| `wizrelay/gate:beta` | En son beta. Denemek için. |
| `wizrelay/gate:latest` | En son kararlı sürüm. İlk kararlı sürüme kadar yayınlanmaz. |

> İlk kararlı sürüme kadar `latest` yayınlanmaz; yukarıdaki `beta` yerine bir
> sürüm numarası da yazabilirsiniz (`wizrelay/gate:0.1.0-beta.1`).

## Kendi PostgreSQL'inizi kullanmak

`DATABASE_URL` verirseniz gömülü veritabanı hiç başlatılmaz:

```bash
docker run -d --name wizrelay-gate \
  -p 3100:3100 -v wizrelay-gate-data:/data \
  -e DATABASE_URL='postgresql://user:pass@db.internal:5432/wizrelay_gate' \
  -e AUTH_SECRET='…' \
  wizrelay/gate:beta
```

PostgreSQL'i imajın dışında bırakmak için `--build-arg EMBEDDED_POSTGRES=false` ile
derleyin.

## Ortam değişkenleri

| Değişken | Ne yapar |
|---|---|
| `DATABASE_URL` | Kendi PostgreSQL'iniz. Boş bırakırsanız gömülü olan kullanılır. |
| `AUTH_SECRET` | Oturumları imzalar, saklanan ClickUp ve GitHub token'larını şifreler. Verilmezse birime üretilir. |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | İlk owner; yalnızca ilk açılışta oluşturulur. |
| `PANEL_NAME`, `PANEL_LOGO_URL`, `PANEL_FAVICON_URL`, `PANEL_ACCENT` | Markalama. Owner her birini panelden değiştirebilir. |
| `WIZRELAY_GATE_HOME` | Hub kopyaları, kapı kayıtları ve marka dosyalarının yeri. Container içinde `/data`. |
| `WIZRELAY_GATE_EXECUTION` | `agent`, `local` ya da `auto`. Aşağıya bakın. |
| `CLICKUP_API_TOKEN`, `GITHUB_TOKEN` | Paylaşılan yedek değerler. Kişinin kendi bağlantısı önceliklidir. |

`/data` üzerindeki her şey kurulumun kendisidir: veritabanı, hub kopyaları, kapı kayıtları
ve marka dosyaları. O birimi yedeklediyseniz paneli yedeklemişsiniz demektir.

## Kapılar nerede çalışır

İki cevap var ve seçtiğiniz, altındaki her şeyi belirler.

**Herkesin kendi makinesinde (önerilen, compose'un kurduğu).** Panel hiçbir şey
çalıştırmaz. Her developer kendi makinesinde bir agent çalıştırır; birinin başlattığı kapı
onun checkout'unda, onun git kimliğiyle ve onun Claude oturumuyla çalışır. Sunucuya hiçbir
depo bağlanmaz ve kimsenin kimlik bilgisi orada tutulmaz.
[Kendi makinende çalıştırmak](19-agent.md) bunu kurar.

```
WIZRELAY_GATE_EXECUTION=agent
```

**Sunucunun kendisinde.** Panel kapıları kendi makinesinde çalıştırır, dolayısıyla
depoların orada olması gerekir. Tek kişilik bir kurulum için makul; ekip paneli için değil,
çünkü o makine herkesin adına commit atar.

```
WIZRELAY_GATE_EXECUTION=local
```

Varsayılan olan `auto` ikisini de yapar: eşleşmiş bir makine varsa oraya, yoksa buraya.

## Depolar

Proje, **GitHub token'ınızın** gördüğü depolardan seçilen bir depodur. Panel hiçbir şey
klonlamaz: depoyu kaydeder, kapıyı çalıştıran makine zaten o depoya sahiptir. Token'ı
[Ayarlar → Bağlantılar](12-settings.md) altından bağlayın.

Hub istisnadır ve onun da bağlanmasına gerek yoktur: panel onu `/data` içine klonlar ve
güncel tutar, çünkü paketleri kendisi okumak zorundadır.

### Panelin dağıttığı adres

İnsanlara verilen iki şey panelin adresini taşır ve başka hiçbir şey taşımaz: **davet
bağlantısı** ve **eşleştirme komutu**. Proxy arkasında isteğin kendi `Host` başlığı
proxy'nin iç adıdır ve şema düz HTTP'dir; dolayısıyla ikisi de yanlış üretilebilir ve
ikisinin de hatasını siz fark etmezsiniz — giriş yapamayan kişi fark eder.

Bir kez yazın, tahmin bitsin:

```
WIZRELAY_GATE_URL=https://panel.sirket.com
```

Vermezseniz panel `X-Forwarded-Host` ve `X-Forwarded-Proto` başlıklarını isteğin
kendisinden önce okur, `localhost`'u da düz HTTP bırakır. Proxy'nizin bu iki başlığı
gönderdiğinden emin olun.

## Kim giriş yapabilir

Kimse kendi kaydolmaz. İlk owner ortamdan gelir; sonrasında owner ya da admin, kişileri
Claude hesaplarının e-postasıyla ekler ve panelin ürettiği davet bağlantısını gönderir.
Her kişinin sonra neye erişebildiği [Kim neyi görür](20-access.md) sayfasındadır.

## Kuruluma özel markalama

Üç yol var; ilk cevap veren kazanır:

1. **Marka dizinindeki dosya.** `$WIZRELAY_GATE_HOME/branding/logo.png` ve `favicon.ico` —
   birimde durur, yeniden dağıtımı atlatır. Yönetim → Panel'den yükleyin ya da ilk
   açılıştan önce bırakın. `.png`, `.jpg`, `.webp`, `.svg` ve `.ico` okunur; sınır 512 KB.
2. **Bağlantı**: Yönetim → Panel'e yazılan, başka bir yerde barınan bir görselin adresi.
3. **Ortam**: `PANEL_NAME`, `PANEL_LOGO_URL`, `PANEL_FAVICON_URL`, `PANEL_ACCENT`.

Hiçbiri yeniden derleme gerektirmez ve `public/` dizinine hiç yazılmaz — o imajın parçası
olduğu için bir sonraki dağıtımda kaybolurdu.

## Sağlık

`GET /api/health` veritabanını, imza anahtarını ve `git`, `python3`, `wizrelay`, `claude`
komutlarının PATH üzerinde olup olmadığını bildirir. Container'ın healthcheck'i bunu
kullanır; ilk açılışın veritabanını hazırlamaya vakti olsun diye 60 saniyelik bir başlangıç
payı vardır.

## Yükseltme

```bash
docker pull wizrelay/gate:beta
docker rm -f wizrelay-gate
docker run -d --name wizrelay-gate -p 3100:3100 -v wizrelay-gate-data:/data wizrelay/gate:beta
```

Göçler açılışta çalışır. Birim veritabanını, anahtarı ve geri kalan her şeyi taşıdığı için
yeni container kaldığı yerden devam eder. Bunun ne zaman olacağına kendiniz karar etmek
isterseniz `latest` yerine bir sürüme sabitleyin — sürümlerin nasıl numaralandığı ve
yayınlandığı için [wizrelay-gate üzerinde çalışmak](14-development.md) sayfasına bakın.

<!-- foot -->
← Önceki: [Sık sorulan sorular](16-faq.md) · [Dokümantasyon](README.md) · Sonraki: [Kişiler, roller ve etkinlik](18-activity.md) →
<!-- /foot -->
