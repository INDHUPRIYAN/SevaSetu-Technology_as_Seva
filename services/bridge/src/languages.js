// The languages a coordinator may speak or type in. One place for: the code (ISO-639-1, what Bhashini, Groq
// Whisper and the browser use), the native label, the BCP-47 tag for browser speech, the weekday names (for the
// rules), the yes / no / "change" words, the fixed questions VoiceBridge asks, and the read-back scaffolding.
//
// NEEDS REVIEW BY NATIVE SPEAKERS for every language except English. These were drafted without one. Please read
// each line aloud with a speaker before the demo and fix the wording here; nothing else needs changing.
//
// Provider cover (checked live against the MeitY Bhashini pipeline on 2026-10-07): speech to text, translation and
// text to speech exist for all of these, except: no TTS voice for Sanskrit and Urdu, no ASR for Assamese. The
// chain then tries Groq Whisper (speech to text) or the browser's own voice.
const LANGUAGES = {
  en: { name: 'English', label: 'English', bcp47: 'en-IN' },
  ta: { name: 'Tamil', label: 'தமிழ்', bcp47: 'ta-IN' },
  hi: { name: 'Hindi', label: 'हिन्दी', bcp47: 'hi-IN' },
  ml: { name: 'Malayalam', label: 'മലയാളം', bcp47: 'ml-IN' },
  te: { name: 'Telugu', label: 'తెలుగు', bcp47: 'te-IN' },
  kn: { name: 'Kannada', label: 'ಕನ್ನಡ', bcp47: 'kn-IN' },
  mr: { name: 'Marathi', label: 'मराठी', bcp47: 'mr-IN' },
  bn: { name: 'Bengali', label: 'বাংলা', bcp47: 'bn-IN' },
  gu: { name: 'Gujarati', label: 'ગુજરાતી', bcp47: 'gu-IN' },
  pa: { name: 'Punjabi', label: 'ਪੰਜਾਬੀ', bcp47: 'pa-IN' },
  or: { name: 'Odia', label: 'ଓଡ଼ିଆ', bcp47: 'or-IN' },
  as: { name: 'Assamese', label: 'অসমীয়া', bcp47: 'as-IN' },
  ur: { name: 'Urdu', label: 'اردو', bcp47: 'ur-IN' },
  sa: { name: 'Sanskrit', label: 'संस्कृतम्', bcp47: 'sa-IN' },
};
const CODES = Object.keys(LANGUAGES);

