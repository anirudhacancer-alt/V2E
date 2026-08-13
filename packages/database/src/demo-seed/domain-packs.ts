export type SiteTypeKind = "Residential" | "Commercial" | "Factory";

export type DemoDomainPack = {
  datasetPrefix: string;
  domain:
    | "ConstructionResidential"
    | "ConstructionCommercial"
    | "FactoryFMCGChocolate"
    | "FactoryMaintenance"
    | "RetailGoToMarket"
    | "WarehouseLogistics"
    | "VenueOperations"
    | "HealthcareOperations"
    | "NGOFieldOperations";
  bundleVariant:
    | "Residential"
    | "Commercial"
    | "Process"
    | "Packaging"
    | "Retail"
    | "Warehouse"
    | "Venue"
    | "Healthcare"
    | "NGO"
    | "Factory";
  siteType: SiteTypeKind;
  leadIdentity: {
    legacyRole: string;
    userId: string;
    email: string;
    name: string;
    teamMemberId?: string;
  };
  locationValidation: {
    forbiddenTerms: string[];
    requiredAll: string[];
    requiredAny?: string[];
  };
  contentGuidance: {
    domainLabel: string;
    taskFocus: string[];
    updateFocus: string[];
    bannedTerms: string[];
    mustUseTerms: string[];
  };
};

const COMMON_FACTORY_BANNED_TERMS = [
  "tower",
  "podium",
  "clubhouse",
  "unit stack",
  "balcony",
  "amenity deck",
  "tenant floor",
  "open office",
  "main lobby",
  "reception",
] as const;

const COMMON_FACTORY_MUST_USE_TERMS = [
  "batch",
  "line",
  "mould",
  "cooling tunnel",
  "qa release",
  "cip",
  "warehouse",
  "dispatch",
] as const;

