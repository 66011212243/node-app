const express = require('express')
const mysql = require('mysql');
const bcrypt = require("bcryptjs");
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'lotto888_db',
    
    password: 'lotto888',
    database: 'lotto888_db',
})


connection.connect((err) => {
    if (err) {
        console.log('Error connecting to MySQL database = ', err)
        return;
    }
    console.log('MySQL successfully connected!');
})

/*------------------- user -------------------*/

// create user
app.post("/create", async  (req, res) => {
    console.log(" POST /create called");
    console.log("Body:", req.body);

    const { email, name, password, wallet } = req.body; //ดึงค่า
    const saltRounds = 10;  //จำนวนรอบในการ hash
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    try {
        connection.query(
            "INSERT INTO users(email, name, password, wallet) VALUES(?, ?, ?, ?)",
            [email, name, hashedPassword, wallet],
            (err, results, fields) => {
                if (err) {
                    console.log("Error while inserting a user into the database", err);
                    return res.status(400).send();
                }
                return res.status(201).json({ message: "New user successfully created!"});
            }
        )
    } catch(err) {
        console.log(err);
        return res.status(500).send();
    }
})

//user login
app.post("/users/login", (req, res) => {
  const { email, password } = req.body;

  // ตรวจสอบว่ามีค่า email/password หรือไม่
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  // query database
  const sql = "SELECT * FROM users WHERE email = ? LIMIT 1";
  connection.query(sql, [email], async (err, results) => {
    if (err) {
      console.error("Error querying MySQL:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const user = results[0];

    //  ตรวจสอบ password ที่กรอก กับ hash ที่อยู่ใน DB
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // ส่ง response กลับ Flutter
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
  });
});

// เอาเลขล็อตโตทั้งหมดมาแสดง
app.get("/lottery", (req, res) => {
    // console.log("Body:", req.body);
    try {
        connection.query("SELECT * FROM lottery", (err, results, fields) => {
            if (err) {
                console.log(err);
                return res.status(400).send();
            }
            res.status(200).json(results)
        })
    } catch(err) {
        console.log(err);
        return res.status(500).send();
    }
})

//กดเลือกซื้อ
app.post("/addOrder", (req, res) => {
    console.log("Body:", req.body);

    const {user_id, lotto_id, status} = req.body;

    try {
        connection.query(
            "INSERT INTO orders(user_id, lotto_id, status) VALUES(?,?,?)",
            [user_id, lotto_id, status],
            (err, results, fields) => {
                if (err) {
                    console.log("Error while inserting a order into the database", err);
                    return res.status(400).send();
                }
                return res.status(201).json({ message: "New order successfully created!"});
            }
        )
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
})


// ซื้อแล้วจะอัปเดต ststus
app.put("/updateStatus", (req, res) => {
    console.log("Body: ", req.body);

    const {lotto_id, status} = req.body;

    try {
        connection.query(
            "UPDATE lottery SET status = ? WHERE lotto_id = ?",
            [ status, lotto_id],
            (err, results, fields) => {
                if (err) {
                    console.log("Error while inserting a update status into the database", err);
                    return res.status(400).send();
                }
                return res.status(201).json({ message: "Update status successfully !"});
            }
        )
    } catch (error) {
        console.log(error);
        return res.status(500).send();
    }
})

//ซื้อเสร็จก็อัปเดตเงินที่เหลือ
app.put("/updatewallet",(req,res) => {
    console.log(res.body)

    const {user_id, wallet} = req.body;

    try {
        connection.query(
            "UPDATE users SET wallet = ? WHERE user_id = ?",
            [ wallet, user_id ],
            (err, results, fields) => {
                if (err) {
                    console.log("Error while inserting a update wallet into the database", err);
                    return res.status(400).send();
                }
                return res.status(201).json({ message: "Update wallet successfully !"});
            }
        )
    } catch (error) {
        console.log(error);
        return res.status(500).send();
    }
})

//เรียกเอาล็อตโตทั้งหมดจาก user_id
app.get("/mylotto/:id",(req,res) =>{
    console.log("Body: ",req.body);
    
    const user_id = req.params.id;
    try {
            connection.query(
                "SELECT lottery.* ,orders.*,RIGHT(lottery.number,3) AS last_three_digits FROM orders INNER JOIN lottery ON orders.lotto_id = lottery.lotto_id WHERE  user_id = ? AND orders.status != 3 ",
                [user_id],
                     (err, results, fields) => {
                if (err) {
                    console.log("Error while show Mylottery  into the database", err);
                    return res.status(400).send();
                }
                res.status(200).json(results)
            }
            )
        
    } catch (error) {
        console.log(error)
        return res.status(500).send();
        
    }
})

//เรียกข้อมูลทั้งหมดของ user_id
app.get("/profile/:id",(req,res) =>{
    console.log("Body: ",req.body);

    const user_id = req.params.id;
    try {
         connection.query(//ส่ง
            "SELECT * FROM users WHERE user_id = ? ",
            [user_id],
              (err, results, fields) => {
                if (err) {
                    console.log("Error while show profile  into the database", err);
                    return res.status(400).send();
                }
                res.status(200).json(results)
            }
         )
        
    } catch (error) {
        console.log(error)
        return res.status(500).send();
        
    }
}) 

// เรียกรางวัลทั้งหมดที่สุ่มได้ เอามาตัดเหลือ 3 ตัว (NumberReward)
app.get("/myreward", (req,res) => {
    console.log ("Body:",req.body);

    // const user_id = req.params.id;
    try{
        connection.query(
            "SELECT  orders.*,reward.*,RIGHT(number_reward,3) AS last_three_digits,RIGHT(number_reward,2) AS last_two_digits  From  orders INNER JOIN reward ON orders.lotto_id = reward.lotto_id  WHERE orders.status = 1 AND reward.no IN (1,2,3,5)",
                    (err,results,fields) => {
             if (err) {
                console.log("Error while Get MyReward On MyLotto Page",err)
                return res.status(400).send();
             }
             res.status(200).json(results)
                    }
        )

    }catch (error) {
        console.log(error)
        return res.status(500).send();

    };

    
           
})


//เอาไว้ดึงค่ารางวัลที่ user_id คนนั้นถูก  (myreward_get_res)
app.get("/getMyreward/:user_id", (req, res) => {
    const userId = req.params.user_id;

    try {
        connection.query(
            `SELECT orders.*, reward.*, RIGHT(reward.number_reward,3) AS lastThree
             FROM orders 
             INNER JOIN reward ON orders.no = reward.no
             WHERE orders.status = 2 AND orders.user_id = ?
             `,
            [userId],

            
            (err, results) => {
                if (err) {
                    console.log("Error while fetching rewards:", err);
                    return res.status(400).send();
                }

                // แปลงข้อมูลเพื่อเพิ่มชื่อรางวัล (ไม่แก้ DB)
                const formatted = results.map(r => ({
                    order_id: r.order_id,
                    user_id: r.user_id,
                    lotto_id: r.lotto_id,
                    status: r.status,
                    no: r.no,
                    number_reward: r.number_reward,
                    price_reward: r.price_reward,
                    // prize_type: r.no === 1 ? "รางวัลที่ 1" : "เลขท้ายสองตัว",
                }));

                res.status(200).json(formatted);
            }
        );
    } catch (error) {
        console.log(error);
        return res.status(500).send();
    }
});

// SELECT เอาเลขท้ายสองตัวมาจาก ordersทั้งหมด
app.get("/LastTwoDigitOrder/:id", (req,res) => {
        console.log("Body:",req.body);
        const user_id = req.params.id;
    try {
        connection.query(
            `SELECT RIGHT(number,2) AS last_two_digits,o.order_id,o.lotto_id 
             FROM orders o JOIN lottery l ON o.lotto_id = l.lotto_id 
             WHERE o.status = 1 AND o.user_id = ?`,
            [user_id],
            (err,results,fields) => {

        if (err) {
            console.log("Error while Get DigitOrder on Database!");
            return res.status(400).send();
        }
        res.status(200).json(results)
    }
        )
    } catch (error) {
        console.log(error)
        return res.status(500).send();
    };

});

// SELECT เอาเลขสองตัวท้ายของ no = 5 จาก reward
app.get("/getLastTwoDigit", (req,res) => {
        console.log("Body:",req.body);

    try {
        connection.query(
            "SELECT RIGHT(number_reward,2) AS last_two_digits,price_reward,no  FROM reward WHERE no = 5",
            (err,results,fields) => {

        if (err) {
            console.log("Error while Get Last Two digit on Database!");
            return res.status(400).send();
        }
        res.status(200).json(results)
    }
        )
    } catch (error) {
        console.log(error)
        return res.status(500).send();
    };

});


//ถ้ารางวัลตรงกันจะมีการอัปเดต ststus = 2
app.put("/updateMylotto", (req,res) => {
    console.log ("Body updateMylotto :",req.body);
    

    const {order_id, status} = req.body;
    console.log("order_id:", order_id, "status:", status);

    try {
         connection.query(
        "UPDATE orders SET status = ? WHERE order_id = ?",
        [ status,order_id],
        (err, results,fields) => {
            if (err) {
                console.log("Error while update status My Lottery in the database",err);
                return res.status(400).send();
            }
            return res.status(201).json ({ message: "Update status successfully !"});
        }
    )
        
    } catch (error) {
        console.log(error);
        return res.status(500).status();
    }
   

})

//ถ้ารางวัลตรงกันจะมีการอัปเดต no ให้ตรงกับรางวัลที่ได้
app.put("/updateOrder",(req,res) => {
    console.log("Body: ",req.body);
    const {lotto_id,no} = req.body;
    try{
    connection.query(
        "UPDATE orders SET no = ? WHERE lotto_id = ?",
        [no,lotto_id],
        (err,results,fields) => {
            if(err){
                console.log("Error while inserting a update no into the database",err);
                return res.status(400).send();
            }
            return res.status(201).json({message: "Update no successfully !"});
        }
    )
} catch(error){
    console.log(error);
    return res.status(500).send();
}
})


//อัปเดต status ที่ขึ้นเงินแล้ว
app.put("/updateGetMoney",(req,res) => {
    console.log("Body: ",req.body);
    const {lotto_id,status} = req.body;
    try{
    connection.query(
        "UPDATE orders SET status = ? WHERE lotto_id = ? AND status = 2",
        [status,lotto_id],
        (err,results,fields) => {
            if(err){
                console.log("Error while inserting a update status in orders on the database",err);
                return res.status(400).send();
            }
            return res.status(201).json({message: "Update no successfully !"});
        }
    )
} catch(error){
    console.log(error);
    return res.status(500).send();
}
})



/*------------------- Admin -------------------*/


//ดึงข้อมูลรางวัลทั้งหมด
app.get("/reward", (req, res) => {
    console.log("Body:", req.body);
    try {
        connection.query("SELECT * FROM reward", (err, results, fields) => {
            if (err) {
                console.log(err);
                return res.status(400).send();
            }
            res.status(200).json(results)
        })
    } catch(err) {
        console.log(err);
        return res.status(500).send();
    }
})

// แรนด้อมล็อตโตจาก lottery ทั้งหมด
app.get("/randomReward", (req, res) => {
    console.log("Body: ",req.body);

    try {
        connection.query("SELECT * FROM lottery ORDER BY RAND() LIMIT 1;", (err, results, fields) => {
            if (err) {
                console.log(err);
                return res.status(400).send();
            }
            res.status(200).json(results)
        })
    } catch(err) {
        console.log(err);
        return res.status(500).send();
    }
})

//เพิ่มข้อมูลลงใน reward
app.post("/addReward", async  (req, res) => {
    console.log(" POST /addReward called");
    console.log("Body:", req.body);

    const { no, lotto_id, number_reward, price_reward } = req.body; //ดึงค่า


    try {
        connection.query(
            "INSERT INTO reward(no, lotto_id, number_reward, price_reward) VALUES(?, ?, ?, ?)",
            [no, lotto_id, number_reward, price_reward ],
            (err, results, fields) => {
                if (err) {
                    console.log("Error while inserting a add reward into the database", err);
                    return res.status(400).send();
                }
                return res.status(201).json({ message: "Add Reward successfully!"});
            }
        )
    } catch(err) {
        console.log(err);
        return res.status(500).send();
    }
})

//จำลองข้อมูล
app.post("/randomLotto", (req, res) => {
    console.log(" POST /create called");
    console.log("Body:", req.body);

    const { uniqueNumbers, price } = req.body;
    try {
        let insertedCount = 0;

        uniqueNumbers.forEach(num => {
            connection.query(
                "INSERT INTO lottery(number, price) VALUES(?, ?)",
                [num, price],
                (err, results, fields) => {
                    if (err) {
                        console.log("Error while inserting a number:", err);
                        return res.status(400).send();
                    }

                    insertedCount++;

                    // ถ้า insert ครบทุกเลขแล้วส่ง response
                    if (insertedCount === uniqueNumbers.length) {
                        return res.status(201).json({ message: "Random Lotto numbers successfully inserted!" });
                    }
                }
            );
        });
    }  catch(err) {
        console.log(err);
        return res.status(500).send();
    }
})


app.get("/getLastThreeDigit", (req,res) => {
    console.log("Body:",req.body);

    try {
        connection.query(
            "SELECT  RIGHT(number_reward,3) AS last_three_digits, lotto_id FROM reward WHERE no = 1",
            (err,results,fields) => {
            if (err) {
                console.log("Error while Get Last 3 digit on Database !",err.sqlMessage)
                return res.status(400).send(err.sqlMessage);
            }
            res.status(200).json(results)
            }
        )
    } catch (error) {
        console.log(error)
        return res.status(500).send();
    }
    
})









app.get("/orders", (req, res) => {
    // console.log("Body:", req.body);
    try {
        connection.query("SELECT * FROM orders", (err, results, fields) => {
            if (err) {
                console.log(err);
                return res.status(400).send();
            }
            res.status(200).json(results)
        })
    } catch(err) {
        console.log(err);
        return res.status(500).send();
    }
})




//รีเซ็ต
app.delete("/delete", (req, res) => {
  connection.query("TRUNCATE TABLE lottery", (err) => {
    if (err) return res.status(500).send({ error: "Lottery truncate failed" });

    connection.query("TRUNCATE TABLE reward", (err) => {
      if (err) return res.status(500).send({ error: "Reward truncate failed" });

      connection.query("TRUNCATE TABLE orders", (err) => {
        if (err) return res.status(500).send({ error: "Orders truncate failed" });

        res.send({ message: "Deleted all tables successfully!" });
      });
    });
  });
});









app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));