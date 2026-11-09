<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/20-access.md)
<!-- /nav -->

# Kim neyi görür

Herkesin her şeyi görebildiği bir panel paylaşılan bir panel değil, paylaşılan bir
klasördür. Bu sayfa kuralın tamamıdır; keşfederek değil, bakarak öğrenesiniz diye tek
yerde duruyor.

## İki ayrı soru

Yetkilendirme iki farklı soruya cevap verir ve bunları ayrı tutmak işe yarar.

**Neye erişebilirim** bir üyelik sorusudur: parçası olduğunuz işe ait hub'lar, projeler,
görevler ve paketler. **Neyi değiştirebilirim** bir rol sorusudur: kim hub ekleyebilir,
kim teslim kapısı çalıştırabilir, kim davet gönderebilir.

Bir şeyin ekranda görünüp görünmeyeceğine üyelik karar verir.

## Üyelik

Bir kişi bir **projenin** üyesidir — tek bir hub rolünü oynayan tek bir depo — ve o
projede proje rollerinden birini ya da ikisini birden taşır: researcher, developer. Bunu
owner ya da admin verir; ya davetin içinde, ya da sonradan kişinin sayfasından.

Aşağıdaki her şey bu tek olgudan çıkar.

| Ne | Kim görür |
|---|---|
| Hub | En az bir projesinin üyesi olan herkes. Admin bütün hub'ları görür. |
| Proje | Üyeleri. Admin bütün projeleri görür. |
| Görev (relay) | Görevin adını andığı hub rolüne ait bir projenin üyesi olan herkes. |
| Araştırma paketi | Görevini gören kişiler. |
| Soru | Muhatabı ve soran. Aşağıya bakın. |
| Etkinlik | Paneli yönetmiyorsanız yalnızca kendinizinki. |

Göremediğiniz bir görev panoda çıkmaz, relay listesinde olmaz, aramada görünmez ve kendi
adresi de yokmuş gibi cevap verir — çünkü bir görevin var olup olmadığı da yalnızca onun
ekibinin öğreneceği bir şeydir.

Konsol akışı da aynı kurala tabidir; önce değildi. HTTP üzerinden erişilebilen her şey
cevap vermeden önce kimin sorduğunu sorar ve oturumsuz bir istek sayfa değil 401 alır.

## Sorular

Her sorunun bir muhatabı vardır ve soruyu yalnızca muhatabı görür. Soran kendi sorusunu
görmeye devam eder; paneli yönetenler hepsini görür.

Muhatap sorunun kendisinden gelir. `questions.md` içindeki `Kime:` bir ya da birkaç kişiyi
virgülle ayırarak adresler; sorunun herhangi bir yerine `@kişi` yazmak da aynı işi görür.
Kimseyi anmayan bir soru projenin **araştırma sorumlusuna** düşer; bu proje başına
belirlenir ve başlangıçta owner'dır.

Araştırma sorumlusu tanımlı olmayan bir projedeki soru kimseye adreslenmemiştir ve panel
bunu kartın üzerinde söyler — yalnızca bir admin'in bakacağı bir yere koymak yerine.

## Roller

**Panel rolleri** panelle ilgilidir. **Proje rolleri** tek bir depoyla. Her birinin
tablosu için [Kişiler, roller ve etkinlik](18-activity.md) sayfasına bakın.

İkisi beklendiği gibi birleşir: bir admin hiçbirinin üyesi olmadan bütün projelere
erişir, bir member ise proje rolleri ne derse desin yalnızca üyeliklerinin kapsadığına
erişir.

## Bunun yapmadığı şey

Bu bir sır sınırı değildir. Giriş yapabilen herkes aynı paneli, aynı veritabanını ve aynı
hub kopyalarını paylaşır; bir yönetici her şeyi okuyabilir. İki grup birbirinin kodunu
hiç okuyamayacaksa iki panel çalıştırın.

Token'lar istisnadır ve öyle de davranılır: her kişinin ClickUp ve GitHub token'ı sunucu
anahtarıyla şifrelenir, girildikten sonra bir daha gösterilmez ve yalnızca o kişi adına
hareket etmek için kullanılır.

<!-- foot -->
← Önceki: [Kendi makinende çalıştırmak](19-agent.md) · [Dokümantasyon](README.md) · Sonraki: [Baştan sona kurulum](21-walkthrough.md) →
<!-- /foot -->
