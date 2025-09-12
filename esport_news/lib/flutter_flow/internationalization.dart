import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kLocaleStorageKey = '__locale_key__';

class FFLocalizations {
  FFLocalizations(this.locale);

  final Locale locale;

  static FFLocalizations of(BuildContext context) =>
      Localizations.of<FFLocalizations>(context, FFLocalizations)!;

  static List<String> languages() => ['fr', 'en'];

  static late SharedPreferences _prefs;
  static Future initialize() async =>
      _prefs = await SharedPreferences.getInstance();
  static Future storeLocale(String locale) =>
      _prefs.setString(_kLocaleStorageKey, locale);
  static Locale? getStoredLocale() {
    final locale = _prefs.getString(_kLocaleStorageKey);
    return locale != null && locale.isNotEmpty ? createLocale(locale) : null;
  }

  String get languageCode => locale.toString();
  String? get languageShortCode =>
      _languagesWithShortCode.contains(locale.toString())
          ? '${locale.toString()}_short'
          : null;
  int get languageIndex => languages().contains(languageCode)
      ? languages().indexOf(languageCode)
      : 0;

  String getText(String key) =>
      (kTranslationsMap[key] ?? {})[locale.toString()] ?? '';

  String getVariableText({
    String? frText = '',
    String? enText = '',
  }) =>
      [frText, enText][languageIndex] ?? '';

  static const Set<String> _languagesWithShortCode = {
    'ar',
    'az',
    'ca',
    'cs',
    'da',
    'de',
    'dv',
    'en',
    'es',
    'et',
    'fi',
    'fr',
    'gr',
    'he',
    'hi',
    'hu',
    'it',
    'km',
    'ku',
    'mn',
    'ms',
    'no',
    'pt',
    'ro',
    'ru',
    'rw',
    'sv',
    'th',
    'uk',
    'vi',
  };
}

/// Used if the locale is not supported by GlobalMaterialLocalizations.
class FallbackMaterialLocalizationDelegate
    extends LocalizationsDelegate<MaterialLocalizations> {
  const FallbackMaterialLocalizationDelegate();

  @override
  bool isSupported(Locale locale) => _isSupportedLocale(locale);

  @override
  Future<MaterialLocalizations> load(Locale locale) async =>
      SynchronousFuture<MaterialLocalizations>(
        const DefaultMaterialLocalizations(),
      );

  @override
  bool shouldReload(FallbackMaterialLocalizationDelegate old) => false;
}

/// Used if the locale is not supported by GlobalCupertinoLocalizations.
class FallbackCupertinoLocalizationDelegate
    extends LocalizationsDelegate<CupertinoLocalizations> {
  const FallbackCupertinoLocalizationDelegate();

  @override
  bool isSupported(Locale locale) => _isSupportedLocale(locale);

  @override
  Future<CupertinoLocalizations> load(Locale locale) =>
      SynchronousFuture<CupertinoLocalizations>(
        const DefaultCupertinoLocalizations(),
      );

  @override
  bool shouldReload(FallbackCupertinoLocalizationDelegate old) => false;
}

class FFLocalizationsDelegate extends LocalizationsDelegate<FFLocalizations> {
  const FFLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => _isSupportedLocale(locale);

  @override
  Future<FFLocalizations> load(Locale locale) =>
      SynchronousFuture<FFLocalizations>(FFLocalizations(locale));

  @override
  bool shouldReload(FFLocalizationsDelegate old) => false;
}

Locale createLocale(String language) => language.contains('_')
    ? Locale.fromSubtags(
        languageCode: language.split('_').first,
        scriptCode: language.split('_').last,
      )
    : Locale(language);

bool _isSupportedLocale(Locale locale) {
  final language = locale.toString();
  return FFLocalizations.languages().contains(
    language.endsWith('_')
        ? language.substring(0, language.length - 1)
        : language,
  );
}

