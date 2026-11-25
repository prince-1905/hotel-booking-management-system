/* eslint-disable */
// LuxeStay demo seed: resets the local DB from sql/local_setup.sql, then adds
// hotels with photos, room types, rooms, staff, guests and ~1 year of bookings
// (payments, invoices, incidentals, ID checks) so every page and dashboard has data.
//
//   npm run db:seed
//
// Dates are relative to today, so the data stays "fresh" whenever you re-run it.
// Output is deterministic (seeded RNG). All seeded users share the password Password@123.
//
// Hosted DB (e.g. TiDB Cloud): put its credentials in a git-ignored file and run
//   npm run db:seed -- --env .env.production --force

const fs = require("fs");
const path = require("path");
const envIdx = process.argv.indexOf("--env");
const envFile = envIdx > -1 ? process.argv[envIdx + 1] : ".env";
require("dotenv").config({ path: path.resolve(process.cwd(), envFile), quiet: true });
const mysql = require("mysql2/promise");

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];
if (!LOCAL_HOSTS.includes(process.env.DB_HOST) && !process.argv.includes("--force")) {
  console.error(`Refusing to reset non-local DB_HOST "${process.env.DB_HOST}" (from ${envFile}). This WIPES the database. Pass --force if you really mean it.`);
  process.exit(1);
}
console.log(`Seeding ${process.env.DB_HOST}/${process.env.DB_NAME} (env: ${envFile})`);

