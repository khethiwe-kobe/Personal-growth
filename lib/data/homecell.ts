// Homecell teaching content for 29 July 2026 — "He Who Observes the Wind Will
// Not Sow" (Ps At Boshoff). The notes quote NKJV; Scripture text here is the
// World English Bible, matching the rest of the app's public-domain sourcing.

export const MEETING = {
  title: "He Who Observes the Wind Will Not Sow",
  speaker: "Ps At Boshoff",
  date: "29 July 2026",
  kicker: "Homecell Notes",
  before: "Encourage the members to bring their Bible and a notebook to Homecell every week.",
};

export const FOCUS_VERSE = {
  ref: "Ecclesiastes 11:4",
  text: "He who observes the wind won't sow; and he who regards the clouds won't reap.",
};

export type Passage = { ref: string; verses: { n: number; text: string }[] };

export const PASSAGES: Record<string, Passage> = {
  ecc11: {
    ref: "Ecclesiastes 11:4-6",
    verses: [
      { n: 4, text: "He who observes the wind won't sow; and he who regards the clouds won't reap." },
      {
        n: 5,
        text: "As you don't know what is the way of the wind, nor how the bones grow in the womb of her who is with child; even so you don't know the work of God who does all.",
      },
      {
        n: 6,
        text: "In the morning sow your seed, and in the evening don't withhold your hand; for you don't know which will prosper, whether this or that, or whether they both will be equally good.",
      },
    ],
  },
  prov4: {
    ref: "Proverbs 4:5-7",
    verses: [
      { n: 5, text: "Get wisdom. Get understanding. Don't forget, and don't deviate from the words of my mouth." },
      { n: 6, text: "Don't forsake her, and she will preserve you. Love her, and she will keep you." },
      {
        n: 7,
        text: "Wisdom is supreme. Get wisdom. Yes, though it costs all your possessions, get understanding.",
      },
    ],
  },
  cor9: {
    ref: "2 Corinthians 9:6-11",
    verses: [
      {
        n: 6,
        text: "Remember this: he who sows sparingly will also reap sparingly. He who sows bountifully will also reap bountifully.",
      },
      {
        n: 7,
        text: "Let each man give according as he has determined in his heart, not grudgingly or under compulsion, for God loves a cheerful giver.",
      },
      {
        n: 8,
        text: "And God is able to make all grace abound to you, that you, always having all sufficiency in everything, may abound to every good work.",
      },
      {
        n: 9,
        text: 'As it is written, "He has scattered abroad, he has given to the poor. His righteousness remains forever."',
      },
      {
        n: 10,
        text: "Now may he who supplies seed to the sower and bread for food, supply and multiply your seed for sowing, and increase the fruits of your righteousness,",
      },
      {
        n: 11,
        text: "you being enriched in everything to all liberality, which produces thanksgiving to God through us.",
      },
    ],
  },
  gal6: {
    ref: "Galatians 6:6-9",
    verses: [
      { n: 6, text: "But let him who is taught in the word share all good things with him who teaches." },
      { n: 7, text: "Don't be deceived. God is not mocked, for whatever a man sows, that he will also reap." },
      {
        n: 8,
        text: "For he who sows to his own flesh will from the flesh reap corruption. But he who sows to the Spirit will from the Spirit reap eternal life.",
      },
      { n: 9, text: "Let's not be weary in doing good, for we will reap in due season if we don't give up." },
    ],
  },
};

export const ICEBREAKER_AREAS = ["Spiritually", "Financially", "Physically", "Relationally"];

export const WORSHIP = {
  praise: [
    { song: "FREE!", artist: "SEU Worship" },
    { song: "Nobody Like You", artist: "CRC Music" },
  ],
  worship: [
    { song: "Your Presence", artist: "Tiffany Hudson" },
    { song: "Throne Room", artist: "Kim Walker-Smith" },
  ],
};

export const SECTION_1 = {
  title: "Nothing changes by itself",
  truths: [
    "Many people wait for their circumstances to improve while doing nothing different. God's Kingdom doesn't operate by wishing or hoping for a miracle; it operates through sowing.",
    "Waiting for the perfect opportunity often becomes an excuse for never starting. If we want to see progress, we must take responsibility for our lives.",
    "God enlarges and promotes people who are willing to grow and take responsibility.",
  ],
  question: "Why do you think taking responsibility is so important in our walk with God?",
  answer:
    "Taking responsibility is important because God has given each of us a free will. He calls us to obey Him, renew our minds, pray, serve, forgive, and sow good seed, but He won't do those things for us. We can't blame our circumstances, our past, or other people forever. At some point we have to say, \"Lord, I'm going to take responsibility for the life You've entrusted to me.\" That's when real growth begins.",
};

