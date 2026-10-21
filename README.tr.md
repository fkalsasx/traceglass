# Traceglass

**HAR kayıtlarını anlaşılır bir ağ analizine dönüştüren, cihazında çalışan geliştirici aracı.**

[English](README.md) · [Gizlilik politikası](docs/PRIVACY.md) · [Hesaplama yöntemi](docs/METHODOLOGY.md)

![Traceglass çalışma alanı](docs/workspace.jpg)

Bir sayfanın neden yavaş olduğunu anlamak için yüzlerce isteğin arasında kaybolma. Kaydı aç, zaman çizelgesini incele, önceki sürümle karşılaştır ve paylaşılabilir raporu indir.

## Çalıştır

Node.js 22 veya üzeri gerekir.

```sh
git clone https://github.com/fkalsasx/traceglass.git
cd traceglass
npm start
```

**http://127.0.0.1:4273** adresini aç. Kurulum, API anahtarı ve hesap gerekmez. Örnek kayıt otomatik yüklenir.

## Neler yapar?

- İstekleri zaman çizelgesinde gösterir; URL, tür ve durum koduyla filtreler.
- Uzun ilk bayt beklemelerini, büyük dosya aktarımlarını ve başarısız istekleri işaretler.
- Önce/sonra kayıtlarında aynı uç noktaların medyan sürelerini karşılaştırır.
- Markdown raporu ve hassas alanları azaltılmış HAR dosyası oluşturur.
- Komut satırında performans bütçesi denetimi ve JSON çıktı sunar.

## Komut satırı

```sh
node bin/traceglass.mjs analyze examples/checkout.har
node bin/traceglass.mjs analyze examples/checkout.har --baseline examples/checkout-before.har --format markdown --output rapor.md
node bin/traceglass.mjs sanitize examples/checkout.har --output temiz.har
node bin/traceglass.mjs analyze examples/checkout.har --fail-on-errors --max-p95 800
```

Çıkış kodları: **0** başarılı, **1** geçersiz girdi/dosya hatası, **2** belirlenen bütçe veya hata eşiği aşıldı. Mevcut çıktı dosyalarının üzerine yazılmaz.

## Gizlilik sınırları

Kayıtlar tarayıcı belleğinde işlenir; sunucuya gönderilmez veya kalıcı depolamaya kaydedilmez. Sayfayı yenilemek çalışma alanını temizler. Ham gövdeler, çerezler ve kimlik doğrulama başlıkları arayüzde gösterilmez.

Temizlenmiş HAR çıktısında çerezler, gövdeler, yorumlar, IP alanları ve bilinmeyen ek alanlar çıkarılır. Sorgu değerleri ve izin listesindeki başlıklar dışındaki başlık değerleri gizlenir. **URL yolları, alan adları, sorgu adları ve bazı metaveriler korunur; bunlar hassas bilgi içerebilir. Paylaşmadan önce çıktıyı incele.** Bu araç bütün sırların bulunacağını garanti etmez.

50 MiB ve 50.000 istek sınırı vardır. Karşılaştırma sonuçları aynı ağ/önbellek/yük koşullarında alınan kayıtlarda anlamlıdır. Otomatik bulgular belirli kurallara dayanır; kapsamlı güvenlik veya performans denetiminin yerini tutmaz.

## Geliştirme

```sh
npm test
npm run check
npm run build
```

`dist/` dizini statik sunucuda yayımlanabilir. GitHub Pages için Settings → Pages → GitHub Actions seçip **Deploy demo** iş akışını çalıştır.

MIT lisansı. Yararlı bulursan yıldız vererek projenin keşfedilmesine yardımcı olabilirsin.