// ---------- helpers ----------
let seed = 20261125;
const rand = () => { // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

const img = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const cover = (id) => img(id, 1600);
const roomImg = (id) => img(id, 900);
const logo = (name, bg) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=128&bold=true&format=png`;

const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const day = (offset) => { const d = new Date(TODAY); d.setDate(d.getDate() + offset); return d; };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dt = (offset, hour = 12, min = 0) => { const d = day(offset); d.setHours(hour, min, 0, 0); return d; };

// ---------- lookup ids (must match sql/local_setup.sql) ----------
const ROLE = { ADMIN: 2, FRONT_DESK: 3, GUEST: 4 };
const ROOM = { AVAILABLE: 1, OCCUPIED: 2, DIRTY: 3, MAINTENANCE: 4 };
const BK = { CONFIRMED: 2, CHECKED_IN: 3, CHECKED_OUT: 4, CANCELLED: 5 };
const SRC = { ONLINE: 1, WALK_IN: 2, PHONE: 3 };
const PM = { CASH: 1, CARD: 2, UPI: 3 };
const PS = { SUCCESS: 2, REFUNDED: 4 };
const TAX_RATE = 0.12; // same as src/modules/invoices/services/invoice.service.ts

// ---------- catalog ----------
const NEW_AMENITIES = ["Spa", "Room Service", "Mini Bar", "Sea View", "Mountain View", "Balcony", "Bathtub", "Smart TV", "Airport Shuttle", "Restaurant"];

// hotel 1 and 2 already exist in local_setup.sql: we only add images / extra room types to them.
const EXISTING = [
  {
    hotel_id: 1, short: "palace", cover: "1564501049412-61c2a3083791", color: "1e293b",
    typePhotos: { Standard: "1631049307264-da0ec9d70304", Deluxe: "1590490360182-c33d57733427", Suite: null },
    extraTypes: [
      { name: "Executive Suite", desc: "Separate living area, work desk and city views over the Sabarmati.", price: 8500, a: 3, c: 2, photo: "1598928506311-c55ded91a20c", amen: ["WiFi", "AC", "Breakfast", "Mini Bar", "Smart TV", "Bathtub"], rooms: 3, floor: 3 },
    ],
    staff: null, // admin@hbms.local / frontdesk@hbms.local already exist
  },
  {
    hotel_id: 2, short: "seaview", cover: "1584132967334-10e028bd69f7", color: "0e7490",
    typePhotos: { Suite: "1578683010236-d716f9a3f461" },
    extraTypes: [
      { name: "Sea Facing Deluxe", desc: "Floor-to-ceiling windows facing the Arabian Sea.", price: 6200, a: 2, c: 1, photo: "1591088398332-8a7791972843", amen: ["WiFi", "AC", "Sea View", "Breakfast", "Smart TV"], rooms: 5, floor: 2 },
    ],
    staff: { admin: ["Rohan", "Kapoor"], fd: ["Sneha", "Iyer"] },
  },
];

const HOTELS = [
  {
    name: "The Aravalli Palace", slug: "aravalli-palace", short: "aravalli", city: "Udaipur", state: "Rajasthan",
    address: "Lake Pichola Road", phone: "9000000003", color: "92400e", cover: "1542314831-068cd1dbfeeb",
    staff: { admin: ["Vikram", "Singh"], fd: ["Pooja", "Rathore"] },
    types: [
      { name: "Heritage Room", desc: "Hand-carved furniture and jharokha windows in the old wing.", price: 5200, a: 2, c: 1, photo: "1566665797739-1674de7a421a", amen: ["WiFi", "AC", "Breakfast", "Smart TV"], rooms: 5, floor: 1 },
      { name: "Lake View Deluxe", desc: "Wake up to sunrise over Lake Pichola from your private balcony.", price: 8900, a: 3, c: 1, photo: "1505693416388-ac5ce068fe85", amen: ["WiFi", "AC", "Breakfast", "Balcony", "Bathtub"], rooms: 4, floor: 2 },
      { name: "Royal Suite", desc: "Two-room suite with a lounge, butler service and palace views.", price: 18500, a: 4, c: 2, photo: "1590381105924-c72589b9ef3f", amen: ["WiFi", "AC", "Breakfast", "Pool", "Spa", "Mini Bar", "Room Service"], rooms: 2, floor: 3 },
    ],
  },
  {
    name: "Coral Bay Resort", slug: "coral-bay-resort", short: "coralbay", city: "Goa", state: "Goa",
    address: "Calangute Beach Road", phone: "9000000004", color: "0f766e", cover: "1563911302283-d2bc129e7570",
    staff: { admin: ["Anita", "D'Souza"], fd: ["Kevin", "Fernandes"] },
    types: [
      { name: "Garden Cottage", desc: "Wood-panelled cottage tucked into a tropical garden.", price: 4800, a: 2, c: 1, photo: "1611892440504-42a792e24d32", amen: ["WiFi", "AC", "Breakfast", "Pool"], rooms: 6, floor: 1 },
      { name: "Pool View Deluxe", desc: "Sun-lit room opening straight onto the lagoon pool.", price: 7200, a: 3, c: 1, photo: "1582719478250-c89cae4dc85b", amen: ["WiFi", "AC", "Breakfast", "Pool", "Balcony"], rooms: 4, floor: 1 },
      { name: "Beach Villa", desc: "Private villa a few steps from the sand, with an outdoor deck.", price: 14500, a: 4, c: 2, photo: "1602002418082-a4443e081dd1", amen: ["WiFi", "AC", "Breakfast", "Pool", "Sea View", "Spa", "Mini Bar"], rooms: 3, floor: 1 },
    ],
  },
  {
    name: "Palm Grove Beach Resort", slug: "palm-grove-beach-resort", short: "palmgrove", city: "Goa", state: "Goa",
    address: "Candolim Fort Road", phone: "9000000005", color: "15803d", cover: "1610641818989-c2051b5e2cfd",
    staff: { admin: ["Rahul", "Naik"], fd: ["Maria", "Pereira"] },
    types: [
      { name: "Standard Room", desc: "Bright and airy room, a short walk from the beach.", price: 3600, a: 2, c: 1, photo: "1576354302919-96748cb8299e", amen: ["WiFi", "AC", "Pool"], rooms: 6, floor: 1 },
      { name: "Deluxe Room", desc: "Larger room with a sitting area and garden views.", price: 5400, a: 2, c: 2, photo: "1540518614846-7eded433c457", amen: ["WiFi", "AC", "Pool", "Breakfast", "Smart TV"], rooms: 4, floor: 2 },
      { name: "Family Room", desc: "Two queen beds and space for the whole family.", price: 6900, a: 4, c: 2, photo: "1595576508898-0ad5c879a061", amen: ["WiFi", "AC", "Pool", "Breakfast", "Parking"], rooms: 3, floor: 2 },
    ],
  },
  {
    name: "Backwater Bliss Retreat", slug: "backwater-bliss-retreat", short: "backwater", city: "Alleppey", state: "Kerala",
    address: "Punnamada Lake", phone: "9000000006", color: "166534", cover: "1520250497591-112f2f40a3f4",
    staff: { admin: ["Arjun", "Menon"], fd: ["Lakshmi", "Nair"] },
    types: [
      { name: "Lake Cottage", desc: "Teak cottage on the backwaters with a private sit-out.", price: 6100, a: 2, c: 1, photo: "1584132915807-fd1f5fbc078f", amen: ["WiFi", "AC", "Breakfast", "Balcony"], rooms: 5, floor: 1 },
      { name: "Ayurveda Pool Villa", desc: "Spacious villa with a plunge pool and daily Ayurveda session.", price: 12800, a: 3, c: 2, photo: "1618221195710-dd6b41faaea6", amen: ["WiFi", "AC", "Breakfast", "Pool", "Spa", "Room Service"], rooms: 3, floor: 1 },
    ],
  },
  {
    name: "Skyline Suites", slug: "skyline-suites", short: "skyline", city: "Bengaluru", state: "Karnataka",
    address: "45 MG Road", phone: "9000000007", color: "4338ca", cover: "1615460549969-36fa19521a4f",
    staff: { admin: ["Karthik", "Rao"], fd: ["Divya", "Shetty"] },
    types: [
      { name: "Business Room", desc: "Quiet, efficient room with a full-size work desk.", price: 4200, a: 2, c: 0, photo: "1522771739844-6a9f6d5f14af", amen: ["WiFi", "AC", "Gym", "Smart TV"], rooms: 8, floor: 4 },
      { name: "Executive Room", desc: "High-floor room with skyline views and lounge access.", price: 6500, a: 2, c: 1, photo: "1568495248636-6432b97bd949", amen: ["WiFi", "AC", "Gym", "Breakfast", "Smart TV", "Mini Bar"], rooms: 5, floor: 8 },
      { name: "Penthouse Suite", desc: "Top-floor suite with a dining area and panoramic city views.", price: 16000, a: 4, c: 2, photo: "1616594039964-ae9021a400a0", amen: ["WiFi", "AC", "Gym", "Breakfast", "Pool", "Mini Bar", "Bathtub", "Room Service"], rooms: 2, floor: 12 },
    ],
  },
  {
    name: "The Heritage Haveli", slug: "heritage-haveli", short: "haveli", city: "Jaipur", state: "Rajasthan",
    address: "Amer Road, Near Jal Mahal", phone: "9000000008", color: "b45309", cover: "1573052905904-34ad8c27f0cc",
    staff: { admin: ["Priya", "Shekhawat"], fd: ["Aman", "Joshi"] },
    types: [
      { name: "Classic Room", desc: "Restored 19th-century haveli room with block-print linen.", price: 4400, a: 2, c: 1, photo: "1559599238-308793637427", amen: ["WiFi", "AC", "Breakfast", "Restaurant"], rooms: 6, floor: 1 },
      { name: "Maharaja Suite", desc: "Gilded suite with antique furnishings and a courtyard view.", price: 11500, a: 3, c: 2, photo: "1587985064135-0366536eab42", amen: ["WiFi", "AC", "Breakfast", "Restaurant", "Spa", "Bathtub"], rooms: 3, floor: 2 },
    ],
  },
  {
    name: "Pine Crest Lodge", slug: "pine-crest-lodge", short: "pinecrest", city: "Manali", state: "Himachal Pradesh",
    address: "Old Manali Road", phone: "9000000009", color: "334155", cover: "1614957004131-9e8f2a13123c",
    staff: { admin: ["Tenzin", "Negi"], fd: ["Ritika", "Thakur"] },
    types: [
      { name: "Mountain View Room", desc: "Cosy room with heated floors and views of the Pir Panjal range.", price: 3900, a: 2, c: 1, photo: "1629140727571-9b5c6f6267b4", amen: ["WiFi", "Mountain View", "Breakfast", "Parking"], rooms: 6, floor: 2 },
      { name: "Valley Cabin", desc: "Standalone cabin with a deck hanging over the Kullu valley.", price: 8200, a: 3, c: 2, photo: "1596394516093-501ba68a0ba6", amen: ["WiFi", "Mountain View", "Breakfast", "Balcony", "Parking"], rooms: 3, floor: 1 },
    ],
  },
  {
    name: "Cedar Valley Resort", slug: "cedar-valley-resort", short: "cedar", city: "Shimla", state: "Himachal Pradesh",
    address: "Mashobra Road", phone: "9000000010", color: "78350f", cover: "1606402179428-a57976d71fa4",
    tenant_status_id: 3, // PENDING onboarding: shows in super-admin, hidden from guests
    staff: { admin: ["Nikhil", "Chauhan"], fd: ["Simran", "Verma"] },
    types: [
      { name: "Deluxe Room", desc: "Bright corner room among the deodar trees.", price: 5600, a: 2, c: 1, photo: "1595526114035-0d45ed16cfbf", amen: ["WiFi", "Mountain View", "Breakfast"], rooms: 4, floor: 1 },
    ],
  },
  {
    name: "Marina Bay Hotel", slug: "marina-bay-hotel", short: "marina", city: "Chennai", state: "Tamil Nadu",
    address: "12 Beach Road, Marina", phone: "9000000011", color: "0369a1", cover: "1455587734955-081b22074882",
    staff: { admin: ["Suresh", "Krishnan"], fd: ["Meena", "Raghavan"] },
    types: [
      { name: "Standard Room", desc: "Comfortable room a short drive from Marina Beach.", price: 3200, a: 2, c: 1, photo: "1618773928121-c32242e63f39", amen: ["WiFi", "AC", "Parking"], rooms: 7, floor: 1 },
      { name: "Deluxe Room", desc: "Larger room with a reading nook and premium bedding.", price: 4900, a: 2, c: 2, photo: "1609949279531-cf48d64bed89", amen: ["WiFi", "AC", "Breakfast", "Smart TV", "Parking"], rooms: 4, floor: 2 },
    ],
  },
  {
    name: "The Capital Grand", slug: "capital-grand", short: "capital", city: "New Delhi", state: "Delhi",
    address: "Janpath, Connaught Place", phone: "9000000012", color: "7f1d1d", cover: "1625244724120-1fd1d34d00f6",
    staff: { admin: ["Aditi", "Malhotra"], fd: ["Varun", "Sethi"] },
    types: [
      { name: "Superior Room", desc: "Marble-floored room in the heart of Connaught Place.", price: 5800, a: 2, c: 1, photo: "1512918728675-ed5a9ecdebfd", amen: ["WiFi", "AC", "Gym", "Breakfast"], rooms: 6, floor: 3 },
      { name: "Premier Room", desc: "Moody, design-led room with a rain shower.", price: 7600, a: 2, c: 1, photo: "1496417263034-38ec4f0b665a", amen: ["WiFi", "AC", "Gym", "Breakfast", "Mini Bar", "Smart TV"], rooms: 4, floor: 5 },
      { name: "Club Suite", desc: "Suite with a living room, club lounge access and airport transfers.", price: 15500, a: 4, c: 2, photo: "1600210492486-724fe5c67fb0", amen: ["WiFi", "AC", "Gym", "Breakfast", "Spa", "Airport Shuttle", "Room Service"], rooms: 2, floor: 9 },
    ],
  },
];

const GUESTS = [
  ["Aarav", "Sharma", "Male"], ["Diya", "Patel", "Female"], ["Kabir", "Mehta", "Male"], ["Ananya", "Gupta", "Female"],
  ["Ishaan", "Reddy", "Male"], ["Saanvi", "Kulkarni", "Female"], ["Vivaan", "Bose", "Male"], ["Myra", "Desai", "Female"],
  ["Reyansh", "Pillai", "Male"], ["Aisha", "Khan", "Female"], ["Arnav", "Chatterjee", "Male"], ["Tara", "Banerjee", "Female"],
  ["Dev", "Agarwal", "Male"], ["Nisha", "Jain", "Female"], ["Yash", "Bhatt", "Male"], ["Zoya", "Mirza", "Female"],
];
const CITIES = [["Ahmedabad", "Gujarat"], ["Mumbai", "Maharashtra"], ["Pune", "Maharashtra"], ["Bengaluru", "Karnataka"], ["Hyderabad", "Telangana"], ["Kolkata", "West Bengal"], ["New Delhi", "Delhi"], ["Chennai", "Tamil Nadu"]];

const INCIDENTALS = [["In-room dining", 850], ["Laundry service", 420], ["Minibar", 360], ["Spa treatment", 2400], ["Airport transfer", 1500], ["Late checkout", 1200], ["Restaurant dinner", 1850]];
const REQUESTS = [null, null, null, "Late check-in around 11 PM", "Extra pillows please", "Celebrating an anniversary", "High floor if possible", "Vegetarian breakfast", "Need a baby cot"];

// ---------- main ----------
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
    password: process.env.DB_PASS, multipleStatements: true, dateStrings: false,
    ssl: process.env.DB_SSL === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
  });
  const q = (sql, params) => conn.query(sql, params).then(([r]) => r);
  const insertMany = async (table, cols, rows) => {
    if (!rows.length) return;
    for (let i = 0; i < rows.length; i += 500) {
      await q(`INSERT INTO ${table} (${cols.join(",")}) VALUES ?`, [rows.slice(i, i + 500)]);
    }
  };

  console.log("1/5 Resetting schema from sql/local_setup.sql ...");
  await q(fs.readFileSync(path.join(__dirname, "..", "sql", "local_setup.sql"), "utf8"));
  await q(`USE \`${process.env.DB_NAME}\``);

  // The app hard-codes these lookup ids (and the seed hotels 1 and 2). Some MySQL-compatible
  // engines (TiDB) don't guarantee consecutive AUTO_INCREMENT ids, so check before going on.
  const expectIds = async (sql, expected, what) => {
    const got = (await q(sql)).map((r) => Object.values(r).join("=")).join(",");
    if (got !== expected) throw new Error(`Unexpected ${what} ids: got ${got}, expected ${expected}`);
  };
  await expectIds("SELECT user_role_id, role_name FROM user_roles ORDER BY user_role_id", "1=SUPER_ADMIN,2=ADMIN,3=FRONT_DESK,4=GUEST", "user_roles");
  await expectIds("SELECT room_status_id, status_name FROM room_statuses ORDER BY room_status_id", "1=AVAILABLE,2=OCCUPIED,3=DIRTY,4=MAINTENANCE", "room_statuses");
  await expectIds("SELECT booking_status_id, status_name FROM booking_statuses ORDER BY booking_status_id", "1=PENDING,2=CONFIRMED,3=CHECKED_IN,4=CHECKED_OUT,5=CANCELLED", "booking_statuses");
  await expectIds("SELECT payment_status_id, status_name FROM payment_statuses ORDER BY payment_status_id", "1=PENDING,2=SUCCESS,3=FAILED,4=REFUNDED,5=BYPASSED", "payment_statuses");
  await expectIds("SELECT hotel_id, slug FROM hotels ORDER BY hotel_id", "1=grand-palace,2=sea-view-resort", "hotels");
  await expectIds("SELECT room_type_id, type_name FROM room_types ORDER BY room_type_id", "1=Standard,2=Deluxe,3=Suite", "room_types");
  await expectIds("SELECT amenity_id, amenity_name FROM amenities ORDER BY amenity_id", "1=WiFi,2=AC,3=Pool,4=Gym,5=Breakfast,6=Parking", "amenities");

  const pwHash = (await q("SELECT password_hash FROM users WHERE email='superadmin@hbms.local'"))[0].password_hash;

  console.log("2/5 Hotels, room types, rooms ...");
  await insertMany("amenities", ["amenity_name"], NEW_AMENITIES.map((a) => [a]));
  const amenityId = Object.fromEntries((await q("SELECT amenity_id, amenity_name FROM amenities")).map((r) => [r.amenity_name, r.amenity_id]));

  const addType = async (hotelId, t) => {
    const r = await q(
      "INSERT INTO room_types (hotel_id, type_name, photo_url, description, base_price, max_adults, max_children) VALUES (?,?,?,?,?,?,?)",
      [hotelId, t.name, roomImg(t.photo), t.desc, t.price, t.a, t.c]);
    const typeId = r.insertId;
    await insertMany("room_type_amenities", ["room_type_id", "amenity_id"], t.amen.map((a) => [typeId, amenityId[a]]));
    const existing = await q("SELECT room_number FROM rooms WHERE hotel_id=?", [hotelId]);
    const taken = new Set(existing.map((x) => x.room_number));
    const rows = []; let n = 1;
    while (rows.length < t.rooms) {
      const num = String(t.floor * 100 + n++);
      if (!taken.has(num)) rows.push([hotelId, typeId, ROOM.AVAILABLE, num, t.floor]);
    }
    await insertMany("rooms", ["hotel_id", "room_type_id", "room_status_id", "room_number", "floor"], rows);
    return typeId;
  };

  const addStaff = async (hotelId, short, staff, city, state) => {
    if (!staff) return;
    const rows = [
      [hotelId, ROLE.ADMIN, staff.admin[0], staff.admin[1], `admin.${short}@hbms.local`, `98${String(hotelId).padStart(2, "0")}000001`, "1988-04-12", "Male", pwHash, state, city, "Hotel premises"],
      [hotelId, ROLE.FRONT_DESK, staff.fd[0], staff.fd[1], `frontdesk.${short}@hbms.local`, `98${String(hotelId).padStart(2, "0")}000002`, "1996-09-23", "Female", pwHash, state, city, "Hotel premises"],
    ];
    await insertMany("users", ["hotel_id", "user_role_id", "first_name", "last_name", "email", "phone", "dob", "gender", "password_hash", "state", "city", "address"], rows);
  };

  for (const h of EXISTING) {
    const [row] = await q("SELECT name, city, state FROM hotels WHERE hotel_id=?", [h.hotel_id]);
    await q("UPDATE hotels SET cover_url=?, logo_url=?, created_at=? WHERE hotel_id=?", [cover(h.cover), logo(row.name, h.color), dt(-400), h.hotel_id]);
    for (const [typeName, photo] of Object.entries(h.typePhotos)) {
      if (photo) await q("UPDATE room_types SET photo_url=? WHERE hotel_id=? AND type_name=?", [roomImg(photo), h.hotel_id, typeName]);
    }
    for (const t of h.extraTypes) await addType(h.hotel_id, t);
    await addStaff(h.hotel_id, h.short, h.staff, row.city, row.state);
  }

  let createdOffset = -380;
  for (const h of HOTELS) {
    const r = await q(
      "INSERT INTO hotels (tenant_status_id, name, slug, address, city, state, country, phone, email, logo_url, cover_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [h.tenant_status_id || 1, h.name, h.slug, h.address, h.city, h.state, "India", h.phone, `stay@${h.slug}.example.com`, logo(h.name, h.color), cover(h.cover), dt(createdOffset += 30)]);
    h.hotel_id = r.insertId;
    for (const t of h.types) await addType(h.hotel_id, t);
    await addStaff(h.hotel_id, h.short, h.staff, h.city, h.state);
  }

  // cancellation policies for every room type that doesn't have one yet
  await q(`INSERT INTO cancellation_policies (hotel_id, room_type_id, free_cancellation_hours, refund_percentage)
           SELECT rt.hotel_id, rt.room_type_id,
                  CASE WHEN rt.base_price >= 10000 THEN 72 WHEN rt.base_price >= 6000 THEN 48 ELSE 24 END,
                  CASE WHEN rt.base_price >= 10000 THEN 50 WHEN rt.base_price >= 6000 THEN 75 ELSE 100 END
           FROM room_types rt
           LEFT JOIN cancellation_policies cp ON cp.room_type_id = rt.room_type_id
           WHERE cp.policy_id IS NULL`);

  console.log("3/5 Guests ...");
  await insertMany("users", ["hotel_id", "user_role_id", "first_name", "last_name", "email", "phone", "dob", "gender", "password_hash", "state", "city", "address"],
    GUESTS.map(([f, l, g], i) => {
      const [city, state] = CITIES[i % CITIES.length];
      return [null, ROLE.GUEST, f, l, `${f.toLowerCase()}.${l.toLowerCase()}@example.com`, `97${String(i).padStart(8, "0")}`, `${int(1975, 2002)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`, g, pwHash, state, city, `${int(1, 200)} Residency Road`];
    }));
  const demoGuestId = (await q("SELECT user_id FROM users WHERE email='guest@hbms.local'"))[0].user_id;
  // the demo guest only gets the handful of bookings picked for it below
  const guestIds = (await q("SELECT user_id FROM users WHERE user_role_id=? AND user_id<>? ORDER BY user_id", [ROLE.GUEST, demoGuestId])).map((r) => r.user_id);

  console.log("4/5 Bookings, payments, invoices ...");
  const activeHotels = await q("SELECT hotel_id FROM hotels WHERE tenant_status_id=1");
  const frontDesk = Object.fromEntries((await q("SELECT hotel_id, user_id FROM users WHERE user_role_id=?", [ROLE.FRONT_DESK])).map((r) => [r.hotel_id, r.user_id]));
  const refs = new Set();
  const newRef = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r;
    do { r = "HBMS-" + Array.from({ length: 6 }, () => chars[Math.floor(rand() * chars.length)]).join(""); } while (refs.has(r));
    refs.add(r); return r;
  };

  const bookings = []; // in-memory, inserted after
  for (const { hotel_id } of activeHotels) {
    const rooms = await q(
      `SELECT r.room_id, r.room_type_id, rt.base_price, rt.max_adults, rt.max_children
       FROM rooms r JOIN room_types rt ON rt.room_type_id=r.room_type_id WHERE r.hotel_id=?`, [hotel_id]);
    const types = [...new Map(rooms.map((r) => [r.room_type_id, r])).values()].sort((a, b) => a.base_price - b.base_price);
    const busy = new Map(rooms.map((r) => [r.room_id, []])); // room_id -> [[in,out)]
    const free = (roomId, a, b) => busy.get(roomId).every(([x, y]) => b <= x || a >= y);

    const tryBook = (checkin, nights, createdOff, forcedStatus) => {
      // cheaper types are booked more often
      const type = types[Math.min(types.length - 1, Math.floor(Math.pow(rand(), 1.6) * types.length))];
      const want = chance(0.15) ? 2 : 1;
      const checkout = checkin + nights;
      const pool = rooms.filter((r) => r.room_type_id === type.room_type_id && free(r.room_id, checkin, checkout));
      if (pool.length < want) return null;
      const chosen = pool.sort(() => rand() - 0.5).slice(0, want);

      let status = forcedStatus;
      if (!status) {
        if (checkout <= 0) status = chance(0.1) ? BK.CANCELLED : BK.CHECKED_OUT;
        else if (checkin <= 0) status = BK.CHECKED_IN;
        else status = chance(0.15) ? BK.CANCELLED : BK.CONFIRMED;
      }
      if (status !== BK.CANCELLED) chosen.forEach((r) => busy.get(r.room_id).push([checkin, checkout]));

      const source = chance(0.75) ? SRC.ONLINE : chance(0.6) ? SRC.WALK_IN : SRC.PHONE;
      const created = source === SRC.WALK_IN ? Math.min(checkin, 0) : createdOff;
      const adults = Math.max(1, int(1, type.max_adults * want));
      const children = type.max_children ? int(0, type.max_children * want) : 0;
      const b = {
        hotel_id, user_id: pick(guestIds), status, source, checkin, checkout, nights, adults, children,
        rate: Number(type.base_price), rooms: chosen.map((r) => r.room_id),
        total: Number(type.base_price) * nights * want,
        created: dt(created, int(7, 22), int(0, 59)),
        request: pick(REQUESTS),
      };
      bookings.push(b);
      return b;
    };

    // ~a year of history, weighted towards recent months
    const historic = int(28, 42);
    for (let i = 0; i < historic; i++) {
      const created = -Math.floor(Math.pow(rand(), 1.4) * 340) - 1;
      tryBook(created + int(1, 25), int(1, 5), created);
    }
    // guests in-house right now
    for (let i = 0; i < int(2, 4); i++) tryBook(-int(1, 2), int(3, 5), -int(3, 20), BK.CHECKED_IN);
    // front desk "today": arrivals waiting for check-in, and in-house guests due to check out
    for (let i = 0; i < int(2, 3); i++) tryBook(0, int(1, 4), -int(2, 20), BK.CONFIRMED);
    for (let i = 0; i < int(1, 2); i++) { const n = int(1, 3); tryBook(-n, n, -int(5, 20), BK.CHECKED_IN); }
    // upcoming stays, several booked in the last week (feeds the daily revenue chart)
    for (let i = 0; i < int(4, 7); i++) tryBook(int(1, 45), int(1, 4), -int(0, 6));
    // a stay that checked out this morning -> room left DIRTY for housekeeping (step 5)
    const n = int(2, 3);
    tryBook(-n, n, -12, BK.CHECKED_OUT);
  }

  // give the demo guest (guest@hbms.local) a realistic My Bookings page
  const byStatus = (s) => bookings.filter((b) => b.status === s);
  const assignDemo = (list, n) => {
    const taken = bookings.filter((b) => b.user_id === demoGuestId && b.status !== BK.CANCELLED);
    let count = 0;
    for (const b of list) {
      if (count >= n) break;
      if (taken.some((t) => !(b.checkout <= t.checkin || b.checkin >= t.checkout)) && b.status !== BK.CANCELLED) continue;
      if (bookings.some((x) => x.user_id === demoGuestId && x.hotel_id === b.hotel_id)) continue;
      b.user_id = demoGuestId; taken.push(b); count++;
    }
  };
  assignDemo(byStatus(BK.CHECKED_OUT).sort((a, b) => b.checkout - a.checkout), 3);
  assignDemo(byStatus(BK.CONFIRMED), 2);
  assignDemo(byStatus(BK.CANCELLED), 1);
  assignDemo(byStatus(BK.CHECKED_IN), 1);

  bookings.sort((a, b) => a.created - b.created);
  for (const b of bookings) {
    const r = await q(
      `INSERT INTO bookings (hotel_id, user_id, booking_status_id, booking_source_id, booking_reference, checkin_date, checkout_date, adults, children, total_amount, special_requests, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.hotel_id, b.user_id, b.status, b.source, newRef(), ymd(day(b.checkin)), ymd(day(b.checkout)), b.adults, b.children, b.total, b.request, b.created, b.created]);
    b.booking_id = r.insertId;
  }

  const brRows = [], payRows = [], idRows = [], incRows = [], invRows = [];
  for (const b of bookings) {
    b.rooms.forEach((roomId) => brRows.push([b.booking_id, roomId, b.rate]));

    const method = b.source === SRC.WALK_IN ? pick([PM.CASH, PM.CARD, PM.UPI]) : pick([PM.CARD, PM.UPI, PM.UPI]);
    const paid = b.status === BK.CANCELLED ? PS.REFUNDED : PS.SUCCESS;
    payRows.push([b.hotel_id, b.booking_id, method, 1, paid, b.total, b.created, b.created]);

    if (b.status === BK.CHECKED_IN || b.status === BK.CHECKED_OUT) {
      const fd = frontDesk[b.hotel_id];
      idRows.push([b.booking_id, b.user_id, fd, int(1, 3), `XXXX-XXXX-${int(1000, 9999)}`, null, "APPROVED", null, dt(b.checkin, 14, int(0, 59))]);

      let incTotal = 0;
      if (chance(0.45)) {
        for (let k = 0; k < int(1, 3); k++) {
          const [desc, base] = pick(INCIDENTALS);
          const amount = base + int(0, 4) * 50;
          incTotal += amount;
          const at = Math.min(b.checkin + int(0, Math.max(0, b.nights - 1)), 0);
          incRows.push([b.hotel_id, b.booking_id, fd, desc, amount, dt(at, int(15, 22), int(0, 59))]);
        }
      }
      if (b.status === BK.CHECKED_OUT) {
        const tax = +((b.total + incTotal) * TAX_RATE).toFixed(2);
        invRows.push([b.hotel_id, b.booking_id, b.total, incTotal, tax, +(b.total + incTotal + tax).toFixed(2), dt(b.checkout, 11, int(0, 45))]);
      }
    }
  }
  await insertMany("booking_rooms", ["booking_id", "room_id", "rate_per_night"], brRows);
  await insertMany("payments", ["hotel_id", "booking_id", "payment_method_id", "payment_type_id", "payment_status_id", "amount", "paid_at", "created_at"], payRows);
  await insertMany("guest_identifications", ["booking_id", "user_id", "verified_by", "id_type_id", "id_number", "document_url", "verification_status", "remarks", "uploaded_at"], idRows);
  await insertMany("incidental_charges", ["hotel_id", "booking_id", "added_by", "description", "amount", "added_at"], incRows);
  await insertMany("invoices", ["hotel_id", "booking_id", "room_charges", "incidentals", "tax_amount", "total_amount", "generated_at"], invRows);

  console.log("5/5 Room statuses ...");
  // in-house guests -> OCCUPIED
  await q(`UPDATE rooms r JOIN booking_rooms br ON br.room_id=r.room_id JOIN bookings b ON b.booking_id=br.booking_id
           SET r.room_status_id=? WHERE b.booking_status_id=?`, [ROOM.OCCUPIED, BK.CHECKED_IN]);
  // checked out today -> DIRTY, waiting for housekeeping
  await q(`UPDATE rooms r JOIN booking_rooms br ON br.room_id=r.room_id JOIN bookings b ON b.booking_id=br.booking_id
           SET r.room_status_id=? WHERE b.booking_status_id=? AND b.checkout_date=CURDATE() AND r.room_status_id=?`,
    [ROOM.DIRTY, BK.CHECKED_OUT, ROOM.AVAILABLE]);
  // one room under maintenance in each larger hotel
  for (const { hotel_id } of activeHotels) {
    const avail = await q("SELECT room_id FROM rooms WHERE hotel_id=? AND room_status_id=? ORDER BY room_id", [hotel_id, ROOM.AVAILABLE]);
    if (avail.length > 6) {
      await q("UPDATE rooms SET room_status_id=?, notes='AC servicing scheduled' WHERE room_id=?", [ROOM.MAINTENANCE, avail[int(0, avail.length - 1)].room_id]);
    }
  }

  const counts = await q(`SELECT
      (SELECT COUNT(*) FROM hotels) hotels, (SELECT COUNT(*) FROM room_types) room_types, (SELECT COUNT(*) FROM rooms) rooms,
      (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM bookings) bookings, (SELECT COUNT(*) FROM payments) payments,
      (SELECT COUNT(*) FROM invoices) invoices, (SELECT COUNT(*) FROM incidental_charges) incidentals`);
  console.table(counts);
  console.log("Logins (password Password@123): superadmin@hbms.local, admin.<hotel>@hbms.local, frontdesk.<hotel>@hbms.local, guest@hbms.local");
  console.log("Hotel short names:", ["palace (admin@/frontdesk@hbms.local)", ...EXISTING.slice(1).map((h) => h.short), ...HOTELS.map((h) => h.short)].join(", "));
  await conn.end();
})().catch((e) => { console.error(e); process.exit(1); });
