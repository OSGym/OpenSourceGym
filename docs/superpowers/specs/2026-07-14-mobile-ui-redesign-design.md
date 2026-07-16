# OpenGym Mobil UI Yenileme Tasarımı

## Özet

OpenGym mobil uygulaması mevcut siyaha yakın monokrom kimliğini korurken daha
sakin ve native odaklı bir ürün arayüzüne taşınır. Yenileme, temsili fitness
içeriklerini kaldırır ve üye deneyimini gerçek ürün yeteneklerine odaklar:
doluluk, üyelik durumu, turnike taraması, profil yönetimi, dil seçimi ve hesap
işlemleri.

Oturum açılmış uygulama üç çalışan hedef kullanır: Ana Sayfa, QR Tara ve Profil.
Kimlik doğrulama küçük ve tipli durum makinesi olarak kalır; oturumlu kabuk da
aynı yaklaşımı kullanır. Bu yenileme bir navigasyon çatısı eklemez veya sunucu
API'lerini değiştirmez.

## Bilgi Mimarisi

- Kimlik doğrulama ekranları safe area ve klavye davranışını yöneten ortak bir
  `AuthShell` kullanır. Üst bölgede kontrollü, monokrom bir ekipman görseli yer
  alır.
- Ana Sayfa üye selamlamasını, canlı salon doluluğunu, üyelik durumunu ve QR
  taramasına giden tek belirgin yolu gösterir. Temsili seri, vücut ağırlığı,
  salon saati ve ders hatırlatması içerikleri kaldırılır.
- QR Tara; kamera izni, tarama, doğrulama, başarı ve ret durumlarını yönetir.
  Her hata somut bir kurtarma yolu sunar.
- Profil; profil/fotoğraf verisini, dil seçimini, çıkışı ve hesap silmeyi yönetir.
  Tehlikeli işlemler rutin ayarlardan görsel olarak ayrılır.
- Etiketli üç öğeli alt menü yalnız çalışan hedefleri gösterir ve çıkış ya da
  oturum kaybına kadar ekran durumunu korur.

## Görsel ve Etkileşim Sistemi

- Sabit palet korunur: `#060607` arka plan, koyu nötr yüzeyler, kırık beyaz ana
  metin ve semantik yeşil/kırmızı durum renkleri.
- Sistem yazı tipi sabit ürün rolleriyle kullanılır: 28 pt ekran başlığı, 20–22
  pt bölüm başlığı, 16–17 pt gövde, 14–15 pt destek metni ve 13 pt kısa etiket.
- Kartlar 14–16 pt, giriş alanları 12–14 pt yarıçap kullanır; tam yuvarlak biçim
  yalnız rozetlere ayrılır. Bir yüzey geniş dekoratif gölge ile kenarlığı aynı
  anda kullanmaz.
- Tüm kontroller basılı, odaklı, devre dışı, yükleniyor ve hata durumları sunar.
  Android'in 48 dp asgari dokunma hedefi iki platform için alt sınırdır.
- Hareket 150–220 ms sürer ve yalnızca basış, sekme veya sonuç durumunu anlatır.
  Hareketi azaltan kullanıcılar kısa crossfade ya da anlık durum değişimi görür.
- QR başarı/hata sonucu kamera durduktan sonra bir kez en iyi çaba haptik
  üretebilir; görsel geri bildirim her zaman belirleyicidir.

## Veri ve Arayüzler

- Mevcut API rotaları ve `@opengym/shared` tipleri değişmez.
- Ana Sayfa üyelik ve doluluk verisini getirir. Profil; profil ve silme talebi
  verisini getirir, fotoğraf yükleme/kaldırma mutasyonlarını yönetir.
- Yerel oturumlu navigasyon `AppTab = "home" | "scan" | "profile"` kullanır.
- Ortak UI semantik düğme varyantları ile alan yardım/hata durumlarını sunar.
- Yeni tüm kullanıcı metinleri Türkçe ve İngilizce kaynaklara eklenir.

## Kalite Eşiği

- Kimlik doğrulama küçük telefonlarda klavye açıkken kullanılabilir kalır.
- Safe area, alt boşluklar, yatay ekran, büyük sistem yazısı, ekran okuyucu
  sırası ve azaltılmış hareket açıkça desteklenir.
- Yükleme mekânsal kararlılığı korur; yenileme mevcut veriyi gösterir; ağ
  hataları yeniden deneme eylemi sunar.
- Kamera/konum izin hataları, riskli cihaz engeli ve tüm turnike ret kodları
  anlaşılır ve kurtarılabilir kalır.
- Mobil lint, typecheck, testler ve Android dev-client derlemesi geçmelidir.

## Kapsam Dışı

Bu çalışma ödeme, ders, antrenman veya diyet özellikleri, vücut takibi, yeni
backend endpoint'i, deneysel gizleme, açık tema ya da çok şube davranışı eklemez.
