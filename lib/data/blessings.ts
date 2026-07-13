// Personalized daily blessings — the word of God spoken over you by name.
// Focus: identity in Christ. {name} is replaced with the reader's name.
// Each affirmation restates a passage (World English Bible) in the second person.

export interface Blessing {
  line: string; // uses {name}
  ref: string;
}

export const blessings: Blessing[] = [
  { line: "{name}, you are fearfully and wonderfully made, and marvelous are His works.", ref: "Psalm 139:14" },
  { line: "{name}, you are a new creation in Christ — old things have passed away; behold, all things have become new.", ref: "2 Corinthians 5:17" },
  { line: "{name}, you are accepted in the Beloved.", ref: "Ephesians 1:6" },
  { line: "{name}, there is now no condemnation for you, because you are in Christ Jesus.", ref: "Romans 8:1" },
  { line: "{name}, you are chosen — set apart, holy, and dearly loved by God.", ref: "Colossians 3:12" },
  { line: "{name}, you are God's own workmanship, created in Christ Jesus for good works.", ref: "Ephesians 2:10" },
  { line: "{name}, to you He gave power to become a child of God, born not of blood but of Him.", ref: "John 1:12" },
  { line: "{name}, you are made the righteousness of God in Christ.", ref: "2 Corinthians 5:21" },
  { line: "{name}, He chose you before the foundation of the world to be holy and without blame before Him.", ref: "Ephesians 1:4" },
  { line: "{name}, you are a chosen generation, a royal priesthood, a holy nation, His own special people.", ref: "1 Peter 2:9" },
  { line: "{name}, nothing shall be able to separate you from the love of God in Christ Jesus your Lord.", ref: "Romans 8:39" },
  { line: "{name}, you are complete in Him, who is the head of all principality and power.", ref: "Colossians 2:10" },
  { line: "{name}, your life is hid with Christ in God.", ref: "Colossians 3:3" },
  { line: "{name}, you are the temple of God, and the Spirit of God dwells in you.", ref: "1 Corinthians 3:16" },
  { line: "{name}, in all these things you are more than a conqueror through Him who loved you.", ref: "Romans 8:37" },
  { line: "{name}, you were once darkness, but now you are light in the Lord — walk as a child of light.", ref: "Ephesians 5:8" },
  { line: "{name}, He calls you friend, for He has made known to you the things of the Father.", ref: "John 15:15" },
  { line: "{name}, in Him you have redemption through His blood, the forgiveness of sins.", ref: "Ephesians 1:7" },
  { line: "{name}, He predestined you to adoption as His own child by Jesus Christ.", ref: "Ephesians 1:5" },
  { line: "{name}, you are not your own; you were bought with a price, so glorify God in your body.", ref: "1 Corinthians 6:20" },
  { line: "{name}, fear not — He has redeemed you, He has called you by your name; you are His.", ref: "Isaiah 43:1" },
  { line: "{name}, He has graven you upon the palms of His hands; you are continually before Him.", ref: "Isaiah 49:16" },
  { line: "{name}, you are blessed with all spiritual blessings in heavenly places in Christ.", ref: "Ephesians 1:3" },
  { line: "{name}, you can do all things through Christ who strengthens you.", ref: "Philippians 4:13" },
  { line: "{name}, He who has begun a good work in you will perform it until the day of Jesus Christ.", ref: "Philippians 1:6" },
  { line: "{name}, you are kept by the power of God through faith.", ref: "1 Peter 1:5" },
  { line: "{name}, He has raised you up and made you sit together in heavenly places in Christ Jesus.", ref: "Ephesians 2:6" },
  { line: "{name}, your citizenship is in heaven, from where you look for the Saviour, the Lord Jesus Christ.", ref: "Philippians 3:20" },
  { line: "{name}, the Lord your God in your midst is mighty; He rejoices over you with singing.", ref: "Zephaniah 3:17" },
  { line: "{name}, behold what manner of love the Father has given you, that you should be called a child of God.", ref: "1 John 3:1" },
  { line: "{name}, you are His beloved, and His banner over you is love.", ref: "Song of Solomon 2:4" },
  { line: "{name}, you are strong and of good courage, for the Lord your God is with you wherever you go.", ref: "Joshua 1:9" },

  // Grace
  { line: "{name}, His grace is sufficient for you, for His strength is made perfect in weakness.", ref: "2 Corinthians 12:9" },
  { line: "{name}, from His fullness you have received grace upon grace.", ref: "John 1:16" },
  { line: "{name}, God is able to make all grace abound to you, so that you always have all you need.", ref: "2 Corinthians 9:8" },
  { line: "{name}, you may come boldly to the throne of grace to find grace to help in your time of need.", ref: "Hebrews 4:16" },
  { line: "{name}, by grace you have been saved through faith — it is the gift of God, not of works.", ref: "Ephesians 2:8" },

  // Peace
  { line: "{name}, the peace of God, which surpasses all understanding, will guard your heart and mind in Christ Jesus.", ref: "Philippians 4:7" },
  { line: "{name}, He gives you His own peace — not as the world gives; let not your heart be troubled.", ref: "John 14:27" },
  { line: "{name}, He will keep you in perfect peace, because your mind is stayed on Him.", ref: "Isaiah 26:3" },
  { line: "{name}, you may lie down and sleep in peace, for the Lord alone makes you dwell in safety.", ref: "Psalm 4:8" },

  // Strength
  { line: "{name}, He gives power to the faint, and to those with no might He increases strength.", ref: "Isaiah 40:29" },
  { line: "{name}, the joy of the Lord is your strength.", ref: "Nehemiah 8:10" },
  { line: "{name}, God is your refuge and strength, a very present help in trouble.", ref: "Psalm 46:1" },
  { line: "{name}, wait on the Lord, and He will renew your strength; you will mount up with wings like eagles.", ref: "Isaiah 40:31" },

  // Hope
  { line: "{name}, may the God of hope fill you with all joy and peace in believing, that you may abound in hope.", ref: "Romans 15:13" },
  { line: "{name}, the Lord's plans for you are for peace and not for evil, to give you a future and a hope.", ref: "Jeremiah 29:11" },
  { line: "{name}, this hope you have is a sure and steadfast anchor of the soul.", ref: "Hebrews 6:19" },

  // Faith & trust
  { line: "{name}, trust in the Lord with all your heart, and He will make your paths straight.", ref: "Proverbs 3:5-6" },
  { line: "{name}, God has given you a spirit not of fear, but of power and love and a sound mind.", ref: "2 Timothy 1:7" },
  { line: "{name}, He who promised is faithful; hold fast the confession of your hope without wavering.", ref: "Hebrews 10:23" },

  // The love of God
  { line: "{name}, the Lord your God is in your midst; He will quiet you with His love and rejoice over you with singing.", ref: "Zephaniah 3:17" },
  { line: "{name}, He has loved you with an everlasting love, and with kindness He has drawn you.", ref: "Jeremiah 31:3" },
  { line: "{name}, neither height nor depth nor anything in all creation can separate you from the love of God.", ref: "Romans 8:39" },

  // Comfort & care
  { line: "{name}, cast all your anxiety on Him, because He cares for you.", ref: "1 Peter 5:7" },
  { line: "{name}, the Lord is near to the brokenhearted and saves the crushed in spirit.", ref: "Psalm 34:18" },
  { line: "{name}, as a mother comforts her child, so the Lord will comfort you.", ref: "Isaiah 66:13" },
  { line: "{name}, He heals the brokenhearted and binds up their wounds.", ref: "Psalm 147:3" },

  // Provision & guidance
  { line: "{name}, my God will supply every need of yours according to His riches in glory in Christ Jesus.", ref: "Philippians 4:19" },
  { line: "{name}, the Lord is your shepherd; you shall not want.", ref: "Psalm 23:1" },
  { line: "{name}, He will guide you continually and satisfy your soul in drought.", ref: "Isaiah 58:11" },
  { line: "{name}, in all your ways acknowledge Him, and He will direct your paths.", ref: "Proverbs 3:6" },

  // Perseverance & renewal
  { line: "{name}, let us not grow weary in doing good, for in due season you will reap if you do not give up.", ref: "Galatians 6:9" },
  { line: "{name}, His mercies are new every morning; great is His faithfulness.", ref: "Lamentations 3:23" },
  { line: "{name}, though your outer self is wasting away, your inner self is being renewed day by day.", ref: "2 Corinthians 4:16" },

  // Joy & gratitude
  { line: "{name}, weeping may endure for a night, but joy comes in the morning.", ref: "Psalm 30:5" },
  { line: "{name}, this is the day the Lord has made; rejoice and be glad in it.", ref: "Psalm 118:24" },

  // Prayer heard
  { line: "{name}, this is the confidence you have: if you ask anything according to His will, He hears you.", ref: "1 John 5:14" },
];

/** The blessing for a given day index, with the name substituted in. */
export function blessingForDay(dayIndex: number, name: string): Blessing {
  const b = blessings[((dayIndex % blessings.length) + blessings.length) % blessings.length];
  const who = name.trim() || "Beloved";
  return { line: b.line.replace(/\{name\}/g, who), ref: b.ref };
}
