# AI usage in Pokepelago

I use Anthropic's Claude through Claude Code while developing Pokepelago. It helps me write and review code, investigate bugs, and keep the web client and the apworld in step. I make the design decisions, choose what enters a release, and remain responsible for the result.

I have ADHD, and AI assistance helps me carry ideas through the long implementation and verification work needed to finish them. That is the practical reason I use it.

## Verification

AI-generated work is treated like any other untrusted contribution. Changes are checked against the game's rules and the project's own data rather than accepted because they compile or make a test pass. The client runs type checks, lint, unit tests and a dependency audit on every pull request. Apworld releases run through the Archipelago fuzz matrix on thousands of seeds and do not ship with a failing run, and the client has its own seed completability check. Releases are played in the browser against real seeds before they go live.

## Art, sound and existing work

The project does not use AI-generated art. Pokémon sprites come from PokéAPI, the Derpemon Community Project, and SpriteCollab's Mystery Dungeon sprites, or from files players import themselves. The notification sounds were contributed by AfiliaFrostfang. Pokepelago builds on the work of Archipelago contributors and the sprite communities above, and they are credited in the client's credits screen.

## Environmental footprint

AI systems use electricity and water, and the wider data-center buildout is a real concern. Published measurements do not support one universal per-request number because models, hardware, data centers, and prompts differ. I keep this project non-commercial and use AI because it makes sustained development possible for me, while recognizing that other people may weigh that tradeoff differently.
