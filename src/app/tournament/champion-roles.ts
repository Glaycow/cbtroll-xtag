import { Role } from './tournament.models';

/** Campeões por rota (ids do Data Dragon). Um campeão pode aparecer em mais de uma rota. */
const BY_ROLE: Record<Role, string[]> = {
  Topo: [
    'Aatrox', 'Ambessa', 'Aurora', 'Briar', 'Camille', 'Chogath', 'Darius', 'DrMundo', 'Fiora', 'Gangplank',
    'Garen', 'Gnar', 'Gwen', 'Heimerdinger', 'Illaoi', 'Irelia', 'Jax', 'Jayce', 'Kayle', 'Kennen', 'KSante',
    'Kled', 'Malphite', 'Mel', 'Mordekaiser', 'Nasus', 'Olaf', 'Ornn', 'Pantheon', 'Poppy', 'Quinn', 'Renekton',
    'Rumble', 'Sett', 'Shen', 'Singed', 'Sion', 'Teemo', 'Tryndamere', 'Urgot', 'Vladimir', 'Volibear', 'Wukong',
    'Yorick', 'Zaahen',
  ],
  Selva: [
    'Amumu', 'Belveth', 'Briar', 'Diana', 'Ekko', 'Elise', 'Evelynn', 'Fiddlesticks', 'Gragas', 'Graves',
    'Hecarim', 'Ivern', 'JarvanIV', 'Karthus', 'Kayn', 'Khazix', 'Kindred', 'LeeSin', 'Lillia', 'Maokai',
    'MasterYi', 'Naafiri', 'Nidalee', 'Nocturne', 'Nunu', 'Olaf', 'Poppy', 'Qiyana', 'Rammus', 'RekSai',
    'Rengar', 'Sejuani', 'Shaco', 'Skarner', 'Taliyah', 'Trundle', 'Udyr', 'Vi', 'Viego', 'Warwick',
    'Wukong', 'XinZhao', 'Zac',
  ],
  Meio: [
    'Ahri', 'Akali', 'Akshan', 'Anivia', 'Annie', 'AurelionSol', 'Aurora', 'Azir', 'Brand', 'Cassiopeia',
    'Corki', 'Diana', 'Ekko', 'Fizz', 'Galio', 'Heimerdinger', 'Hwei', 'Irelia', 'Kassadin', 'Katarina',
    'Leblanc', 'Lissandra', 'Lux', 'Malzahar', 'Mel', 'Naafiri', 'Neeko', 'Orianna', 'Qiyana', 'Ryze', 'Swain',
    'Syndra', 'Sylas', 'Taliyah', 'Talon', 'TwistedFate', 'Vex', 'Veigar', 'Velkoz', 'Viktor', 'Vladimir',
    'Xerath', 'Yasuo', 'Yone', 'Zed', 'Ziggs', 'Zoe',
  ],
  Atirador: [
    'Aphelios', 'Ashe', 'Caitlyn', 'Corki', 'Draven', 'Ezreal', 'Jhin', 'Jinx', 'Kaisa', 'Kalista', 'KogMaw',
    'Lucian', 'MissFortune', 'Nilah', 'Samira', 'Sivir', 'Smolder', 'Tristana', 'Twitch', 'Varus', 'Vayne',
    'Xayah', 'Yunara', 'Zeri', 'Ziggs',
  ],
  Suporte: [
    'Alistar', 'Ashe', 'Bard', 'Blitzcrank', 'Brand', 'Heimerdinger', 'Galio', 'Ivern', 'Janna', 'Karma',
    'Leona', 'Lulu', 'Lux', 'Maokai', 'Milio', 'Morgana', 'Nami', 'Nautilus', 'Neeko', 'Poppy', 'Pyke',
    'Rakan', 'Rell', 'Renata', 'Senna', 'Seraphine', 'Shen', 'Skarner', 'Sion', 'Sona', 'Soraka', 'Swain',
    'Taric', 'Thresh', 'Velkoz', 'Xerath', 'Yuumi', 'Zilean', 'Zyra',
  ],
};

/** Mapa campeão → rotas, derivado de BY_ROLE. */
export const CHAMP_ROLES: Record<string, Role[]> = {};
for (const [role, ids] of Object.entries(BY_ROLE) as [Role, string[]][]) {
  for (const id of ids) (CHAMP_ROLES[id] ??= []).push(role);
}
