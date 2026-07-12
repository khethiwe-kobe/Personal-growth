// Personalized daily blessings — the word of God spoken over you by name.
// Focus: identity in Christ. {name} is replaced with the reader's name.
// Verse text is KJV (public domain); the affirmation restates it in the second person.

export interface Blessing {
  line: string; // uses {name}
  ref: string;
}

export const blessings: Blessing[] = [
  { line: "{name}, you are fearfully and wonderfully made, and His works are marvellous.", ref: "Psalm 139:14" },
  { line: "{name}, you are a new creation in Christ — old things are passed away, all things are become new.", ref: "2 Corinthians 5:17" },
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
  { line: "{name}, in all these things you are more than a conqueror through Him that loved you.", ref: "Romans 8:37" },
  { line: "{name}, you were once darkness, but now you are light in the Lord — walk as a child of light.", ref: "Ephesians 5:8" },
  { line: "{name}, He calls you friend, for He has made known to you the things of the Father.", ref: "John 15:15" },
  { line: "{name}, in Him you have redemption through His blood, the forgiveness of sins.", ref: "Ephesians 1:7" },
  { line: "{name}, He predestined you to adoption as His own child by Jesus Christ.", ref: "Ephesians 1:5" },
  { line: "{name}, you are not your own; you were bought with a price, so glorify God in your body.", ref: "1 Corinthians 6:20" },
  { line: "{name}, fear not — He has redeemed you, He has called you by your name; you are His.", ref: "Isaiah 43:1" },
  { line: "{name}, He has graven you upon the palms of His hands; you are continually before Him.", ref: "Isaiah 49:16" },
  { line: "{name}, you are blessed with all spiritual blessings in heavenly places in Christ.", ref: "Ephesians 1:3" },
  { line: "{name}, you can do all things through Christ which strengthens you.", ref: "Philippians 4:13" },
  { line: "{name}, He who has begun a good work in you will perform it until the day of Jesus Christ.", ref: "Philippians 1:6" },
  { line: "{name}, you are kept by the power of God through faith.", ref: "1 Peter 1:5" },
  { line: "{name}, He has raised you up and made you sit together in heavenly places in Christ Jesus.", ref: "Ephesians 2:6" },
  { line: "{name}, your citizenship is in heaven, from where you look for the Saviour, the Lord Jesus Christ.", ref: "Philippians 3:20" },
  { line: "{name}, the Lord your God in your midst is mighty; He rejoices over you with singing.", ref: "Zephaniah 3:17" },
  { line: "{name}, behold what manner of love the Father has given you, that you should be called a child of God.", ref: "1 John 3:1" },
  { line: "{name}, you are His beloved, and His banner over you is love.", ref: "Song of Solomon 2:4" },
  { line: "{name}, you are strong and of good courage, for the Lord your God is with you wherever you go.", ref: "Joshua 1:9" },
];

/** The blessing for a given day index, with the name substituted in. */
export function blessingForDay(dayIndex: number, name: string): Blessing {
  const b = blessings[((dayIndex % blessings.length) + blessings.length) % blessings.length];
  const who = name.trim() || "Beloved";
  return { line: b.line.replace(/\{name\}/g, who), ref: b.ref };
}
