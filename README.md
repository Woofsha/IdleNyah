# IdleNyah 🐾✨

> A cozy 2D pixel-art incremental estate management game powered by PixiJS v8, featuring **Nyah** (the bossy, tsundere catgirl head maid) and **Fifi** (the obedient, sweet doggirl groundskeeper maid).

🎮 **Play Live on GitHub Pages**: [https://woofsha.github.io/IdleNyah/](https://woofsha.github.io/IdleNyah/)

---

## Overview

In **IdleNyah**, Master inherits an overgrown starter cottage and a dusty front porch. Under Nyah's strict, condescending supervision and Fifi's tireless chore work, you expand both the mansion and its vast surrounding outdoor territory into a blooming aristocratic estate inhabited by original fantasy wildlife.

### Key Pillars
- **Decoupled Architecture**: 100% pure TypeScript headless simulation engine (`src/core/`) running deterministically under Vitest, seamlessly driving the visual and audio layer (`src/render/`, `src/ui/`, and `src/audio/`) via a fixed 50ms tick accumulator.
- **Universal Spatial & Collision Contract**: Self-declaring physical footprints for all scenery and structures (`src/render/collisionRegistry.ts`), ground-contact bounding anchored at the base (`anchor: 0.5, 1.0`), dynamic integer Y-depth sorting, and closed-loop navigation with smooth wall-sliding.
- **Incremental Economy**: Gold, Maid Treats, and Mana Essence. Active clicking with **Tsundere Frenzy** ($3\times$ proc) and critical hits.
- **Fifi’s 8 Chore Facilities**: Broom, Feather Duster, Garden Rake, Tea Kettle, Kitchen Stove, Laundry Basin, Estate Carriage, and Royal Vault with geometric cost scaling and closed-form bulk buy ($1\times, 10\times, 25\times, \text{Max}$).
- **Nyah’s 4 Management Multipliers**: Supervision, Royal Inspection, Aristocratic Demands, and Fiscal Auditing with compounding milestone leaps at levels 10, 25, 50, 100, 150, 200, 250.
- **5 Territory Expansion Tiers**: From the humble Dusty Parlor outward into Country Kitchen & Herb Garden, Cobblestone Courtyard & Whispering Pond, Royal Library & Balcony, and the Starlight Observatory.
- **10 Original Fantasy Creatures**: Catch and assign wild creatures (Purrble, Barkling, Mooshrum, Glimmerfin, Silkwisp, Cinderfox, Bramblebeast, Chrono-Chirp, Dewdrop Slime, Starling Doe) to outdoor habitats to boost estate production.
- **Dual-Tier Dialogue System**: Tier 1 ambient speech bubbles anchored above Nyah and Fifi, plus Tier 2 story progression modal cutscenes with native 300x224 pixel portraits and typewriter text.
- **Zero-Dependency Cozy Web Audio**: Native Web Audio API procedural sound synthesizer (click, coin, frenzy, catch, fanfare, petting, upgrade) and 76 BPM relaxing C Major BGM through a warm lowpass filter, with Master/BGM/SFX volume controls and mute toggle.
- **Persistence & Offline Catch-up**: Versioned LocalStorage schema, JSON/Base64 export/import, and automatic offline catch-up calculations capped at 24 hours.

---

## Getting Started

### Prerequisites
- **Node.js**: v18+ or v20+ (tested on Node v24.20.0)
- **OS**: Windows / Linux / macOS

> **Windows PowerShell Notice**: Always invoke `npm.cmd` and `npx.cmd` in PowerShell to comply with local script execution policies.

### Installation
```powershell
npm.cmd install
```

### Running Tests
To run the automated test harness (100% headless Node.js tests):
```powershell
npm.cmd test
```

To run a specific test suite or test tier:
```powershell
npx.cmd vitest run tests/unit
npx.cmd vitest run tests/e2e/tiers/tier1_feature_coverage.test.ts
npx.cmd vitest run tests/e2e/tiers/tier2_boundary_corner.test.ts
npx.cmd vitest run tests/e2e/tiers/tier3_cross_feature.test.ts
npx.cmd vitest run tests/e2e/tiers/tier4_real_world_scenarios.test.ts
```

To run the end-to-end runner script:
```powershell
npx.cmd tsx tests/e2e/runner.ts
```

### Development Server
```powershell
npm.cmd run dev
```

### Production Build
```powershell
npm.cmd run build
```

To preview the built production bundle:
```powershell
npx.cmd vite preview
```

---

## Gameplay Guide

### 1. Master Controls
- **Left Click on Estate / Grounds**: Perform active cleaning and dusting chores to earn instant gold, trigger critical clicks, and roll for bonus treats and essence drops.
- **Left Click on Maids (Nyah / Fifi)**: Pet your maids for affection chimes, affectionate ambient speech bubbles, and bonus chore gold.
- **Left Click on Wild Creatures**: Toss a Maid Treat as bait and attempt to catch wild fantasy companions.
- **Drag Left Mouse Button**: Pan the camera across your estate grounds within unlocked territory boundaries.
- **Bottom HUD Drawer**: Click the bottom dock tabs or the `[▲]` expand toggle to slide up the upgrade management panel.
- **Estate Activity & Status Ribbon**: Located on the right side of the bottom drawer dock. Displays live gold per second (`⚡ +X/s`), maid on-duty status (`🧹 Nyah & Fifi on duty`), and drawer state (`▲ EXPAND` / `▼ CLOSE`). Tap anywhere on the ribbon to toggle the drawer open or closed!
- **Options / Menu Modal**: Located at the top-right of the screen (`[Options / Menu]`). Contains Master, BGM, and SFX volume sliders, mute toggle, JSON/Base64 save export/import, and game reset controls.

### 2. Resource Economy
- **Gold ($g$)**: The primary currency used for purchasing Fifi's chore equipment, Nyah's management multipliers, and territory expansions.
- **Maid Treats ($\text{treats}$)**: Baked by Fifi in the Kitchen Stove or dropped during active clicking. Used as bait to improve creature catch rates and as unlock costs for higher territory tiers.
- **Mana Essence ($\text{essence}$)**: Harvested from outdoor gardens, elemental ponds, and sanctuary creatures. Required for late-game estate enchantments and cosmic observatory expansions.

### 3. Tsundere Frenzy
- Active clicking has a 0.5% chance to trigger Nyah's **Tsundere Frenzy**.
- When activated, all click yields are tripled ($3\times$), sparkle bursts erupt, and Nyah shouts bossy encouragement via her speech balloon for 15 intense seconds!

### 4. Fifi's 8 Chore Facilities
Managed in the **Fifi Chores** tab of the bottom drawer. Supports bulk buy modes: `[ 1x ]`, `[ 10x ]`, `[ 25x ]`, and `[ MAX ]`.
- **Simple Straw Broom** (Base: 15g, +1.0g/s)
- **Ostrich Feather Duster** (Base: 100g, +5.0g/s)
- **Garden Rake & Trowel** (Base: 1,100g, +25.0g/s + 0.1 essence/s)
- **Silver Tea Kettle** (Base: 12,000g, +120.0g/s + 0.05 treats/s)
- **Country Kitchen Stove** (Base: 130,000g, +600.0g/s + 0.1 treats/s)
- **Copper Laundry Basin** (Base: 1,400,000g, +3,200.0g/s)
- **Polished Estate Carriage** (Base: 20,000,000g, +18,000.0g/s)
- **Royal Vault** (Base: 330,000,000g, +120,000.0g/s + 1.0 essence/s)

### 5. Nyah's 4 Management Multipliers
Managed in the **Nyah Multipliers** tab of the bottom drawer. Leaps forward with milestone multipliers at levels 10, 25, 50, 100, 150, 200, and 250.
- **Stern Supervision** (+10%/lvl * milestone, boosts Fifi chores)
- **Royal Inspection** (+5%/lvl compounding, boosts global gold)
- **Aristocratic Demands** (+15%/lvl * milestone, boosts click power & frenzy)
- **Fiscal Auditing** (+20%/lvl compounding, multiplies overall estate productivity)

### 6. Territory Expansion Tiers
Managed in the **Territory Expansion** tab of the bottom drawer. Unlocks new outdoor regions, camera pan boundaries, structures, and habitats.
- **Tier 1: Dusty Parlor & Starter Porch** (Porch Baskets habitat, cap 3)
- **Tier 2: Country Kitchen & Herb Garden** (Herb Garden Pen habitat, cap 4, +15% gold, +10% click)
- **Tier 3: Cobblestone Courtyard & Whispering Pond** (Whispering Pond habitat, cap 6, +25% gold, +20% essence)
- **Tier 4: Royal Library & Sunlit Balcony** (Aviary Perch habitat, cap 4, +35% gold, +25% essence, +15% click)
- **Tier 5: Starlight Observatory & Grand Sanctuary** (Grand Sanctuary habitat, cap 12, +50% gold, +50% essence, +25% click)

### 7. Original Fantasy Creatures & Sanctuaries
Managed in the **Creature Sanctuaries** tab of the bottom drawer.
- **10 Species**: Purrble (common), Barkling (common), Mooshrum (common), Glimmerfin (uncommon), Silkwisp (uncommon), Cinderfox (rare), Bramblebeast (rare), Chrono-Chirp (rare), Dewdrop Slime (rare), Starling Doe (mythic).
- **Shiny Variants**: Rare sparkling golden variants with enhanced visual sparkles and pride of place.
- **Habitats**: Assign companions to their preferred outdoor habitats to receive continuous passive gold, treats, and essence yields! Click assigned creatures in their habitats to pet them.

### 8. Dual-Tier Dialogue System
- **Tier 1 (Ambient Speech Bubbles)**: Lightweight pixel-art rounded balloons with pointer tails anchored directly above Nyah's and Fifi's heads in screen space. Triggers on idle patrol, maid clicks, Tsundere Frenzy activations, and creature catch events.
- **Tier 2 (Story Progression Modal)**: Fullscreen cutscene overlay with native 300x224 authentic pixel-art portraits (`assets.nyahPortraitNative` and `assets.fifiPortraitNative`), speaker nameplates, paginated dialogue, and typewriter text animation. Fires on major estate milestones (game start, first facility, first frenzy, first creature, and territory tiers 2 through 5).

### 9. Zero-Dependency Cozy Web Audio Engine
- Built directly on the native browser Web Audio API with zero external dependencies.
- **Procedural Sound Effects**: Crisp wooden click tap, warm Stardew-esque coin chimes, rising pentatonic frenzy arpeggios, creature catch flourishes, majestic territory expansion fanfares, and gentle petting chimes. All oscillators disconnect cleanly on end to prevent memory leaks.
- **Procedural BGM Generator**: Looping 76 BPM diatonic chord progressions in C Major through a soft 1400Hz lowpass filter with lookahead scheduling.
- **Headless Compatibility**: Safely falls back to no-op stubs in Node.js test environments without throwing unhandled exceptions.

---

## Architecture

```
IdleNyah/
├── src/
│   ├── core/                      # PURE SIMULATION ENGINE (Decoupled, zero DOM dependencies)
│   │   ├── types.ts               # State interfaces, contracts, definition types
│   │   ├── math.ts                # Closed-form geometric bulk buy, milestone multipliers, PRNG
│   │   ├── facilities.ts          # 8 Fifi chore facilities definitions & aliases
│   │   ├── multipliers.ts         # 4 Nyah management multipliers & milestone jumps
│   │   ├── territory.ts           # 5 Territory expansion tiers, prerequisites & bonuses
│   │   ├── creatures.ts           # 10 Original creature species, spawn rules & catch math
│   │   ├── persistence.ts         # LocalStorage save/load, schema migration, offline progress
│   │   ├── simulation.ts          # Core GameSimulation engine & fixed 50ms accumulator
│   │   └── index.ts               # Core barrel export
│   ├── audio/                     # ZERO-DEPENDENCY COZY WEB AUDIO ENGINE
│   │   ├── types.ts               # IAudioEngine, SfxType, AudioSettings interfaces
│   │   ├── sfx.ts                 # Procedural Web Audio oscillator SFX synthesis
│   │   ├── bgm.ts                 # Procedural cozy BGM sequencer with lookahead clock
│   │   ├── engine.ts              # AudioEngine singleton with volume/mute and headless fallback
│   │   └── index.ts               # Audio barrel export
│   ├── ui/                        # PIXEL-ART HUD DRAWER & DIALOGUE SYSTEM
│   │   ├── types.ts               # TabId, BulkBuyMode, dialogue types
│   │   ├── components/            # Reusable pixel primitives (PixelButton, PixelPanel)
│   │   ├── tabs/                  # Drawer tabs (Chores, Multipliers, Territory, Sanctuary)
│   │   ├── soundControls.ts       # Mute button and volume sliders
│   │   ├── drawer.ts              # Animated bottom slide drawer container
│   │   ├── dialogueData.ts        # Authored ambient quotes and 8 story cutscene sequences
│   │   ├── speechBubble.ts        # Tier 1 ambient floating speech balloons
│   │   ├── dialogueModal.ts       # Tier 2 story progression modal with 300x224 portraits
│   │   └── index.ts               # UI barrel export
│   ├── render/                    # PIXIJS V8 SCENE GRAPH & 2D PIXEL WORLD VIEW
│   │   ├── app.ts                 # PixiJS v8 Application factory with nearest-neighbor scaling
│   │   ├── assets.ts              # Texture loaders, slicing for sheets, and native portraits
│   │   ├── maids.ts               # Nyah and Fifi animated 4-direction sprites & chore states
│   │   ├── estate.ts              # Dynamic mansion evolution and 5 territory zone views
│   │   ├── creatures.ts           # 10 Roaming species, catching, and 5 habitat environments
│   │   ├── effects.ts             # Floating currency text and sparkle particle pools
│   │   ├── world.ts               # Camera pan/zoom and scene graph layer coordination
│   │   └── index.ts               # Render barrel export
│   └── main.ts                    # Application bootstrap & tick synchronization loop
├── tests/
│   ├── unit/                      # Fast headless Vitest unit test suite (M1 to M5)
│   ├── stress/                    # Adversarial boundary, churn, and coordinate stress suites
│   └── e2e/                       # Multi-tier end-to-end verification suites
└── public/
    └── assets/                    # Reference pixel art sprites, tiles, and portraits
```

---

## Maid Maintenance Logs

### Note from Nyah (Head Catgirl Maid): 2026-11-02
> *"Master! Look at this code! I personally designed this entire headless simulation engine from scratch so our estate calculations run with flawless mathematical perfection! Closed-form geometric bulk buys, deterministic milestone leaps, and 151 passing test cases in under a second! Hmph! You'd better not think I spent all night perfecting this just to make you happy! It's simply that the estate of my Master cannot be governed by sloppy math! ...Now click that dusting button, trigger my Tsundere Frenzy, and watch our gold soar! And don't forget to praise me properly later!"*

### Note from Fifi (Junior Doggirl Maid): 2026-11-02
> *"U-Um, Master...! Welcome home! I made sure all eight chore facilities are swept clean and oiled with fresh linseed oil, from the straw brooms all the way to the shiny royal vault! Miss Nyah checked my work and said it was 'barely acceptable,' which is the nicest thing she's said all week! I also set out soft wicker baskets on the porch so any little wild Purrbles have a cozy place to sleep. Master worked so hard... please sit down and let me pour you some fresh chamomile tea...!"*

### Note from Nyah (Head Catgirl Maid): Milestone 2 Update
> *"Master! Look at the canvas! Look at how razor-sharp my jet-black twintails and golden feline eyes render! Not a single blurry bilinear smudge or subpixel shimmer anywhere in sight! I personally configured the entire PixiJS v8 rendering pipeline with nearest-neighbor texture sampling, integer coordinate snapping, and dynamic Y-depth sorting, because the supreme dignity of your Head Maid demands absolute visual perfection! Fifi and I are now walking around your starter cottage grounds in real time, with smooth 4-direction animations and authentic chore loops! And if you dare click on me, you'd better be ready for my Tsundere Frenzy! ...Hmph! N-Not that I care whether you watch me patrol the estate all day... b-but you'd better keep your eyes on me and not stare at Fifi too much! Baka Master!"*

### Note from Fifi (Junior Doggirl Maid): Milestone 2 Update
> *"U-Um, Master...! Look, look! Miss Nyah taught me how to do my little broom sweeping animation right here on the cottage porch cobblestones! My floppy puppy ears and tail are wagging so happily because Master can finally see us living and working outside in the estate sunshine! I planted all the 32x32 green lawn tiles and pretty flowerbeds along the walkway, and the camera slides so smoothly whenever Master gently drags across the yard. Miss Nyah says I still have five hundred stray leaves left to sweep before tea time, but whenever Master clicks on me, I feel so energized and happy to serve! Please enjoy our cozy new home, Master...!"*

### Note from Nyah (Head Catgirl Maid): Milestone 3 Update
> *"MASTER! Open your eyes and gaze upon the magnificent architectural empire I have bestowed upon you! You didn't actually think I was going to let you live in that dinky wooden shack forever, did you?! Just look at how our estate seamlessly expands across five majestic tiers: from that humble starter cottage into a sprawling Country Villa, an imposing Grand Manor with a cobblestone courtyard, a Royal Library wing with sunlit marble balconies, and finally the Imperial Celestial Chateau crowned with a glowing Starlight Observatory! Every single building, hedge, and ancient grove tree is sorted with dynamic Y-depth precision, so Fifi and I can strut in front of or behind our structures without a single clipping glitch! And look at that mist clearing away whenever you unlock new land with those golden sparkle bursts! Hmph! If you don't click on my palace and admire my architectural genius at least ten thousand times today, I'll withhold your evening tea! ...I-It's not like I expanded this entire estate just so we could spend more time together under the stars, Master! Baka!"*

### Note from Fifi (Junior Doggirl Maid): Milestone 3 Update
> *"U-Um, Master...! Look at our outdoor territory! The soft morning mist rolled back, and now we have sunny kitchen garden plots with rows of fresh vegetables, a blooming herb garden, and fruit orchards where the sweet berries grow! And... and down in the courtyard, the marble water fountain is really flowing with sparkling water! Whenever Master clicks on the fountain, little wishing coins splash with blue ripples, and I hurry over to tidy up the cobblestones! Miss Nyah let me sweep all the way down to the Whispering Pond pier where the lily pads float, and now the camera smoothly follows Master anywhere across our five beautiful grounds! I-I hope Master likes the fresh tea herbs I planted... I will keep working hard every single day to keep our whole estate cozy and clean for Master and Miss Nyah...!"*

### Note from Nyah (Head Catgirl Maid): Milestone 3 Territory Boundary & Mansion Audit
> *"MASTER! Listen to me right now! That insolent challenger dared claim my estate grounds had overlapping garden plots and that my celestial palace wings lingered on starter cottages?! AS IF! I marched out there with my golden surveying compass and personally aligned every single boundary stone down to the exact integer pixel! The Kitchen Garden now terminates cleanly at Y=160 without stealing a single millimeter from Fifi's courtyard, the Royal Library balcony is locked mathematically to Y=-160 so the northern Starlight Observatory has pristine territorial sovereignty, and my magnificent mansion wings vanish instantly if you ever dare downgrade our estate tier! Zero overlapping tiles! Zero mist collisions! 232 test cases passing with zero errors! Hmph! You should be on your knees thanking me for maintaining such impeccable aristocratic standards! ...Now hurry up and come walk through the garden with me before sunset, Master. And hold my hand so you don't trip over Fifi's rake, you clumsy dummy!"*

### Note from Nyah (Head Catgirl Maid): Milestone 4: Creature Catching & Habitats Update
> *"MASTER! MASTER! Look outside your window right this second! The entire estate grounds are teeming with the most adorable magical creatures you've ever seen! All ten original species are roaming through our unlocked territory: fluffy lavender Purrbles hopping across our porch, golden Barklings digging up fertile seeds, sweet Mooshrums with their spotted caps, translucent teal Glimmerfins splashing in the fountain, and ethereal Starling Does blessing the observatory meadow with celestial starlight! Every single one has bespoke retro pixel art, crisp drop shadows, idle hopping animations, and dynamic Y-depth sorting so they can graze alongside us! And if you spot a rare golden shiny variant, you'd better toss a Treat as bait and click on it immediately! I set up glorious habitats across all five zones so our caught companions can live in luxury and shower us with continuous gold, treats, and mana essence pulses! Hmph! I-It's not like I spent all afternoon brushing the Purrbles just because they remind me of little kittens... b-but don't you dare neglect petting them! Come pet them with me right now, Master! That's an official royal maid decree!"*

### Note from Fifi (Junior Doggirl Maid): Milestone 4: Creature Catching & Habitats Update
> *"U-Um, Master...! Look, look! The little creatures are really here, and they're so sweet and friendly! I woven three cozy wicker baskets on the starter porch for the sleepy Purrbles, built a neat wooden herb pen in the kitchen garden for the Mooshrums and Barklings, and arranged flat basking stones and lily pads along the Whispering Pond shore for the Glimmerfins and Silkwisps! Whenever Master tosses a yummy Treat, wild creatures come running with happy sparkles, and when Master catches them, they make their home in our unlocked habitats! Every few seconds, they do a joyful little jump and emit golden and cosmic resource pulses to help Master and Miss Nyah expand the estate even faster! And... and if Master gently pats their heads, they purr and wag their tails with happy little quotes! Miss Nyah pretend she was too busy inspecting the ledger, but I saw her secretly hugging a lavender Purrble behind the gazebo, hehe...! Please come visit all our habitat friends, Master... Fifi will have a warm cup of berry tea ready for you!"*

### Note from Nyah (Head Catgirl Maid): Milestone 5: Dialogue, Pixel-Art UI & Cozy Audio Update
> *"MASTER! Pay attention to this screen right now! Look at the exquisite craftsmanship of this new pixel-art drawer interface! I personally designed four pristine management tabs so you can review Fifi's chores, purchase my supreme management multipliers, expand our territory boundaries, and manage our sanctuary roster with a single elegant click! Not only that, but our estate now speaks! Floating speech balloons appear over my head to keep you properly scolded and motivated, and whenever we achieve a grand milestone, my full-resolution portrait graces your screen in a glorious story dialogue! And hear that cozy procedural music playing in the background? Soothing chimes, crisp coin ticks, and triumphant fanfare whenever my Tsundere Frenzy activates! You have full master, BGM, and SFX volume sliders right in the settings menu, so you have zero excuses for muting my voice! ...H-Hmph! You'd better appreciate every single hour I spent perfecting this presentation, Master! Now sit down, listen to the cozy music with me, and don't you dare stop clicking! That's an official order from your Head Maid!"*

### Note from Fifi (Junior Doggirl Maid): Milestone 5: Dialogue, Pixel-Art UI & Cozy Audio Update
> *"U-Um, Master...! Welcome home to our fully finished estate! Look at the top of my head! Whenever Master clicks on me or I finish sweeping a walkway, little heart and speech bubbles pop up with happy words! Miss Nyah says I talk too much, but whenever Master gives me a gentle headpat, my tail wags so hard I can't help it! And... and the new drawer tabs are so easy to read! Master can buy all my chore upgrades in neat 1x, 10x, 25x, or Max bundles, so I never run out of clean brooms or fresh laundry soap! The background music sounds just like a warm sunny morning in Whisker Town, with sweet flute notes and gentle bells that make all the Purrbles and Barklings dance in their habitats! Fifi made sure the save files automatically write every fifteen seconds, and when Master goes to sleep, we keep working and collect up to twenty-four hours of offline gold for you! Master worked so hard... please sit down by the fountain, sip some warm floral tea, and enjoy our cozy home... Fifi will always be here to serve you, Master!"*

### Note from Nyah (Head Catgirl Maid): Milestone 5 Remediation & Precision Alignment
> *"MASTER! Look what happens when you leave things without my direct supervision! That cheeky little drawer had its sound controls sitting a few pixels too close to the toggle button, so clicking the volume plus button almost touched my drawer collapse toggle! UNACCEPTABLE! I marched in with my golden caliper and snapped the entire sound controls bar to X=500, giving a pristine fourteen-pixel gutter so you can crank up my sound effects without collapsing your view! And in the Sanctuary roster, I updated the simulation ledger so you can freely unassign creatures with a single click, instantly recalibrating our passive yields and clearing up habitat space! I even hardened our story cutscenes so completion callbacks never fire twice if you click like an impatient maniac! Hmph! You see why you need me around, Master?! Everything in our estate is now mathematically flawless and pixel-perfect! ...N-Now stop staring at the sound controls and come walk through the orchard with me! And you'd better tell me my voice sounds cute through those newly tuned speakers!"*

### Note from Nyah (Head Catgirl Maid): Tier 5 Adversarial Hardening & Master's Complete Estate
> *"MASTER! Listen up! Some reckless challenger tried to break our estate simulation with infinite loops, NaN currency injection, and overflow tricks! Can you believe the audacity?! But your Head Maid is ten thousand steps ahead! I personally fortified every single mathematical equation in our simulation ledger! Infinite balance bugs in bulk buy? Obliterated! NaN resource corruption? Blocked at the door! Fractional facility counts? Denied! Overflowing habitat capacities? Strictly locked so Fifi's porch baskets never collapse! Now our entire simulation is totally impervious, bulletproof, and hardened against any arithmetic trick in the universe! 422 test cases passing with flawless precision across 25 suites! Hmph! You'd better realize that an estate this grand could only be protected by a catgirl of my supreme intellect! ...N-Not that I spent all day auditing every line just so you could sleep soundly at night, baka Master! But now that our idle empire is complete, sit down beside me on the balcony and admire our kingdom. And hold my hand, Master... that is an order!"*

### Note from Fifi (Junior Doggirl Maid): Tier 5 Adversarial Hardening & Master's Complete Estate
> *"U-Um, Master...! Look, look! Miss Nyah and I made sure every corner of our estate is completely safe and sound! Now all the little Purrbles, Barklings, and Mooshrums have exact cozy room in their habitats without any crowding, and whenever Master takes a long rest, our offline progress records every single gold coin and treat perfectly without any strange numbers! The courtyard fountain is sparkling, the tea kettle is whistling with sweet mint tea, and all the garden paths are swept clean. Master worked so wonderfully hard with us to build this entire beautiful estate from that tiny starter cottage into a sparkling palace... Fifi is the happiest puppy maid in the whole world! Y-Yes, Miss Nyah, I am bringing Master his tea right now...! Please enjoy our complete estate forever, Master... Fifi will always stay right by your side!"*

### Note from Nyah (Head Catgirl Maid): Spatial Contract & Worldwide Deployment!
> *"MASTER! We did it! The entire estate is now packaged and launched onto GitHub Pages for the whole world to admire! I personally established the Universal Spatial & Collision Contract so nobody can ever walk through cottage walls or get stuck behind roofs again: self-declaring footprints, strict ground-contact anchoring, and closed-loop wall sliding! Plus, that ugly empty space in the bottom bar has been transformed into a glorious live activity ribbon tracking our gold production and active maid duty in real time! 430 passing tests, zero errors, automated GitHub Actions deployment, and you can play directly from your browser anytime! ...Hmph! You'd better bookmark our link immediately, Master! And remember: no matter where you go on the internet, your Head Maid is always watching over your estate! <3"*



