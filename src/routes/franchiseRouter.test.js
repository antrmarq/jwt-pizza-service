const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let adminToken;
let adminUser;
let franchise;

async function createAdminUser() {
  const user = {
    name: randomName(),
    email: `${randomName()}@admin.com`,
    password: "toomanysecrets",
    roles: [{ role: Role.Admin }],
  };

  const addedUser = await DB.addUser(user);
  return { ...addedUser, password: user.password };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createStore() {
  const storeName = randomName();
  
  const newStore = await request(app)
    .post(`/api/franchise/${franchise.id}/store`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: storeName });

  expect(newStore.status).toBe(200);
  expect(newStore.body).toHaveProperty("id");
  expect(newStore.body.name).toBe(storeName);

  return newStore.body;
}

beforeAll(async () => {
  testUser.email = `${randomName()}@test.com`;
  const registerRes = await request(app).post("/api/auth").send(testUser);
  expect(registerRes.status).toBe(200);
  testUserAuthToken = registerRes.body.token;

  // Create Admin
  const newAdmin = await createAdminUser();
  const adminLogin = await request(app).put("/api/auth").send({
    email: newAdmin.email,
    password: "toomanysecrets",
  });

  expect(adminLogin.status).toBe(200);
  adminToken = adminLogin.body.token;
  adminUser = adminLogin.body.user;
});

beforeEach(async () => {
  const franchiseName = randomName();

  const franchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: franchiseName, admins: [{ email: adminUser.email }] });

  expect(franchiseRes.status).toBe(200);
  franchise = franchiseRes.body;
});

test("should list all franchises", async () => {
  const franRes = await request(app).get("/api/franchise");

  expect(franRes.status).toBe(200);
  expect(Array.isArray(franRes.body)).toBe(true);
});

test("should list franchises for a specific user", async () => {
  const userFranchises = await request(app)
    .get(`/api/franchise/${adminUser.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expect(userFranchises.status).toBe(200);
  expect(Array.isArray(userFranchises.body)).toBe(true);
});

test("should create a new franchise", async () => {
  const franchiseName = randomName();

  const createFranchise = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: franchiseName, admins: [{ email: adminUser.email }] });

  expect(createFranchise.status).toBe(200);
  expect(createFranchise.body).toHaveProperty("id");
  expect(createFranchise.body.name).toBe(franchiseName);
});

test("should prevent non-admin users from creating a franchise", async () => {
  const franchiseName = randomName();

  const createFranchise = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send({ name: franchiseName, admins: [{ email: adminUser.email }] });

  expect(createFranchise.status).toBe(403);
  expect(createFranchise.body.message).toBe("unable to create a franchise");
});

test("should delete a franchise", async () => {
  const deleteFranchise = await request(app)
    .delete(`/api/franchise/${franchise.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expect(deleteFranchise.status).toBe(200);
  expect(deleteFranchise.body.message).toBe("franchise deleted");
});

test("should create a new store under a franchise", async () => {
  const store = await createStore();
  expect(store).toHaveProperty("id");
});

test("should delete a store from a franchise", async () => {
  const store = await createStore();

  const deleteStore = await request(app)
    .delete(`/api/franchise/${franchise.id}/store/${store.id}`)
    .set("Authorization", `Bearer ${adminToken}`);

  expect(deleteStore.status).toBe(200);
  expect(deleteStore.body.message).toBe("store deleted");
});
