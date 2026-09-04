// X-Client-Platform başlığından platformu okur — bkz. plan §Faz D. Android
// varsayılan (mobilin çoğunluğu ve HENÜZ iOS sürümü yok) — başlık eksik/
// tanınmayan bir değer taşıyorsa REDDETMEZ, sessizce android'e düşer (yanlış
// başlık boot'u/isteği asla çökertmemeli, diğer no-op adaptörlerle aynı ilke).
const KNOWN_PLATFORMS = new Set(['android', 'ios']);

const clientPlatform = () => {
  return (req, res, next) => {
    const header = req.get('X-Client-Platform');
    req.clientPlatform = KNOWN_PLATFORMS.has(header) ? header : 'android';
    next();
  };
};

export { clientPlatform };
