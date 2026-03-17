import PTT from './parse-torrent-title.js';

function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleMatches(objTitle, metaName) {
  if (!objTitle || !metaName) return true;
  return normalizeTitle(objTitle) === normalizeTitle(metaName);
}

const KNOWN_SERIES_ALIASES = {
    'star trek': [
        'star trek discovery',
        'star trek picard',
        'star trek lower decks',
        'star trek prodigy',
        'star trek the next generation',
        'star trek voyager',
        'star trek enterprise',
        'star trek the original series',
        'star trek strange new worlds',
    ]
};

function isDifferentSeries(torrentTitle, seriesTitle) {
    const normalizedTorrentTitle = normalizeTitle(torrentTitle);
    const normalizedSeriesTitle = normalizeTitle(seriesTitle);

    for (const key in KNOWN_SERIES_ALIASES) {
        if (normalizedSeriesTitle.includes(key)) {
            const otherSeries = KNOWN_SERIES_ALIASES[key].filter(series => series !== normalizedSeriesTitle);
            if (otherSeries.some(series => normalizedTorrentTitle.includes(series))) {
                return true;
            }
        }
    }

    return false;
}

function matchesSeriesTitle(torrent, seriesTitle) {
    const torrentTitle = torrent.Title || torrent.name || '';
    const pttInfo = PTT.parse(torrentTitle);
    const pttTitle = pttInfo.title || '';

    const normalizedTorrentTitle = normalizeTitle(torrentTitle);
    const normalizedPttTitle = normalizeTitle(pttTitle);
    const normalizedSeriesTitle = normalizeTitle(seriesTitle);

    if (normalizedPttTitle === normalizedSeriesTitle) {
        return true;
    }

    if (isDifferentSeries(torrentTitle, seriesTitle)) {
        return false;
    }

    const seriesTitleWords = normalizedSeriesTitle.split(' ').filter(w => w.length > 0);
    const significantWords = seriesTitleWords.filter(w => w.length > 2);

    // If all words present, match
    if (seriesTitleWords.every(word => normalizedTorrentTitle.includes(word))) {
        return true;
    }

    // For titles with >2 significant words, require at least 70% of significant words
    if (significantWords.length > 2) {
        const matchCount = significantWords.filter(word => normalizedTorrentTitle.includes(word)).length;
        if (matchCount / significantWords.length >= 0.7) return true;
    }

    // Also check against PTT-extracted title
    if (significantWords.length > 0 && normalizedPttTitle) {
        if (significantWords.every(word => normalizedPttTitle.includes(word))) return true;
    }

    return false;
}

function hasEpisodeMarker(torrentName, season, episode) {
    if (!torrentName) return false;

    const s = String(season).padStart(2, '0');
    const e = String(episode).padStart(2, '0');
    const sRaw = String(Number(season));
    const eRaw = String(Number(episode));

    const patterns = [
        new RegExp(`[sS]0*${sRaw}[\\W_]*[eE]0*${eRaw}(?!\\d)`, 'i'),
        new RegExp(`season\\s*${sRaw}\\s*episode\\s*${eRaw}(?!\\d)`, 'i'),
        new RegExp(`\\b0*${sRaw}x0*${eRaw}(?!\\d)\\b`, 'i'),
    ];

    return patterns.some(p => p.test(torrentName));
}

function filterSeason(torrent, season, cinemetaDetails) {
  const s = Number(season);
  if (torrent?.info?.season != null && Number(torrent.info.season) === s) return true;
  if (Array.isArray(torrent?.info?.seasons) && torrent.info.seasons.map(Number).includes(s)) return true;
  if (cinemetaDetails?.name) {
    const candidate = torrent?.info?.title || torrent?.title || torrent?.name || torrent?.searchableName || torrent?.path;
    if (!titleMatches(candidate, cinemetaDetails.name)) return false;
  }
  return true;
}

function isSeasonPack(torrentName, season) {
    if (!torrentName) return false;

    const normalizedTorrentName = normalizeTitle(torrentName);
    const seasonPattern = new RegExp(`season ${season}\\b`, 'i');
    const sPattern = new RegExp(`s${String(season).padStart(2, '0')}\\b`, 'i');

    return (seasonPattern.test(normalizedTorrentName) || sPattern.test(normalizedTorrentName)) && !/[eE]\d{2}/.test(normalizedTorrentName);
}

