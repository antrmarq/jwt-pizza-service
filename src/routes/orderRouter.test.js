const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
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

async function createFranchise() {
  const franchiseName = randomName();

  const newFranchise = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: franchiseName, admins: [{ email: adminUser.email }] });

  expect(newFranchise.status).toBe(200);
  franchise = newFranchise.body;
  return franchise;
}

async function createStore() {
  const storeName = randomName();

  const newStore = await request(app)
    .post(`/api/franchise/${franchise.id}/store`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: storeName });

  expect(newStore.status).toBe(200);
  expect(newStore.body).toHaveProperty("id");
  return newStore.body;
}

async function getMenu() {
  const menuRes = await request(app).get("/api/order/menu");

  expect(menuRes.status).toBe(200);
  expect(Array.isArray(menuRes.body)).toBe(true);
  return menuRes.body;
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

function randomPrice() {
  return parseFloat((Math.random() * 10).toFixed(2));
}

beforeAll(async () => {
  testUser.email = `${randomName()}@test.com`;

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

test("should retrieve the pizza menu", async () => {
  const menu = await getMenu();
  expect(menu.length).toBeGreaterThanOrEqual(0);
});

test("should add an item to the menu", async () => {
  const newTitle = randomName();
  const newDescription = randomName();
  const newPrice = randomPrice();

  const addMenu = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: newTitle,
      description: newDescription,
      image: "pizza9.png",
      price: newPrice,
    });

  expect(addMenu.status).toBe(200);
  expect(Array.isArray(addMenu.body)).toBe(true);
  expect(addMenu.body.some(item => item.title === newTitle)).toBe(true);
});

test("should retrieve orders for an authenticated user", async () => {
  const getOrder = await request(app)
    .get("/api/order")
    .set("Authorization", `Bearer ${adminToken}`);

  expect(getOrder.status).toBe(200);
  expect(getOrder.body).toHaveProperty("orders");
  expect(Array.isArray(getOrder.body.orders)).toBe(true);
});

test("should create an order for the authenticated user", async () => {
  const menu = await getMenu();
  expect(menu.length).toBeGreaterThan(0);
  
  const menuItem = menu[0];

  const newFranchise = await createFranchise();
  const newStore = await createStore();

  const createOrder = await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      franchiseId: newFranchise.id,
      storeId: newStore.id,
      items: [
        {
          menuId: menuItem.id,
          description: menuItem.description,
          price: menuItem.price,
        },
      ],
    });

  expect(createOrder.status).toBe(200);
  expect(createOrder.body).toHaveProperty("order");
  expect(createOrder.body.order.items.length).toBeGreaterThan(0);
});
