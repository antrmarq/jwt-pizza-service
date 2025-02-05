const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let adminToken;
let adminUser;

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

beforeAll(async () => {
  const newAdmin = await createAdminUser();
  const adminLogin = await request(app).put("/api/auth").send({
    email: newAdmin.email,
    password: "toomanysecrets",
  });

  expect(adminLogin.status).toBe(200);
  adminToken = adminLogin.body.token;
  adminUser = adminLogin.body.user;
});

test("should fail to register a user with missing fields", async () => {
  const incompleteUser = { name: "David Bowie", email: "wrongo@mail.com" };
  const res = await request(app).post("/api/auth").send(incompleteUser);
  expect(res.status).toBe(400);
  expect(res.body.message).toBe("name, email, and password are required");
});

test("should register and login a user successfully", async () => {
  testUser.email = `${randomName()}@test.com`;
  
  const registerRes = await request(app).post("/api/auth").send(testUser);
  expect(registerRes.status).toBe(200);
  expect(registerRes.body.user.email).toBe(testUser.email);

  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );

  expect(loginRes.body.user).toMatchObject({
    name: testUser.name,
    email: testUser.email,
    roles: [{ role: "diner" }],
  });
});

test("should allow an admin to update their password", async () => {
  const newPassword = "1234";

  const updateRes = await request(app)
    .put(`/api/auth/${adminUser.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email: adminUser.email, password: newPassword });

  expect(updateRes.status).toBe(200);
  expect(updateRes.body.email).toBe(adminUser.email);
});

test("should successfully log out a user", async () => {
  const logoutRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${adminToken}`);

  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe("logout successful");

  const invalidLogout = await request(app)
    .delete("/api/auth")
    .set("Authorization", "Bearer invalidtoken");

  expect(invalidLogout.status).toBe(401);
  expect(invalidLogout.body.message).toBe("unauthorized");
});