// weekday words, Monday..Sunday, in each language (lower-case Latin alternatives are matched as whole words)
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_WORDS = {
  en: [['monday', 'mon'], ['tuesday', 'tue', 'tues'], ['wednesday', 'wed'], ['thursday', 'thu', 'thurs'], ['friday', 'fri'], ['saturday', 'sat'], ['sunday', 'sun']],
  ta: [['திங்கள்', 'திங்கட்கிழமை'], ['செவ்வாய்', 'செவ்வாய்க்கிழமை'], ['புதன்', 'புதன்கிழமை'], ['வியாழன்', 'வியாழக்கிழமை'], ['வெள்ளி', 'வெள்ளிக்கிழமை'], ['சனி', 'சனிக்கிழமை'], ['ஞாயிறு', 'ஞாயிற்றுக்கிழமை']],
  hi: [['सोमवार'], ['मंगलवार'], ['बुधवार'], ['गुरुवार', 'बृहस्पतिवार'], ['शुक्रवार'], ['शनिवार'], ['रविवार', 'इतवार']],
  ml: [['തിങ്കൾ', 'തിങ്കളാഴ്ച'], ['ചൊവ്വ', 'ചൊവ്വാഴ്ച'], ['ബുധൻ', 'ബുധനാഴ്ച'], ['വ്യാഴം', 'വ്യാഴാഴ്ച'], ['വെള്ളി', 'വെള്ളിയാഴ്ച'], ['ശനി', 'ശനിയാഴ്ച'], ['ഞായർ', 'ഞായറാഴ്ച']],
  te: [['సోమవారం'], ['మంగళవారం'], ['బుధవారం'], ['గురువారం'], ['శుక్రవారం'], ['శనివారం'], ['ఆదివారం']],
  kn: [['ಸೋಮವಾರ'], ['ಮಂಗಳವಾರ'], ['ಬುಧವಾರ'], ['ಗುರುವಾರ'], ['ಶುಕ್ರವಾರ'], ['ಶನಿವಾರ'], ['ಭಾನುವಾರ']],
  mr: [['सोमवार'], ['मंगळवार'], ['बुधवार'], ['गुरुवार'], ['शुक्रवार'], ['शनिवार'], ['रविवार']],
  bn: [['সোমবার'], ['মঙ্গলবার'], ['বুধবার'], ['বৃহস্পতিবার'], ['শুক্রবার'], ['শনিবার'], ['রবিবার']],
  gu: [['સોમવાર'], ['મંગળવાર'], ['બુધવાર'], ['ગુરુવાર'], ['શુક્રવાર'], ['શનિવાર'], ['રવિવાર']],
  pa: [['ਸੋਮਵਾਰ'], ['ਮੰਗਲਵਾਰ'], ['ਬੁੱਧਵਾਰ'], ['ਵੀਰਵਾਰ'], ['ਸ਼ੁੱਕਰਵਾਰ'], ['ਸ਼ਨੀਵਾਰ', 'ਸ਼ਨਿੱਚਰਵਾਰ'], ['ਐਤਵਾਰ']],
  or: [['ସୋମବାର'], ['ମଙ୍ଗଳବାର'], ['ବୁଧବାର'], ['ଗୁରୁବାର'], ['ଶୁକ୍ରବାର'], ['ଶନିବାର'], ['ରବିବାର']],
  as: [['সোমবাৰ'], ['মঙ্গলবাৰ'], ['বুধবাৰ'], ['বৃহস্পতিবাৰ'], ['শুক্ৰবাৰ'], ['শনিবাৰ'], ['দেওবাৰ']],
  ur: [['پیر'], ['منگل'], ['بدھ'], ['جمعرات'], ['جمعہ'], ['ہفتہ'], ['اتوار']],
  sa: [['सोमवासरः', 'सोमवारः'], ['मङ्गलवासरः', 'मङ्गलवारः'], ['बुधवासरः', 'बुधवारः'], ['गुरुवासरः', 'गुरुवारः'], ['शुक्रवासरः', 'शुक्रवारः'], ['शनिवासरः', 'शनिवारः'], ['रविवासरः', 'रविवारः']],
};