export const SECTION_2 = {
  title: "What you allow into your mind produces a harvest",
  truths: [
    "Every seed eventually produces fruit.",
    "The voices we listen to, the things we watch, the conversations we entertain, and the thoughts we continually meditate on all become seeds in our hearts.",
    "You eventually become what you consistently feed your mind. If we desire a different future, we must first change what we are planting in our minds today.",
  ],
  quote: "What are you allowing into your mind every day?",
  question: "What practical changes can you make to change the seed we plant in our minds?",
  answers: [
    "Spend time in God's Word daily instead of only consuming social media or entertainment.",
    'Be intentional about what you watch and listen to. Ask yourself, "Is this building my faith or feeding fear, negativity, or temptation?"',
    "Surround yourself with godly people who encourage and challenge you to grow.",
    "Speak God's promises over your life instead of constantly speaking negatively about yourself or your future.",
    "Pray before you start your day, asking God to help you think on things that honour Him.",
    "Limit influences that continually pull you away from God and replace them with worship, sermons, or Christian podcasts.",
  ],
  illustration: {
    need: ["Two small flower pots or cups", "Healthy seeds", "Small stones"],
    steps: [
      "Explain that both containers represent our hearts.",
      "Plant seeds in one container.",
      "Fill the other container with stones.",
    ],
    ask: "Which one has the ability to produce life?",
    close:
      "Just as a seed grows into a harvest, God's Word produces life when planted in our hearts. But if our hearts are continually filled with unhealthy influences, there is no room for God's Word to grow.",
  },
};

// The sorting exercise: each daily input is either a seed (produces life) or a
// stone (crowds the Word out).
export type Input = { id: string; label: string; kind: "seed" | "stone"; why: string };

export const MIND_INPUTS: Input[] = [
  {
    id: "word",
    label: "Reading a chapter of the Word before you touch your phone",
    kind: "seed",
    why: "Whatever goes in first shapes the whole day. Sow the Word before anything else competes for you.",
  },
  {
    id: "scroll",
    label: "An hour of scrolling every night before you sleep",
    kind: "stone",
    why: "It fills the soil without planting anything. Nothing grows from what only entertains you.",
  },
  {
    id: "friends",
    label: "Friends who challenge you to grow and pray with you",
    kind: "seed",
    why: "Godly relationships plant courage and accountability in you.",
  },
  {
    id: "gossip",
    label: "A group chat that thrives on gossip and complaining",
    kind: "stone",
    why: "The conversations we entertain become seeds too, and this one only grows bitterness.",
  },
  {
    id: "promise",
    label: "Speaking God's promises over your future out loud",
    kind: "seed",
    why: "Your own words are seed. Plant the promise, not the fear.",
  },
  {
    id: "negative",
    label: "Telling yourself you will never change",
    kind: "stone",
    why: "You eventually become what you consistently feed your mind, so stop feeding it defeat.",
  },
  {
    id: "sermons",
    label: "Worship and sermons on the drive to work",
    kind: "seed",
    why: "Redeemed time is planted time; the same commute either sows or wastes.",
  },
  {
    id: "series",
    label: "Watching whatever autoplays, whatever it feeds you",
    kind: "stone",
    why: "Unintentional input is still input. What you do not choose still takes root.",
  },
  {
    id: "prayer",
    label: "Praying before the day starts",
    kind: "seed",
    why: "Prayer sets your mind on the things that honour God before the noise arrives.",
  },
  {
    id: "fear",
    label: "Feeding on bad news until you expect the worst",
    kind: "stone",
    why: "He who observes the wind will not sow. Fear watches the sky instead of planting.",
  },
];

export const SECTION_3 = {
  title: "The miracle is in the seed",
  truths: [
    "God has already established the principle of seedtime and harvest; the seed must leave your hand before it can multiply.",
    "God gives seed to the sower and not the hoarder.",
    "Whatever we faithfully sow — our time, generosity, service, obedience, encouragement, and faithfulness — God is able to multiply.",
    "God only multiplies what we release into His hands.",
  ],
  seeds: [
    { id: "time", label: "Time", prompt: "Hours you deliberately give to God and to people." },
    { id: "generosity", label: "Generosity", prompt: "Giving that costs you something." },
    { id: "service", label: "Service", prompt: "Showing up to serve where you are needed." },
    { id: "obedience", label: "Obedience", prompt: "Doing the last thing God told you to do." },
    { id: "encouragement", label: "Encouragement", prompt: "Words that build somebody else up." },
    { id: "faithfulness", label: "Faithfulness", prompt: "Being consistent when nobody is watching." },
  ],
  questions: [
    "What seed is God asking you to sow?",
    "Is there anything you've been holding back from God?",
    "How can you become a faithful sower in every area of life?",
  ],
};

export const SECTION_4 = {
  title: "Your attitude determines your altitude",
  truths: [
    "Life doesn't owe us anything. We cannot control everything that happens to us, but we can choose our response.",
    "Prayer gives us God's perspective and wisdom for every situation.",
    "Choosing the right relationships and maintaining the right attitude positions us for God's purpose.",
    "When God raises someone up, no person can stop His plan.",
  ],
  quote: "Your attitude will take you places!",
  question: "Why is attitude just as important as ability?",
  answer:
    "Ability may open a door, but attitude determines whether you can stay there. Someone can be gifted, talented, and intelligent, but if they have a poor attitude, they're difficult to teach, difficult to lead, and difficult to trust. God is looking for people who are humble, faithful, and willing to serve.",
};

