import fs from 'fs';
import path from 'path';

const TARGET_DIR = path.resolve('public/assets/football');
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

const USER_AGENT = 'PartyGameBot/1.0 (contact@partygame.com) Node/24';

// Download helper with custom User-Agent and fallback proxy to bypass 403 restrictions
export const downloadFile = async (url, relativeFilename) => {
  const dest = path.join(TARGET_DIR, relativeFilename);
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Skip if already downloaded and valid
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    return `/assets/football/${relativeFilename.replace(/\\/g, '/')}`;
  }

  const urlsToTry = [url];
  // add wsrv.nl proxy as fallback
  urlsToTry.push(`https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400`);

  for (const fetchUrl of urlsToTry) {
    try {
      const res = await fetch(fetchUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 500) {
          fs.writeFileSync(dest, buffer);
          return `/assets/football/${relativeFilename.replace(/\\/g, '/')}`;
        }
      }
    } catch {}
  }

  throw new Error(`Failed to download ${relativeFilename} from ${url}`);
};

// All Football Assets Registry (Clubs, Flags, Trophies, Managers, Traits, Players)
export const ASSETS_TO_DOWNLOAD = [
  // --- الأندية ---
  { filename: 'clubs/al_hilal.png', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/fa/Al_Hilal_SFC_logo.svg/300px-Al_Hilal_SFC_logo.svg.png' },
  { filename: 'clubs/al_nassr.png', url: 'https://thumb.wikimedia.org/wikipedia/en/thumb/a/ac/Al_Nassr_FC_Logo.svg/500px-Al_Nassr_FC_Logo.svg.png' },
  { filename: 'clubs/al_ittihad.png', url: 'https://thumb.wikimedia.org/wikipedia/en/thumb/8/87/Al-Ittihad_Club_%28Jeddah%29_logo.svg/500px-Al-Ittihad_Club_%28Jeddah%29_logo.svg.png' },
  { filename: 'clubs/al_ahli.png', url: 'https://thumb.wikimedia.org/wikipedia/en/thumb/4/45/Al_Ahli_Saudi_FC_logo.svg/500px-Al_Ahli_Saudi_FC_logo.svg.png' },
  { filename: 'clubs/real_madrid.png', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/300px-Real_Madrid_CF.svg.png' },
  { filename: 'clubs/barcelona.png', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/300px-FC_Barcelona_%28crest%29.svg.png' },
  { filename: 'clubs/man_city.png', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/300px-Manchester_City_FC_badge.svg.png' },
  { filename: 'clubs/bayern.png', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/300px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png' },
  { filename: 'clubs/liverpool.png', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/300px-Liverpool_FC.svg.png' },
  { filename: 'clubs/psg.png', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/300px-Paris_Saint-Germain_F.C..svg.png' },
  { filename: 'clubs/arsenal.png', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/300px-Arsenal_FC.svg.png' },
  { filename: 'clubs/ac_milan.png', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/300px-Logo_of_AC_Milan.svg.png' },
  { filename: 'clubs/inter.png', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/FC_Internazionale_Milano_2021.svg/300px-FC_Internazionale_Milano_2021.svg.png' },
  { filename: 'clubs/juventus.png', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Juventus_FC_2017_icon_%28black%29.svg/300px-Juventus_FC_2017_icon_%28black%29.svg.png' },
  { filename: 'clubs/man_united.png', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/300px-Manchester_United_FC_crest.svg.png' },
  { filename: 'clubs/chelsea.png', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/300px-Chelsea_FC.svg.png' },

  // --- الأعلام ---
  { filename: 'flags/sa.png', url: 'https://flagcdn.com/w160/sa.png' },
  { filename: 'flags/br.png', url: 'https://flagcdn.com/w160/br.png' },
  { filename: 'flags/ar.png', url: 'https://flagcdn.com/w160/ar.png' },
  { filename: 'flags/fr.png', url: 'https://flagcdn.com/w160/fr.png' },
  { filename: 'flags/pt.png', url: 'https://flagcdn.com/w160/pt.png' },
  { filename: 'flags/es.png', url: 'https://flagcdn.com/w160/es.png' },
  { filename: 'flags/de.png', url: 'https://flagcdn.com/w160/de.png' },
  { filename: 'flags/eg.png', url: 'https://flagcdn.com/w160/eg.png' },
  { filename: 'flags/ma.png', url: 'https://flagcdn.com/w160/ma.png' },
  { filename: 'flags/hr.png', url: 'https://flagcdn.com/w160/hr.png' },

  // --- البطولات ---
  { filename: 'trophies/ucl.png', url: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/UEFA_Champions_League_logo_2.svg/300px-UEFA_Champions_League_logo_2.svg.png' },
  { filename: 'trophies/world_cup.png', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/FIFA_World_Cup_Trophy.svg/300px-FIFA_World_Cup_Trophy.svg.png' },
  { filename: 'trophies/rpl.png', url: 'https://thumb.wikimedia.org/wikipedia/en/thumb/7/75/Roshn_Saudi_League_Logo.svg/500px-Roshn_Saudi_League_Logo.svg.png' },
  { filename: 'trophies/afc.png', url: 'https://thumb.wikimedia.org/wikipedia/en/thumb/d/d7/AFC_Champions_League_Elite_logo.svg/500px-AFC_Champions_League_Elite_logo.svg.png' },
  { filename: 'trophies/ballon_dor.png', url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/2016_Ballon_dOr_CR7Museum.jpg/500px-2016_Ballon_dOr_CR7Museum.jpg' },

  // --- المدربون ---
  { filename: 'managers/guardiola.jpg', url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Josep_Guardiola_2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2797_%28cropped%29.jpg/500px-Josep_Guardiola_2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2797_%28cropped%29.jpg' },
  { filename: 'managers/ancelotti.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Carlo_Ancelotti_2016.jpg/360px-Carlo_Ancelotti_2016.jpg' },
  { filename: 'managers/jesus.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Jorge_Jesus_2019.jpg/360px-Jorge_Jesus_2019.jpg' },
  { filename: 'managers/zidane.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Zinedine_Zidane_by_Tasnim_03.jpg/360px-Zinedine_Zidane_by_Tasnim_03.jpg' },

  // --- صفات ---
  { filename: 'traits/dark_skin.jpg', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },

  // --- اللاعبون ---
  { filename: 'players/ronaldo.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Cristiano_Ronaldo_playing_for_Al_Nassr_FC_against_Persepolis%2C_September_2023_%28cropped%29.jpg/440px-Cristiano_Ronaldo_playing_for_Al_Nassr_FC_against_Persepolis%2C_September_2023_%28cropped%29.jpg' },
  { filename: 'players/messi.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg/440px-Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg' },
  { filename: 'players/salem_aldawsari.jpg', url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fd/Salem_Al-Dawsari_%28Saudi_Arabia_v_Uruguay%2C_June_2026%29_%28cropped%29.jpg/500px-Salem_Al-Dawsari_%28Saudi_Arabia_v_Uruguay%2C_June_2026%29_%28cropped%29.jpg' },
  { filename: 'players/benzema.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Karim_Benzema_wearing_Real_Madrid_home_kit_2021-2022.jpg/440px-Karim_Benzema_wearing_Real_Madrid_home_kit_2021-2022.jpg' },
  { filename: 'players/kante.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/N%27Golo_Kant%C3%A9_2018.jpg/440px-N%27Golo_Kant%C3%A9_2018.jpg' },
  { filename: 'players/neymar.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Bra-Cos_%281%29_%28cropped%29.jpg/440px-Bra-Cos_%281%29_%28cropped%29.jpg' },
  { filename: 'players/mahrez.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Riyad_Mahrez_2018.jpg/440px-Riyad_Mahrez_2018.jpg' },
  { filename: 'players/modric.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Luka_Modri%C4%87_2022.jpg/440px-Luka_Modri%C4%87_2022.jpg' },
  { filename: 'players/vinicius.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Vinicius_Junior_2021.jpg/440px-Vinicius_Junior_2021.jpg' },
  { filename: 'players/haaland.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Erling_Haaland_2023_%28cropped%29.jpg/440px-Erling_Haaland_2023_%28cropped%29.jpg' },
  { filename: 'players/albulayhi.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Ali_Al-Bulaihi_2018.jpg/440px-Ali_Al-Bulaihi_2018.jpg' },
  { filename: 'players/alburaikan.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Firas_Al-Buraikan_2022.jpg/440px-Firas_Al-Buraikan_2022.jpg' },
  { filename: 'players/muller.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Thomas_M%C3%BCller_2022.jpg/440px-Thomas_M%C3%BCller_2022.jpg' },
  { filename: 'players/kroos.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Toni_Kroos_2022.jpg/440px-Toni_Kroos_2022.jpg' },
  { filename: 'players/mbappe.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Kylian_Mbapp%C3%A9_2018.jpg/440px-Kylian_Mbapp%C3%A9_2018.jpg' },
  { filename: 'players/salah.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Mohamed_Salah_2018.jpg/440px-Mohamed_Salah_2018.jpg' },
  { filename: 'players/courtois.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Thibaut_Courtois_2018.jpg/440px-Thibaut_Courtois_2018.jpg' },
  { filename: 'players/bono.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Yassine_Bounou_2022.jpg/440px-Yassine_Bounou_2022.jpg' },
  { filename: 'players/debruyne.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Kevin_De_Bruyne_201807091.jpg/440px-Kevin_De_Bruyne_201807091.jpg' },
  { filename: 'players/mane.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Sadio_Man%C3%A9_2018.jpg/440px-Sadio_Man%C3%A9_2018.jpg' },
  { filename: 'players/firmino.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Roberto_Firmino_2018.jpg/440px-Roberto_Firmino_2018.jpg' },
  { filename: 'players/kessie.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Franck_Kessi%C3%A9_2022.jpg/440px-Franck_Kessi%C3%A9_2022.jpg' },
  { filename: 'players/mendy.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/%C3%89douard_Mendy_2021.jpg/440px-%C3%89douard_Mendy_2021.jpg' },
  { filename: 'players/neves.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/R%C3%BAben_Neves_2018.jpg/440px-R%C3%BAben_Neves_2018.jpg' },
  { filename: 'players/mitrovic.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Aleksandar_Mitrovi%C4%87_2018.jpg/440px-Aleksandar_Mitrovi%C4%87_2018.jpg' },
  { filename: 'players/koulibaly.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Kalidou_Koulibaly_2018.jpg/440px-Kalidou_Koulibaly_2018.jpg' },
  { filename: 'players/cancelo.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Jo%C3%A3o_Cancelo_2018.jpg/440px-Jo%C3%A3o_Cancelo_2018.jpg' },
  { filename: 'players/saud_abdulhamid.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Saud_Abdulhamid_2022.jpg/440px-Saud_Abdulhamid_2022.jpg' },
  { filename: 'players/bellingham.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Jude_Bellingham_2022.jpg/440px-Jude_Bellingham_2022.jpg' },
  { filename: 'players/lewandowski.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Robert_Lewandowski_2022.jpg/440px-Robert_Lewandowski_2022.jpg' },
  { filename: 'players/palmer.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Cole_Palmer_2023.jpg/440px-Cole_Palmer_2023.jpg' },
  { filename: 'players/saka.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Bukayo_Saka_2022.jpg/440px-Bukayo_Saka_2022.jpg' },
  { filename: 'players/neuer.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Manuel_Neuer_2018.jpg/440px-Manuel_Neuer_2018.jpg' },
  { filename: 'players/hakimi.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Achraf_Hakimi_2022.jpg/440px-Achraf_Hakimi_2022.jpg' },
  { filename: 'players/zidane_player.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Zinedine_Zidane_by_Tasnim_03.jpg/360px-Zinedine_Zidane_by_Tasnim_03.jpg' },
  { filename: 'players/ronaldinho.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Ronaldinho_in_2019.jpg/440px-Ronaldinho_in_2019.jpg' },
  { filename: 'players/ramos.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Sergio_Ramos_2018.jpg/440px-Sergio_Ramos_2018.jpg' },
  { filename: 'players/alisson.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Alisson_Becker_2018.jpg/440px-Alisson_Becker_2018.jpg' },
];

async function run() {
  console.log(`Starting download of ${ASSETS_TO_DOWNLOAD.length} football assets into public/assets/football/...`);
  let successCount = 0;
  let failCount = 0;

  for (const item of ASSETS_TO_DOWNLOAD) {
    try {
      const localPath = await downloadFile(item.url, item.filename);
      console.log(`✓ [Saved] ${item.filename} -> ${localPath}`);
      successCount++;
    } catch (err) {
      console.error(`✗ [Failed] ${item.filename}:`, err.message);
      failCount++;
    }
  }

  console.log(`\nDownload completed: ${successCount} successful, ${failCount} failed.`);
}

run();
