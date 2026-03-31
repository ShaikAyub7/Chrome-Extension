const connectDB = require("./backend/connect");

async function insertData() {
  const db = await connectDB();
  const collection = db.collection("users");

  const result = await collection.insertOne({
    name: "Ayub",
    age: 21,
    skill: "Frontend Developer",
  });

  console.log("Data inserted:", result);
}

insertData();