// Scenario game for section 4: each response either lifts or lowers altitude.
export type Scenario = {
  id: string;
  setup: string;
  options: { label: string; lift: number; note: string }[];
};

export const SCENARIOS: Scenario[] = [
  {
    id: "correction",
    setup: "Your leader corrects you in front of the team, and the correction is fair.",
    options: [
      {
        label: "Thank them and fix it the same week",
        lift: 2,
        note: "Teachable people keep the doors that ability opens.",
      },
      {
        label: "Take it, but go quiet and cold for a month",
        lift: -1,
        note: "Withdrawing is still a response, and it plants distance.",
      },
      {
        label: "Defend yourself and explain why it wasn't your fault",
        lift: -2,
        note: "Hard to teach, hard to lead, hard to trust.",
      },
    ],
  },
  {
    id: "overlooked",
    setup: "Someone less experienced is given the opportunity you were hoping for.",
    options: [
      {
        label: "Celebrate them and keep serving faithfully",
        lift: 2,
        note: "God enlarges people who stay faithful before they are promoted.",
      },
      {
        label: "Serve, but let everyone know you were overlooked",
        lift: -1,
        note: "Faithfulness that needs an audience isn't faithfulness yet.",
      },
      {
        label: "Pull back until you are properly recognised",
        lift: -2,
        note: "Withholding your seed guarantees there is no harvest.",
      },
    ],
  },
  {
    id: "delay",
    setup: "You have sown consistently for a year and still see no harvest.",
    options: [
      {
        label: "Keep sowing and ask God for wisdom in prayer",
        lift: 2,
        note: "We reap in due season if we don't give up.",
      },
      {
        label: "Wait for a better season before sowing again",
        lift: -2,
        note: "He who observes the wind will not sow.",
      },
      {
        label: "Decide the principle doesn't work for you",
        lift: -2,
        note: "God is not mocked; the harvest follows the seed, not the feeling.",
      },
    ],
  },
  {
    id: "unseen",
    setup: "The task in front of you is small, unseen, and nobody will thank you for it.",
    options: [
      { label: "Do it well anyway", lift: 2, note: "Consistency when nobody is watching is the seed God multiplies." },
      { label: "Do the minimum required", lift: -1, note: "Sowing sparingly reaps sparingly." },
      {
        label: "Leave it for someone who gets noticed for it",
        lift: -2,
        note: "God gives seed to the sower, not the hoarder.",
      },
    ],
  },
];

export const WORKS = {
  heading: "Each one reach one is a lifestyle!",
  points: [
    "Allow members to share updates on their Oikos List and celebrate every testimony!",
    "Encourage everyone to remember that every invitation, every prayer, and every conversation is a seed that God can use to bring someone to salvation.",
  ],
  challenge: [
    "Pray daily for the people on their Oikos List.",
    "Invite at least one person on their Oikos List to Church and Homecell.",
  ],
  prayer: [
    "For faith to continue sowing, even when we don't yet see the harvest.",
    "For wisdom to sow the right seeds in every area of life.",
    "For a great harvest of souls.",
  ],
  prayerNote: "For the last few minutes, make smaller groups of 2 or 3 and pray:",
};

export const ANNOUNCEMENTS = {
  lead: "Exciting news, DREAMWEEK tickets are on sale right now!",
  link: "https://bit.ly/DW26TicketSalesSMS",
  prices: [
    { label: "Early bird ticket", value: "R300" },
    { label: "Standard ticket", value: "R380" },
  ],
  note: "Ticket prices apply to ages 13 and up.",
};

export type Quiz = { id: string; q: string; options: string[]; correct: number; why: string };

export const QUIZ: Quiz[] = [
  {
    id: "q1",
    q: "According to Ecclesiastes 11:4, what does the person who watches the wind fail to do?",
    options: ["Pray", "Sow", "Give thanks", "Rest"],
    correct: 1,
    why: "He who observes the wind won't sow, and he who regards the clouds won't reap.",
  },
  {
    id: "q2",
    q: "Who does God give seed to?",
    options: ["The hoarder", "The most gifted", "The sower", "The one who waits"],
    correct: 2,
    why: "God gives seed to the sower and not the hoarder, and He multiplies only what we release.",
  },
  {
    id: "q3",
    q: "What becomes seed in our hearts?",
    options: [
      "Only the sermons we hear",
      "The voices, conversations and thoughts we entertain",
      "Nothing, until we speak it",
      "Only what we give financially",
    ],
    correct: 1,
    why: "You eventually become what you consistently feed your mind.",
  },
  {
    id: "q4",
    q: "Ability may open a door. What determines whether you stay there?",
    options: ["Talent", "Timing", "Attitude", "Experience"],
    correct: 2,
    why: "God is looking for people who are humble, faithful, and willing to serve.",
  },
  {
    id: "q5",
    q: "Galatians 6:9 promises a harvest in due season on one condition. What is it?",
    options: [
      "That we give up",
      "That we wait for perfect conditions",
      "That we don't grow weary and give up",
      "That we sow only once",
    ],
    correct: 2,
    why: "Let's not be weary in doing good, for we will reap in due season if we don't give up.",
  },
];
