# Finansal model sözleşmesi v1

Tarih: 7 Ekim 2026. Durum: uygulama ve otomatik hesaplama testleriyle doğrulandı; bağımsız uzman kabulü ve kalıcı LOCK kaydı yok.

Bu model, HDSE için açıkça tanımlanmış basitleştirilmiş otel nakit akışı sözleşmesidir. USALI veya vergi mevzuatı uygunluk sertifikası değildir. Finans Case dönemi 365–366 gündür; kısmi dönem sessizce yıllık kabul edilmez. Açık günler sezon nedeniyle daha az olabilir. Bütün tutarlar Case'in tek para birimindedir. Döviz dönüştürülmez.

## İşletme zinciri

1. Kullanılabilir oda gecesi = oda sayısı × açık günler − kullanılamayan oda geceleri. Sezon kapanışı zaten açık günlerden çıkarıldıysa tekrar düşülmez. Pozitif blokajın nedeni zorunludur.
2. Satılan oda gecesi = kullanılabilir oda gecesi × talep modelinden doluluk.
3. Oda geliri = satılan oda gecesi × ADR.
4. Diğer gelir = her gelir kaleminin sabit yıllık geliri + satılan oda gecesi başına gelirinin satılan geceyle çarpımı. Kalem isimleri benzersiz olmalı.
5. Toplam gelir = oda geliri + diğer gelir.
6. OPEX = sabit OPEX + oda gecesi başına değişken gider × satılan gece + toplam gelir × değişken gider oranı.
7. GOP = toplam gelir − OPEX.
8. EBITDA = GOP − yönetim ücreti − OPEX'e dahil edilmemiş mülk giderleri + işletme dışı gelir.
9. NOI = EBITDA − yenileme rezervi.

Yönetim ücreti ve yenileme rezervi toplam gelire uygulanan ayrı oranlardır. Personel, enerji, bakım, pazarlama vb. sabit OPEX'te veya değişken giderlerde bir kez temsil edilir. Mülk giderleri ve rezerv tekrar OPEX'te gösterilmez. Açık yıllık ek CapEx, rezervde zaten karşılanan aynı yenileme giderini tekrar içeremez.

## Tahmin, nakit ve borç

Yıl 1 mevcut işletme yılıdır. Sonraki yıllarda ADR, sabit/per-gece diğer gelirler ve işletme dışı gelir, belirtilen gelir büyümesiyle; sabit OPEX, per-gece giderler ve mülk giderleri belirtilen gider büyümesiyle ölçeklenir. Gelire bağlı gider/ücret/rezerv oranları sabit kalır. Başlangıç doluluğu ve kapasitesi tahmin boyunca sabittir; bu bir açık senaryo varsayımıdır, gelecekteki fiyat esnekliği tahmini değildir.

Nakit vergi = max(0, NOI) × verilen etkin nakit vergi oranı. Zarar devri, amortisman kalkanı, faiz vergi kalkanı veya ülke mevzuatı hesaplanmaz. Vergi oranı kullanıcı varsayımıdır.

- Property CF = NOI − nakit vergi − ek CapEx − işletme sermayesi değişimi.
- Equity CF = property CF − yıllık borç servisi.
- DSCR = NOI / yıllık borç servisi. Borç servisi sıfırsa null; sonsuz olarak başarıya dönüştürülmez.
- Özkaynak exit-cap/açık satış terminal değerinde kalan borç ayrıca girilir ve satış gelirinden bir kez düşülür. Gordon özkaynak CF kapitalizasyonunda tekrar borç düşülmez.

Yıllık ek CapEx, işletme sermayesi ve borç servisi dizileri tahmin ufkuyla aynı sayıda değer içermelidir. Borç ve başlangıç özkaynak tutarlarının kaynağı kullanıcının senaryo girdisidir. Nakit akışı bazına uygun iskonto oranı kullanıcı tarafından verilmelidir.

## Değerleme ve yatırım

