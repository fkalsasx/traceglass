# Launch kit

Use these as drafts. Share only where project announcements are welcome; do not mass-post or buy stars.

## Repository description

See the whole request. A local HAR workbench with waterfalls, before/after comparisons, sanitized exports and a zero-dependency CLI.

## Suggested topics

`har` `network-analysis` `developer-tools` `performance` `waterfall` `privacy` `local-first` `javascript` `cli` `zero-dependencies`

## A 45-second demo

1. Open the bundled checkout demo and show 19 requests, 2 failures.
2. Select `recommendations` and point out 2.10 s spent waiting for the first byte.
3. Open Findings and inspect the three long waits.
4. Open Compare captures → Try demo comparison. Show the three regressions.
5. Export a Markdown report and a sanitized HAR. Mention the retained-path caveat.
6. End with the repository link and one concrete request for feedback.

## English announcement draft

I built Traceglass because I wanted a simple way to understand and share browser network captures without uploading them to another service.

It has a request waterfall, deterministic findings, before/after endpoint comparison, a sanitized HAR export and a dependency-free Node CLI with CI performance budgets. The demo uses synthetic data and runs without an account or API key.

Sanitization removes bodies, cookies and query values; URL paths and some metadata remain, so exported files still need review.

I’d love feedback from people who debug slow pages or exchange HAR files with teammates. Which part of your network-debugging workflow is still painful?

https://github.com/fkalsasx/traceglass

## Türkçe duyuru taslağı

Tarayıcı ağ kayıtlarını daha rahat incelemek için Traceglass’ı geliştirdim. HAR dosyasını açıp yavaş istekleri görebiliyor, önceki kayıtla karşılaştırabiliyor ve rapor indirebiliyorsun.

Dosya cihazında işleniyor; hesap, API anahtarı ve çalışma zamanı bağımlılığı yok. Komut satırı aracı CI’da hata ve performans eşiği kontrolü de yapıyor. HAR çıktısında gövdeler, çerezler ve sorgu değerleri çıkarılıyor; URL yollarını yine de paylaşmadan önce kontrol etmek gerekiyor.

Ağ sorunları ayıklayan geliştiricilerin geri bildirimini merak ediyorum: günlük iş akışında en çok hangi adım zaman kaybettiriyor?

https://github.com/fkalsasx/traceglass

## Release checks

- Run the test, syntax and build commands.
- Check the demo, real local file import, invalid input and both exports.
- Review screenshots for private information (only synthetic demo data should appear).
- Enable Pages and verify the published demo before advertising its URL.
- Link the demo in the repository’s About panel.
- Respond to early issues and improve one real pain point at a time. A working project and considerate maintenance help; no star count is guaranteed.
