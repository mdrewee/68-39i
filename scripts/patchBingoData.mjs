import fs from 'fs';
import path from 'path';

const filePath = path.resolve('src/data/footballBingoData.ts');
let content = fs.readFileSync(filePath, 'utf8');

const TILE_MAP = {
  'club_real_madrid': '/assets/football/clubs/real_madrid.png',
  'club_barcelona': '/assets/football/clubs/barcelona.png',
  'club_al_hilal': '/assets/football/clubs/al_hilal.png',
  'club_al_nassr': '/assets/football/clubs/al_nassr.png',
  'club_al_ittihad': '/assets/football/clubs/al_ittihad.png',
  'club_al_ahli': '/assets/football/clubs/al_ahli.png',
  'club_man_city': '/assets/football/clubs/man_city.png',
  'club_man_united': '/assets/football/clubs/man_united.png',
  'club_bayern': '/assets/football/clubs/bayern.png',
  'club_psg': '/assets/football/clubs/psg.png',
  'club_liverpool': '/assets/football/clubs/liverpool.png',
  'club_arsenal': '/assets/football/clubs/arsenal.png',
  'club_chelsea': '/assets/football/clubs/chelsea.png',
  'club_juventus': '/assets/football/clubs/juventus.png',
  'club_milan': '/assets/football/clubs/ac_milan.png',
  'club_inter': '/assets/football/clubs/inter.png',

  'flag_sa': '/assets/football/flags/sa.png',
  'flag_br': '/assets/football/flags/br.png',
  'flag_ar': '/assets/football/flags/ar.png',
  'flag_fr': '/assets/football/flags/fr.png',
  'flag_pt': '/assets/football/flags/pt.png',
  'flag_es': '/assets/football/flags/es.png',
  'flag_de': '/assets/football/flags/de.png',
  'flag_eg': '/assets/football/flags/eg.png',
  'flag_ma': '/assets/football/flags/ma.png',
  'flag_hr': '/assets/football/flags/hr.png',

  'trophy_world_cup': '/assets/football/trophies/world_cup.png',
  'trophy_ucl': '/assets/football/trophies/ucl.png',
  'trophy_ballon_dor': '/assets/football/trophies/ballon_dor.png',
  'trophy_copa_america': '/assets/football/trophies/copa_america.png',

  'mgr_guardiola': '/assets/football/managers/guardiola.jpg',
  'mgr_ancelotti': '/assets/football/managers/ancelotti.jpg',
  'mgr_mourinho': '/assets/football/managers/mourinho.jpg',
  'mgr_jesus': '/assets/football/managers/jesus.jpg',
  'mgr_zidane': '/assets/football/managers/zidane.jpg',

  'trait_dark': '/assets/football/traits/dark_skin.jpg',
};

const PLAYER_MAP = {
  'ronaldo': '/assets/football/players/ronaldo.jpg',
  'messi': '/assets/football/players/messi.jpg',
  'salem_aldawsari': '/assets/football/players/salem_aldawsari.jpg',
  'benzema': '/assets/football/players/benzema.jpg',
  'kante': '/assets/football/players/kante.jpg',
  'neymar': '/assets/football/players/neymar.jpg',
  'mahrez': '/assets/football/players/mahrez.jpg',
  'modric': '/assets/football/players/modric.jpg',
  'vinicius': '/assets/football/players/vinicius.jpg',
  'haaland': '/assets/football/players/haaland.jpg',
  'albulayhi': '/assets/football/players/albulayhi.jpg',
  'alharbi_firas': '/assets/football/players/alburaikan.jpg',
  'muller': '/assets/football/players/muller.jpg',
  'kroos': '/assets/football/players/kroos.jpg',
  'mbappe': '/assets/football/players/mbappe.jpg',
  'salah': '/assets/football/players/salah.jpg',
  'courtois': '/assets/football/players/courtois.jpg',
  'bounou': '/assets/football/players/bono.jpg',
  'debruyne': '/assets/football/players/debruyne.jpg',
  'sadio_mane': '/assets/football/players/mane.jpg',
  'firmino': '/assets/football/players/firmino.jpg',
  'kessie': '/assets/football/players/kessie.jpg',
  'edouard_mendy': '/assets/football/players/mendy.jpg',
  'ruben_neves': '/assets/football/players/neves.jpg',
  'mitrovic': '/assets/football/players/mitrovic.jpg',
  'koulibaly': '/assets/football/players/koulibaly.jpg',
  'cancelo': '/assets/football/players/cancelo.jpg',
  'saud_abdulhamid': '/assets/football/players/saud_abdulhamid.jpg',
  'bellingham': '/assets/football/players/bellingham.jpg',
  'lewandowski': '/assets/football/players/lewandowski.jpg',
  'palmer': '/assets/football/players/palmer.jpg',
  'saka': '/assets/football/players/saka.jpg',
  'neuer': '/assets/football/players/neuer.jpg',
  'hakimi': '/assets/football/players/hakimi.jpg',
  'zidane_player': '/assets/football/players/zidane_player.jpg',
  'ronaldinho': '/assets/football/players/ronaldinho.jpg',
  'ramos': '/assets/football/players/ramos.jpg',
  'alisson': '/assets/football/players/alisson.jpg',
};

// Replace tile iconUrls
for (const [id, localUrl] of Object.entries(TILE_MAP)) {
  const regex = new RegExp(`(id:\\s*['"]${id}['"][\\s\\S]*?iconUrl:\\s*)['"][^'"]+['"]`, 'g');
  content = content.replace(regex, `$1'${localUrl}'`);
}

// Replace player photos
for (const [id, localUrl] of Object.entries(PLAYER_MAP)) {
  const regex = new RegExp(`(id:\\s*['"]${id}['"][\\s\\S]*?photo:\\s*)['"][^'"]+['"]`, 'g');
  content = content.replace(regex, `$1'${localUrl}'`);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched footballBingoData.ts with local assets!');