function filterEpisode(torrentDetails, season, episode, cinemetaDetails) {
    const torrentTitle = torrentDetails.Title || torrentDetails.name || '';

    // Check for exact episode marker in any candidate field
    const candidates = [torrentTitle];
    ['name', 'title', 'searchableName', 'path'].forEach(f => {
        if (torrentDetails[f] && !candidates.includes(torrentDetails[f])) candidates.push(torrentDetails[f]);
    });
    if (torrentDetails.files && Array.isArray(torrentDetails.files)) {
        for (const f of torrentDetails.files) {
            if (f.path) candidates.push(f.path);
            if (f.name) candidates.push(f.name);
        }
    }

    const hasExactEpisode = candidates.some(c => c && hasEpisodeMarker(c, season, episode));

    // If exact episode marker found, only need loose title match (any significant word)
    if (hasExactEpisode) {
        if (!cinemetaDetails || !cinemetaDetails.name) return true; // No metadata to validate against, keep it
        const normalizedSeriesTitle = normalizeTitle(cinemetaDetails.name);
        const seriesWords = normalizedSeriesTitle.split(' ').filter(w => w.length > 2);
        if (seriesWords.length > 0) {
            const normalizedTorrent = normalizeTitle(torrentTitle);
            const hasAnyWord = seriesWords.some(word => normalizedTorrent.includes(word));
            if (!hasAnyWord) {
                // Also check alternative titles if available
                if (cinemetaDetails.alternativeTitles && Array.isArray(cinemetaDetails.alternativeTitles)) {
                    const altMatch = cinemetaDetails.alternativeTitles.some(altTitle => {
                        const normalizedAlt = normalizeTitle(altTitle);
                        const altWords = normalizedAlt.split(' ').filter(w => w.length > 2);
                        return altWords.length > 0 && altWords.some(word => normalizedTorrent.includes(word));
                    });
                    if (!altMatch) return false;
                } else {
                    return false;
                }
            }
        }
        // Check it's not a different series in the same franchise
        if (isDifferentSeries(torrentTitle, cinemetaDetails.name)) return false;
        return true;
    }

    // No exact episode marker - apply stricter matching
    if (!cinemetaDetails || !cinemetaDetails.name) return true; // No metadata to validate against
    if (!matchesSeriesTitle(torrentDetails, cinemetaDetails.name)) {
        // Try alternative titles
        if (cinemetaDetails.alternativeTitles && Array.isArray(cinemetaDetails.alternativeTitles)) {
            const altMatch = cinemetaDetails.alternativeTitles.some(altTitle =>
                matchesSeriesTitle(torrentDetails, altTitle)
            );
            if (!altMatch) return false;
        } else {
            return false;
        }
    }

    // Season pack handling
    if (isSeasonPack(torrentTitle, season) && !torrentDetails.isFromPack) {
        return false;
    }

    const pttInfo = PTT.parse(torrentTitle);
    if (pttInfo.season === Number(season) && pttInfo.episode === Number(episode)) {
        if (cinemetaDetails.year && pttInfo.year && cinemetaDetails.year !== pttInfo.year) {
            return false;
        }
        return true;
    }

    if (torrentDetails.videos && Array.isArray(torrentDetails.videos)) {
        const matched = torrentDetails.videos
            .filter(v => String(season) == String(v.info.season) && String(episode) == String(v.info.episode));
        if (matched.length > 0) {
            return true;
        }
    }

    // Check all candidate fields for episode marker
    for (const c of candidates) {
        if (c && hasEpisodeMarker(c, season, episode)) return true;
    }

    return false;
}

function filterYear(torrent, cinemetaDetails) {
  if (torrent?.info?.year && cinemetaDetails?.year) return torrent.info.year == cinemetaDetails.year;
  return true;
}

export {
    normalizeTitle,
    titleMatches,
    matchesSeriesTitle,
    hasEpisodeMarker,
    filterSeason,
    filterEpisode,
    filterYear
};
