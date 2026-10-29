window.CMC_V4_CONFIG = {
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbz3XFh57ivklNRHKoVu1DMnfDgCv8pW0sQKAcCwDQJa8U0f0qAcUSDcaPWa4re_9wMHIw/exec",
  GOOGLE_SHEET_URL: "https://docs.google.com/spreadsheets/d/14e7XkQCSgtAwCrXhWVYWou3ARAR_9AZtZe4uvXl1-es/edit",
  EVENT_NAME: "NKU AI Day 2026",
  RELEASE: "ai-day-focused-release-2026-10-29",

  ARTIFACT_MAPPING: {
    fossil1: { artifact: "NEEDS CONFIRMATION", routeStop: "Stop 1", tableLabel: "STOP 1 · CITY FOSSIL STORY" },
    fossil2: { artifact: "NEEDS CONFIRMATION", routeStop: "Stop 4", tableLabel: "STOP 4 · MOLTING MYSTERY" },
    fossil3: { artifact: "NEEDS CONFIRMATION", routeStop: "Stop 5", tableLabel: "STOP 5 · MYSTERY DONUT" }
  },

  SPECIMENS: {
    fossil1: {
      name: "Stop 1 proxy",
      tableLabel: "Stop 1 · City Fossil Story",
      scenarioName: "Cincinnati city fossil",
      approved: true,
      promptAudit: "NEEDS ARTIFACT REVIEW",
      referenceImage: "",
      referenceAlt: "",
      referenceCaption: "Look at the museum image.",
      noticeQuestion: "Which feature would you look for to spot a starfish relative?",
      noticeChoices: [
        {value:"five-part",label:"A five-part pattern",detail:""},
        {value:"round",label:"A round body",detail:""},
        {value:"unsure",label:"Not sure",detail:""}
      ],
      revealTitle: "An ancient relative of starfish.",
      revealText: "This animal was related to starfish and lived in Cincinnati’s ancient sea.",
      uncertaintyText: "",
      sourceText: "CMC Stop 1 · Cincinnati City Fossil · Catalog IP87827",
      relatedObjectName: "Stop 4 · Molting Mystery",
      aiDayDirection: "Find the table label: STOP 4 · MOLTING MYSTERY.",
      missionPrompt: "Look for the clue behind the “headless” trilobites."
    },
    fossil2: {
      name: "Stop 4 proxy",
      tableLabel: "Stop 4 · Molting Mystery",
      scenarioName: "Outgrowing a Skeleton",
      approved: true,
      promptAudit: "REFERENCE IMAGE OR MATCHING PROXY REQUIRED",
      referenceImage: "",
      referenceAlt: "",
      referenceCaption: "Look at the museum image.",
      noticeQuestion: "Why might a slab contain so many “headless” trilobite bodies?",
      noticeChoices: [
        {value:"predator",label:"A predator",detail:""},
        {value:"molts",label:"Shedding their shells",detail:""},
        {value:"unsure",label:"Not sure",detail:""}
      ],
      revealTitle: "They weren’t headless bodies after all.",
      revealText: "Trilobites grew by molting—crawling out of an old outer skeleton.",
      uncertaintyText: "While soft, they were vulnerable.",
      sourceText: "CMC Stop 4 · Catalogs IP52930 and IP87975",
      relatedObjectName: "Stop 5 · Mystery Donut",
      aiDayDirection: "Find the table label: STOP 5 · MYSTERY DONUT.",
      missionPrompt: "Make a guess before you see the answer."
    },
    fossil3: {
      name: "Stop 5 proxy",
      tableLabel: "Stop 5 · Mystery Donut",
      scenarioName: "Ordovician donut",
      approved: true,
      promptAudit: "REFERENCE IMAGE OR MATCHING PROXY REQUIRED",
      referenceImage: "",
      referenceAlt: "",
      referenceCaption: "Look at the museum image.",
      noticeQuestion: "How do you think this hole formed?",
      noticeChoices: [
        {value:"shell",label:"Around another shell",detail:""},
        {value:"growth",label:"It grew that way",detail:""},
        {value:"unsure",label:"Not sure",detail:""}
      ],
      revealTitle: "The mystery is real.",
      revealText: "This colony probably grew around a shell—but the shell left no trace.",
      uncertaintyText: "Scientists still don’t know exactly what happened.",
      sourceText: "CMC Stop 5 · Ordovician Donut · Catalog IP56360",
      relatedObjectName: "Stop 6 · Finale",
      aiDayDirection: "Continue to the STOP 6 · FINALE card.",
      missionPrompt: "Look for how life changed after the extinction."
    }
  },

  VISITOR_URL: "https://brandinealnku.github.io/coi-webai/fossil/",
  VISITOR_BLUE_URL: "https://brandinealnku.github.io/coi-webai/fossil/?design=blue",
  VISITOR_GOLD_URL: "https://brandinealnku.github.io/coi-webai/fossil/?design=gold"
};