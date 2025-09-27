require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

//------------------ MONGODB CONNECTION ------------------//
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected successfully!"))
    .catch(err => console.error("MongoDB connection error:", err));

//------------------ SCHEMAS ------------------//
const userSchema = new mongoose.Schema({
    user_id: { type: Number, unique: true },
    email: { type: String, required: true, unique: true },
    name: String,
    password: String,
    wallet: { type: Number, default: 0 },
    status: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

const lotterySchema = new mongoose.Schema({
    lotto_id: { type: Number, unique: true },
    number: { type: String, required: true },
    price: Number,
    status: { type: Number, default: 0 }
});
const Lottery = mongoose.model('Lottery', lotterySchema);

const orderSchema = new mongoose.Schema({
    order_id: { type: Number, unique: true },
    user_id: { type: Number, ref: 'User' },  
    lotto_id: { type: Number, ref: 'Lottery' }, 
    status: { type: Number, default: 1 },
    no: Number
});
const Order = mongoose.model('Order', orderSchema);

const rewardSchema = new mongoose.Schema({
    no: Number,
    lotto_id: { type: Number, ref: 'Lottery' }, 
    number_reward: String,
    price_reward: Number
});
const Reward = mongoose.model('Reward', rewardSchema);


// const Order = require("./models/Order");
// const Reward = require("./models/Reward");
// const Lottery = require("./models/Lottery");

//------------------ ROUTES ------------------//


const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model("Counter", counterSchema);

async function getNextUserId() {
  const counter = await Counter.findOneAndUpdate(
    { name: "user_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

async function getNextLotteryId() {
  const counter = await Counter.findOneAndUpdate(
    { name: "lottery_id" },  // แก้ typo
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

async function getNextOrderId() {
  const counter = await Counter.findOneAndUpdate(
    { name: "order_id" },  // แก้ typo
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}





// Test server
app.get('/', (req, res) => {
    res.send('Hello, world! Render is running!');
});



//------------------ USERS ------------------//

// create user
app.post("/create", async (req, res) => {
    const { email, name, password, wallet } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const newUserId = await getNextUserId(); // ได้ user_id เป็นเลข
        const user = new User({ user_id: newUserId, email, name, password: hashedPassword, wallet });
        await user.save();
        res.status(201).json({ message: "New user successfully created!" });
    } catch(err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

// GET: แสดงผู้ใช้ทั้งหมด
app.get("/users", async (req, res) => {
    try {
        // ดึงข้อมูลทั้งหมดจาก collection 'users'
        const users = await User.find({}, { _id: 0, __v: 0 }); 

        res.status(200).json(users);
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ message: "Error fetching users" });
    }
});


//user login
app.post("/users/login", async (req, res) => {
  const { email, password } = req.body;


  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // ตรวจสอบ password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // ส่ง response กลับ Flutter เหมือนเดิม
    res.json({
      users: {
        user_id: user.user_id, 
        email: user.email,
        name: user.name,
        password: user.password,
        wallet: user.wallet,
        status: user.status,
      },
    });
  } catch (err) {
    console.error("Error querying MongoDB:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
});






//---------------------------------------START----------------------------------------------------------

// เอาเลขล็อตโตทั้งหมดมาแสดง
app.get("/lottery", async (req, res) => {
    try {
        const lotteries = await Lottery.find(); // ดึงข้อมูลทั้งหมดจาก collection lottery
        res.status(200).json(lotteries);
    } catch (err) {
        console.error("Error while fetching lottery:", err);
        res.status(500).send("Server error");
    }
});


//กดเลือกซื้อ
app.post("/addOrder", async (req, res) => {
  console.log("Body:", req.body);

  const { user_id, lotto_id, status } = req.body;

  try {

    const orderId = await getNextOrderId();

    const newOrder = new Order({
      order_id: orderId,
      user_id: user_id,  
      lotto_id: lotto_id, 
      status: status
    });

    await newOrder.save();

    return res.status(201).json({ message: "New order successfully created!" });
  } catch (err) {
    console.error("Error while inserting a order into the database", err);
    return res.status(500).json({ error: "Server error" });
  }
});




// ซื้อแล้วจะอัปเดต ststus
app.put("/updateStatus", async (req, res) => {
  console.log("Body:", req.body);

  const { lotto_id, status } = req.body;

  try {
    const result = await Lottery.updateOne(
      { lotto_id: lotto_id },   
      { $set: { status: status } } 
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Lottery not found" });
    }

    return res.status(200).json({ message: "Update status successfully!" });
  } catch (error) {
    console.error("Error while updating lottery status:", error);
    return res.status(500).json({ error: "Server error" });
  }
});



// --- Route สำหรับอัปเดต wallet ---
app.put("/updatewallet", async (req, res) => {
    console.log(req.body);

    const { user_id, wallet } = req.body;

    try {
        const result = await User.updateOne(
            { user_id: user_id },        // เงื่อนไขค้นหา
            { $set: { wallet: wallet } } // ค่าใหม่
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(201).json({ message: "Update wallet successfully !" });
    } catch (error) {
        console.error("Error while updating wallet:", error);
        return res.status(500).send();
    }
});



//เรียกเอาล็อตโตทั้งหมดจาก user_id
app.get("/mylotto/:id", async (req, res) => {
    console.log("Body: ", req.body);

    const user_id = Number(req.params.id);

    try {
        const results = await Order.aggregate([
            {
                $match: {
                    user_id: user_id,
                    status: { $ne: 3 }
                }
            },
            {
                $lookup: {
                    from: "lotteries",
                    localField: "lotto_id",
                    foreignField: "lotto_id",
                    as: "lottery_data"
                }
            },
            { $unwind: "$lottery_data" },
            {
                $addFields: {
                    last_three_digits: {
                        $cond: [
                            { $gte: [ { $strLenCP: "$lottery_data.number" }, 3 ] },
                            {
                                $substrCP: [
                                    "$lottery_data.number",
                                    { $subtract: [ { $strLenCP: "$lottery_data.number" }, 3 ] },
                                    3
                                ]
                            },
                            "$lottery_data.number"
                        ]
                    }
                }
            },
            // project ให้ตรงกับ Flutter model
            {
                $project: {
                    order_id: 1,
                    user_id: 1,
                    lotto_id: 1,
                    status: 1,
                    number: "$lottery_data.number",
                    price: "$lottery_data.price",
                    last_three_digits: 1
                }
            }
        ]);

        console.log("Results:", results);
        res.status(200).json(results);
    } catch (error) {
        console.error(error);
        return res.status(500).send();
    }
});


//เรียกข้อมูลทั้งหมดของ user_id
app.get("/profile/:id", async (req, res) => {
  const user_id = req.params.id;

  try {
    const user = await User.findOne(
      { user_id: user_id },
      { _id: 0, __v: 0 } // ลบ _id และ __v
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error while fetching profile:", error);
    res.status(500).json({ error: "Server error" });
  }
});


// เรียกรางวัลทั้งหมดที่สุ่มได้ เอามาตัดเหลือ 3 ตัว (NumberReward)
app.get("/myreward", async (req, res) => {
  try {
    const results = await Order.aggregate([
      { $match: { status: 1 } },

      {
        $lookup: {
          from: "rewards",
          localField: "lotto_id",
          foreignField: "lotto_id",
          as: "reward_data"
        }
      },
      { $unwind: "$reward_data" },

      { $match: { "reward_data.no": { $in: [1, 2, 3] } } },

      {
        $addFields: {
          last_three_digits: {
            $cond: [
              { $gte: [{ $strLenCP: "$reward_data.number_reward" }, 3] },
              {
                $substrCP: [
                  "$reward_data.number_reward",
                  { $subtract: [{ $strLenCP: "$reward_data.number_reward" }, 3] },
                  3
                ]
              },
              "$reward_data.number_reward"
            ]
          },
          last_two_digits: {
            $cond: [
              { $gte: [{ $strLenCP: "$reward_data.number_reward" }, 2] },
              {
                $substrCP: [
                  "$reward_data.number_reward",
                  { $subtract: [{ $strLenCP: "$reward_data.number_reward" }, 2] },
                  2
                ]
              },
              "$reward_data.number_reward"
            ]
          }
        }
      },
      // Project fields ให้ตรงกับ Flutter model NumberReward
      {
        $project: {
          orderId: "$order_id",
          userId: "$user_id",
          lottoId: "$lotto_id",
          status: 1,
          no: "$reward_data.no",
          numberReward: "$reward_data.number_reward",
          priceReward: "$reward_data.price_reward",
          lastThreeDigits: "$last_three_digits",
          lastTwoDigits: "$last_two_digits"
        }
      }
    ]);

    res.status(200).json(results);
  } catch (error) {
    console.error("Error while getting MyReward:", error);
    res.status(500).json({ error: "Server error" });
  }
});




//////////////////////////////////////////////////////////////////////

//เอาไว้ดึงค่ารางวัลที่ user_id คนนั้นถูก  (myreward_get_res)


app.get("/getMyreward/:user_id", async (req, res) => {
    const userId = Number(req.params.user_id);

    try {
        const results = await Order.aggregate([
            {
                $match: { user_id: userId, status: 2 }
            },
            {
                $lookup: {
                    from: "rewards",
                    localField: "no",
                    foreignField: "no",
                    as: "rewardData"
                }
            },
            { $unwind: "$rewardData" },
            {
                $addFields: {
                    lastThree: {
                        $cond: [
                            { $gte: [{ $strLenCP: "$rewardData.number_reward" }, 3] },
                            {
                                $substrCP: [
                                    "$rewardData.number_reward",
                                    { $subtract: [{ $strLenCP: "$rewardData.number_reward" }, 3] },
                                    3
                                ]
                            },
                            "$rewardData.number_reward"
                        ]
                    }
                }
            },
            {
                $project: {
                    order_id: 1,
                    user_id: 1,
                    lotto_id: 1,
                    status: 1,
                    no: 1,
                    number_reward: "$rewardData.number_reward",
                    price_reward: "$rewardData.price_reward",
                    lastThree: 1
                }
            }
        ]);

        res.status(200).json(results);
    } catch (error) {
        console.error("Error while fetching rewards:", error);
        return res.status(500).send();
    }
});




// SELECT เอาเลขท้ายสองตัวมาจาก ordersทั้งหมด

app.get("/LastTwoDigitOrder/:id", async (req, res) => {
    const user_id = Number(req.params.id);

    try {
        const results = await Order.aggregate([
            { $match: { user_id: user_id, status: 1 } },
            {
                $lookup: {
                    from: "lotteries",
                    localField: "lotto_id",
                    foreignField: "lotto_id",
                    as: "lotteryData"
                }
            },
            { $unwind: "$lotteryData" },
            {
                $addFields: {
                    last_two_digits: {
                        $cond: [
                            { $gte: [{ $strLenCP: "$lotteryData.number" }, 2] },
                            {
                                $substrCP: [
                                    "$lotteryData.number",
                                    { $subtract: [{ $strLenCP: "$lotteryData.number" }, 2] },
                                    2
                                ]
                            },
                            "$lotteryData.number"
                        ]
                    }
                }
            },
            {
                $project: {
                    order_id: 1,
                    lotto_id: 1,
                    last_two_digits: 1
                }
            }
        ]);

        res.status(200).json(results);
    } catch (error) {
        console.error("Error while Get DigitOrder:", error);
        return res.status(500).send();
    }
});



// SELECT เอาเลขสองตัวท้ายของ no = 5 จาก reward
app.get("/getLastTwoDigit", async (req, res) => {
    console.log("Body:", req.body);

    try {
        const results = await Reward.aggregate([
            { $match: { no: 5 } },  // กรองเฉพาะ no = 5
            {
                $addFields: {
                    last_two_digits: {
                        $cond: [
                            { $gte: [{ $strLenCP: "$number_reward" }, 2] },
                            {
                                $substrCP: [
                                    "$number_reward",
                                    { $subtract: [{ $strLenCP: "$number_reward" }, 2] },
                                    2
                                ]
                            },
                            "$number_reward" // ถ้า string < 2 ใช้เต็ม ๆ
                        ]
                    }
                }
            },
            {
                $project: {
                    last_two_digits: 1,
                    price_reward: 1,
                    no: 1
                }
            }
        ]);

        res.status(200).json(results);
    } catch (error) {
        console.error("Error while Get Last Two digit on MongoDB!", error);
        return res.status(500).send();
    }
});



//ถ้ารางวัลตรงกันจะมีการอัปเดต ststus = 2
app.put("/updateMylotto", async (req, res) => {
    console.log("Body updateMylotto:", req.body);

    const { order_id, status } = req.body;
    console.log("order_id:", order_id, "status:", status);

    try {
        const result = await Order.updateOne(
            { order_id: order_id },     // เงื่อนไขค้นหา
            { $set: { status: status } } // ค่าใหม่
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.status(201).json({ message: "Update status successfully !" });
    } catch (error) {
        console.error("Error while updating status My Lottery in MongoDB:", error);
        return res.status(500).send();
    }
});


////////////////////////////////////////////////////////////////////////////////////

//ถ้ารางวัลตรงกันจะมีการอัปเดต no ให้ตรงกับรางวัลที่ได้
app.put("/updateOrder", async (req, res) => {
    console.log("Body: ", req.body);
    const { lotto_id, no } = req.body;

    try {
        const result = await Order.updateMany(
            { lotto_id: lotto_id }, // เงื่อนไขเหมือน WHERE lotto_id = ?
            { $set: { no: no } }    // อัปเดตค่า no
        );

        res.status(201).json({ 
            message: "Update no successfully!",
            modifiedCount: result.modifiedCount // จำนวนเอกสารที่ถูกอัปเดต
        });
    } catch (error) {
        console.log("Error while updating order no:", error);
        res.status(500).send({ error: "Server error" });
    }
});



//อัปเดต status ที่ขึ้นเงินแล้ว
app.put("/updateGetMoney", async (req, res) => {
    console.log("Body: ", req.body);
    const { lotto_id, status } = req.body;

    try {
        const result = await Order.updateMany(
            { lotto_id: lotto_id, status: 2 },
            { $set: { status: status } }
        );

        res.status(201).json({ message: "Update status successfully!", modifiedCount: result.modifiedCount });
    } catch (error) {
        console.log("Error while updating orders:", error);
        res.status(500).send({ error: "Server error" });
    }
});




/*------------------- Admin -------------------*/


//ดึงข้อมูลรางวัลทั้งหมด
app.get("/reward", async (req, res) => {
    console.log("Body:", req.body);

    try {
        const rewards = await Reward.find(); // ดึงข้อมูล reward ทั้งหมด
        res.status(200).json(rewards);
    } catch (err) {
        console.log("Error fetching rewards:", err);
        res.status(500).send({ error: "Server error" });
    }
});


// แรนด้อมล็อตโตจาก lottery ทั้งหมด
app.get("/randomReward", async (req, res) => {
  console.log("Body:", req.body);

  try {
    // ใช้ aggregation กับ $sample เพื่อสุ่ม 1 document
    const results = await Lottery.aggregate([{ $sample: { size: 1 } }]);

    res.status(200).json(results);
  } catch (err) {
    console.error("Error while fetching random lottery:", err);
    res.status(500).json({ error: "Server error" });
  }
});


//เพิ่มข้อมูลลงใน reward
app.post("/addReward", async (req, res) => {
    console.log("POST /addReward called");
    console.log("Body:", req.body);

    const { no, lotto_id, number_reward, price_reward } = req.body;

    try {
        const reward = new Reward({
            no,
            lotto_id,
            number_reward,
            price_reward
        });

        await reward.save(); // บันทึกลง MongoDB

        res.status(201).json({ message: "Add Reward successfully!" });
    } catch (err) {
        console.error("Error while adding reward:", err);
        res.status(500).json({ error: "Server error" });
    }
});


//จำลองข้อมูล  (เปลี่ยนแล้ว)
app.post("/randomLotto", async (req, res) => {
    console.log("POST /randomLotto called");
    console.log("Body:", req.body);

    const { uniqueNumbers, price } = req.body;

    try {
        const lottoDocs = [];

        for (const num of uniqueNumbers) {
            const nextId = await getNextLotteryId();
            lottoDocs.push({
                lotto_id: nextId,
                number: num,
                price: price
            });
        }

        await Lottery.insertMany(lottoDocs);

        res.status(201).json({ message: "Random Lotto numbers successfully inserted!" });
    } catch (err) {
        console.error("Error while inserting lottery numbers:", err);
        res.status(500).json({ error: "Server error" });
    }
});




app.get("/getLastThreeDigit", async (req, res) => {
  try {
    const results = await Reward.aggregate([
      { $match: { no: 1 } }, // เงื่อนไข no = 1
      {
        $addFields: {
          last_three_digits: { $substr: ["$number_reward", -3, 3] } // เอา 3 ตัวท้าย
        }
      },
      { $project: { lotto_id: 1, last_three_digits: 1 } } // เลือก field ที่ต้องการ
    ]);

    res.status(200).json(results);
  } catch (error) {
    console.error("Error while getting last 3 digits:", error);
    res.status(500).json({ error: "Server error" });
  }
});





app.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find({});
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error while fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});




//รีเซ็ต
app.delete("/delete", async (req, res) => {
  try {
    await Lottery.deleteMany({});
    await Reward.deleteMany({});
    await Order.deleteMany({});

    res.status(200).json({ message: "Deleted all collections successfully!" });
  } catch (error) {
    console.error("Error while deleting collections:", error);
    res.status(500).json({ error: "Failed to delete collections" });
  }
});



// START SERVER
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
