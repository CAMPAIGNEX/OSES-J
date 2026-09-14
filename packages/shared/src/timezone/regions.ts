/** Region (state/province) -> IANA timezone for countries spanning multiple zones. Keys are normalized lowercase. */

const US: Record<string, string> = {
  al: "America/Chicago", alabama: "America/Chicago", ak: "America/Anchorage", alaska: "America/Anchorage",
  az: "America/Phoenix", arizona: "America/Phoenix", ar: "America/Chicago", arkansas: "America/Chicago",
  ca: "America/Los_Angeles", california: "America/Los_Angeles", co: "America/Denver", colorado: "America/Denver",
  ct: "America/New_York", connecticut: "America/New_York", de: "America/New_York", delaware: "America/New_York",
  dc: "America/New_York", "district of columbia": "America/New_York", "washington dc": "America/New_York", "washington d c": "America/New_York",
  fl: "America/New_York", florida: "America/New_York", ga: "America/New_York", georgia: "America/New_York",
  hi: "Pacific/Honolulu", hawaii: "Pacific/Honolulu", id: "America/Boise", idaho: "America/Boise",
  il: "America/Chicago", illinois: "America/Chicago", in: "America/Indiana/Indianapolis", indiana: "America/Indiana/Indianapolis",
  ia: "America/Chicago", iowa: "America/Chicago", ks: "America/Chicago", kansas: "America/Chicago",
  ky: "America/New_York", kentucky: "America/New_York", la: "America/Chicago", louisiana: "America/Chicago",
  me: "America/New_York", maine: "America/New_York", md: "America/New_York", maryland: "America/New_York",
  ma: "America/New_York", massachusetts: "America/New_York", mi: "America/Detroit", michigan: "America/Detroit",
  mn: "America/Chicago", minnesota: "America/Chicago", ms: "America/Chicago", mississippi: "America/Chicago",
  mo: "America/Chicago", missouri: "America/Chicago", mt: "America/Denver", montana: "America/Denver",
  ne: "America/Chicago", nebraska: "America/Chicago", nv: "America/Los_Angeles", nevada: "America/Los_Angeles",
  nh: "America/New_York", "new hampshire": "America/New_York", nj: "America/New_York", "new jersey": "America/New_York",
  nm: "America/Denver", "new mexico": "America/Denver", ny: "America/New_York", "new york": "America/New_York",
  nc: "America/New_York", "north carolina": "America/New_York", nd: "America/Chicago", "north dakota": "America/Chicago",
  oh: "America/New_York", ohio: "America/New_York", ok: "America/Chicago", oklahoma: "America/Chicago",
  or: "America/Los_Angeles", oregon: "America/Los_Angeles", pa: "America/New_York", pennsylvania: "America/New_York",
  ri: "America/New_York", "rhode island": "America/New_York", sc: "America/New_York", "south carolina": "America/New_York",
  sd: "America/Chicago", "south dakota": "America/Chicago", tn: "America/Chicago", tennessee: "America/Chicago",
  tx: "America/Chicago", texas: "America/Chicago", ut: "America/Denver", utah: "America/Denver",
  vt: "America/New_York", vermont: "America/New_York", va: "America/New_York", virginia: "America/New_York",
  wa: "America/Los_Angeles", washington: "America/Los_Angeles", wv: "America/New_York", "west virginia": "America/New_York",
  wi: "America/Chicago", wisconsin: "America/Chicago", wy: "America/Denver", wyoming: "America/Denver",
  pr: "America/Puerto_Rico", "puerto rico": "America/Puerto_Rico",
};

