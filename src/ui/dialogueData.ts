// src/ui/dialogueData.ts
import type { GameState } from '../core/types';
import type { AmbientQuotePools, StoryModalSequence } from './types';

export const NYAH_AMBIENT_QUOTES: AmbientQuotePools = {
  idle: [
    'Look at this ledger... If I do not balance the gold personally, this estate will be bankrupt by nightfall!',
    'Fifi! That corner still has dust! Put your back into it, or no treats after dinner!',
    'Master is spacing out again... Unbelievable. Who gave you permission to slack off?',
    'The sun is hitting the balcony just right... N-Not that I want a catnap! I am surveying the perimeter!',
    'One coin, two coins... Hmph, our treasury is growing, but it is only because of my strict supervision.',
    'Why do humans require so much oversight? If I look away for two seconds, you will probably trip over a broom.',
    'My ears twitched. Did someone drop a gold piece? ...I am watching you, Master.',
    'A proper head maid maintains poise, dignity, and absolute fiscal authority.',
    'Fifi is humming again. Good grief, that dog has more enthusiasm than brains...',
    'If you think I am going to let you slack on the estate expansion, you have another thing coming!',
  ],
  click: [
    'H-Hmph! Who gave you permission to poke your Head Maid?! Hands to yourself, Master!',
    'D-Don\'t touch my twintails! They take an hour to brush, you clumsy dummy!',
    'Baka Master! If you have time to poke me, you have time to collect more gold!',
    'W-What?! Did you need something, or are you just bothering me because you like my face?!',
    'My ears are NOT for petting! ...W-Wait, a little lower... Ah! N-NO! Stop that this instant!',
    'Keep clicking! That gold won\'t multiply itself, and my supervision fee isn\'t cheap!',
    'L-Look at you, smiling like that... You are hopeless without me, aren\'t you?',
    'Stop staring! Go buy another facility before I deduct your allowance!',
  ],
  frenzy: [
    'THAT IS IT! TSUNDERE FRENZY! Don\'t you dare stop clicking right now, Master! THREE TIMES THE POWER!',
    'LOOK AT ALL THIS GOLD! See what happens when you actually listen to my commands?! SPEED IT UP!',
    'MY TAIL IS PUFFED AND MY AUDITORS ARE UNLEASHED! CLICK, MASTER, CLICK!',
    'DON\'T YOU DARE BLINK! While this surge lasts, we are squeezing every single coin out of this estate!',
    'HAAAAAH?! YOU CALL THAT FAST?! FASTER! I EXPECT ABSOLUTE PERFECTION!',
  ],
  catch: [
    'Hmph! Another wild creature tamed under my jurisdiction. Make sure it earns its keep!',
    'A Purrble? ...I suppose it is mildly tolerable. Don\'t look at me, I am NOT cuddling it!',
    'Shiny variant?! G-Good work, Master! Even I have to admit, that golden sparkle is breathtaking!',
    'Assigned to the habitat. That will boost our passive hourly yields by an acceptable margin.',
    'If that creature scratches my mahogany furniture, Master, I am holding YOU personally responsible!',
  ],
};

export const FIFI_AMBIENT_QUOTES: AmbientQuotePools = {
  idle: [
    'Sweep, sweep, sweep! One fallen leaf, two fallen leaves... Master\'s walkways must stay spotless!',
    'U-Um, Master, would you like a warm cup of chamomile tea? I picked fresh herbs this morning...!',
    'Miss Nyah said my sweeping was "passable"! That means she is in a good mood today, hehe!',
    'Oh! The sweet little Mooshrums are grazing near the garden fence! Aren\'t they precious, Master?',
    'I-I hope Master isn\'t working too hard... please remember to rest your hands!',
    'My tail starts wagging all on its own whenever Master walks past... E-Eep, how embarrassing!',
    'I polished the brass doorknobs until I could see my own puppy ears! Did I do okay, Master?',
    'Miss Nyah\'s tea is always so fragrant... one day, I hope I can brew tea half as delicious as hers!',
    'A gentle breeze through the herb garden... it smells like lavender and sweet berry pie!',
    'Y-Yes! I will sweep until every single cobblestone shines like a diamond for Master!',
  ],
  click: [
    'E-Eep! Master! D-Did I do something wrong? I will re-sweep the porch immediately!',
    'A-A headpat...? For me?! Oh gosh, my tail won\'t stop wagging... thank you, Master!',
    'Y-Yes, Master! I am right here! Whatever you need, Fifi will do her very best!',
    'Master\'s hand is so warm and gentle... Can I stay right by your side for just a moment?',
    'I-I will work twice as hard! Master\'s smile gives me so much energy!',
    'Hehe, Master patted my puppy ears! Miss Nyah says I look silly, but I am so happy...!',
    'Ready for orders, Master! Should I weed the garden or polish the silver tea service next?',
    'Woof...! U-Um, I mean... Y-Yes, Master! At your service, always!',
  ],
  frenzy: [
    'W-Wah! Miss Nyah\'s aura is blazing! I-I will sweep at maximum speed! Woooosh!',
    'Master and Miss Nyah are so amazing! Look at the gold fountain! Fifi will help gather every coin!',
    'So much energy! My ears are tingling! Go go Master! Fifi is cheering with all her might!',
    'A whirlwind of gold! I-I have never seen Miss Nyah this fired up! Master, keep going!',
  ],
  catch: [
    'Yay! Welcome to our estate, little friend! I made a cozy warm basket just for you!',
    'Master caught one! Look at its little paws! Oh, you are going to love our garden so much!',
    'Gasp! It is sparkling gold! A shiny friend! Miss Nyah, Master, look how bright it is!',
    'Don\'t be scared, little cutie! Fifi will bring you fresh sweet treats and clean water every single day!',
    'It is settling into the habitat so nicely! Look, Master, it did a happy little hop for you!',
  ],
};

