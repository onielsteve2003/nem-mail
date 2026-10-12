/** Common English words that carry little meaning on their own; ignored by most models. */
export const STOPWORDS: ReadonlySet<string> = new Set(
	(
		'a about above after again against all am an and any are as at be because been before ' +
		'being below between both but by can could did do does doing down during each few for ' +
		'from further had has have having he her here hers herself him himself his how i if in ' +
		'into is it its itself just me more most my myself no nor not now of off on once only or ' +
		'other our ours ourselves out over own same she should so some such than that the their ' +
		'theirs them themselves then there these they this those through to too under until up ' +
		'very was we were what when where which while who whom why will with would you your yours ' +
		"yourself yourselves i'm you're it's don't can't won't isn't i'll i've we're let's"
	).split(' ')
);

/** Drops stopwords from a token list. */
export function removeStopwords(tokens: readonly string[]): string[] {
	return tokens.filter((token) => !STOPWORDS.has(token));
}
