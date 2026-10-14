async function testHilalIttihad() {
  const q = `
    SELECT DISTINCT ?player ?nameAr ?nameEn ?image WHERE {
      VALUES ?teamA { wd:Q73965 wd:Q311141 }
      VALUES ?teamB { wd:Q309480 wd:Q723793 }
      ?player wdt:P106 wd:Q937857;
              wdt:P54 ?teamA;
              wdt:P54 ?teamB.
      OPTIONAL {
        ?player rdfs:label ?nameAr.
        FILTER(LANG(?nameAr) = "ar")
      }
      OPTIONAL {
        ?player rdfs:label ?nameEn.
        FILTER(LANG(?nameEn) = "en")
      }
      OPTIONAL { ?player wdt:P18 ?image. }
    } LIMIT 20
  `;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(q)}&format=json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'MayyazGame/1.0' },
  });
  const json = await res.json();
  console.log('Mutual players between Al-Hilal and Al-Ittihad: count =', json.results.bindings.length);
  json.results.bindings.forEach(b => {
    console.log('-', b.nameAr?.value || b.nameEn?.value, `(${b.nameEn?.value})`);
  });
}
testHilalIttihad();
