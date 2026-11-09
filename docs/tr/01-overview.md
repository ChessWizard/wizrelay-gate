<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/01-overview.md)
<!-- /nav -->

# Genel bakış

wizrelay-gate, bir wizrelay task'ını task kalite kapılarından oluşan bir pipeline olarak çalıştıran, yerelde çalışan bir panodur.

[wizrelay](https://github.com/ChessWizard/wizrelay) bir Claude Code plugin'idir. Bir
researcher'ın task analizini tek bir ekip hub'ından her geliştiricinin AI kodlama
oturumuna taşır ve bu analizi deterministik biçimde uygular: kapsam koruması, model
yönlendirmesi, soru döngüsü ve bağımsız doğrulama. Yaptığı her şey terminaldeki slash
komutlarıyla sürülür.

wizrelay-gate aynı işin diğer yüzüdür. Akışı izlenebilen, yanıtlanabilen ve onaylanabilen
bir pipeline'a çevirir — CI/CD'nin shell script'leri kalite kapıları, loglar ve manuel
onaylar olan aşamalara çevirdiği gibi.

## Ne katıyor

| | |
|---|---|
| **Görülebilen bir pipeline** | Alımdan teslime dokuz kapı; araştırma hattı bir kez, teslim hattı her rol için bir kez |
| **Bekleyen bir istem** | Claude bir karar, onay ya da dosya istediğinde kapı durur ve pano bunu söyler |
| **Komutlar açıkta** | Her deterministik sonuç onu üreten komutu gösterir; böylece arayüz ile CLI asla sessizce ayrışamaz |
| **Var olan metrikler** | İnsan bekleme süresi, açık soru yaşı, kapsam ihlalleri, doğrulama sonuçları — uydurma yok |

## Ne değil

- **CLI'ın yerine geçmez.** Plugin bu pano olmadan da tam olarak kullanılabilir.
- **Bizim servisimiz değildir.** Telemetri yok ve hiçbir şey sizin adınıza barındırılmaz:
  panel sizindir — dizüstünüzde ya da ekibinizin kendi makinesinde. Kapılar, onları
  başlatan kişinin makinesinde çalışır; o makinedeki ajan üzerinden. Kodunuz, git
  kimliğiniz ve Claude oturumunuz zaten bulundukları yerde kalır.
- **İkinci bir uygulama değildir.** Kapsam kararları, doğrulama ve yönlendirme `wizrelay`
  CLI'dan gelir; pano yalnızca CLI'ın yanıtını gösterir.

## İki çalıştırma biçimi

**Örnek çalışma alanı** — yedi relay, bütün kapı durumları, diskinde hiçbir şeye
dokunulmaz. Kurulumda "Önce örnek çalışma alanını gez" dediğinde bunu alırsın.

**Bağlı** — gerçek bir hub reposu ve bir ya da daha fazla proje reposu. Kapılar gerçek
komutları çalıştırır; `claude` PATH'teyse konuşma kapıları başsız bir Claude Code
oturumunda çalışır.

<!-- foot -->
[Dokümantasyon](README.md) · Sonraki: [Kurulum ve çalıştırma](02-install.md) →
<!-- /foot -->
