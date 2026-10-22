import { formatBytes as bytes, formatDuration as time } from './har.js';

// A small, deterministic analyst. This module never calls a model or a network API.
const normalize = value => String(value ?? '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/\p{M}/gu, '');
const has = (text, pattern) => pattern.test(text);
const labels = { summary: 'Nereden başlamalıyım?', slow: 'Neden yavaş?', errors: 'Hataları açıkla', large: 'Büyük dosyaları bul', cache: 'Önbelleği incele', compare: 'Önceki kayıtla ne değişti?', budgets: 'Bütçeler nasıl?', privacy: 'Verilerim nerede?', help: 'Bu araç ne işe yarıyor?' };
const sortSlow = entries => [...entries].sort((a, b) => b.duration - a.duration);
const reference = e => ({ entryId: e.id, label: `${e.method} ${e.path}`, detail: `${e.status || 'ERR'} · ${time(e.duration)} · ${bytes(e.transfer)}` });
const section = (title, items) => ({ title, items: items.filter(Boolean) });

function chooseTopic(q) {
  if (has(q, /gizli|guven|privacy|veriler|upload|ucret|api anahtar|model|yapay zeka/)) return 'privacy';
  if (has(q, /karsilastir|onceki|baseline|degisti|regres|compare|before|after/)) return 'compare';
  if (has(q, /butce|budget|limit|p95/)) return 'budgets';
  if (has(q, /onbelle|\bcache\b/)) return 'cache';
  if (has(q, /buyuk|boyut|transfer|dosya|gorsel|resim|image|bundle|javascript|large|size/)) return 'large';
  if (has(q, /hata|basarisiz|\bfailed\b|\berror\b|\b[45]\d{2}\b|\bstatus\b|durum kod|\b0\b/)) return 'errors';
  if (has(q, /yavas|bekle|ttfb|latency|slow|hizlandir|timing|ilk bayt/)) return 'slow';
  if (has(q, /ne ise|nasil kullan|har nedir|nedir bu|yardim|help|merhaba|selam|hello|neler yap/)) return 'help';
  if (has(q, /ozet|oncelik|nereden|basla|once ne|analiz|incele|\boner\b|\boneri|\bsummary\b|\boverview\b/)) return 'summary';
  return null;
}

function statusAdvice(status) {
  if (status === 0) return ['HTTP yanıt kodu kaydedilmemiş. İptal, tarayıcı engeli veya bağlantı hatası olasılıklarını DevTools Console ve Network hata ayrıntılarıyla ayır.', 'Durum 0 tek başına CORS hatası olduğunu kanıtlamaz.'];
  if (status === 401) return ['Kimlik doğrulama reddedilmiş. Oturum süresini, token yenilemesini ve beklenen kimlik doğrulama akışını kontrol et.', 'HAR gövdeleri ve gizli başlıklar yorumlayıcıya verilmez; token içeriğini değerlendiremem.'];
  if (status === 403) return ['Sunucu erişimi reddetmiş. Kullanıcı yetkilerini ve sunucu/WAF erişim kurallarını kontrol et.', '403, hangi erişim kuralının reddettiğini tek başına göstermez.'];
  if (status === 404) return ['İstenen kaynak bulunamamış. İstemcinin çağırdığı yol ve HTTP metodunu yayımlanan API rotasıyla karşılaştır; eski bir asset referansı olup olmadığını incele.', 'Kaynağın neden bulunamadığı bu kayıttan kesinleşmez.'];
  if (status === 429) return ['İstek sınırına takılmış. Sunucu günlükleri ve hız sınırı politikasını kontrol et; gerekiyorsa gecikmeli yeniden deneme ve istek birleştirme uygula.', 'Bu kayıtta Retry-After veya yanıt gövdesini değerlendirmiyorum.'];
  if (status === 503) return ['Servis kullanılamaz yanıtı vermiş. Aynı zaman aralığındaki uygulama, proxy ve bağımlılık günlüklerini kontrol et; kapasite ve sağlık denetimlerini incele.', '503 tek başına kapasite sorunu veya çökmüş bir sunucu olduğunu kanıtlamaz.'];
  if (status === 502 || status === 504) return ['Ağ geçidi/upstream hattını incele. Proxy zaman aşımı ayarlarını, upstream yanıt sürelerini ve aynı andaki servis günlüklerini karşılaştır.', 'Hangi servis veya ağ katmanının sorumlu olduğu HAR ile kesinleşmez.'];
  return [status >= 500 ? 'Aynı zaman aralığındaki sunucu günlükleri ve dağıtık izlerle hata kaynağını araştır.' : 'İstek yolu, HTTP metodu ve beklenen API davranışını kontrol et.', 'HTTP durum kodu gözlemdir; uygulamadaki kök nedeni tek başına açıklamaz.'];
}

export function answerQuestion({ question, analysis, comparison = null, context = {} } = {}) {
  if (typeof question !== 'string' || !question.trim()) throw new Error('Bir soru yaz.');
  if (question.length > 2000) throw new Error('Sorunu 2.000 karakter içinde yaz.');
  const q = normalize(question.trim());
  const followup = /^(peki\s+)?(neden|nasil|nasil duzeltirim|cozum|devam|daha fazla|ne yapmaliyim)[?!.\s]*$/.test(q);
  let topic = chooseTopic(q) || (followup && Object.hasOwn(labels, context?.topic) ? context.topic : null);
  const entries = analysis?.entries ?? [];
  // Resolve explicit paths to captured requests; do not interpret arbitrary instructions in HAR text.
  const explicit = entries.filter(e => {
    const path = normalize(e.path.split('?')[0]);
    const leaf = path.split('/').filter(Boolean).at(-1);
    return path.length > 1 && q.includes(path) || leaf?.length >= 5 && q.includes(leaf) && new RegExp(`(?:^|[\\s/])${leaf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[\\s?.,])`).test(q);
  });
  const focused = sortSlow(explicit)[0] || (followup ? entries.find(e => e.id === context?.entryId) : null);
  if (focused && (!topic || ['summary', 'slow', 'errors', 'large', 'cache'].includes(topic) || followup)) topic = 'request';
  const result = { topic: topic ?? 'unsupported', title: '', lead: '', sections: [], evidence: [], actions: [], followUps: [], note: '', context: {} };
  const finish = (suggestions = ['summary', 'slow', 'errors']) => {
    result.followUps = suggestions.filter(t => t !== topic).map(t => labels[t]);
    result.context = { topic: topic ?? 'unsupported', ...(result.evidence.length ? { entryId: result.evidence[0].entryId } : {}) };
    return result;
  };
  const cite = list => { result.evidence = list.slice(0, 3).map(reference); };
  const view = (label, target) => result.actions.push({ label, view: target });

  if (topic === 'privacy') {
    result.title = 'Dosyan ve sohbetin tarayıcında kalır.';
    result.lead = 'Bu, ücretsiz ve kural tabanlı bir yerel yorumlayıcı. Dil modeli yerine açık HAR kaydının ölçümlerine uygulanan analiz kuralları kullanır.';
    result.sections = [section('Nasıl çalışıyor?', ['Kayıttaki URL’lere istek gönderilmez. API çağrısı, model indirmesi, hesap veya kullanım ücreti yok.', 'HAR worker belleğinde, sohbet sayfa belleğinde tutulur. Yenilemek ikisini de temizler; yalnızca tema tercihi yerel depolamaya yazılır.', 'Yorumlayıcı yalnızca azaltılmış analiz verisini kullanır. Sorgu değerleri gizlenir; alan adı ve URL yolu hâlâ hassas bilgi içerebilir.'])];
    return finish(['help', 'summary']);
  }
  if (topic === 'help') {
    result.title = 'Ağ kaydını, izleyebileceğin bir inceleme planına çeviriyorum.';
    result.lead = 'Traceglass bir sayfanın ağ isteklerini HAR dosyasından inceler. Hangi istek yavaş, hangisi hata vermiş ve hangi dosya çok veri taşıyor: bunları ölçümlerle açıklarım.';
    result.sections = [section('İlk bir dakikan', ['DevTools → Network içinde sorunu yeniden oluştur ve HAR olarak dışa aktar. Ardından Open HAR file ile aç.', '“Neden yavaş?” veya “Önce neyi düzeltmeliyim?” diye sor. Yanıttaki kanıt kartı ilgili isteğin ayrıntılarını açar.', 'Önceki bir HAR dosyasını Add baseline ile eklersen değişen uç noktaları da açıklayabilirim.'])];
    result.note = 'Ücretsiz ve kural tabanlıyım; genel amaçlı bir dil modeli değilim. Açık kaydın dışındaki sistem durumunu bilemem.';
    return finish();
  }
  if (!analysis) {
    result.title = 'Önce bir ağ kaydı açalım.';
    result.lead = 'Open HAR file ile dosyanı aç veya örnek kaydı yükle. Açık bir kayıt olmadan ölçüm ya da sorun uydurmam.';
    return finish(['help', 'privacy']);
  }
  const s = analysis.summary;
  const failures = sortSlow(entries.filter(e => e.failed));
  const waitingIds = new Set(analysis.findings.find(f => f.id === 'waiting')?.entryIds ?? []);
  const waiting = sortSlow(entries.filter(e => waitingIds.has(e.id)));
  const largest = [...entries].filter(e => e.transfer !== null).sort((a, b) => b.transfer - a.transfer);
  if (topic === 'request' && focused) {
    result.title = `${focused.method} ${focused.path}`;
    result.lead = `${focused.status || 'Durum 0'} yanıtı · ${time(focused.duration)} toplam süre · ${bytes(focused.transfer)} aktarım.`;
    const advice = focused.failed ? statusAdvice(focused.status) : ['Aynı isteğin farklı çalıştırmalardaki süresini karşılaştır. Bekleme yüksekse sunucu izleriyle, indirme yüksekse dosya boyutu ve bağlantı koşullarıyla birlikte incele.', 'Tek bir istek ölçümü kök nedeni veya kullanıcı deneyimine etkisini kesinleştirmez.'];
    result.sections = [section('Kayıtta görülen', [focused.wait !== null ? `${time(focused.wait)} ilk bayt beklemesi, toplam sürenin %${Math.round(focused.wait / Math.max(focused.duration, 1) * 100)} kadarı.` : 'İlk bayt bekleme süresi kaydedilmemiş.', `Tür: ${focused.type} · Alan adı: ${focused.host}.`]), section('Kontrol adımı', [advice[0]])];
    result.note = advice[1]; cite([focused]);
    return finish(['slow', 'errors', 'large']);
  }
  if (topic === 'errors') {
    const code = q.match(/\b([45]\d{2}|0)\b/)?.[1];
    const matches = code ? failures.filter(e => e.status === Number(code)) : failures;
    result.title = code ? `${code} durum kodunu inceleyelim.` : `${failures.length} başarısız istek var.`;
    result.lead = code ? `Seçili kayıtta bu kodla ${matches.length} istek bulunuyor.` : `${s.count} isteğin ${failures.length} tanesi HTTP 4xx/5xx veya durum 0 ile kaydedilmiş.`;
    if (matches.length || code) {
      const statuses = code ? [Number(code)] : [...new Set(matches.map(e => e.status))];
      result.sections = statuses.slice(0, 5).map(status => section(`${status || 'Durum 0'} · ${matches.filter(e => e.status === status).length} istek`, [statusAdvice(status)[0]]));
      result.sections.push(section('İzlenecek yol', ['İlgili isteğin yolunu, metodunu ve zamanlamasını aşağıdaki kanıttan aç. Aynı zaman aralığındaki uygulama günlükleriyle eşleştir.', code && !matches.length ? 'Bu kod seçili kapsamda yok; açıklama genel durum kodu bilgisidir.' : 'Başarısız yanıtları düzeltirken beklenen iş davranışını doğrula; her 4xx istemci kodunda hata olduğu anlamına gelmez.']));
      result.note = code ? statusAdvice(Number(code))[1] : `HTTP durum kodları kök nedeni tek başına kanıtlamaz.${statuses.length > 5 ? ' İlk 5 farklı kod açıklanıyor; diğer yanıtları zaman çizelgesinde inceleyebilirsin.' : ''}`;
      cite(matches);
    } else result.note = 'Bu kayıtta başarısız yanıt görünmüyor. Bu, uygulamanın tüm akışlarının hatasız olduğu anlamına gelmez.';
    result.actions = [{ label: 'Başarısız istekleri göster', filter: 'failed' }];
    return finish(['summary', 'slow', 'compare']);
  }
  if (topic === 'slow') {
    const slowest = focused ?? waiting[0] ?? sortSlow(entries)[0];
    result.title = waiting.length ? 'İlk bakılacak yer: ilk bayt beklemesi.' : 'En uzun isteği ölçümle ayıralım.';
    result.lead = `${slowest.method} ${slowest.path}, ${time(slowest.duration)} ile ${focused ? 'seçtiğin' : 'öne çıkan'} istek. ${slowest.wait === null ? 'Bekleme ölçümü kayıtta yok.' : `Bunun ${time(slowest.wait)} kadarı ilk baytı beklerken geçmiş.`}`;
    result.sections = [section('Kayıtta görülen', [`${waiting.length} istek, ${time(analysis.config.slowWaitMs)} ve %${Math.round(analysis.config.slowWaitRatio * 100)} bekleme eşiklerinin ikisini de aşıyor.`, `Kayıt aralığı ${time(s.duration)}; istek p95 değeri ${time(s.p95)}. Paralel isteklerin sürelerini toplamak sayfa yüklenme süresini vermez.`]), section('Ne yapabilirsin?', ['Öne çıkan isteği sunucu izleriyle eşleştir; veritabanı sorgusu, bağımlı servis, önbellek kaçırma ve ağ gecikmesini ayrı ayrı ölç.', 'Aynı akışı aynı bağlantı ve önbellek koşullarında birkaç kez kaydet. İyileştirmeyi baseline karşılaştırmasıyla doğrula.'])];
    result.note = 'TTFB, sunucu çalışmasına ek olarak ağ ve aracı katmanları da içerir. Bu veri tek başına “veritabanı yavaş” sonucunu vermez; HAR, LCP gibi görsel performans ölçümlerini de sağlamaz.';
    cite(focused ? [focused] : waiting.length ? waiting : [slowest]); view('Zaman çizelgesini aç', 'waterfall');
    return finish(['errors', 'large', 'compare']);
  }
  if (topic === 'large') {
    const large = largest.filter(e => e.transfer >= analysis.config.largeTransferBytes);
    result.title = large.length ? `${large.length} büyük aktarım öne çıkıyor.` : 'Bilinen aktarım boyutlarına bakalım.';
    result.lead = `${bytes(s.totalTransfer)} bilinen ağ aktarımı var.${s.unknownTransfer ? ` ${s.unknownTransfer} isteğin boyutu bilinmediği için bu bir alt sınır.` : ''}`;
    result.sections = [section('Kayıtta görülen', [largest[0] ? `En büyük aktarım ${largest[0].path}: ${bytes(largest[0].transfer)}. Bilinen toplamın %${Math.round(largest[0].transfer / Math.max(s.totalTransfer, 1) * 100)} kadarı.` : 'Aktarım boyutları kaydedilmemiş; dosya büyüklüğü sıralaması yapılamıyor.', `Büyük aktarım eşiği bu profilde ${bytes(analysis.config.largeTransferBytes)}.`]), section('Kontrol adımları', ['Görsellerin gerçek görüntülenme boyutunu, sıkıştırmasını ve uygun formatını kontrol et. Ekranın altındaki görseller için gecikmeli yüklemeyi değerlendir.', 'JavaScript için paket analizinde kullanılmayan kodu ve sayfa bazlı bölmeyi incele. Sıkıştırma/önbellek ayarını sunucuda doğrula.'])];
    result.note = 'Aktarılan bayt ile açılmış içerik boyutu farklıdır. Kaynak içeriğini incelemediğim için belirli bir küçülme yüzdesi veya hız kazancı vaat edemem.';
    cite(large.length ? large : largest); view('Aktarım dağılımını aç', 'overview');
    return finish(['cache', 'slow', 'budgets']);
  }
  if (topic === 'cache') {
    const ids = new Set(analysis.findings.find(f => f.id === 'cache')?.entryIds ?? []);
    const uncached = entries.filter(e => ids.has(e.id));
    result.title = `${uncached.length} statik yanıtta Cache-Control kaydedilmemiş.`;
    result.lead = 'Bu kontrol başarılı GET isteklerindeki script, stil, font ve görselleri kapsar.';
    result.sections = [section('Nasıl kontrol edilir?', ['Aynı sayfayı ikinci kez kaydet; DevTools içindeki Disable cache seçeneğinin durumunu not et. Ağ aktarımı ve yanıt başlıklarını karşılaştır.', 'İçerik hash’i taşıyan herkese açık statik dosyalarda uzun ömürlü önbellek politikasını değerlendir. Kişisel veya kimlik doğrulamalı yanıtları aynı politikaya dahil etme.'])];
    result.note = 'Başlığın eksik olması önbelleğin tamamen kapalı olduğunu kanıtlamaz. ETag, Expires, tarayıcı ve aracı önbellek davranışı ayrıca incelenmelidir.';
    cite(uncached); view('Bulguları aç', 'findings'); return finish(['large', 'compare']);
  }
  if (topic === 'compare') {
    result.title = comparison ? `${comparison.regressions} gerileme, ${comparison.newFailures} yeni hata sinyali.` : 'Karşılaştırmak için önceki bir kayıt ekle.';
    result.lead = comparison ? 'Aynı uç noktaların istek medyanlarını karşılaştırıyorum; toplam kayıt aralığı veya tek bir en yavaş istek üzerinden karar vermiyorum.' : 'Add baseline ile aynı akışın önceki HAR dosyasını aç. Ardından “Ne değişti?” diye sor.';
    if (comparison) {
      const changed = [...comparison.endpoints].filter(e => e.state === 'regression' || e.newFailure).sort((a, b) => Number(b.newFailure) - Number(a.newFailure) || b.delta - a.delta);
      result.sections = [section('Kayıtta görülen', [`Gerileme eşiği: en az ${time(comparison.config.regressionMs)} ve %${comparison.config.regressionPercent} artış; iki koşul birlikte aranır.`, ...changed.slice(0, 3).map(e => `${e.key}: ${time(e.previous)} → ${time(e.current)}${e.newFailure ? '; yeni başarısız yanıt var' : ''}.`)]), section('Doğrulama', ['Sayfa kapsamlarını, cihazı, bağlantıyı ve önbellek koşullarını eşleştir. Tek kayıttaki farkı kalıcı bir performans değişimi saymadan önce tekrarlı ölçüm yap.'])];
      cite(changed.flatMap(e => e.entryIds.map(id => entries.find(r => r.id === id)).filter(Boolean)));
    }
    result.note = 'URL soru işareti parametrelerinin değerleri eşleştirmeye katılmaz; farklı parametre değerleri aynı uç noktada birleşebilir.';
    view('Karşılaştırmayı aç', 'compare'); return finish(['summary', 'errors', 'budgets']);
  }
  if (topic === 'budgets') {
    const failed = analysis.budgets.filter(b => b.status === 'fail');
    result.title = `${analysis.budgets.length} etkin bütçenin ${failed.length} tanesi aşılmış.`;
    result.lead = 'Bütçeler, seçili HAR sayfasına uygulanan ayarlanabilir sınırlar. Evrensel bir performans puanı değildir.';
    result.sections = [section('Bütçe sonuçları', analysis.budgets.map(b => {
      const value = n => b.unit === 'bytes' ? bytes(n) : b.unit === 'ms' ? time(n) : n;
      return `${({ p95Ms: 'İstek p95 süresi', transferBytes: 'Bilinen aktarım', requests: 'İstek sayısı', failed: 'Başarısız istek' })[b.key]}: ${value(b.actual)} / ${value(b.limit)} · ${{ pass: 'sınır içinde', fail: 'sınır aşıldı', unknown: 'boyut eksik; geçiş doğrulanamadı' }[b.status]}.`;
    })), section('Sonraki adım', ['Budgets & rules bölümünden ürüne uygun sınırlar belirle. Boş bırakılan sınır devre dışı kalır.', 'Profili JSON olarak dışa aktararak aynı sınırları komut satırında ve CI içinde kullan.'])];
    result.note = 'p95, istek sürelerinin yüzde 95’lik dilimidir; sayfanın açılma veya etkileşime hazır olma süresi değildir.';
    view('Bütçeleri düzenle', 'budgets'); return finish(['slow', 'large', 'errors']);
  }
  if (topic === 'summary') {
    const heavy = largest[0]?.transfer >= analysis.config.largeTransferBytes ? largest[0] : null;
    result.title = failures.length ? 'Önce başarısız yanıtı incele.' : waiting.length ? 'İncelemeye bekleme süreleriyle başla.' : heavy ? 'İncelemeye büyük aktarımlardan başla.' : 'Hata, uzun bekleme veya büyük aktarım eşiği aşılmamış.';
    result.lead = `${s.count} istek · ${s.failed} başarısız yanıt · ${time(s.duration)} kayıt aralığı · ${s.unknownTransfer ? 'en az ' : ''}${bytes(s.totalTransfer)} aktarım.`;
    const first = failures.find(e => e.status >= 500) ?? failures[0];
    result.sections = [section('Önerdiğim inceleme sırası', [first ? `1. ${first.path} ${first.status || 'durum 0'} ile bitmiş. Önce bu yanıtın akışta beklenen bir durum olup olmadığını doğrula.` : '1. Başarısız HTTP yanıtı görünmüyor. Yavaş isteklerin kullanıcı akışındaki etkisini inceleyerek başla.', waiting[0] ? `2. ${waiting[0].path}: ${time(waiting[0].wait)} ilk bayt beklemesi. Sunucu ve bağımlılık izleriyle eşleştir.` : '2. Hiçbir istek mevcut uzun bekleme eşiklerini birlikte aşmamış.', heavy ? `3. ${heavy.path}: ${bytes(heavy.transfer)} aktarım. Boyut, sıkıştırma ve yükleme önceliğini kontrol et.` : largest.length ? `3. Bilinen boyutlarda büyük aktarım eşiğini aşan istek yok.${s.unknownTransfer ? ` ${s.unknownTransfer} isteğin boyutu bilinmiyor.` : ''}` : '3. Aktarım boyutları eksik; dosya boyutu önceliği belirleyemiyorum.'])];
    result.note = 'Bu, kayıttaki sinyallere göre bir inceleme sırasıdır. İsteklerin iş açısından önemini veya sayfanın kritik yolunu bu HAR’dan kesin belirleyemem.';
    cite([...new Map([first, waiting[0], heavy].filter(Boolean).map(e => [e.id, e])).values()]); view('Tüm bulguları aç', 'findings');
    return finish(['slow', 'errors', 'large']);
  }
  result.title = 'Bu soruyu kayıttaki verilerle yanıtlayamıyorum.';
  result.lead = 'Ücretsiz yerel yorumlayıcı; ağ yavaşlığı, HTTP hataları, aktarım boyutları, önbellek, bütçeler ve kayıt karşılaştırmaları için hazırlanmış kurallarla çalışır. Genel sohbet veya kod üretimi yapmaz.';
  result.note = '“Neden yavaş?”, “503 ne demek?” veya “Önce neyi düzeltmeliyim?” diye sorabilirsin. Belirli bir isteği sormak için URL yolunu yaz.';
  return finish();
}