// the word for "week(s)" after a number, per language, so "4 weeks" is read in any of them
const WEEK_WORDS = ['weeks?', 'வாரங்களுக்கு', 'வாரங்கள்', 'வாரம்', 'हफ़्तों', 'हफ्तों', 'हफ़्ते', 'हफ्ते', 'सप्ताह', 'आठवडे', 'आठवडा', 'ആഴ്ച\\S*', 'వారా\\S*', 'ವಾರ\\S*', 'সপ্তাহ\\S*', 'અઠવાડિય\\S*', 'ਹਫ਼ਤ\\S*', 'ਹਫਤ\\S*', 'ସପ୍ତାହ\\S*', 'ہفت\\S*', 'सप्ताहा\\S*'];
// the word for people in a group after a number
const GROUP_WORDS = ['students?\\b', 'children\\b', 'kids\\b', 'people\\b', 'elders\\b', 'women\\b', 'men\\b', 'boys\\b', 'girls\\b', 'மாணவர\\S*', 'குழந்தை\\S*', 'பேர\\S*', 'बच्च\\S*', 'छात्र\\S*', 'लोग\\S*', 'विद्यार्थ\\S*', 'കുട്ടിക\\S*', 'വിദ്യാർത്ഥ\\S*', 'పిల్లల\\S*', 'విద్యార్థ\\S*', 'ಮಕ್ಕಳ\\S*', 'ವಿದ್ಯಾರ್ಥಿ\\S*', 'শিশু\\S*', 'ছাত্র\\S*', 'બાળક\\S*', 'વિદ્યાર્થી\\S*', 'ਬੱਚ\\S*', 'ਵਿਦਿਆਰਥੀ\\S*', 'ପିଲା\\S*', 'ছাত্ৰ\\S*', 'بچ\\S*', 'طلب\\S*', 'बालक\\S*', 'छात्रा\\S*', 'मुल\\S*', 'मुली\\S*', 'लड़क\\S*', 'लड़कि\\S*', 'विद्यार्थी\\S*'];
// morning / afternoon-evening words, to settle am / pm
const MORNING = ['morning', 'காலை', 'सुबह', 'സുബഹ്', 'രാവിലെ', 'ఉదయం', 'ಬೆಳಿಗ್ಗೆ', 'सकाळ', 'সকাল', 'સવાર', 'ਸਵੇਰ', 'ସକାଳ', 'ৰাতিপুৱা', 'صبح', 'प्रातः'];
const EVENING = ['evening', 'afternoon', 'மாலை', 'மதியம்', 'शाम', 'दोपहर', 'വൈകുന്നേരം', 'ഉച്ച', 'సాయంత్రం', 'మధ్యాహ్నం', 'ಸಂಜೆ', 'ಮಧ್ಯಾಹ್ನ', 'संध्याकाळ', 'दुपार', 'বিকেল', 'সন্ধ্যা', 'સાંજ', 'બપોર', 'ਸ਼ਾਮ', 'ਦੁਪਹਿਰ', 'ସନ୍ଧ୍ୟା', 'ଅପରାହ୍ନ', 'সন্ধিয়া', 'আবেলি', 'شام', 'دوپہر', 'सायं', 'मध्याह्न'];
// yes / no, and the words that mark a correction ("not Wednesday, Thursday")
const YES_WORDS = ['yes', 'yeah', 'yep', 'ok', 'okay', 'ஆம்', 'ஆமாம்', 'சரி', 'हाँ', 'हां', 'जी', 'ठीक', 'അതെ', 'ശരി', 'అవును', 'సరే', 'ಹೌದು', 'ಸರಿ', 'हो', 'होय', 'হ্যাঁ', 'ঠিক', 'હા', 'ਹਾਂ', 'ਜੀ', 'ହଁ', 'ঠিক', 'হয়', 'ہاں', 'جی', 'आम्', 'अस्तु'];
const NO_WORDS = ['no', 'nope', 'not', 'இல்லை', 'வேண்டாம்', 'नहीं', 'ना', 'അല്ല', 'വേണ്ട', 'కాదు', 'లేదు', 'ಇಲ್ಲ', 'ಅಲ್ಲ', 'नाही', 'না', 'ના', 'નહીં', 'ਨਹੀਂ', 'ਨਾ', 'ନା', 'ନୁହେଁ', 'নহয়', 'نہیں', 'नास्ति'];
const EDIT_WORDS = ['change', 'make it', 'not', 'instead', 'correct', 'rather', 'மாற்று', 'இல்லை', 'बदल', 'नहीं', 'മാറ്റ', 'അല്ല', 'మార్చ', 'కాదు', 'ಬದಲ', 'ಅಲ್ಲ', 'नाही', 'बदला', 'না', 'বদল', 'ના', 'નહીં', 'બદલ', 'ਨਹੀਂ', 'ਬਦਲ', 'ନା', 'ବଦଳ', 'নহয়', 'সলনি', 'نہیں', 'بدل', 'परिवर्त'];

