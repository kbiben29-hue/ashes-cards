# Ashes cards

Every card for **Ashes Reborn** and **Ashes Ascendancy**, downloaded from the
[ashes.live](https://ashes.live) public API.

## What's here

| Path | Contents |
|---|---|
| `data/cards.json` | All cards in one file |
| `data/by-release/<release>.json` | Cards split by box / expansion |
| `data/releases.json` | List of every release |
| `data/meta.json` | When the data was last downloaded and how many cards |
| `images/<card-stub>.jpg` | Card images |

Each card has fields like `name`, `stub`, `type`, `release`, `placement`,
`cost`, `dice`, `magicCost`, `text`, and (where they apply) `attack`, `life`,
`recover`, `copies` and `conjurations`.

## Updating

The **Update Ashes cards** GitHub Action runs every Monday and whenever the
script changes. To run it now: **Actions → Update Ashes cards → Run workflow**.

To run it on your Mac instead (needs Node 18+):

```sh
node scripts/fetch-cards.mjs --images
```

## Credits

Card data and images come from ashes.live, a fan-made site. Ashes is a game by
Plaid Hat Games. This repo is for personal use and isn't affiliated with either.
