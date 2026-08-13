/**
 * Phase E Routes - Platform Entity CRUD - Vitest Tests
 *
 * Tests for:
 * - Users: GET/POST/PATCH /v1/users
 * - Departments: GET/POST/PATCH /v1/departments
 * - Roles: GET/POST/PATCH /v1/roles
 * - Locations: GET/POST/PATCH /v1/locations
 * - Sites: GET/POST/PATCH /v1/sites
 * - Members: GET/POST/PATCH /v1/members
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// Mock the database and env modules before importing routes
vi.mock("../db.js", () => ({
  getDemoDb: vi.fn(),
}));

vi.mock("../env.js", () => ({
  sqliteFileExists: vi.fn(),
  resolveSqlitePath: vi.fn(() => "/mock/path/demo.sqlite"),
  V2E_API_TOKEN: "test-token",
  V2E_API_USER_ID: "test-user-id",
  AI_GATEWAY_URL: "http://localhost:3001",
}));

vi.mock("../lib/audit.js", () => ({
  insertAuditEvent: vi.fn(),
}));

vi.mock("../lib/logger.js", () => ({
  opsLog: vi.fn(),
}));

import { getDemoDb } from "../db.js";
import { sqliteFileExists } from "../env.js";
import { usersRouter } from "./users.js";
import { departmentsRouter } from "./departments.js";
import { rolesRouter } from "./roles.js";
import { locationsRouter } from "./locations.js";
import { sitesRouter } from "./sites.js";
import { membersRouter } from "./members.js";

const mockedGetDemoDb = vi.mocked(getDemoDb);
const mockedSqliteFileExists = vi.mocked(sqliteFileExists);

// Auth header for authenticated requests
const authHeader = { Authorization: "Bearer test-token" };

// Mirror v1.ts Phase E mounts: platform CRUD + flat projects
const phaseEApp = new Hono();
phaseEApp.route("/users", usersRouter);
phaseEApp.route("/departments", departmentsRouter);
phaseEApp.route("/roles", rolesRouter);
phaseEApp.route("/locations", locationsRouter);
phaseEApp.route("/sites", sitesRouter);
phaseEApp.route("/members", membersRouter);

const app = new Hono();
app.route("/v1", phaseEApp);

// ============================================================================
// Test Data Fixtures
// ============================================================================

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  orgRoleCode: "FOREMAN",
  departmentCode: "ELECTRICAL",
  specialty: "Wiring",
  phone: "555-1234",
  employeeId: "EMP001",
  avatarUrl: null,
  preferencesPushNotificationsEnabled: "true",
  preferencesDarkModeEnabled: "false",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockRoleType = {
  id: "role-1",
  code: "FOREMAN",
  name: "Foreman",
  level: "Field",
  isManagerial: 0,
  isFieldBased: 1,
  isCrewRole: 0,
  isActive: 1,
  sortOrder: 10,
};

const mockDepartment = {
  id: "dept-1",
  code: "ELECTRICAL",
  name: "Electrical",
  category: "Execution",
  isSiteFunction: 0,
  isExecutionDiscipline: 1,
  isActive: 1,
  sortOrder: 10,
};

const mockSite = {
  id: "site-1",
  name: "Test Site",
  code: "SITE-001",
  address: "123 Test St",
  locationLatitude: null,
  locationLongitude: null,
  projectManagerId: "user-1",
  isActive: "true",
  metadata: "{}",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockProject = {
  id: "project-1",
  siteId: "site-1",
  code: "PRJ-001",
  name: "Test Project",
  description: "A test project",
  type: "construction",
  status: "active",
  isActive: "true",
  metadata: "{}",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockLocation = {
  id: "loc-1",
  projectId: "project-1",
  siteType: "Commercial",
  level1: "Building A",
  level2: "Floor 1",
  level3: null,
  level4: null,
  displayLabel: "Building A > Floor 1",
  listLabel: "Building A · Floor 1",
  isActive: 1,
  sortOrder: 10,
};

const mockTeamMember = {
  id: "member-1",
  siteId: "site-1",
  userId: "user-1",
  name: "Test Member",
  orgRoleCode: "FOREMAN",
  departmentCode: "ELECTRICAL",
  specialty: "Wiring",
  reportsToUserId: null,
  email: "member@example.com",
  phone: "555-5678",
  isActive: "true",
  joinedAt: "2024-01-01",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

// ============================================================================
// Helper Functions
// ============================================================================

function createMockDb(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve([])),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    ...overrides,
  };
}

function createSequentialSelectMock(responses: unknown[][]) {
  let callIndex = 0;
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => {
        const response = responses[callIndex] ?? [];
        callIndex++;
        return Promise.resolve(response);
      }),
    }),
  });
}

// ============================================================================
// Users Tests
// ============================================================================

describe("Phase E Users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /v1/users", () => {
    it("returns list of users", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(Promise.resolve([mockUser])),
      });
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/users");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.total).toBeDefined();
    });

    it("returns 503 when DB not ready", async () => {
      mockedSqliteFileExists.mockReturnValue(false);

      const res = await app.request("/v1/users");

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error.code).toBe("DB_NOT_FOUND");
    });
  });

  describe("GET /v1/users/:userId", () => {
    it("returns a single user", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[mockUser]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/users/user-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("user-1");
    });

    it("returns 404 for non-existent user", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/users/non-existent");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /v1/users", () => {
    it("creates a user and returns 201", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([
        [mockRoleType],  // role lookup
        [mockDepartment], // department lookup
      ]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/users", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new@example.com",
          name: "New User",
          orgRoleCode: "FOREMAN",
          departmentCode: "ELECTRICAL",
          phone: "555-9999",
          employeeId: "EMP002",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.email).toBe("new@example.com");
    });

    it("returns 400 for missing required fields", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/users", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          // Missing: name, orgRoleCode, phone, employeeId
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details.missingFields).toBeDefined();
    });

    it("returns 400 for invalid orgRoleCode", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);  // role not found
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/users", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          name: "Test",
          orgRoleCode: "INVALID_ROLE",
          phone: "555-1234",
          employeeId: "EMP001",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("orgRoleCode not found");
    });

    it("returns 401 without auth header", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const res = await app.request("/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          name: "Test",
          orgRoleCode: "FOREMAN",
          phone: "555-1234",
          employeeId: "EMP001",
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /v1/users/:userId", () => {
    it("updates a user and returns 200", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[mockUser]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/users/user-1", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Updated Name");
    });

    it("returns 404 for non-existent user", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/users/non-existent", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(res.status).toBe(404);
    });
  });
});

// ============================================================================
// Departments Tests
// ============================================================================

describe("Phase E Departments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /v1/departments", () => {
    it("returns list of departments with boolean conversion", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(Promise.resolve([mockDepartment])),
      });
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/departments");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data[0].isExecutionDiscipline).toBe(true);
      expect(body.data[0].isActive).toBe(true);
    });
  });

  describe("GET /v1/departments/:departmentId", () => {
    it("returns a single department", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[mockDepartment]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/departments/dept-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("dept-1");
      expect(body.isActive).toBe(true);
    });

    it("returns 404 for non-existent department", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/departments/non-existent");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /v1/departments", () => {
    it("creates a department and returns 201", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);  // no duplicate code
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/departments", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "PLUMBING",
          name: "Plumbing",
          category: "Execution",
          sortOrder: 20,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.code).toBe("PLUMBING");
      expect(body.isActive).toBe(true);
    });

    it("returns 409 for duplicate code", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[{ id: "existing" }]]);  // duplicate code
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/departments", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "ELECTRICAL",
          name: "Duplicate",
          category: "Execution",
          sortOrder: 20,
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.message).toContain("already exists");
    });
  });

  describe("PATCH /v1/departments/:departmentId", () => {
    it("updates a department", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[mockDepartment]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/departments/dept-1", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Electrical",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Updated Electrical");
    });
  });
});

// ============================================================================
// Role Types Tests
// ============================================================================

describe("Phase E Role Types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /v1/roles", () => {
    it("returns list of role types", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(Promise.resolve([mockRoleType])),
      });
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/roles");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data[0].isFieldBased).toBe(true);
    });
  });

  describe("POST /v1/roles", () => {
    it("creates a role type and returns 201", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);  // no duplicate code
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/roles", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "SITE_MANAGER",
          name: "Site Manager",
          level: "Management",
          sortOrder: 5,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.code).toBe("SITE_MANAGER");
    });

    it("returns 400 for invalid code format", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/roles", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "invalid-code",  // not SCREAMING_SNAKE_CASE
          name: "Invalid",
          level: "Field",
          sortOrder: 10,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain("SCREAMING_SNAKE_CASE");
    });
  });
});

// ============================================================================
// Locations Tests
// ============================================================================

describe("Phase E Locations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /v1/locations", () => {
    it("returns 400 when projectId is missing", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/locations");

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("projectId");
    });

    it("returns list of locations when projectId is provided", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(Promise.resolve([mockLocation])),
        }),
      });
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/locations?projectId=project-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
    });
  });

  describe("GET /v1/locations/:locationId", () => {
    it("returns a single location", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[mockLocation]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/locations/loc-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("loc-1");
      expect(body.isActive).toBe(true);
    });
  });

  describe("POST /v1/locations", () => {
    it("creates a location and returns 201", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[mockProject]]);  // project exists
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/locations", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "project-1",
          siteType: "Commercial",
          level1: "Building B",
          sortOrder: 20,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.level1).toBe("Building B");
      expect(body.displayLabel).toBeDefined();
    });

    it("returns 400 for invalid projectId", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);  // project not found
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/locations", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "invalid-project",
          siteType: "Commercial",
          level1: "Building B",
          sortOrder: 20,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain("projectId not found");
    });
  });
});

// ============================================================================
// Sites Tests
// ============================================================================

describe("Phase E Sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /v1/sites", () => {
    it("returns list of sites", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(Promise.resolve([mockSite])),
      });
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/sites");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
    });
  });

  describe("POST /v1/sites", () => {
    it("creates a site and returns 201", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[mockUser]]);  // projectManagerId exists
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/sites", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Site",
          code: "SITE-002",
          address: "456 New St",
          projectManagerId: "user-1",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.code).toBe("SITE-002");
    });

    it("returns 400 for invalid projectManagerId", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);  // user not found
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/sites", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Site",
          code: "SITE-002",
          address: "456 New St",
          projectManagerId: "invalid-user",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain("projectManagerId not found");
    });
  });
});

// ============================================================================
// Team Members Tests
// ============================================================================

describe("Phase E Team Members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /v1/members", () => {
    it("returns list of team members", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(Promise.resolve([mockTeamMember])),
      });
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/members");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data[0].userId).toBe("user-1");
    });

    it("accepts userId as a list filter", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockTeamMember]),
        }),
      });
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/members?userId=user-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].userId).toBe("user-1");
    });
  });

  describe("POST /v1/members", () => {
    it("creates a team member and returns 201", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([
        [mockSite],       // siteId exists
        [mockRoleType],   // orgRoleCode exists
        [mockUser],       // userId exists
        [mockDepartment], // departmentCode exists
      ]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/members", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: "site-1",
          userId: "user-1",
          name: "New Member",
          orgRoleCode: "FOREMAN",
          departmentCode: "ELECTRICAL",
          joinedAt: "2024-01-15",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("New Member");
      expect(body.userId).toBe("user-1");
    });

    it("returns 400 for invalid siteId", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);  // site not found
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/members", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: "invalid-site",
          name: "New Member",
          orgRoleCode: "FOREMAN",
          joinedAt: "2024-01-15",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain("siteId not found");
    });

    it("returns 400 for invalid orgRoleCode", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([
        [mockSite],  // site exists
        [],          // role not found
      ]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/members", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: "site-1",
          name: "New Member",
          orgRoleCode: "INVALID_ROLE",
          joinedAt: "2024-01-15",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain("orgRoleCode not found");
    });

    it("returns 400 for invalid userId", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([
        [mockSite],
        [mockRoleType],
        [],
      ]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/members", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: "site-1",
          userId: "missing-user",
          name: "New Member",
          orgRoleCode: "FOREMAN",
          joinedAt: "2024-01-15",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain("userId not found");
    });
  });

  describe("PATCH /v1/members/:teamMemberId", () => {
    it("updates a team member", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([
        [mockTeamMember],
        [mockUser],
      ]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/members/member-1", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Member",
          userId: "user-1",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Updated Member");
      expect(body.userId).toBe("user-1");
    });

    it("returns 404 for non-existent team member", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/members/non-existent", {
        method: "PATCH",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      });

      expect(res.status).toBe(404);
    });
  });
});

// ============================================================================
// DB Not Ready Tests (shared across all endpoints)
// ============================================================================

describe("Phase E - DB Not Ready (503)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSqliteFileExists.mockReturnValue(false);
  });

  it("GET /v1/users returns 503", async () => {
    const res = await app.request("/v1/users");
    expect(res.status).toBe(503);
  });

  it("GET /v1/departments returns 503", async () => {
    const res = await app.request("/v1/departments");
    expect(res.status).toBe(503);
  });

  it("GET /v1/roles returns 503", async () => {
    const res = await app.request("/v1/roles");
    expect(res.status).toBe(503);
  });

  it("GET /v1/sites returns 503", async () => {
    const res = await app.request("/v1/sites");
    expect(res.status).toBe(503);
  });

  it("GET /v1/members returns 503", async () => {
    const res = await app.request("/v1/members");
    expect(res.status).toBe(503);
  });

  it("POST /v1/users returns 503", async () => {
    const res = await app.request("/v1/users", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    expect(res.status).toBe(503);
  });
});

// ============================================================================
// Auth Tests (shared pattern)
// ============================================================================

describe("Phase E - Auth Required (401)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSqliteFileExists.mockReturnValue(true);
  });

  const postRoutes = [
    "/v1/users",
    "/v1/departments",
    "/v1/roles",
    "/v1/locations",
    "/v1/sites",
    "/v1/members",
  ];

  postRoutes.forEach((route) => {
    it(`POST ${route} returns 401 without auth`, async () => {
      const res = await app.request(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });
  });

  const patchRoutes = [
    "/v1/users/user-1",
    "/v1/departments/dept-1",
    "/v1/roles/role-1",
    "/v1/locations/loc-1",
    "/v1/sites/site-1",
    "/v1/members/member-1",
  ];

  patchRoutes.forEach((route) => {
    it(`PATCH ${route} returns 401 without auth`, async () => {
      const res = await app.request(route, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });
  });
});