// The fixed questions VoiceBridge asks, one field at a time. {title} is the earlier card's title.
const QUESTIONS = {
  en: { want: 'What does the group want help with?', place: 'Where will this happen? Please name the place.', day: 'Which day of the week?', start: 'What time does it start, and until when?', weeks: 'For how many weeks?', serveUsWell: 'How can a volunteer serve the group well?', youWillLearn: 'What will a volunteer learn here?', related: 'Is this for the same place as "{title}"?' },
  ta: { want: 'குழுவிற்கு எதில் உதவி வேண்டும்?', place: 'இது எங்கே நடக்கும்? இடத்தின் பெயரைச் சொல்லுங்கள்.', day: 'வாரத்தில் எந்த நாள்?', start: 'எத்தனை மணிக்குத் தொடங்கும், எத்தனை மணி வரை?', weeks: 'எத்தனை வாரங்களுக்கு?', serveUsWell: 'ஒரு தன்னார்வலர் குழுவிற்கு எப்படி நன்றாகச் சேவை செய்யலாம்?', youWillLearn: 'ஒரு தன்னார்வலர் இங்கே என்ன கற்றுக்கொள்வார்?', related: 'இது "{title}" அதே இடத்திற்கா?' },
  hi: { want: 'समूह को किस चीज़ में मदद चाहिए?', place: 'यह कहाँ होगा? कृपया जगह का नाम बताइए।', day: 'हफ़्ते का कौन सा दिन?', start: 'कितने बजे शुरू होगा, और कब तक?', weeks: 'कितने हफ़्तों के लिए?', serveUsWell: 'एक स्वयंसेवक समूह की अच्छी सेवा कैसे कर सकता है?', youWillLearn: 'एक स्वयंसेवक यहाँ क्या सीखेगा?', related: 'क्या यह "{title}" वाली जगह के लिए ही है?' },
  ml: { want: 'ഗ്രൂപ്പിന് എന്തിലാണ് സഹായം വേണ്ടത്?', place: 'ഇത് എവിടെ നടക്കും? സ്ഥലത്തിന്റെ പേര് പറയൂ.', day: 'ആഴ്ചയിലെ ഏത് ദിവസം?', start: 'എത്ര മണിക്ക് തുടങ്ങും, എത്ര മണി വരെ?', weeks: 'എത്ര ആഴ്ചത്തേക്ക്?', serveUsWell: 'ഒരു സന്നദ്ധപ്രവർത്തകന് ഗ്രൂപ്പിനെ എങ്ങനെ നന്നായി സേവിക്കാം?', youWillLearn: 'ഒരു സന്നദ്ധപ്രവർത്തകൻ ഇവിടെ എന്ത് പഠിക്കും?', related: 'ഇത് "{title}" എന്ന അതേ സ്ഥലത്തേക്കാണോ?' },
  te: { want: 'సమూహానికి దేనిలో సహాయం కావాలి?', place: 'ఇది ఎక్కడ జరుగుతుంది? స్థలం పేరు చెప్పండి.', day: 'వారంలో ఏ రోజు?', start: 'ఎన్ని గంటలకు మొదలవుతుంది, ఎంతవరకు?', weeks: 'ఎన్ని వారాలకు?', serveUsWell: 'ఒక వాలంటీర్ సమూహానికి ఎలా బాగా సేవ చేయగలరు?', youWillLearn: 'ఒక వాలంటీర్ ఇక్కడ ఏమి నేర్చుకుంటారు?', related: 'ఇది "{title}" అదే స్థలానికేనా?' },
  kn: { want: 'ಗುಂಪಿಗೆ ಯಾವುದರಲ್ಲಿ ಸಹಾಯ ಬೇಕು?', place: 'ಇದು ಎಲ್ಲಿ ನಡೆಯುತ್ತದೆ? ಸ್ಥಳದ ಹೆಸರು ಹೇಳಿ.', day: 'ವಾರದ ಯಾವ ದಿನ?', start: 'ಎಷ್ಟು ಗಂಟೆಗೆ ಶುರು, ಎಷ್ಟು ಗಂಟೆಯವರೆಗೆ?', weeks: 'ಎಷ್ಟು ವಾರಗಳಿಗೆ?', serveUsWell: 'ಒಬ್ಬ ಸ್ವಯಂಸೇವಕ ಗುಂಪಿಗೆ ಹೇಗೆ ಚೆನ್ನಾಗಿ ಸೇವೆ ಮಾಡಬಹುದು?', youWillLearn: 'ಒಬ್ಬ ಸ್ವಯಂಸೇವಕ ಇಲ್ಲಿ ಏನು ಕಲಿಯುತ್ತಾರೆ?', related: 'ಇದು "{title}" ಅದೇ ಸ್ಥಳಕ್ಕೇ?' },
  mr: { want: 'गटाला कशात मदत हवी आहे?', place: 'हे कुठे होईल? कृपया ठिकाणाचे नाव सांगा.', day: 'आठवड्यातील कोणता दिवस?', start: 'किती वाजता सुरू होईल, आणि किती वाजेपर्यंत?', weeks: 'किती आठवड्यांसाठी?', serveUsWell: 'एक स्वयंसेवक गटाची चांगली सेवा कशी करू शकतो?', youWillLearn: 'एक स्वयंसेवक इथे काय शिकेल?', related: 'हे "{title}" याच ठिकाणासाठी आहे का?' },
  bn: { want: 'দলটির কোন বিষয়ে সাহায্য দরকার?', place: 'এটি কোথায় হবে? জায়গার নাম বলুন।', day: 'সপ্তাহের কোন দিন?', start: 'কটায় শুরু হবে, আর কতক্ষণ পর্যন্ত?', weeks: 'কত সপ্তাহের জন্য?', serveUsWell: 'একজন স্বেচ্ছাসেবক দলটির ভালোভাবে সেবা কীভাবে করতে পারেন?', youWillLearn: 'একজন স্বেচ্ছাসেবক এখানে কী শিখবেন?', related: 'এটি কি "{title}"-এর একই জায়গার জন্য?' },
  gu: { want: 'જૂથને શેમાં મદદ જોઈએ છે?', place: 'આ ક્યાં થશે? કૃપા કરીને જગ્યાનું નામ કહો.', day: 'અઠવાડિયાનો કયો દિવસ?', start: 'કેટલા વાગ્યે શરૂ થશે, અને ક્યાં સુધી?', weeks: 'કેટલા અઠવાડિયાં માટે?', serveUsWell: 'એક સ્વયંસેવક જૂથની સારી સેવા કેવી રીતે કરી શકે?', youWillLearn: 'એક સ્વયંસેવક અહીં શું શીખશે?', related: 'શું આ "{title}" જેવી જ જગ્યા માટે છે?' },
  pa: { want: 'ਸਮੂਹ ਨੂੰ ਕਿਸ ਵਿੱਚ ਮਦਦ ਚਾਹੀਦੀ ਹੈ?', place: 'ਇਹ ਕਿੱਥੇ ਹੋਵੇਗਾ? ਕਿਰਪਾ ਕਰਕੇ ਜਗ੍ਹਾ ਦਾ ਨਾਮ ਦੱਸੋ।', day: 'ਹਫ਼ਤੇ ਦਾ ਕਿਹੜਾ ਦਿਨ?', start: 'ਕਿੰਨੇ ਵਜੇ ਸ਼ੁਰੂ ਹੋਵੇਗਾ, ਅਤੇ ਕਦੋਂ ਤੱਕ?', weeks: 'ਕਿੰਨੇ ਹਫ਼ਤਿਆਂ ਲਈ?', serveUsWell: 'ਇੱਕ ਵਲੰਟੀਅਰ ਸਮੂਹ ਦੀ ਚੰਗੀ ਸੇਵਾ ਕਿਵੇਂ ਕਰ ਸਕਦਾ ਹੈ?', youWillLearn: 'ਇੱਕ ਵਲੰਟੀਅਰ ਇੱਥੇ ਕੀ ਸਿੱਖੇਗਾ?', related: 'ਕੀ ਇਹ "{title}" ਵਾਲੀ ਜਗ੍ਹਾ ਲਈ ਹੀ ਹੈ?' },
  or: { want: 'ଗୋଷ୍ଠୀକୁ କେଉଁଥିରେ ସାହାଯ୍ୟ ଦରକାର?', place: 'ଏହା କେଉଁଠାରେ ହେବ? ସ୍ଥାନର ନାମ କୁହନ୍ତୁ।', day: 'ସପ୍ତାହର କେଉଁ ଦିନ?', start: 'କେତେ ବେଳେ ଆରମ୍ଭ ହେବ, ଆଉ କେତେ ବେଳ ପର୍ଯ୍ୟନ୍ତ?', weeks: 'କେତେ ସପ୍ତାହ ପାଇଁ?', serveUsWell: 'ଜଣେ ସ୍ୱେଚ୍ଛାସେବୀ ଗୋଷ୍ଠୀର ଭଲ ସେବା କିପରି କରିପାରିବେ?', youWillLearn: 'ଜଣେ ସ୍ୱେଚ୍ଛାସେବୀ ଏଠାରେ କ’ଣ ଶିଖିବେ?', related: 'ଏହା କ’ଣ "{title}" ସେହି ସ୍ଥାନ ପାଇଁ?' },
  as: { want: 'দলটোক কিহত সহায় লাগে?', place: 'এইটো ক’ত হ’ব? ঠাইৰ নাম কওক।', day: 'সপ্তাহৰ কোন দিন?', start: 'কেতিয়া আৰম্ভ হ’ব, আৰু কেতিয়ালৈ?', weeks: 'কিমান সপ্তাহৰ বাবে?', serveUsWell: 'এজন স্বেচ্ছাসেৱকে দলটোক কেনেকৈ ভালদৰে সেৱা কৰিব পাৰে?', youWillLearn: 'এজন স্বেচ্ছাসেৱকে ইয়াত কি শিকিব?', related: 'এইটো "{title}" একে ঠাইৰ বাবে নেকি?' },
  ur: { want: 'گروپ کو کس چیز میں مدد چاہیے؟', place: 'یہ کہاں ہوگا؟ براہِ کرم جگہ کا نام بتائیں۔', day: 'ہفتے کا کون سا دن؟', start: 'کتنے بجے شروع ہوگا، اور کب تک؟', weeks: 'کتنے ہفتوں کے لیے؟', serveUsWell: 'ایک رضاکار گروپ کی اچھی خدمت کیسے کر سکتا ہے؟', youWillLearn: 'ایک رضاکار یہاں کیا سیکھے گا؟', related: 'کیا یہ "{title}" والی جگہ کے لیے ہی ہے؟' },
  sa: { want: 'समूहस्य कस्मिन् विषये साहाय्यम् अपेक्षितम्?', place: 'एतत् कुत्र भविष्यति? स्थानस्य नाम वदतु।', day: 'सप्ताहस्य कः दिवसः?', start: 'कदा आरभ्यते, कदा पर्यन्तं च?', weeks: 'कति सप्ताहान् यावत्?', serveUsWell: 'स्वयंसेवकः समूहस्य सम्यक् सेवां कथं कुर्यात्?', youWillLearn: 'स्वयंसेवकः अत्र किं शिक्षिष्यते?', related: 'किम् एतत् "{title}" इति तस्मिन् एव स्थाने?' },
};

