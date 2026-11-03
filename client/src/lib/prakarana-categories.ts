// Prakarana Grantha sub-category per Strapi grantha documentId (= Book.id).
// Granthas typed "Prakarana Grantha" but missing here fall back to "pg-other".
export const PRAKARANA_SUBCATEGORY_BY_ID: Record<string, string> = {
  // Gitas
  "fvxvieo57zqp6rfeb5vv4cta": "pg-gitas", // Adbhutaramayana Ramagita
  "glad1kujmqsakbh0sfe84fai": "pg-gitas", // Adhyatma Gita
  "jhh99w85fha1id7auryv6xrz": "pg-gitas", // Arupa Gita
  "c7ymftfffihx3uz3slicdeci": "pg-gitas", // aShTAvakra gItA
  "wd7bdzxz12wumi61el3ieviy": "pg-gitas", // Avadhuta Gita
  "brofpb25x6tgltlzh12zrkf5": "pg-gitas", // Baka gita
  "mfybyz00yauzwfar8gmso23h": "pg-gitas", // Dharamvyaadha gita
  "qy0xme0n0s6qzuseyjzrmi9m": "pg-gitas", // Ganesha Gita
  "r8t53odojgzrhzwekzx4oktn": "pg-gitas", // Ganesha Gita Comprehensive
  "n7nck658i38fc5sq34dintr4": "pg-gitas", // Guru Gita
  "dpwni3g1wy4uy845gdp0gzfl": "pg-gitas", // Jayanteya Gita
  "rqj5uzuj2r655b1nqef9tjfy": "pg-gitas", // Kapila Gita
  "zgat36pd3bwqi4xrf9jq8mxb": "pg-gitas", // Kashyapa Gita
  "f7ljw2thi8plimhn11inh30l": "pg-gitas", // Nahusha gita
  "gv1vqise4wn0iokhrk4aids8": "pg-gitas", // Ribhu Gita
  "jquhd6qziqk79njtr5c7l5lg": "pg-gitas", // Saraswati gita
  "kspfti5ahbm02vcftz53m4gs": "pg-gitas", // Shaunaka Gita
  "shccsvqrst6gj11vzopz5wta": "pg-gitas", // Shiva gita
  "ftkzrc58da17wvl1vt0bwca9": "pg-gitas", // Shri Rama Gita
  "egvyymauye1kzw33giuoit63": "pg-gitas", // Uddhava Gita
  "ztdpmgeqj7eunhgjbs0lcdol": "pg-gitas", // Yama gita
  "ca2ywh8yt3gnjk4wortvagmd": "pg-gitas", // Yudhishtira gita
  // Shankara Granthas
  "ntfozq69v2ag9ecxcz0om3nt": "pg-shankara", // Advaita Pañcaratnam
  "u8sn5eg9p5cov8u3aqjvqh93": "pg-shankara", // Advaita Shatakam
  "kdvwdk9vjqbtp44gzqyp9aa3": "pg-shankara", // Advaitanubhuti
  "ooe2fu9ttgufw1svuzdmyhtw": "pg-shankara", // Anatma Shri Vigarhanam
  "hx1wfwu0adz57cl5990hzagm": "pg-shankara", // Anātmaśrīvigarhaṇam
  "qr2h305q8nf1ralaa5o5ytk9": "pg-shankara", // Aparokshanubhuthi
  "mazzyims1l3upqnqruez5q1n": "pg-shankara", // Atma Bodha आत्मबोध
  "smvpprx6no4rwq4u0qa3wvmv": "pg-shankara", // Atmastavah
  "mk3wobg3chnw9qfoolyp53ws": "pg-shankara", // Atmavabodhanastotram
  "d2651vpnwhfqj1y79amk7r1f": "pg-shankara", // Brahma gnanavali mala
  "hoixp2sa6u5tzlnjep0ptyv8": "pg-shankara", // Brahmanuchintanam
  "rqcwd3090z9be0wy6g5r8smu": "pg-shankara", // Daśaśloki
  "f7xhgtldqvv33ckh16eqsb9w": "pg-shankara", // Dhanyashtakam
  "xi8rwr7d2yi3xg6f00hnei8m": "pg-shankara", // Dhanyāṣṭakam
  "s0x5fae5by5vbq8w9d118p4d": "pg-shankara", // Ekasloki
  "kim8e5wt7bfm3exl02icfn2g": "pg-shankara", // Jeevan Mukthanandhalahari
  "jw5znc1nbhc0z679j0ffxrgf": "pg-shankara", // Laghu Vākya Vṛtti
  "np3szcvoc6tev0zceniocunv": "pg-shankara", // Mahavakya Vivaranam
  "vgezpf3zd2v5y76twvb7dnxl": "pg-shankara", // Manīṣā Pañcakam
  "dtyd0kmpb62pti7sknj3j0k0": "pg-shankara", // Maya Panchakam
  "ibp5kvppm7xi8oo5zu6bm0m0": "pg-shankara", // Nirvanamanjari
  "c1ofpv7hfk6ravmy8uxnecsh": "pg-shankara", // Pancheekaranam
  "jhp7ei2vp1nfry48u6dgua8c": "pg-shankara", // Para Puja
  "ptx6mswn2jfw95v58jz1bjpe": "pg-shankara", // Prabodha Sudhakara प्रबोधसुधाकरः
  "fk86ceft5j7me59u5vnjjdua": "pg-shankara", // Prapancha Sara Tantra
  "nblge3v83tey3lqai1q9wy9q": "pg-shankara", // Prashnottara Ratnamalika
  "s72wt9frqytzgg3sfw8wlb48": "pg-shankara", // Praudhanubhuti
  "y81afxfwpl095ewsqnu40hkq": "pg-shankara", // Sadhana Panchakam
  "djtmv8722asy32nr86fmtmgy": "pg-shankara", // Sarva Vedanta Siddhantasaar Sangraha - वेदान्तशास्त्रसिद्धान्तसारसङ्ग्रह
  "wcr0dyow3o7yswpcgkl9v3t9": "pg-shankara", // Svarupanusandhanashtakam
  "vbfkcj9v60xb6l01mikngby0": "pg-shankara", // Svatmanirupanam
  "a3dr7clcalyvhtevtgu97ozo": "pg-shankara", // Svatmaprakashika
  "vghftx4e5apyoo9xpe0jpkdl": "pg-shankara", // Tattva Bodah
  "ayq6h5oknfbc1g18v1teo7f4": "pg-shankara", // Tattvopadeshah
  "xwxgji7cdd77s4iytjy3xlqp": "pg-shankara", // Upadesha Sahasri
  "bnw8w7kqkhax4liss1uf2pnj": "pg-shankara", // Upadeśa‑Pañcakam
  "ofx4h0x4wyd3z4a3jew7lnj1": "pg-shankara", // Vakya Vriththi
  "a5dv2fo6q5a087r9h4wtt9mw": "pg-shankara", // Vivekachudamani
  "wqmbas9uazatsu7u9iqhggc3": "pg-shankara", // Vākyavṛttiḥ
  "hke5q44z9of46pdq8h5m65q0": "pg-shankara", // Yati Pañcakam
  "fln7ocwhlvgv2m7ixrrknti8": "pg-shankara", // शतश्लोकी - Śataślokī
  // Siddhi Granthas
  "y9fma1uvlxu65mvyz1emwdht": "pg-siddhi", // Advaita Chandrika
  "ixm9971ao50392d0x9csot0d": "pg-siddhi", // Advaitasiddhānta Vaijayantī
  "m84drug3g0roshr153nnsylp": "pg-siddhi", // Naishkarmyasidhi
  "pu61ea93a3pkeby7vzh6vf7v": "pg-siddhi", // Sidhdhantha Bindu
  // Mimamsa Granthas
  "domymsar9l5cjdju0urhb30m": "pg-mimamsa", // Bhashyartha Ratnamala
  "aiqpdcrqjfp056t5mo972lgy": "pg-mimamsa", // BhashyarthaRathnamala
  "v31mzhq4925agnsj8ufyf9vl": "pg-mimamsa", // Pancheekaranam Vaarthikam
  "dgu9lhmez5a2h2tze54tgmfu": "pg-mimamsa", // Purusha Suktham Bhashyam
  "mxkh9r0ozvmwdizhtbitd5b2": "pg-mimamsa", // Vedanta Sutra Muktavali
  "ovyiv9n603z73ivco5eh824k": "pg-mimamsa", // Yathi Dharma Sangraha
  // Other Granthas
  "euckqbo4nkv3cda7ay230t30": "pg-other", // Advaita Makaranda अद्वैतमकरन्दः
  "oeippidsqnx90u4dbw315ma0": "pg-other", // Advaita Rasa Manjari
  "j9jd467nxlk8oyw8x1i50rhb": "pg-other", // advaitaM dattAtreyavarmastotraM
  "q8flr84vwn6c8kgkguqgo4vg": "pg-other", // Anubhuthi Prakasha
  "c5iyap8ax1qj31b3euk1chov": "pg-other", // Atma Samadhi
  "lkiq4ww8t6vzt04wr5094ky3": "pg-other", // Atmopadesha
  "mjcae9rz0rlhgn6cp6v64j2q": "pg-other", // Brihadaranyaka Mitakshara
  "z0506x3yfwzk36pdiy86om8a": "pg-other", // Drig Drishya-Vivek  दृग्दृश्य-विवेक
  "zdta4l3fjm6gmnz61sz6qbii": "pg-other", // Drig-Drishya-Viveka
  "xbjfcz3djuxb0sxvbemrn4dq": "pg-other", // Hastamalakiyam
  "no7qgr1toaxka3ocf94mhm5e": "pg-other", // Jeevanmuktiviveka
  "mashzlfck26iqvuzsybyb1fo": "pg-other", // Jivayatra
  "zlqeja6vkegjl0q4q5zrpeq2": "pg-other", // Manasollasa Stutih by Appayya Dheekshitha
  "fbvmoskwpufe9kdd1fk98v83": "pg-other", // Panchadasi
  "riia0z069yeg9kd2bbsoiujm": "pg-other", // Panchadasi Patabedha
  "uegz2wjbcp598z8sys64p1o5": "pg-other", // Paramartha Sara
  "aesp6d5ht57jv6xkhut0x3yd": "pg-other", // Saddarshanam
  "g7aiq9ec0hx32wf26bbsaj4z": "pg-other", // Shrutisarasamuddharanam
  "x6fgqhcg79mok2vxeioy6gjg": "pg-other", // Suta Samhita
  "mevrz7agxohjd2si13g7uirk": "pg-other", // Upadeshachaturvimshatih
  "eokhdfpdyqznwn5ewknj080j": "pg-other", // Upadeshasaram
  "spscf0vrbkg6tulf50j0rha8": "pg-other", // Vedanta Dindima
  "ft7rrrgbwuvjz20f17us8rii": "pg-other", // Vedanta Panchadasi
  "kbalo3b7oaul4dkghcwkrfgb": "pg-other", // Vedanta Paribhasha
  "goqg3t303ukuhe6n71un2avn": "pg-other", // Vedanta Sara
  "tn4g8eh79e6kyb1d3l2mlrck": "pg-other", // vedAntapara bhAgavataM
  "n316ckeucvq1jfd6njfhg3t6": "pg-other", // vedAntaparatriveNI
  "uit9l4sz26ety01ur8xxfr1v": "pg-other", // जगत् जीवः परमात्मा विचाराः
};