export const STORY_SEQUENCES: StoryModalSequence[] = [
  {
    id: 'intro_welcome',
    title: 'Arrival at the Starter Cottage',
    priority: 10,
    triggerCondition: (state: GameState) => (state.stats?.playTimeSeconds ?? 0) >= 0,
    lines: [
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'So you finally showed up. I was beginning to think you had abandoned us to rot in this pathetic excuse for an estate.',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'U-Um, welcome home, Master! Please don\'t mind the dust, I-I have been sweeping since sunrise, but the leaves keep blowing in...!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'Don\'t apologize to him, Fifi! HE is the Master here, which means HE is responsible for this financial ruin! Look at this roof! Look at these cracked porch boards! It is an insult to my aristocratic pedigree!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'At least you recognize where to start. Since your treasury is currently flatter than a day-old pancake, we start with manual labor. Click the screen to dust and gather starter funds. And remember: I am watching your every move. Don\'t disappoint me!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'I-I will be right beside you, Master! Every little coin helps us rebuild our home!',
      },
    ],
  },
  {
    id: 'first_chore_unlocked',
    title: 'A Brand New Straw Broom',
    priority: 20,
    triggerCondition: (state: GameState) => (state.facilities['fifi_broom']?.level ?? 0) >= 1,
    lines: [
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'Master... is this... is this really for me?! A brand new straw broom with tightly bound bristles?!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'Don\'t get all teary-eyed over a bundle of twigs, Fifi. It is an investment in baseline efficiency. Now you won\'t have to sweep with your bare hands.',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'Y-Yes, Miss Nyah! Oh, Master, thank you so much! Feel how smooth the wooden handle is! Now I can sweep continuously without stopping! I will generate gold for you every single second!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'Hmph, see that? That is what we call automated passive income. Keep accumulating gold, Master. A broom is just the bare minimum. Next, I expect proper dusters, silver tea sets, and a kitchen worthy of my palate!',
      },
    ],
  },
  {
    id: 'first_frenzy_triggered',
    title: 'Tsundere Frenzy Awakens!',
    priority: 30,
    triggerCondition: (state: GameState) => state.clickStats.frenzyActive === true,
    lines: [
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'W-WAIT A SECOND! Why are you clicking so aggressively?! My heart skipped a beat, you idiot!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'E-Eep! Miss Nyah\'s cat ears are standing straight up, and her golden eyes are glowing! Is this... the legendary Frenzy?!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'SILENCE! If Master wants to work this frantically, who am I to stop him?! For the next fifteen seconds, all click profits are tripled by my personal royal decree! CLICK, MASTER, CLICK! Squeeze every ounce of gold out of this estate before the surge cools down! GO GO GO!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'Woooosh! Fifi is sweeping at double-time! Go Master, go!',
      },
    ],
  },
  {
    id: 'territory_tier_2',
    title: 'Country Kitchen & Herb Garden Expansion',
    priority: 40,
    triggerCondition: (state: GameState) => state.territory.unlockedZones.includes('zone_02_kitchen_garden'),
    lines: [
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'Well, well. It seems my Master isn\'t entirely incompetent after all. Look at that mist clearing away!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'GASP! Master, look! The garden gate opened! Look at the fertile soil, and the sunny herb patches! We have real garden beds now!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'Don\'t get distracted by the weeds, Fifi. More land means more responsibility. We now have a proper Country Kitchen Stove to bake maid treats, and our estate production is boosted by fifteen percent. Furthermore, wild creatures from the nearby fields will start wandering onto the grounds.',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'I-I can plant fresh peppermint, chamomile, and sweet lavender for tea! And bake catnip biscuits for Miss Nyah!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'C-Catnip biscuits?! Who said I wanted... H-Hmph! Well, if you insist on baking them, I suppose I can sample one. Strictly for quality assurance! Master, buy some Treats so we can lure wild creatures into our new Herb Garden Pen!',
      },
    ],
  },
  {
    id: 'first_creature_caught',
    title: 'A New Companion for the Estate',
    priority: 50,
    triggerCondition: (state: GameState) => Object.values(state.creatures.caught).some((c) => c.count > 0),
    lines: [
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'MASTER CAUGHT ONE! Look, look! It is safe in Master\'s hands! It is so tiny and soft...!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'Hold it right there! What on earth is that fluffball?! Don\'t just bring stray animals into my parlor!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'B-But Miss Nyah, it is a Purrble! It was rolling in the dust and trying to help me sweep up breadcrumbs with its little tail!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: '...It sweeps? ...And it purrs? ...H-Hmph! Well, I suppose if it generates passive gold and provides click bonuses, it can stay. BUT it sleeps in the porch basket! And if it sheds fur on my apron, you are both cleaning it!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'Yay! I will line the basket with warm flannel right away! Come along, little friend, you are part of our estate family now!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'Don\'t stare at me, Master! ...Fine, you did good. Now go find more of them. Our habitats have plenty of capacity!',
      },
    ],
  },
  {
    id: 'territory_tier_3',
    title: 'Cobblestone Courtyard & Whispering Pond',
    priority: 60,
    triggerCondition: (state: GameState) => state.territory.unlockedZones.includes('zone_03_pond_courtyard'),
    lines: [
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'Now THIS is starting to look like an aristocratic residence! An authentic cobblestone courtyard and a Whispering Pond. My architectural vision is finally bearing fruit.',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'The fountain water is so clear and cool! Look at the little lily pads floating, and... oh! Master, did you see that ripple? Something was swimming!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'That would be a Glimmerfin, an aquatic elemental sprite. In this pond, they can generate pure Mana Essence, which we will need for our advanced estate enchantments. Fifi, keep the courtyard walkways clean. Master, toss a wishing coin into the fountain whenever you pass by. It brings good fortune, and more importantly, gold!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'I-I will sweep all around the fountain every afternoon! It is so peaceful listening to the water splash while Master works...!',
      },
    ],
  },
  {
    id: 'territory_tier_4',
    title: 'Royal Library & Sunlit Balcony',
    priority: 70,
    triggerCondition: (state: GameState) => state.territory.unlockedZones.includes('zone_04_library_balcony'),
    lines: [
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'BEHOLD! The Royal Library Wing! Two stories of mahogany bookshelves, ancient ledgers, astrological charts, and my personal velvet reading couch on the sunlit balcony!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'W-Wow...! Miss Nyah, it is so grand! The ceilings are so high, and the sunlight streams through the tall arched windows! There is even an Aviary Perch outside for flying companions!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'Indeed. Cinderfoxes and Bramblebeasts inhabit these higher grounds. Their essence output will supercharge our multipliers. Master... come here for a moment.',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'Look at how far we have come. When we started, you were standing on three rotten floorboards in a leaky shack. Now... you have built a true manor for us. ...I-It is not like I am proud of you or anything! Baka! You still have the final tier to unlock! Don\'t you dare stop until we reach the stars!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'Miss Nyah\'s face is completely pink, hehe! Master, let\'s keep working together to reach the very top!',
      },
    ],
  },
  {
    id: 'territory_tier_5',
    title: 'The Celestial Chateau & Grand Sanctuary',
    priority: 80,
    triggerCondition: (state: GameState) => state.territory.unlockedZones.includes('zone_05_starlight_observatory'),
    lines: [
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'WE HAVE ACHIEVED ABSOLUTE CELESTIAL PERFECTION! The Starlight Observatory! A glass dome reaching into the cosmos, crowned with the grandest sanctuary in the entire realm!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'Look at the glowing meadow... the flowers are shining like fallen stars! And... Master, look! Is that... a Starling Doe?!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'The mythic astral fawn... It only appears in estates of peerless splendor and harmony. Master, you actually did it. You took my impossible, unreasonable demands, my bossy complaints, and my strict deadlines... and you turned them into paradise.',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'Master is the greatest master in the entire world! Fifi is so, so blessed to serve Master and Miss Nyah here!',
      },
      {
        speaker: 'nyah',
        speakerName: 'Miss Nyah [Head Maid]',
        portrait: 'nyah_native',
        text: 'H-Hey! Don\'t make me get emotional, Fifi! A-Anyway... Master, listen closely: your Head Maid hereby grants you full, unconditional commendation. You are no longer a rookie lord. You are MY Master, ruler of the Celestial Chateau. ...Now come sit on the observatory terrace with me. We are going to watch the stars together until dawn, and you are not allowed to leave my side!',
      },
      {
        speaker: 'fifi',
        speakerName: 'Fifi [Junior Maid]',
        portrait: 'fifi_native',
        text: 'I will go brew our finest celestial chamomile tea for the three of us right now, Master...!',
      },
    ],
  },
];

export function getNextPendingMilestone(
  state: GameState,
  completedMilestones: Set<string>,
): StoryModalSequence | null {
  for (const seq of STORY_SEQUENCES) {
    if (!completedMilestones.has(seq.id) && seq.triggerCondition(state)) {
      return seq;
    }
  }
  return null;
}