- Doğrudan kapitalizasyon değeri = pozitif stabilize NOI / pozitif cap rate. Negatif NOI veya sıfır cap rate için piyasa değeri uydurulmaz.
- DCF = yıl sonu CF'lerin bugünkü değeri + ufuk sonu terminal değerin bugünkü değeri.
- NPV = DCF − t=0 başlangıç yatırımı. Başlangıç yatırımı tekrar iskonto edilmez.
- Exit-cap terminal değeri = ufuk sonrasındaki yılın NOI'si / exit cap × (1 − satış masrafı).
- Gordon = son CF × (1+g)/(r−g), -1 < g < r.
- Terminal yöntemi none, explicit, exit-cap veya Gordon olabilir; birbirleriyle toplanmaz.
- IRR eşit dönemli akışların NPV'sini sıfıra indiren orandır. Standart ilk negatif/sonraki negatif olmayan akışlar için log ölçekli deterministik kök aranır. Çok işaret değişimli akışlarda keyfi bir kök seçilmez; NON_CONVENTIONAL döner. Oran araması 1+r için 1e-12–1e12 sınırındadır; sınır dışı kök ayrı durumdur.
- Geri ödeme işletme CF'leriyle ilk sermaye geri kazanımını ölçer; terminal satışını içermez. Yıl içinde doğrusal nakit kazanımı varsayımıyla kesirli yıl gösterilir. Ufukta geri kazanım yoksa null olur. İskontolu geri ödeme ayrıca hesaplanır.

IRR bağımsız referans testi: Microsoft'un [-70000,12000,15000,18000,21000,26000] örneği yaklaşık %8.6630948 üretir. Eşit dönem ve NPV=0 anlamı [Microsoft IRR dokümanında](https://support.microsoft.com/en-us/excel/functions/irr-function?nochrome=true) açıklanır. HDSE nakit akışı API'si t=0 değerini açık içerir; boş ve metin değerleri sessizce atlamaz.

## Optimizasyon ve risk

MAX RevPAR, desteklenen sürekli parçalı doğrusal talepte analitik adaylarla çözülür. MAX NOI/NPV/değer, MIN OPEX/CapEx/risk/geri ödeme ve Pareto karşılaştırması açık kullanıcı alternatifleri veya fiyat adımıyla oluşturulan sonlu fiyat kümesini tam değerlendirir. Sonuç OPTIMAL_CANDIDATES'tir; sürekli uzay optimumu veya küresel işletme stratejisi iddiası yoktur.

Piyasa cap rate, discount rate, büyüme, vergi ve talep modeli optimizasyonda serbest karar değişkeni olamaz. What-if ve senaryo analizinde açık varsayım olarak değiştirilebilir.

Risk metriği kullanıcının seçenekler için sağladığı 0–1 karşılaştırmalı endekstir. Olasılık veya veriden tahmin edilmiş kayıp değildir. Hizmet kalitesi de kullanıcı ölçümüdür; gideri düşürmenin kalite etkisi uydurulmaz. Kısıtlar bu açık değerlerle değerlendirilir.

## Rehber ve AI

Varsayılan uygulama kural tabanlı rehber kullanır; API anahtarı veya LLM gerektirmez. Sağlayıcıdan bağımsız opsiyonel AI adapter yalnız izin verilen araç kimliğini, açıklamayı ve soruları kabul eder. Sayısal alanları, hesaplama sonuçlarını veya Case değişikliklerini kabul etmez. AI önerisinin uygulanması için kullanıcı onayı gerekir. LLM, finansal hesaplama veya çözücüye bağlanmaz.

## Yaşam döngüsü

Model lifecycle modülü DRAFT → VALIDATED → LOCKED → BLUEPRINT geçişlerini uygular. LOCK için açık kabul kaydı gerekir. MAX RevPAR teknik davranış sözleşmesi, kullanıcının görevlendirmesi altında blueprint'in test bazlı kapısından geçirilerek `release/flow-baseline.json` içinde kilitlendi. Bu kayıt bağımsız insan finans/UX kabulü veya değerleme sertifikası iddiası değildir. Ayrı GOP/EBITDA/NOI ve yatırım sözleşmesi teknik olarak doğrulandı; bağımsız uzman kabulünden önce kalıcı LOCK olarak etiketlenmedi.