const CA: Record<string, string> = {
  bc: "America/Vancouver", "british columbia": "America/Vancouver", ab: "America/Edmonton", alberta: "America/Edmonton",
  sk: "America/Regina", saskatchewan: "America/Regina", mb: "America/Winnipeg", manitoba: "America/Winnipeg",
  on: "America/Toronto", ontario: "America/Toronto", qc: "America/Toronto", quebec: "America/Toronto",
  nb: "America/Halifax", "new brunswick": "America/Halifax", ns: "America/Halifax", "nova scotia": "America/Halifax",
  pe: "America/Halifax", "prince edward island": "America/Halifax", nl: "America/St_Johns", newfoundland: "America/St_Johns",
  "newfoundland and labrador": "America/St_Johns", yt: "America/Whitehorse", yukon: "America/Whitehorse",
  nt: "America/Yellowknife", "northwest territories": "America/Yellowknife", nu: "America/Iqaluit", nunavut: "America/Iqaluit",
};

const AU: Record<string, string> = {
  nsw: "Australia/Sydney", "new south wales": "Australia/Sydney", vic: "Australia/Melbourne", victoria: "Australia/Melbourne",
  qld: "Australia/Brisbane", queensland: "Australia/Brisbane", sa: "Australia/Adelaide", "south australia": "Australia/Adelaide",
  wa: "Australia/Perth", "western australia": "Australia/Perth", tas: "Australia/Hobart", tasmania: "Australia/Hobart",
  nt: "Australia/Darwin", "northern territory": "Australia/Darwin", act: "Australia/Sydney", "australian capital territory": "Australia/Sydney",
};

const BR: Record<string, string> = {
  sp: "America/Sao_Paulo", "sao paulo": "America/Sao_Paulo", rj: "America/Sao_Paulo", "rio de janeiro": "America/Sao_Paulo",
  mg: "America/Sao_Paulo", "minas gerais": "America/Sao_Paulo", pr: "America/Sao_Paulo", parana: "America/Sao_Paulo",
  rs: "America/Sao_Paulo", "rio grande do sul": "America/Sao_Paulo", sc: "America/Sao_Paulo", "santa catarina": "America/Sao_Paulo",
  ba: "America/Bahia", bahia: "America/Bahia", am: "America/Manaus", amazonas: "America/Manaus", mt: "America/Cuiaba", "mato grosso": "America/Cuiaba",
  ac: "America/Rio_Branco", acre: "America/Rio_Branco", pe: "America/Recife", pernambuco: "America/Recife", ce: "America/Fortaleza", ceara: "America/Fortaleza",
};

const MX: Record<string, string> = {
  cdmx: "America/Mexico_City", "mexico city": "America/Mexico_City", "ciudad de mexico": "America/Mexico_City",
  jalisco: "America/Mexico_City", "nuevo leon": "America/Monterrey", monterrey: "America/Monterrey",
  "baja california": "America/Tijuana", tijuana: "America/Tijuana", sonora: "America/Hermosillo", chihuahua: "America/Chihuahua",
  "quintana roo": "America/Cancun", cancun: "America/Cancun", sinaloa: "America/Mazatlan", "baja california sur": "America/Mazatlan",
};

const RU: Record<string, string> = {
  moscow: "Europe/Moscow", "saint petersburg": "Europe/Moscow", "st petersburg": "Europe/Moscow", kaliningrad: "Europe/Kaliningrad",
  samara: "Europe/Samara", yekaterinburg: "Asia/Yekaterinburg", omsk: "Asia/Omsk", novosibirsk: "Asia/Novosibirsk",
  krasnoyarsk: "Asia/Krasnoyarsk", irkutsk: "Asia/Irkutsk", yakutsk: "Asia/Yakutsk", vladivostok: "Asia/Vladivostok",
};

const ID: Record<string, string> = {
  jakarta: "Asia/Jakarta", java: "Asia/Jakarta", "west java": "Asia/Jakarta", "central java": "Asia/Jakarta", "east java": "Asia/Jakarta",
  sumatra: "Asia/Jakarta", bali: "Asia/Makassar", sulawesi: "Asia/Makassar", "east kalimantan": "Asia/Makassar", papua: "Asia/Jayapura",
};

export const REGION_TZ: Record<string, Record<string, string>> = { US, CA, AU, BR, MX, RU, ID };