export const DEMO_DATASET_PACKS: DemoDomainPack[] = [
  {
    datasetPrefix: "RES",
    domain: "ConstructionResidential",
    bundleVariant: "Residential",
    siteType: "Residential",
    leadIdentity: {
      legacyRole: "SiteSupervisor",
      userId: "bcea1e0f-b972-4f75-8563-c9f64aa9756f",
      email: "supervisor.gurugram@demo.local",
      name: "Narayanan",
    },
    locationValidation: {
      forbiddenTerms: ["Open Office", "Reception", "Tenant Floor", "Loading Dock"],
      requiredAll: ["Lift Lobby", "Amenity", "Parking", "Unit"],
      requiredAny: ["Tower", "Podium", "Clubhouse", "Basement"],
    },
    contentGuidance: {
      domainLabel: "residential construction",
      taskFocus: [
        "Use residential construction vocabulary.",
        "Prefer words like tower, podium, clubhouse, unit stack, balcony edge, amenity deck, lift lobby, staircase, parking bay, and pump room.",
        "Focus on work like masonry snagging, waterproofing, facade patching, unit finishing readiness, MEP coordination, and handover readiness.",
      ],
      updateFocus: [
        "The transcript should sound like a short field update from a site supervisor or crew lead.",
      ],
      bannedTerms: ["office floor", "factory", "batch", "callets", "chips", "cooling tunnel"],
      mustUseTerms: ["tower", "podium", "lift lobby", "parking bay"],
    },
  },
  {
    datasetPrefix: "COM",
    domain: "ConstructionCommercial",
    bundleVariant: "Commercial",
    siteType: "Commercial",
    leadIdentity: {
      legacyRole: "SiteSupervisor",
      userId: "bcea1e0f-b972-4f75-8563-c9f64aa9756f",
      email: "supervisor.gurugram@demo.local",
      name: "Narayanan",
    },
    locationValidation: {
      forbiddenTerms: ["Unit", "Amenity Deck", "Clubhouse", "Apartment"],
      requiredAll: [
        "Office Tower",
        "Main Lobby",
        "Open Office",
        "Plant Room",
        "Loading Dock",
      ],
    },
    contentGuidance: {
      domainLabel: "commercial construction",
      taskFocus: [
        "Use commercial construction vocabulary.",
        "Prefer words like office tower, podium, annex, central core, tenant floor, main lobby, west wing, east wing, meeting suite, server room, plant room, loading dock, and service yard.",
        "Focus on fit-out coordination, MEP readiness, false ceiling and lighting coordination, plant room clearance, and office-floor handover sequencing.",
      ],
      updateFocus: [
        "The transcript should sound like a short field update from a site supervisor or trade lead.",
      ],
      bannedTerms: ["apartment", "clubhouse", "factory", "batch", "callets", "cooling tunnel"],
      mustUseTerms: ["office tower", "plant room", "loading dock", "tenant floor"],
    },
  },
  {
    datasetPrefix: "PROC",
    domain: "FactoryFMCGChocolate",
    bundleVariant: "Process",
    siteType: "Factory",
    leadIdentity: {
      legacyRole: "ShiftSupervisor",
      userId: "80f1de64-5ef6-47c2-9ee8-d890b7536342",
      email: "shift.supervisor.factory@demo.local",
      name: "Aarush Mehta",
      teamMemberId: "4ab80f20-6850-44e2-ae7a-0e0ca9d3d6c8",
    },
    locationValidation: {
      forbiddenTerms: ["Tower", "Podium", "Clubhouse", "Open Office", "Tenant Floor"],
      requiredAll: [
        "Raw Material Store",
        "Mixing Hall",
        "Refining Room",
        "Tempering Bay",
        "Moulding Line",
        "Cooling Tunnel",
        "QA Lab",
        "CIP Station",
      ],
    },
    contentGuidance: {
      domainLabel: "fmcg chocolate factory process operations",
      taskFocus: [
        "Use FMCG chocolate factory process vocabulary.",
        "Focus on cocoa powder intake, mixing, refining, conching, tempering, moulding, cooling tunnel flow, CIP completion, QA release, and utility stability.",
        "Describe work in a plant context, not a construction or office context.",
      ],
      updateFocus: [
        "The transcript should sound like a short production-floor or shift-handover update.",
      ],
      bannedTerms: [...COMMON_FACTORY_BANNED_TERMS],
      mustUseTerms: [...COMMON_FACTORY_MUST_USE_TERMS, "cocoa powder", "tempering", "moulding"],
    },
  },
  {
    datasetPrefix: "PKG",
    domain: "FactoryFMCGChocolate",
    bundleVariant: "Packaging",
    siteType: "Factory",
    leadIdentity: {
      legacyRole: "ShiftSupervisor",
      userId: "80f1de64-5ef6-47c2-9ee8-d890b7536342",
      email: "shift.supervisor.factory@demo.local",
      name: "Aarush Mehta",
      teamMemberId: "4ab80f20-6850-44e2-ae7a-0e0ca9d3d6c8",
    },
    locationValidation: {
      forbiddenTerms: ["Tower", "Podium", "Clubhouse", "Open Office", "Tenant Floor"],
      requiredAll: [
        "Packaging Hall",
        "Bagging Line",
        "Carton Station",
        "Metal Detector",
        "Coding Station",
        "Palletising Zone",
        "Finished Goods Warehouse",
        "Dispatch Bay",
      ],
    },
    contentGuidance: {
      domainLabel: "fmcg chocolate factory packaging and dispatch operations",
      taskFocus: [
        "Use FMCG chocolate packaging and warehouse vocabulary.",
        "Focus on callets, drops, chips, chunks, bagging, cartoning, coding, metal detector checks, palletising, warehouse release, and dispatch readiness.",
        "Describe work in a factory packaging context, not a construction or office context.",
      ],
      updateFocus: [
        "The transcript should sound like a short packaging-floor, warehouse, or dispatch update.",
      ],
      bannedTerms: [...COMMON_FACTORY_BANNED_TERMS],
      mustUseTerms: [...COMMON_FACTORY_MUST_USE_TERMS, "callets", "chips", "chunks", "metal detector"],
    },
  },
  // ============================================================================
  // New Domain Packs - §18 Demo Dataset Expansion
  // ============================================================================
  {
    datasetPrefix: "FAC",
    domain: "FactoryMaintenance",
    bundleVariant: "Factory",
    siteType: "Factory",
    leadIdentity: {
      legacyRole: "MaintenanceLead",
      userId: "80f1de64-5ef6-47c2-9ee8-d890b7536342",
      email: "maintenance.lead@demo.local",
      name: "Suresh Kulkarni",
    },
    locationValidation: {
      forbiddenTerms: ["Tower", "Podium", "Clubhouse", "Open Office", "Tenant Floor", "Retail"],
      requiredAll: [
        "CNC Zone",
        "Assembly Line",
        "Compressor Room",
        "Electrical Room",
        "Tool Crib",
        "CMM Room",
      ],
    },
    contentGuidance: {
      domainLabel: "factory maintenance and equipment operations",
      taskFocus: [
        "Use factory maintenance and equipment vocabulary.",
        "Focus on CNC machine upkeep, preventive maintenance, tool calibration, spare parts management, and breakdown response.",
        "Track work orders, equipment inspections, and safety compliance.",
        "Include shift handovers and maintenance schedules.",
      ],
      updateFocus: [
        "The transcript should sound like a maintenance technician or supervisor reporting.",
      ],
      bannedTerms: ["tower", "podium", "clubhouse", "retail", "office", "tenant"],
      mustUseTerms: ["machine", "maintenance", "calibration", "spare", "breakdown", "tool"],
    },
  },
  {
    datasetPrefix: "RGM",
    domain: "RetailGoToMarket",
    bundleVariant: "Retail",
    siteType: "Commercial",
    leadIdentity: {
      legacyRole: "AreaSalesManager",
      userId: "a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d",
      email: "asm.retail@demo.local",
      name: "Priya Sharma",
    },
    locationValidation: {
      forbiddenTerms: ["Tower", "Podium", "Clubhouse", "Factory", "Batch", "Cooling Tunnel"],
      requiredAll: [
        "Store Front",
        "Checkout Zone",
        "Shelf Bay",
        "Cold Storage",
        "Backroom",
        "Promotion Display",
      ],
    },
    contentGuidance: {
      domainLabel: "retail go-to-market field execution (LASER + Perfect Store)",
      taskFocus: [
        "Use retail field execution vocabulary.",
        "Focus on LASER (Listing, Availability, Share of Shelf, Execution, Relationship) and Perfect Store compliance.",
        "Track shelf availability, planogram compliance, promotional display setup, stock rotation, and competitor activity.",
        "Include outlet visits, compliance audits, and merchandiser route coverage.",
      ],
      updateFocus: [
        "The transcript should sound like a field sales rep or merchandiser reporting from a retail outlet.",
      ],
      bannedTerms: ["factory", "batch", "mould", "cooling tunnel", "cip", "construction", "masonry"],
      mustUseTerms: ["shelf", "planogram", "outlet", "SKU", "facing", "promo", "availability"],
    },
  },
  {
    datasetPrefix: "WH",
    domain: "WarehouseLogistics",
    bundleVariant: "Warehouse",
    siteType: "Commercial",
    leadIdentity: {
      legacyRole: "WarehouseSupervisor",
      userId: "b2c3d4e5-f6a7-5b6c-9d8e-0f1a2b3c4d5e",
      email: "warehouse.supervisor@demo.local",
      name: "Vikram Patel",
    },
    locationValidation: {
      forbiddenTerms: ["Tower", "Podium", "Clubhouse", "Office Floor", "Retail Store"],
      requiredAll: [
        "Receiving Dock",
        "Putaway Zone",
        "Picking Area",
        "Packing Station",
        "Shipping Dock",
        "Cold Room",
        "Returns Bay",
      ],
    },
    contentGuidance: {
      domainLabel: "warehouse and distribution center operations",
      taskFocus: [
        "Use warehouse and logistics vocabulary.",
        "Focus on inbound receiving, putaway, picking, packing, shipping, inventory accuracy, and exception handling.",
        "Track dock scheduling, forklift operations, WMS compliance, and carrier coordination.",
        "Include shift handover, cycle counts, and damage reports.",
      ],
      updateFocus: [
        "The transcript should sound like a warehouse shift supervisor or dock coordinator.",
      ],
      bannedTerms: ["factory", "construction", "retail", "planogram", "mould", "cooling tunnel"],
      mustUseTerms: ["dock", "pallet", "pick", "putaway", "inventory", "shipment", "WMS"],
    },
  },
  {
    datasetPrefix: "VEN",
    domain: "VenueOperations",
    bundleVariant: "Venue",
    siteType: "Commercial",
    leadIdentity: {
      legacyRole: "VenueManager",
      userId: "c3d4e5f6-a7b8-6c7d-0e9f-1a2b3c4d5e6f",
      email: "venue.manager@demo.local",
      name: "Ananya Gupta",
    },
    locationValidation: {
      forbiddenTerms: ["Tower", "Podium", "Factory", "Warehouse", "Retail Store"],
      requiredAll: [
        "Main Hall",
        "VIP Lounge",
        "Backstage",
        "Control Room",
        "Entry Gate",
        "Concession Stand",
        "Restroom Block",
      ],
    },
    contentGuidance: {
      domainLabel: "venue and event operations",
      taskFocus: [
        "Use venue and event management vocabulary.",
        "Focus on event readiness, crowd management, AV setup, security protocols, and live incident response.",
        "Track load-in schedules, artist requirements, F&B operations, and emergency procedures.",
        "Include pre-event checklists, live incident reports, and post-event closure.",
      ],
      updateFocus: [
        "The transcript should sound like a venue operations manager or event coordinator.",
      ],
      bannedTerms: ["factory", "warehouse", "construction", "retail", "planogram", "batch"],
      mustUseTerms: ["event", "crowd", "security", "AV", "backstage", "gate", "incident"],
    },
  },
  {
    datasetPrefix: "HC",
    domain: "HealthcareOperations",
    bundleVariant: "Healthcare",
    siteType: "Commercial",
    leadIdentity: {
      legacyRole: "OperationsLead",
      userId: "d4e5f6a7-b8c9-7d8e-1f0a-2b3c4d5e6f7a",
      email: "ops.lead.healthcare@demo.local",
      name: "Dr. Rajesh Kumar",
    },
    locationValidation: {
      forbiddenTerms: ["Tower", "Podium", "Factory", "Warehouse", "Retail Store", "Venue"],
      requiredAll: [
        "Reception",
        "Waiting Area",
        "Examination Room",
        "Pharmacy",
        "Lab",
        "Storage Room",
        "Admin Office",
      ],
    },
    contentGuidance: {
      domainLabel: "healthcare non-clinical operations",
      taskFocus: [
        "Use healthcare operations vocabulary (non-clinical focus).",
        "Focus on facility readiness, equipment maintenance, supply chain, patient flow, and compliance checks.",
        "Track shift handovers, inventory management, cleaning schedules, and regulatory compliance.",
        "Include action tracking for operational issues, not clinical care.",
      ],
      updateFocus: [
        "The transcript should sound like a healthcare operations lead or facility coordinator.",
      ],
      bannedTerms: ["factory", "warehouse", "construction", "retail", "clinical diagnosis", "treatment"],
      mustUseTerms: ["facility", "equipment", "supply", "compliance", "handover", "maintenance"],
    },
  },
  {
    datasetPrefix: "NGO",
    domain: "NGOFieldOperations",
    bundleVariant: "NGO",
    siteType: "Commercial",
    leadIdentity: {
      legacyRole: "FieldCoordinator",
      userId: "e5f6a7b8-c9d0-8e9f-2a1b-3c4d5e6f7a8b",
      email: "field.coordinator.ngo@demo.local",
      name: "Meera Krishnan",
    },
    locationValidation: {
      forbiddenTerms: ["Tower", "Podium", "Factory", "Warehouse", "Retail Store", "Venue"],
      requiredAll: [
        "Field Site",
        "Community Center",
        "Distribution Point",
        "Mobile Unit",
        "Camp Office",
        "Registration Desk",
      ],
    },
    contentGuidance: {
      domainLabel: "NGO field operations and community outreach",
      taskFocus: [
        "Use NGO and humanitarian field operations vocabulary.",
        "Focus on field visits, beneficiary registration, distribution logistics, and escalation management.",
        "Track visit reports, coverage metrics, supply distribution, and community feedback.",
        "Include escalation protocols for urgent issues and impact reporting.",
      ],
      updateFocus: [
        "The transcript should sound like a field coordinator or community worker.",
      ],
      bannedTerms: ["factory", "warehouse", "construction", "retail", "commercial", "profit"],
      mustUseTerms: ["field", "community", "beneficiary", "distribution", "visit", "escalation"],
    },
  },
];

export const KNOWN_DATASET_KEYS_BY_CONTRACT: Record<string, string> = {
  "1328": "RES-1328",
  "1330": "COM-1330",
  "2101": "PROC-2101",
  "2102": "PKG-2102",
  "3101": "RGM-3101",
  "3102": "RGM-3102",
  "3201": "WH-3201",
  "3202": "FAC-3202",
  "3203": "VEN-3203",
  "3204": "HC-3204",
  "3205": "NGO-3205",
};

export function resolveDemoDatasetPack(datasetKey: string): DemoDomainPack {
  const normalized = datasetKey.trim().toUpperCase();
  const pack = DEMO_DATASET_PACKS.find((candidate) =>
    normalized.startsWith(`${candidate.datasetPrefix}-`) ||
    normalized === candidate.datasetPrefix
  );
  if (!pack) {
    throw new Error(`Unsupported demo dataset key "${datasetKey}"`);
  }
  return pack;
}
