const ROTA = { br1: 'americas', na1: 'americas', euw1: 'europe', eun1: 'europe', kr: 'asia', jp1: 'asia' };

module.exports = async (req, res) => {
  const key = process.env.RIOT_API_KEY;
  if (!key) return res.status(500).json({ error: 'RIOT_API_KEY ausente' });

  const { riotId = '', regiao = 'br1' } = req.query;
  const [nome, tag] = String(riotId).split('#');
  const rota = ROTA[regiao];
  if (!nome || !tag || !rota) return res.status(400).json({ error: 'parametros invalidos' });

  const headers = { 'X-Riot-Token': key };
  try {
    const conta = await fetch(
      `https://${rota}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(nome)}/${encodeURIComponent(tag)}`,
      { headers }
    );
    if (!conta.ok) return res.status(conta.status).json({ error: 'conta nao encontrada' });
    const { puuid, gameName, tagLine } = await conta.json();

    const liga = await fetch(`https://${regiao}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`, { headers });
    if (!liga.ok) return res.status(liga.status).json({ error: 'erro na league' });
    const entradas = await liga.json();
    const solo = entradas.find(e => e.queueType === 'RANKED_SOLO_5x5');

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    return res.status(200).json({
      gameName,
      tagLine,
      tier: solo?.tier ?? null,
      rank: solo?.rank ?? null,
      lp: solo?.leaguePoints ?? null,
      vitorias: solo?.wins ?? 0,
      derrotas: solo?.losses ?? 0,
    });
  } catch {
    return res.status(502).json({ error: 'falha ao consultar a Riot' });
  }
};
