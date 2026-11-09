<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/14-development.md)
<!-- /nav -->

# wizrelay-gate üzerinde çalışmak

**Bu sayfa panelin kodu üzerinde çalışanlar içindir** — depoyu klonlayan, test
çalıştıran, sürüm yayınlayan. Paneli yalnızca kurup kullanacaksanız buraya hiç ihtiyacınız
yok: [Paneli sunucuda çalıştırmak](17-docker.md) ve
[Baştan sona kurulum](21-walkthrough.md) sizi karşılar.

## Komutlar

```bash
npm run dev         # pano, sıcak yeniden yükleme ile
npm run build       # üretim derlemesi
npm start           # derlemeyi sun
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run docs:nav    # doküman gezinmesini yeniden üret
npm run smoke       # çalışan bir panele, bir tarayıcının soracağı soruları sorar
npm run check       # typecheck + lint + test + build
```

`npm run smoke -- http://127.0.0.1:3100`, hâlihazırda çalışan bir panele rotalarının var
olup olmadığını, oturumsuz isteği reddedip reddetmediğini ve taşınmış bir sayfanın eski
adresinden hâlâ cevap verip vermediğini sorar. Kimse olarak giriş yapar ve hiçbir şey
yazmaz; bu yüzden gerçek iş tutan bir panele karşı da güvenlidir. Birim testlerinin
ulaşamadığı katmandır: kurallar değil, bağlantılar.

Çalışan bir paneli bozmadan derleyip kontrol etmek için derlemeye kendi dizinini verin:

```bash
WIZRELAY_GATE_DIST=.next-verify npm run build
WIZRELAY_GATE_DIST=.next-verify PORT=3101 npx next start
npm run smoke -- http://127.0.0.1:3101
```

## Kurallar

- **TypeScript, strict.** Uygulama kodunda `any` yok; CLI'ın JSON'u sınırda zod şemalarıyla
  ayrıştırılır ve oradan itibaren tiplidir.
- **Kullanıcıya görünen her metin bir katalog anahtarıdır.** Hiçbir cümle kodda
  parçalardan birleştirilmez — Türkçe, İngilizcenin çekim yapmadığı yerde çekim yapar.
  `tests/i18n.test.ts` iki kataloğu birebir aynı anahtarlarda ve aynı yer tutucularda
  tutar.
- **Varsayılan olarak server component.** Bir bileşen, ancak sunucunun sahip olamayacağı
  bir duruma sahip olduğunda client bileşeni olur: konsol akışı, istem kartları, görünüm
  anahtarları.
- **Yorumlar nedenini anlatır.** Ne yaptığı kodda zaten yazıyor.

## Testler

| Dosya | Neyi korur |
|---|---|
| `tests/routing.test.ts` | skor, tier'lar, başlatma komutu, glob kesişimi |
| `tests/gates.test.ts` | kapı grafiği ve durum modeli |
| `tests/parsers.test.ts` | paket metin biçimleri, İngilizce ve Türkçe |
| `tests/derive.test.ts` | relay durumu, güncel kapı, pano metrikleri |
| `tests/i18n.test.ts` | katalog ve yer tutucu paritesi |
| `tests/store.test.ts` | çalışma alanı yaması, relay gidiş-dönüşü, olay günlüğü |
| `tests/time.test.ts` | iki dilde süreler ve göreli zaman |
| `tests/architecture.test.ts` | katman kuralı ve feature klasörleri |
| `tests/docs.test.ts` | iki dilde aynı bölümler ve güncel gezinme |

## Geliştirme sunucusu hakkında bir not

Turbopack'in sıcak yeniden yüklemesi, bir editör yerine bir araç tarafından yapılan
değişikliği her zaman yakalamaz. Bir sayfa düzenlemeden sonra eski görünüyorsa hatayı
başka yerde aramadan önce `npm run dev`'i yeniden başlat.


## macOS'ta iki tuzak

**`EMFILE: too many open files` ve her rota 404 veriyor.** Watchpack izlediği her dizin
için bir dosya tanıtıcısı açar; tükendiğinde rota ağacı boş döner ve `/api/health` dahil
her yol 404 verir. `ulimit -n` yükseltmek güvenilir bir çözüm değil: macOS'ta tavan
`kern.maxfilesperproc` ve bir gün işe yarayan değer ertesi gün yetmiyor.