final kTranslationsMap = <Map<String, Map<String, String>>>[
  // Home
  {
    'aue8nt51': {
      'fr': 'Home',
      'en': '',
    },
  },
  // Profil
  {
    'r4krto8o': {
      'fr': 'Settings',
      'en': '',
    },
    '774ygg90': {
      'fr': 'Préférences',
      'en': '',
    },
    'ck8gsxwy': {
      'fr': 'Préférences',
      'en': '',
    },
    'sygxvk0b': {
      'fr': 'Select...',
      'en': '',
    },
    'wzs1yqr3': {
      'fr': 'Search...',
      'en': '',
    },
    'hln14md6': {
      'fr': 'Dark mode',
      'en': '',
    },
    'vfe3ua16': {
      'fr': 'Light mode',
      'en': '',
    },
    'lcuzik6n': {
      'fr': 'Edit profile',
      'en': '',
    },
    'h70fh9ss': {
      'fr': 'Name',
      'en': '',
    },
    'mpmov5cf': {
      'fr': 'Email',
      'en': '',
    },
    '5a8eh8ds': {
      'fr': 'New password',
      'en': '',
    },
    '6r9ygdok': {
      'fr': 'Cancel',
      'en': '',
    },
    'pm1f6f0y': {
      'fr': 'Apply',
      'en': '',
    },
    'kplcunq6': {
      'fr': 'Buy Premium',
      'en': '',
    },
    'w20e1i15': {
      'fr': 'Premium',
      'en': '',
    },
    'k6hiaz3x': {
      'fr': 'Edit',
      'en': '',
    },
    'cfsgndoy': {
      'fr': 'Favorite Game',
      'en': '',
    },
    'ty44nfr5': {
      'fr': 'FIFA',
      'en': '',
    },
    'juq03t0p': {
      'fr': 'FIFA',
      'en': '',
    },
    'qsdnetvz': {
      'fr': 'CS2',
      'en': '',
    },
    '29q80c25': {
      'fr': 'CS2',
      'en': '',
    },
    '66f0d3mf': {
      'fr': 'LOL',
      'en': '',
    },
    '0l7vx88d': {
      'fr': 'LOL',
      'en': '',
    },
    'jc9byar1': {
      'fr': 'DOTA 2',
      'en': '',
    },
    'qq1jxwdq': {
      'fr': 'DOTA 2',
      'en': '',
    },
    'gl3f9fru': {
      'fr': 'NBA 2K',
      'en': '',
    },
    's8ufcrpk': {
      'fr': 'NBA 2K',
      'en': '',
    },
    'slr5g6jk': {
      'fr': 'Favorite Team',
      'en': '',
    },
    '924vx38t': {
      'fr': 'Pick a team',
      'en': '',
    },
    'wy3uvh4q': {
      'fr': 'Buy Premium',
      'en': '',
    },
    'lk34ogh7': {
      'fr': 'Premium',
      'en': '',
    },
    '2feqrfxw': {
      'fr': 'Logout',
      'en': '',
    },
    'i84ptlz6': {
      'fr': 'Settings',
      'en': 'Settings',
    },
    'jzi24cvs': {
      'fr': 'Edit',
      'en': '',
    },
    '6uumo18w': {
      'fr': 'Favorite Game',
      'en': '',
    },
    'ydah3mdc': {
      'fr': 'FIFA',
      'en': '',
    },
    '6y7ezfxq': {
      'fr': 'FIFA',
      'en': '',
    },
    'toyy4q6y': {
      'fr': 'CS2',
      'en': '',
    },
    'fwpkiq1u': {
      'fr': 'CS2',
      'en': '',
    },
    'i3nn14pr': {
      'fr': 'LOL',
      'en': '',
    },
    'phcqnatx': {
      'fr': 'LOL',
      'en': '',
    },
    '1cp15ads': {
      'fr': 'NBA 2K',
      'en': '',
    },
    'w8n2z641': {
      'fr': 'NBA 2K',
      'en': '',
    },
    'nmrmnikz': {
      'fr': 'DOTA 2',
      'en': '',
    },
    'c3p7mviw': {
      'fr': 'DOTA 2',
      'en': '',
    },
    'vf33iikv': {
      'fr': 'Favorite Team',
      'en': '',
    },
    'bzjaouwm': {
      'fr': 'Pick a team',
      'en': '',
    },
    'lx2wj5tp': {
      'fr': 'Profil',
      'en': '',
    },
  },
  // Login
  {
    'wo0epong': {
      'fr': 'Login to continue',
      'en': '',
    },
    '1qr364zx': {
      'fr': 'Let\'s get started by filling out the form below.',
      'en': '',
    },
    'j4vcti70': {
      'fr': 'Email',
      'en': '',
    },
    'xriwweda': {
      'fr': 'Password',
      'en': '',
    },
    'kc5tgnru': {
      'fr': 'Login',
      'en': '',
    },
    '2pceplxo': {
      'fr': 'Login to continue',
      'en': '',
    },
    'jhyjl57c': {
      'fr': 'Let\'s get started by filling out the form below.',
      'en': '',
    },
    '49g95aaj': {
      'fr': 'Email',
      'en': '',
    },
    'y4o7fs92': {
      'fr': 'Password',
      'en': '',
    },
    '456zsrb3': {
      'fr': 'Login',
      'en': '',
    },
    'kanycm4z': {
      'fr': 'Sign up',
      'en': '',
    },
    '4zp3629l': {
      'fr': 'Home',
      'en': '',
    },
  },
  // SignUp
  {
    '4ead8tu6': {
      'fr': 'Create an account',
      'en': '',
    },
    '5og3tlo1': {
      'fr': 'Let\'s get started by filling out the form below.',
      'en': '',
    },
    '233x19w1': {
      'fr': 'Name',
      'en': '',
    },
    'gc54fowq': {
      'fr': 'Email',
      'en': '',
    },
    'n0ljuwik': {
      'fr': 'Password',
      'en': '',
    },
    'xqypalpg': {
      'fr': 'Confirm password',
      'en': '',
    },
    'ohfbeq0m': {
      'fr': 'Sign Up',
      'en': '',
    },
    '851uh28k': {
      'fr': 'Create an account',
      'en': '',
    },
    '8q7zer0a': {
      'fr': 'Let\'s get started by filling out the form below.',
      'en': '',
    },
    '206dubtl': {
      'fr': 'Name',
      'en': '',
    },
    '48t83lml': {
      'fr': 'Email',
      'en': '',
    },
    '3rj7gn9s': {
      'fr': 'Password',
      'en': '',
    },
    't08mpijq': {
      'fr': 'Confirm password',
      'en': '',
    },
    '79eptwi2': {
      'fr': 'Sign Up',
      'en': '',
    },
    'mi7a75nb': {
      'fr': 'Login',
      'en': '',
    },
    'ctr4h5eq': {
      'fr': 'Home',
      'en': '',
    },
  },
  // settings_page
  {
    'j1yjjxrn': {
      'fr': 'Settings',
      'en': '',
    },
    'j0b20kng': {
      'fr': 'Préférences',
      'en': '',
    },
    'sm0etm6q': {
      'fr': 'Home',
      'en': '',
    },
  },
  // preference_settings
  {
    'ymnrr04k': {
      'fr': 'Préférences',
      'en': '',
    },
    'i11wwdof': {
      'fr': 'Select...',
      'en': '',
    },
    '6fjvqs9e': {
      'fr': 'Search...',
      'en': '',
    },
    '2f2tcywn': {
      'fr': 'Dark mode',
      'en': '',
    },
    'jbnan6p6': {
      'fr': 'Light mode',
      'en': '',
    },
    '4ov1su4w': {
      'fr': 'Home',
      'en': '',
    },
  },
  // unique_event
  {
    '05wovpm8': {
      'fr': 'Matches',
      'en': '',
    },
    'z8aj1g69': {
      'fr': 'Equipes',
      'en': '',
    },
    'h3njryii': {
      'fr': 'Home',
      'en': '',
    },
  },
  // Stream_page
  {
    'c50hwbvi': {
      'fr': 'Streaming',
      'en': '',
    },
    'srns7ibl': {
      'fr': 'Home',
      'en': '',
    },
  },
  // event_mobile_page
  {
    'p7qz28e5': {
      'fr': 'Running',
      'en': '',
    },
    '51k31no0': {
      'fr': 'Upcoming',
      'en': '',
    },
    '1rpcimuq': {
      'fr': 'Past',
      'en': '',
    },
    'vj2ho07b': {
      'fr': 'Home',
      'en': '',
    },
  },
  // unique_match
  {
    'cx0l1wx1': {
      'fr': 'Game',
      'en': '',
    },
    'vpes05yl': {
      'fr': 'Winner :',
      'en': '',
    },
    'p8z8hgh0': {
      'fr': 'Not finished',
      'en': '',
    },
    'i67qnfs2': {
      'fr': 'Stream',
      'en': '',
    },
    '3mw7addv': {
      'fr': 'Stream available',
      'en': '',
    },
    'gsjwoble': {
      'fr': 'Winner :',
      'en': '',
    },
    'r6brv2ml': {
      'fr': 'Not finished',
      'en': '',
    },
    '7q7b1hea': {
      'fr': 'Stream available',
      'en': '',
    },
    'iq1tdd8o': {
      'fr': 'Home',
      'en': '',
    },
  },
  // tournament
  {
    'khzu9ibt': {
      'fr': 'Live Tournaments',
      'en': '',
    },
    'cm9ohpm1': {
      'fr': 'Upcoming Tournaments',
      'en': '',
    },
    'ydo3fh2n': {
      'fr': 'Past Tournaments',
      'en': '',
    },
    '9jee71yl': {
      'fr': 'Home',
      'en': '',
    },
  },
  // calendar
  {
    'h53zjobl': {
      'fr': 'Sélectionner une région...',
      'en': '',
    },
    'qq9b4qav': {
      'fr': 'Search...',
      'en': '',
    },
    'r3n9mz3l': {
      'fr': 'Monde',
      'en': '',
    },
    'czbxa0c5': {
      'fr': 'Europe de l’Ouest',
      'en': '',
    },
    'phw68arb': {
      'fr': 'Europe de l’Est',
      'en': '',
    },
    'sgv7dbzn': {
      'fr': 'Amérique du Nord',
      'en': '',
    },
    '2evqmlzv': {
      'fr': 'Amérique du Sud',
      'en': '',
    },
    'plnw52nz': {
      'fr': 'Asie',
      'en': '',
    },
    'pcy8zlo0': {
      'fr': 'Océanie',
      'en': '',
    },
    'lua3l85f': {
      'fr': 'Choisissez le niveau du tournoi...',
      'en': '',
    },
    'danvlorm': {
      'fr': 'Search...',
      'en': '',
    },
    'wkdykrtq': {
      'fr': 'Top mondial',
      'en': '',
    },
    '0ts4ytmp': {
      'fr': 'Grands tournois',
      'en': '',
    },
    '2koye0kr': {
      'fr': 'Régional haut niveau',
      'en': '',
    },
    'ria91a8v': {
      'fr': 'Semi-pro',
      'en': '',
    },
    'uokxl3j6': {
      'fr': 'Amateur',
      'en': '',
    },
    'pefhivwy': {
      'fr': 'Home',
      'en': '',
    },
  },
  // ArticlesPage
  {
    '49rpwqbj': {
      'fr': 'Home',
      'en': '',
    },
  },
  // article
  {
    'tq5j329o': {
      'fr': 'Home',
      'en': '',
    },
  },
  // news_page
  {
    'mugjhbbf': {
      'fr': 'Home',
      'en': '',
    },
  },
  // navBarPC-login
  {
    'r7cxenfh': {
      'fr': 'Home',
      'en': '',
    },
    '0thdcm8b': {
      'fr': 'News',
      'en': '',
    },
    'zwv7awpg': {
      'fr': 'Calendar',
      'en': '',
    },
    'ykyigfgw': {
      'fr': 'Tournament',
      'en': '',
    },
    'iycwbob7': {
      'fr': 'Article',
      'en': '',
    },
    'u9sw9qq7': {
      'fr': 'Sign Up',
      'en': '',
    },
  },
  // navBarPC-signup
  {
    '80j2wpwl': {
      'fr': 'Home',
      'en': '',
    },
    'cce013p8': {
      'fr': 'News',
      'en': '',
    },
    'shx0jvay': {
      'fr': 'Calendar',
      'en': '',
    },
    'pgo3b5a1': {
      'fr': 'Tournament',
      'en': '',
    },
    'eiv6fwe4': {
      'fr': 'Article',
      'en': '',
    },
    'rpzmufdz': {
      'fr': 'Login',
      'en': '',
    },
  },
  // gamesPickerPC
  {
    'nystvqxh': {
      'fr': 'SELECT ESPORT',
      'en': '',
    },
  },
  // matchLiveComponent
  {
    'cxyhsofs': {
      'fr': 'LIVE',
      'en': '',
    },
  },
  // matchLiveComponentMobile
  {
    'bqt8hvka': {
      'fr': 'LIVE',
      'en': '',
    },
  },
  // navBarPC-connected
  {
    'xao3wsa4': {
      'fr': 'Home',
      'en': '',
    },
    's3p6mc33': {
      'fr': 'News',
      'en': '',
    },
    'qakzu6h8': {
      'fr': 'Calendar',
      'en': '',
    },
    'daj7gr8v': {
      'fr': 'Tournament',
      'en': '',
    },
    'elrqde5m': {
      'fr': 'Article',
      'en': '',
    },
  },
  // topBar_Mobile_login
  {
    '98ftj7pv': {
      'fr': 'Sign up',
      'en': '',
    },
  },
  // topBar_mobile_home
  {
    '7ft4n3pg': {
      'fr': '0',
      'en': '',
    },
  },
  // topBar_mobile_signup
  {
    'qusr8fxh': {
      'fr': 'Login',
      'en': '',
    },
  },
  // modal_search_team
  {
    '64mxnos4': {
      'fr': 'Find your team...',
      'en': '',
    },
  },
  // modal_search_team_mobile
  {
    'e0zz5hcs': {
      'fr': 'Find your team...',
      'en': '',
    },
  },
  // mobal_select_gameTeams_mobile
  {
    'bvwpvafc': {
      'fr': 'Search by team ',
      'en': '',
    },
    '71zo3cd1': {
      'fr': 'Find your team...',
      'en': '',
    },
    '085hl7t1': {
      'fr': 'Game selection',
      'en': '',
    },
    'merx7h7p': {
      'fr': 'FIFA',
      'en': '',
    },
    '8m01tkpq': {
      'fr': 'FIFA',
      'en': '',
    },
    'olir9kgq': {
      'fr': 'CS2',
      'en': '',
    },
    '41i0h2c0': {
      'fr': 'CS2',
      'en': '',
    },
    'wynbur8e': {
      'fr': 'LOL',
      'en': '',
    },
    'pqc42f07': {
      'fr': 'LOL',
      'en': '',
    },
    'ok6z9qim': {
      'fr': 'NBA 2K',
      'en': '',
    },
    'k9do2ulf': {
      'fr': 'NBA 2K',
      'en': '',
    },
    'eiz79mtk': {
      'fr': 'DOTA 2',
      'en': '',
    },
    '7uhfsfk9': {
      'fr': 'DOTA 2',
      'en': '',
    },
  },
  // event_container
  {
    'g8735nef': {
      'fr': 'Upcoming event',
      'en': '',
    },
  },
  // home_event_container
  {
    'llei7wb7': {
      'fr': 'Live',
      'en': '',
    },
    'dtcudgl6': {
      'fr': 'Upcoming',
      'en': '',
    },
    'zzvdxsyx': {
      'fr': 'Past',
      'en': '',
    },
  },
  // bottomsheet_calendar
  {
    'g3tgreos': {
      'fr': 'Loading ...',
      'en': '',
    },
  },
  // bottomsheet_settings
  {
    'ihi75e87': {
      'fr': 'Sélectionner une région...',
      'en': '',
    },
    'a6q1xde9': {
      'fr': 'Search...',
      'en': '',
    },
    'w76md1tc': {
      'fr': 'Monde',
      'en': '',
    },
    '9obmcx8q': {
      'fr': 'Europe de l’Ouest',
      'en': '',
    },
    '0dk28gv1': {
      'fr': 'Europe de l’Est',
      'en': '',
    },
    'wd2g0ede': {
      'fr': 'Amérique du Nord',
      'en': '',
    },
    'oi070tyv': {
      'fr': 'Amérique du Sud',
      'en': '',
    },
    'r2cj01s0': {
      'fr': 'Asie',
      'en': '',
    },
    'gjhuu5k2': {
      'fr': 'Océanie',
      'en': '',
    },
    'v295pbqe': {
      'fr': 'Choisissez le niveau du tournoi...',
      'en': '',
    },
    'az08t82m': {
      'fr': 'Search...',
      'en': '',
    },
    '3lupf2zu': {
      'fr': 'Top mondial',
      'en': '',
    },
    'vppha3mr': {
      'fr': 'Grands tournois',
      'en': '',
    },
    'qdm04eo1': {
      'fr': 'Régional haut niveau',
      'en': '',
    },
    '31oxipa7': {
      'fr': 'Semi-pro',
      'en': '',
    },
    '1hcuout6': {
      'fr': 'Amateur',
      'en': '',
    },
    'po3jae5s': {
      'fr': 'Filters',
      'en': '',
    },
  },
  // modal_search_favorite_team
  {
    'd6wbui96': {
      'fr': 'Find your team...',
      'en': '',
    },
  },
  // Miscellaneous
  {
    'hviwm7bx': {
      'fr': '',
      'en': '',
    },
    'zrdd5yn8': {
      'fr': '',
      'en': '',
    },
    'o8rm20jv': {
      'fr': '',
      'en': '',
    },
    '90f7omyk': {
      'fr': '',
      'en': '',
    },
    'nl1w66ck': {
      'fr': '',
      'en': '',
    },
    'wwjtnfqj': {
      'fr': '',
      'en': '',
    },
    's5sdsont': {
      'fr': '',
      'en': '',
    },
    'eikaukrj': {
      'fr': '',
      'en': '',
    },
    'rsnqhg34': {
      'fr': '',
      'en': '',
    },
    '2pcbhawf': {
      'fr': '',
      'en': '',
    },
    'imohlr3d': {
      'fr': '',
      'en': '',
    },
    '660b696c': {
      'fr': '',
      'en': '',
    },
    'e45lcndm': {
      'fr': '',
      'en': '',
    },
    'u9zo7ipo': {
      'fr': '',
      'en': '',
    },
    'd4vnitt5': {
      'fr': '',
      'en': '',
    },
    'qh42k6hk': {
      'fr': '',
      'en': '',
    },
    '0sqg8rln': {
      'fr': '',
      'en': '',
    },
    'm3b1gy5e': {
      'fr': '',
      'en': '',
    },
    '086fff2o': {
      'fr': '',
      'en': '',
    },
    'egmhsw86': {
      'fr': '',
      'en': '',
    },
    'kdedws4y': {
      'fr': '',
      'en': '',
    },
    'bym344mb': {
      'fr': '',
      'en': '',
    },
    'y8m6ulx1': {
      'fr': '',
      'en': '',
    },
    'lxqlfdu3': {
      'fr': '',
      'en': '',
    },
    'pc0qajq9': {
      'fr': '',
      'en': '',
    },
    'wb88dspe': {
      'fr': '',
      'en': '',
    },
    'ypcxza0n': {
      'fr': '',
      'en': '',
    },
  },
].reduce((a, b) => a..addAll(b));
