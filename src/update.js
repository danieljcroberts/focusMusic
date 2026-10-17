// Pure, for tests: should the Android app offer the published version? Only a newer one, and not one you put off.
export const shouldOffer = (published, mine, skipped) => !!published && Number(published.code) > Number(mine) && Number(published.code) !== Number(skipped);