Bu yüzden `npm run dev` artık `WATCHPACK_POLLING=true` ile çalışıyor; watchpack o
tanıtıcıları hiç açmıyor. Asıl izlemeyi Turbopack yaptığı için ölçülebilir bir CPU
maliyeti yok. `next dev` komutunu elle çalıştırıp rotalar 404 verirse bu değişkeni
kendiniz verin.

**Çökme sonrası eski `.next`.** Sunucu derleme ortasında öldükten sonra rotalar 404
veriyorsa `.next` klasörünü silip yeniden başlatın.

## Sürüm yayınlamak (yalnızca bakımcılar)

`package.json` içindeki sürüm, imajın taşıdığı sürümdür. Semver'i izler; paneli çalıştıran
kişinin gözünden okunur:

| Değişiklik | Artış |
|---|---|
| Geri alınamayan bir göç, artık zorunlu olan bir ortam değişkeni, kaldırılan bir rota | **major** |
| Yeni bir ekran, yeni bir kapı davranışı, yeni bir ayar | **minor** |
| Düzeltme, metin değişikliği, hiçbir şeyi bozmayan tasarım değişikliği | **patch** |

### Dallar

`main` her zaman yayınlanabilir durumdadır: `latest` etiketi ondan derlenir ve
`npm run check` geçmemiş hiçbir şey oraya inmez.

İş, ne yaptığına göre adlandırılmış bir dalda yapılır — `feat/question-routing`,
`fix/board-loop` — ve `main` üzerine conventional-commit başlıklı tek bir commit olarak
iner. Yayın, `main` üzerinde bir etikettir: `v0.3.0`; asla kendine ait bir dal değil. Yayın
dalı, doğrunun yaşadığı ikinci bir yer olurdu.

### İlk sürüm bir beta

Beta tek bir şey söyler: *bu kullanılmak için var ve altınızdan kayabilir.* Diğer bütün
yayınlar gibi bir sürüm numarası hak eder — ve o numara, git etiketiyle Docker Hub
etiketini birbirine bağlayan şeydir.

```
package.json 0.1.0-beta.1  →  git etiketi v0.1.0-beta.1  →  wizrelay/gate:0.1.0-beta.1
```

Tek numara, üç yer, aralarında çeviri yok. `0.1.0-beta.1` için hata bildiren biri, hem
checkout edebileceğiniz bir commit'i hem çalıştırabileceğiniz bir imajı adlandırmış olur.

**`latest` beta değildir.** Hiç etiket yazmayan birinin aldığı şeydir ve arkasında
durabileceğiniz bir yayın olmalıdır. Ortada yalnızca betalar varken `0.1.0-beta.1` ve
`beta` etiketlerini gönderin; `latest`'i ilk kararlı sürüme kadar hiç göndermeyin.

### Beta için dallar

`main` yine her zaman yayınlanabilir durumdadır; beta bunu değiştirmez.

```
feat/question-routing ─┐
fix/board-loop ────────┼─► main ──► etiket v0.1.0-beta.1 ──► imaj 0.1.0-beta.1
docs/walkthrough ──────┘            etiket v0.1.0-beta.2
                                    etiket v0.1.0           ← kararlı, aynı çizgide
```

İş, ne yaptığına göre adlandırılmış bir dalda yapılır ve `main` üzerine tek commit olarak
iner. Beta, **`main` üzerinde bir etikettir**, kendine ait bir dal değil; ardından gelen
kararlı sürüm de öyle. `0.1.0-beta.2` ile `0.1.0` aynı çizgi üzerinde iki nokta, iki ayrı
çizgi değil.

Yayın dalı (`release/0.1.0`) açmaya yalnızca, `main` ilerlemişken gönderilmiş bir betayı
düzeltmek zorunda kaldığınızda değer. O gün gelene kadar doğrunun yaşadığı ikinci bir
yerdir.

### Beta numaralandırma

| Ne oldu | Sonraki sürüm |
|---|---|
| Bir tur daha beta düzeltmesi | `0.1.0-beta.2` |
| Beta arkasında durulacak kadar iyi | `0.1.0` |
| `0.1.0` sonrası bir düzeltme | `0.1.1` |
| Sonraki özellik turu | `0.2.0-beta.1` |

