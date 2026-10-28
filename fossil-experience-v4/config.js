window.CMC_V4_CONFIG = {
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbz3XFh57ivklNRHKoVu1DMnfDgCv8pW0sQKAcCwDQJa8U0f0qAcUSDcaPWa4re_9wMHIw/exec",
  GOOGLE_SHEET_URL: "https://docs.google.com/spreadsheets/d/14e7XkQCSgtAwCrXhWVYWou3ARAR_9AZtZe4uvXl1-es/edit",
  EVENT_NAME: "NKU AI Day 2026",
  SPECIMENS: {
    fossil1: {
      name: "Route Stop 1",
      shortName: "Route Stop 1",
      proxyLabel: "AI Day proxy artifact",
      approved: true,
      routePosition: 1,
      catalogNumber: "IP87827",
      stopName: "Stop 1 · Cincinnati Under the Sea",
      scenarioName: "Cincinnati city fossil",
      noticeQuestion: "What does this body shape remind you of?",
      noticeChoices: [
        {value:"star",label:"A star",detail:"A five-part, star-like body plan"},
        {value:"disc",label:"A round disc",detail:"A low, plate-like overall form"},
        {value:"other",label:"Something else",detail:"Another detail stands out first"}
      ],
      revealTitle: "That resemblance is a clue.",
      revealText: "This animal was related to starfish and lived in Cincinnati’s ancient sea.",
      uncertaintyText: "",
      sourceText: "AI Day route simulation · CMC Stop 1 · Catalog IP87827",
      relatedObjectName: "Outgrowing a Skeleton",
      relatedCatalogNumber: "",
      relatedStop: "Stop 4 · Right of the seafloor slab graphic",
      relatedObjectReason: "Next, see how trilobites grew by shedding their outer skeletons.",
      missionPrompt: "Look for the clue behind the “headless” trilobites."
    },
    fossil2: {
      name: "Route Stop 4",
      shortName: "Route Stop 4",
      proxyLabel: "AI Day proxy artifact",
      approved: true,
      routePosition: 2,
      catalogNumber: "IP52930 / IP87975",
      stopName: "Stop 4 · Outgrowing a Skeleton slab case",
      scenarioName: "Outgrowing a Skeleton",
      noticeQuestion: "Why might a slab contain so many ‘headless’ trilobite bodies?",
      noticeChoices: [
        {value:"predator",label:"A predator attacked them",detail:"Something removed the heads"},
        {value:"molts",label:"They shed their old shells",detail:"The bodies may be molts, not dead animals"},
        {value:"unsure",label:"I’m not sure",detail:"The fossil evidence is puzzling"}
      ],
      revealTitle: "They weren’t headless bodies after all.",
      revealText: "Trilobites grew by molting—crawling out of an old outer skeleton.",
      uncertaintyText: "While soft, they were vulnerable.",
      sourceText: "AI Day route simulation · CMC Stop 4 · Catalogs IP52930 and IP87975",
      relatedObjectName: "Ordovician donuts",
      relatedCatalogNumber: "IP56360 / IP56362",
      relatedStop: "Stop 5 · Ramp stairs, left of the middle case",
      relatedObjectReason: "You just saw growth we can explain. Next comes growth we still can’t.",
      missionPrompt: "Make a guess before you see the answer."
    },
    fossil3: {
      name: "Route Stop 5",
      shortName: "Route Stop 5",
      proxyLabel: "AI Day proxy artifact",
      approved: true,
      routePosition: 3,
      catalogNumber: "IP56360",
      stopName: "Stop 5 · Ordovician donuts",
      scenarioName: "Ordovician donut",
      noticeQuestion: "What do you think once filled the hole?",
      noticeChoices: [
        {value:"shell",label:"Another animal’s shell",detail:"Something may have occupied the center"},
        {value:"growth",label:"It grew that way",detail:"The colony may have formed the opening itself"},
        {value:"mystery",label:"I can’t tell",detail:"The shape leaves an open question"}
      ],
      revealTitle: "The mystery is real.",
      revealText: "This colony probably grew around a shell—but the shell left no trace.",
      uncertaintyText: "Scientists still don’t know exactly what happened.",
      sourceText: "AI Day route simulation · CMC Stop 5 · Catalog IP56360",
      relatedObjectName: "Silurian–Devonian case",
      relatedCatalogNumber: "",
      relatedStop: "Stop 6 · After the DNA lab, first case facing the ramp",
      relatedObjectReason: "The final stop jumps forward to life after the Ordovician extinction.",
      missionPrompt: "Look for how life changed after the extinction."
    }
  },
  TEST_SPECIMENS: {
    fossil1: {
      name: "Cincinnati city fossil",
      shortName: "City fossil",
      approved: true,
      routePosition: 1,
      catalogNumber: "IP87827",
      stopName: "Stop 1 · Cincinnati Under the Sea",
      noticeQuestion: "What does this body shape remind you of?",
      noticeChoices: [
        {value:"star",label:"A star",detail:"A five-part, star-like body plan"},
        {value:"disc",label:"A round disc",detail:"A low, plate-like overall form"},
        {value:"other",label:"Something else",detail:"Another detail stands out first"}
      ],
      revealTitle: "That resemblance is a clue.",
      revealText: "This animal was related to starfish and lived in Cincinnati’s ancient sea.",
      uncertaintyText: "",
      sourceText: "CMC gallery panel · Catalog IP87827",
      relatedObjectName: "Outgrowing a Skeleton",
      relatedCatalogNumber: "",
      relatedStop: "Stop 4 · Right of the seafloor slab graphic",
      relatedObjectReason: "Next, see how trilobites grew by shedding their outer skeletons.",
      missionPrompt: "Look for the clue behind the “headless” trilobites."
    },
    fossil2: {
      name: "Outgrowing a Skeleton",
      shortName: "Molting mystery",
      approved: true,
      routePosition: 2,
      catalogNumber: "IP52930 / IP87975",
      stopName: "Stop 4 · Outgrowing a Skeleton slab case",
      noticeQuestion: "Why might a slab contain so many ‘headless’ trilobite bodies?",
      noticeChoices: [
        {value:"predator",label:"A predator attacked them",detail:"Something removed the heads"},
        {value:"molts",label:"They shed their old shells",detail:"The bodies may be molts, not dead animals"},
        {value:"unsure",label:"I’m not sure",detail:"The fossil evidence is puzzling"}
      ],
      revealTitle: "They weren’t headless bodies after all.",
      revealText: "Trilobites grew by molting—crawling out of an old outer skeleton.",
      uncertaintyText: "While soft, they were vulnerable.",
      sourceText: "CMC gallery panels · Catalogs IP52930 and IP87975",
      relatedObjectName: "Ordovician donuts",
      relatedCatalogNumber: "IP56360 / IP56362",
      relatedStop: "Stop 5 · Ramp stairs, left of the middle case",
      relatedObjectReason: "You just saw growth we can explain. Next comes growth we still can’t.",
      missionPrompt: "Make a guess before you see the answer."
    },
    fossil3: {
      name: "Ordovician donut",
      shortName: "Mystery donut",
      approved: true,
      routePosition: 3,
      catalogNumber: "IP56360",
      stopName: "Stop 5 · Ordovician donuts",
      noticeQuestion: "What do you think once filled the hole?",
      noticeChoices: [
        {value:"shell",label:"Another animal’s shell",detail:"Something may have occupied the center"},
        {value:"growth",label:"It grew that way",detail:"The colony may have formed the opening itself"},
        {value:"mystery",label:"I can’t tell",detail:"The shape leaves an open question"}
      ],
      revealTitle: "The mystery is real.",
      revealText: "This colony probably grew around a shell—but the shell left no trace.",
      uncertaintyText: "Scientists still don’t know exactly what happened.",
      sourceText: "CMC gallery panel · Catalog IP56360",
      relatedObjectName: "Silurian–Devonian case",
      relatedCatalogNumber: "",
      relatedStop: "Stop 6 · After the DNA lab, first case facing the ramp",
      relatedObjectReason: "The final stop jumps forward to life after the Ordovician extinction.",
      missionPrompt: "Look for how life changed after the extinction."
    }
  },
  VISITOR_URL: "https://brandinealnku.github.io/coi-webai/fossil/"
};