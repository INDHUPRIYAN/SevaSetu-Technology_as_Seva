// The languages a coordinator may speak or type in: the same list as services/bridge/src/languages.js
// (a bridge test keeps the two in step). code = ISO-639-1 (Bhashini, Groq Whisper, the browser); bcp47 = the
// browser's speech tag. The UI chrome itself is translated only where apps/web/src/i18n has strings.
export const LANGUAGES = [
  { code: 'ta', label: 'தமிழ்', name: 'Tamil', bcp47: 'ta-IN' },
  { code: 'hi', label: 'हिन्दी', name: 'Hindi', bcp47: 'hi-IN' },
  { code: 'en', label: 'English', name: 'English', bcp47: 'en-IN' },
  { code: 'ml', label: 'മലയാളം', name: 'Malayalam', bcp47: 'ml-IN' },
  { code: 'te', label: 'తెలుగు', name: 'Telugu', bcp47: 'te-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', name: 'Kannada', bcp47: 'kn-IN' },
  { code: 'mr', label: 'मराठी', name: 'Marathi', bcp47: 'mr-IN' },
  { code: 'bn', label: 'বাংলা', name: 'Bengali', bcp47: 'bn-IN' },
  { code: 'gu', label: 'ગુજરાતી', name: 'Gujarati', bcp47: 'gu-IN' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', name: 'Punjabi', bcp47: 'pa-IN' },
  { code: 'or', label: 'ଓଡ଼ିଆ', name: 'Odia', bcp47: 'or-IN' },
  { code: 'as', label: 'অসমীয়া', name: 'Assamese', bcp47: 'as-IN' },
  { code: 'ur', label: 'اردو', name: 'Urdu', bcp47: 'ur-IN' },
  { code: 'sa', label: 'संस्कृतम्', name: 'Sanskrit', bcp47: 'sa-IN' },
];
export const CODES = LANGUAGES.map(l => l.code);
export const BCP47 = Object.fromEntries(LANGUAGES.map(l => [l.code, l.bcp47]));
export const labelOf = code => LANGUAGES.find(l => l.code === code)?.label || code;
// right-to-left scripts, for text boxes and read-backs
export const dirOf = code => (code === 'ur' ? 'rtl' : 'ltr');
