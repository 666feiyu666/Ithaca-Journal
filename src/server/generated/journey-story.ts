// Generated from narrative/journey/story.zh-CN.twee. Do not edit by hand.

export const JOURNEY_STORY_START = "PROLOGUE_S01";
export const JOURNEY_STORY_REVISION = "draft-02";
export const JOURNEY_STORY_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  "PROLOGUE_S01": [
    "PROLOGUE_S02"
  ],
  "PROLOGUE_S02": [
    "PROLOGUE_DRAFT_01"
  ],
  "PROLOGUE_DRAFT_01": [
    "PROLOGUE_DRAFT_02"
  ],
  "PROLOGUE_DRAFT_02": [
    "PROLOGUE_DRAFT_03"
  ],
  "PROLOGUE_DRAFT_03": [
    "PROLOGUE_DRAFT_04"
  ],
  "PROLOGUE_DRAFT_04": [
    "PROLOGUE_S03"
  ],
  "PROLOGUE_S03": [
    "CH01_CARD"
  ],
  "CH01_CARD": [
    "CH01_S01"
  ],
  "CH01_S01": [
    "CH01_S02"
  ],
  "CH01_S02": [
    "CH01_S03"
  ],
  "CH01_S03": [
    "CH01_S04"
  ],
  "CH01_S04": [
    "CH01_S05"
  ],
  "CH01_S05": [
    "CH01_S06"
  ],
  "CH01_S06": [
    "CH01_END"
  ],
  "CH01_END": [
    "CH02_CARD"
  ],
  "CH02_CARD": [
    "CH02_S01"
  ],
  "CH02_S01": [
    "CH02_I01"
  ],
  "CH02_I01": [
    "CH02_I02"
  ],
  "CH02_I02": [
    "CH02_I03"
  ],
  "CH02_I03": [
    "CH02_I04"
  ],
  "CH02_I04": [
    "CH02_I05"
  ],
  "CH02_I05": [
    "CH02_S02"
  ],
  "CH02_S02": [
    "CH02_NOTICE"
  ],
  "CH02_NOTICE": [
    "CH02_S03"
  ],
  "CH02_S03": [
    "CH02_S04"
  ],
  "CH02_S04": [
    "CH02_I06"
  ],
  "CH02_I06": [
    "CH02_I06_WRONG_AGENCY",
    "CH02_I06_WRONG_COMMUNION",
    "CH02_I06_C",
    "CH02_I06_COMPLETE"
  ],
  "CH02_I06_WRONG_AGENCY": [
    "CH02_I06"
  ],
  "CH02_I06_WRONG_COMMUNION": [
    "CH02_I06"
  ],
  "CH02_I06_C": [
    "CH02_I06"
  ],
  "CH02_I06_COMPLETE": [
    "CH02_S05"
  ],
  "CH02_S05": [
    "CH02_END"
  ],
  "CH02_END": [
    "CH03_CARD"
  ],
  "CH03_CARD": [
    "CH03_S01"
  ],
  "CH03_S01": [
    "CH03_S02"
  ],
  "CH03_S02": [
    "CH03_S03"
  ],
  "CH03_S03": [
    "CH03_S04"
  ],
  "CH03_S04": [
    "CH03_S05"
  ],
  "CH03_S05": [
    "CH03_S06"
  ],
  "CH03_S06": [
    "CH03_S07"
  ],
  "CH03_S07": [
    "CH03_S08"
  ],
  "CH03_S08": [
    "CH03_END"
  ],
  "CH03_END": [
    "CH04_CARD"
  ],
  "CH04_CARD": [
    "CH04_S01"
  ],
  "CH04_S01": [
    "CH04_S02"
  ],
  "CH04_S02": [
    "CH04_END"
  ],
  "CH04_END": []
};
export const JOURNEY_STORY_PASSAGE_IDS = new Set(Object.keys(JOURNEY_STORY_TRANSITIONS));
export const JOURNEY_STORY_ENDINGS = new Set(["CH04_END"]);