Semver'de `0.1.0-beta.2`, `0.1.0`'dan **önce** gelir; istenen de budur — kararlı sürüm
kendi betalarının yerini alır.

### İlk betayı yayınlamak, adım adım

**1 · Sürümü belirleyin.** Her şeyin kopyaladığı tek numara budur.

```bash
npm version 0.1.0-beta.1 --no-git-tag-version
```

**2 · Çalıştığını kanıtlayın.** Geçmeyen hiçbir şey dışarı çıkmaz.

```bash
npm run check
```

**3 · `main` üzerinde commit'leyip etiketleyin.**

```bash
git add -A
git commit -m "release: 0.1.0-beta.1"
git tag -a v0.1.0-beta.1 -m "wizrelay-gate 0.1.0-beta.1"
```

**4 · İmajı aynı numarayla derleyin.**

```bash
VERSION=$(node -p "require('./package.json').version")
docker build -t wizrelay/gate:$VERSION -t wizrelay/gate:beta .
```

**5 · Push edeceğiniz imajı smoke test edin**, geçen hafta derlediğinizi değil.

```bash
docker run --rm -d --name gate-check -p 3109:3100 -v gate-check:/data \
  -e OWNER_EMAIL=kontrol@ornek.com -e OWNER_PASSWORD='kontrol-parola-1234' \
  wizrelay/gate:$VERSION
npm run smoke -- http://127.0.0.1:3109
docker rm -f gate-check && docker volume rm gate-check
```

**6 · Gönderin.** Önce sürüm, sonra hareketli etiket — ikisi arasında bir şey ters
giderse `beta` hâlâ çalışan yayını gösteriyor olur.

```bash
docker login
docker push wizrelay/gate:$VERSION
docker push wizrelay/gate:beta
git push origin main --follow-tags
```

**7 · İnsanlara ne çalıştıracaklarını söyleyin.** Betayı kuran kişi sabitler:

```bash
docker run -d -p 3100:3100 -v wizrelay-gate-data:/data wizrelay/gate:0.1.0-beta.1
```

### İlk push'tan önce

Docker Hub'daki depo var ve sizin olmalı: **hub.docker.com → Create repository**,
hesabınızın ya da organizasyonunuzun altında `gate` adıyla — böylece imaj `<hesap>/gate`
olur. Parola yerine **access token** kullanın: *Account Settings → Personal access
tokens*, Read & Write yetkisiyle. `docker login` onu parola olarak kabul eder.

Hesabınız `wizrelay` değilse yukarıdaki her yerde değiştirin; imajdaki ad, sahibi olan
hesaptır.

### Birden çok mimari için

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t wizrelay/gate:$VERSION -t wizrelay/gate:beta --push .
```

Çok mimarili derleme doğrudan builder'dan push eder; bu yüzden 5. adımı önce aynı
commit'in tek mimarili derlemesiyle yapın — buildx'in yerele hiç yüklemediği bir imajı
smoke test edemezsiniz.

### Beta kararlıya dönüşünce

Aynı yedi adım, iki farkla: sürümden `-beta.N` düşer ve hareketli etiket `beta` değil
`latest` olur.

```bash
npm version 0.1.0 --no-git-tag-version
npm run check

VERSION=$(node -p "require('./package.json').version")
docker build -t wizrelay/gate:$VERSION -t wizrelay/gate:latest .
# $VERSION imajını yukarıdaki gibi smoke test edin
docker push wizrelay/gate:$VERSION
docker push wizrelay/gate:latest
git tag -a v$VERSION -m "wizrelay-gate $VERSION" && git push origin main --follow-tags
```

Bu noktadan sonra `latest`, en yeni kararlı sürüm demektir. Betalar için `beta`
göndermeye devam edin; betayı izleyen biri sorulmadan kararlı hatta taşınmamalı.

<!-- foot -->
← Önceki: [Kodun düzeni](13-architecture.md) · [Dokümantasyon](README.md) · Sonraki: [Sorun giderme](15-troubleshooting.md) →
<!-- /foot -->
