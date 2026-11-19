// Job Terms v1 Unicode rules, as data.
// tslint:disable
export const UNICODE_RULES: any = {
  unicodeVersion: "17.0",
  note: "Shared by hash.py and hash.ts. Both refuse to validate or hash on a runtime whose Unicode version differs. defaultIgnorable is Default_Ignorable_Code_Point from Unicode 17.0 DerivedCoreProperties; hash.test.ts checks it against the runtime's \\p{Default_Ignorable_Code_Point}. blankLetters are visible-width-zero letters that are not Default_Ignorable.",
  defaultIgnorable: [
    ["00ad", "00ad"],
    ["034f", "034f"],
    ["061c", "061c"],
    ["115f", "1160"],
    ["17b4", "17b5"],
    ["180b", "180f"],
    ["200b", "200f"],
    ["202a", "202e"],
    ["2060", "206f"],
    ["3164", "3164"],
    ["fe00", "fe0f"],
    ["feff", "feff"],
    ["ffa0", "ffa0"],
    ["fff0", "fff8"],
    ["1bca0", "1bca3"],
    ["1d173", "1d17a"],
    ["e0000", "e0fff"],
  ],
  blankLetters: ["2800"],
};