// Read-back scaffolding per language; the card's own words stay as written.
// need, place, every, from, to, weeks ({n}), serve, learn; `order`: 'from-to' = "from X to Y", 'postfix' = "X from Y to"
const READ_BACK = {
  en: { need: 'Need', place: 'Place', every: 'Every', from: 'from', to: 'to', weeks: 'for {n} weeks', serve: 'How to serve the group well', learn: 'A volunteer will learn', order: 'from-to' },
  ta: { need: 'தேவை', place: 'இடம்', every: 'ஒவ்வொரு', from: 'முதல்', to: 'வரை', weeks: '{n} வாரங்களுக்கு', serve: 'குழுவிற்கு நன்றாகச் சேவை செய்வது எப்படி', learn: 'தன்னார்வலர் கற்றுக்கொள்வது', order: 'postfix' },
  hi: { need: 'ज़रूरत', place: 'जगह', every: 'हर', from: 'से', to: 'तक', weeks: '{n} हफ़्तों के लिए', serve: 'समूह की अच्छी सेवा कैसे करें', learn: 'एक स्वयंसेवक सीखेगा', order: 'postfix' },
  ml: { need: 'ആവശ്യം', place: 'സ്ഥലം', every: 'എല്ലാ', from: 'മുതൽ', to: 'വരെ', weeks: '{n} ആഴ്ചത്തേക്ക്', serve: 'ഗ്രൂപ്പിനെ നന്നായി സേവിക്കുന്ന വിധം', learn: 'സന്നദ്ധപ്രവർത്തകൻ പഠിക്കുന്നത്', order: 'postfix' },
  te: { need: 'అవసరం', place: 'స్థలం', every: 'ప్రతి', from: 'నుండి', to: 'వరకు', weeks: '{n} వారాలకు', serve: 'సమూహానికి బాగా సేవ చేయడం ఎలా', learn: 'వాలంటీర్ నేర్చుకునేది', order: 'postfix' },
  kn: { need: 'ಅಗತ್ಯ', place: 'ಸ್ಥಳ', every: 'ಪ್ರತಿ', from: 'ರಿಂದ', to: 'ವರೆಗೆ', weeks: '{n} ವಾರಗಳಿಗೆ', serve: 'ಗುಂಪಿಗೆ ಚೆನ್ನಾಗಿ ಸೇವೆ ಮಾಡುವುದು ಹೇಗೆ', learn: 'ಸ್ವಯಂಸೇವಕ ಕಲಿಯುವುದು', order: 'postfix' },
  mr: { need: 'गरज', place: 'ठिकाण', every: 'दर', from: 'पासून', to: 'पर्यंत', weeks: '{n} आठवड्यांसाठी', serve: 'गटाची चांगली सेवा कशी करावी', learn: 'स्वयंसेवक शिकेल', order: 'postfix' },
  bn: { need: 'প্রয়োজন', place: 'জায়গা', every: 'প্রতি', from: 'থেকে', to: 'পর্যন্ত', weeks: '{n} সপ্তাহের জন্য', serve: 'দলটির ভালো সেবা কীভাবে করবেন', learn: 'একজন স্বেচ্ছাসেবক শিখবেন', order: 'postfix' },
  gu: { need: 'જરૂરિયાત', place: 'જગ્યા', every: 'દર', from: 'થી', to: 'સુધી', weeks: '{n} અઠવાડિયાં માટે', serve: 'જૂથની સારી સેવા કેવી રીતે કરવી', learn: 'સ્વયંસેવક શીખશે', order: 'postfix' },
  pa: { need: 'ਲੋੜ', place: 'ਜਗ੍ਹਾ', every: 'ਹਰ', from: 'ਤੋਂ', to: 'ਤੱਕ', weeks: '{n} ਹਫ਼ਤਿਆਂ ਲਈ', serve: 'ਸਮੂਹ ਦੀ ਚੰਗੀ ਸੇਵਾ ਕਿਵੇਂ ਕਰੀਏ', learn: 'ਵਲੰਟੀਅਰ ਸਿੱਖੇਗਾ', order: 'postfix' },
  or: { need: 'ଆବଶ୍ୟକତା', place: 'ସ୍ଥାନ', every: 'ପ୍ରତି', from: 'ରୁ', to: 'ପର୍ଯ୍ୟନ୍ତ', weeks: '{n} ସପ୍ତାହ ପାଇଁ', serve: 'ଗୋଷ୍ଠୀର ଭଲ ସେବା କିପରି କରିବେ', learn: 'ସ୍ୱେଚ୍ଛାସେବୀ ଶିଖିବେ', order: 'postfix' },
  as: { need: 'প্ৰয়োজন', place: 'ঠাই', every: 'প্ৰতি', from: 'ৰ পৰা', to: 'লৈ', weeks: '{n} সপ্তাহৰ বাবে', serve: 'দলটোক ভালদৰে সেৱা কেনেকৈ কৰিব', learn: 'স্বেচ্ছাসেৱকে শিকিব', order: 'postfix' },
  ur: { need: 'ضرورت', place: 'جگہ', every: 'ہر', from: 'سے', to: 'تک', weeks: '{n} ہفتوں کے لیے', serve: 'گروپ کی اچھی خدمت کیسے کریں', learn: 'ایک رضاکار سیکھے گا', order: 'postfix' },
  sa: { need: 'आवश्यकता', place: 'स्थानम्', every: 'प्रति', from: 'तः', to: 'पर्यन्तम्', weeks: '{n} सप्ताहान् यावत्', serve: 'समूहस्य सम्यक् सेवा कथम्', learn: 'स्वयंसेवकः शिक्षिष्यते', order: 'postfix' },
};

module.exports = { LANGUAGES, CODES, WEEKDAYS, DAY_WORDS, WEEK_WORDS, GROUP_WORDS, MORNING, EVENING, YES_WORDS, NO_WORDS, EDIT_WORDS, QUESTIONS, READ_BACK };
